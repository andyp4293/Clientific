import { Prisma } from '@prisma/client';
import { buildPromotionSmsAudienceWhere, normalizeCustomerGroupIds } from '@/lib/customer-groups';
import { normalizeOptionalPhoneNumber } from '@/lib/phone';
import { prisma } from '@/lib/prisma';
import { appendSmsComplianceFooter, sendSMS } from '@/lib/twilio';

export const CUSTOMER_BROADCAST_MAX_MESSAGE_LENGTH = 500;
export const CUSTOMER_BROADCAST_MESSAGE_TYPE = 'customer_broadcast';
const CUSTOMER_BROADCAST_BATCH_SIZE = 5;

export type CustomerBroadcastTarget = 'all' | 'groups';

export type CustomerBroadcastGroup = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
};

export type CustomerBroadcastAudienceSummary = {
  target: CustomerBroadcastTarget;
  selectedGroups: CustomerBroadcastGroup[];
  eligibleCount: number;
  skippedDuplicateCount: number;
  skippedInvalidPhoneCount: number;
  disabledGroupCount: number;
  recipientsPreview: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
};

export type CustomerBroadcastSendResult = CustomerBroadcastAudienceSummary & {
  dryRun: boolean;
  sent: number;
  failed: number;
};

type BroadcastCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export function normalizeCustomerBroadcastTarget(value: unknown): CustomerBroadcastTarget {
  return value === 'groups' ? 'groups' : 'all';
}

export function normalizeCustomerBroadcastMessage(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatCustomerBroadcastSms(args: {
  businessName: string;
  message: string;
}) {
  return appendSmsComplianceFooter(`${args.businessName}: ${args.message.trim()}`);
}

export function buildCustomerBroadcastAudienceWhere(args: {
  businessId: string;
  groupIds?: string[];
}): Prisma.CustomerWhereInput {
  const baseWhere = buildPromotionSmsAudienceWhere(args.businessId);
  const groupIds = normalizeCustomerGroupIds(args.groupIds ?? []);

  if (groupIds.length === 0) {
    return baseWhere;
  }

  return {
    AND: [
      baseWhere,
      {
        groupMemberships: {
          some: {
            groupId: { in: groupIds },
            group: {
              businessId: args.businessId,
              promotionSmsEnabled: true,
            },
          },
        },
      },
    ],
  };
}

async function resolveSelectedGroups(args: {
  businessId: string;
  target: CustomerBroadcastTarget;
  groupIds: string[];
}) {
  if (args.target !== 'groups') {
    return [] as CustomerBroadcastGroup[];
  }

  if (args.groupIds.length === 0) {
    throw new CustomerBroadcastValidationError('Select at least one customer group');
  }

  const groups = await prisma.customerGroup.findMany({
    where: {
      businessId: args.businessId,
      id: { in: args.groupIds },
    },
    select: {
      id: true,
      name: true,
      promotionSmsEnabled: true,
    },
    orderBy: { name: 'asc' },
  });

  if (groups.length !== args.groupIds.length) {
    throw new CustomerBroadcastValidationError('One or more selected groups could not be found');
  }

  return groups;
}

function dedupeBroadcastRecipients(customers: BroadcastCustomer[]) {
  const seenPhones = new Set<string>();
  let skippedDuplicateCount = 0;
  let skippedInvalidPhoneCount = 0;
  const recipients: Array<{ id: string; name: string; phone: string }> = [];

  customers.forEach((customer) => {
    const phone = normalizeOptionalPhoneNumber(customer.phone);

    if (!phone) {
      skippedInvalidPhoneCount += 1;
      return;
    }

    if (seenPhones.has(phone)) {
      skippedDuplicateCount += 1;
      return;
    }

    seenPhones.add(phone);
    recipients.push({
      id: customer.id,
      name: customer.name,
      phone,
    });
  });

  return {
    recipients,
    skippedDuplicateCount,
    skippedInvalidPhoneCount,
  };
}

export class CustomerBroadcastValidationError extends Error {
  status = 400;
}

export async function getCustomerBroadcastAudience(args: {
  businessId: string;
  target: CustomerBroadcastTarget;
  groupIds?: string[];
}): Promise<CustomerBroadcastAudienceSummary & {
  recipients: Array<{ id: string; name: string; phone: string }>;
}> {
  const groupIds = normalizeCustomerGroupIds(args.groupIds ?? []);
  const selectedGroups = await resolveSelectedGroups({
    businessId: args.businessId,
    target: args.target,
    groupIds,
  });

  const customers = await prisma.customer.findMany({
    where: buildCustomerBroadcastAudienceWhere({
      businessId: args.businessId,
      groupIds: args.target === 'groups' ? groupIds : [],
    }),
    select: {
      id: true,
      name: true,
      phone: true,
    },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  });

  const {
    recipients,
    skippedDuplicateCount,
    skippedInvalidPhoneCount,
  } = dedupeBroadcastRecipients(customers);

  return {
    target: args.target,
    selectedGroups,
    eligibleCount: recipients.length,
    skippedDuplicateCount,
    skippedInvalidPhoneCount,
    disabledGroupCount: selectedGroups.filter((group) => !group.promotionSmsEnabled).length,
    recipientsPreview: recipients.slice(0, 5),
    recipients,
  };
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }

  return results;
}

export async function sendCustomerBroadcast(args: {
  businessId: string;
  businessName: string;
  target: CustomerBroadcastTarget;
  groupIds?: string[];
  message: string;
}): Promise<CustomerBroadcastSendResult> {
  const audience = await getCustomerBroadcastAudience({
    businessId: args.businessId,
    target: args.target,
    groupIds: args.groupIds,
  });
  const { recipients, ...summary } = audience;

  const message = formatCustomerBroadcastSms({
    businessName: args.businessName,
    message: args.message,
  });

  const results = await mapInBatches(
    recipients,
    CUSTOMER_BROADCAST_BATCH_SIZE,
    async (recipient) => {
      const smsResult = await sendSMS({
        to: recipient.phone,
        message,
      });

      return {
        recipient,
        smsResult,
      };
    },
  );

  if (results.length > 0) {
    await prisma.smsLog.createMany({
      data: results.map(({ recipient, smsResult }) => ({
        businessId: args.businessId,
        toPhone: recipient.phone,
        message,
        messageType: CUSTOMER_BROADCAST_MESSAGE_TYPE,
        status: smsResult.success ? 'sent' : 'failed',
        twilioSid: smsResult.sid ?? null,
        errorMessage: smsResult.error ?? null,
      })),
    });
  }

  return {
    ...summary,
    dryRun: false,
    sent: results.filter((result) => result.smsResult.success).length,
    failed: results.filter((result) => !result.smsResult.success).length,
  };
}
