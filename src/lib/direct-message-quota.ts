import { Prisma } from '@prisma/client';
import { addMonths, subMonths } from 'date-fns';
import { normalizeSubscriptionPlan, getPricingPlanKey } from './plan-utils';
import { prisma } from './prisma';
import { PRICING_PLANS } from './stripe';
import { isSubscriptionCurrentlyActive } from './subscription';

const COUNTED_DIRECT_MESSAGE_STATUSES = ['queued', 'sent'] as const;
const SERIALIZABLE_RETRY_LIMIT = 2;

const directMessageQuotaBusinessSelect = {
  id: true,
  createdAt: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  stripeCurrentPeriodEnd: true,
} as const;

type DirectMessageQuotaBusiness = {
  id: string;
  createdAt: Date;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  stripeCurrentPeriodEnd: Date | null;
};

type QuotaReadClient = {
  business: {
    findUnique: typeof prisma.business.findUnique;
  };
  smsLog: {
    count: typeof prisma.smsLog.count;
    create: typeof prisma.smsLog.create;
  };
};

export type DirectMessageQuotaSnapshot = {
  plan: ReturnType<typeof normalizeSubscriptionPlan>;
  limit: number;
  used: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
  isActive: boolean;
};

export type DirectMessageQuotaReservation =
  | {
      allowed: true;
      logId: string;
      quota: DirectMessageQuotaSnapshot;
    }
  | {
      allowed: false;
      code: 'BUSINESS_NOT_FOUND' | 'SUBSCRIPTION_REQUIRED' | 'DIRECT_MESSAGE_LIMIT_REACHED';
      error: string;
      quota?: DirectMessageQuotaSnapshot;
    };

export function getDirectMessagePlanLimit(plan: string | null | undefined): number {
  const planKey = getPricingPlanKey(plan);
  const resolvedPlan = planKey ? PRICING_PLANS[planKey] : PRICING_PLANS.STARTER;
  return resolvedPlan.limits.directMessages;
}

export function getDirectMessageQuotaWindow(
  business: DirectMessageQuotaBusiness,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  if (
    business.subscriptionStatus === 'active' &&
    business.stripeCurrentPeriodEnd &&
    new Date(business.stripeCurrentPeriodEnd) > now
  ) {
    const periodEnd = new Date(business.stripeCurrentPeriodEnd);
    return {
      periodStart: subMonths(periodEnd, 1),
      periodEnd,
    };
  }

  let periodStart = new Date(business.createdAt);
  let periodEnd = addMonths(periodStart, 1);

  while (periodEnd <= now) {
    periodStart = periodEnd;
    periodEnd = addMonths(periodEnd, 1);
  }

  return { periodStart, periodEnd };
}

export function buildDirectMessageQuotaSnapshot(
  business: DirectMessageQuotaBusiness,
  used: number,
  now: Date = new Date(),
): DirectMessageQuotaSnapshot {
  const { periodStart, periodEnd } = getDirectMessageQuotaWindow(business, now);
  const limit = getDirectMessagePlanLimit(business.subscriptionPlan);

  return {
    plan: normalizeSubscriptionPlan(business.subscriptionPlan),
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    periodStart,
    periodEnd,
    isActive: isSubscriptionCurrentlyActive(
      business.subscriptionStatus,
      business.trialEndsAt,
      now,
    ),
  };
}

async function fetchQuotaBusiness(client: QuotaReadClient, businessId: string) {
  return client.business.findUnique({
    where: { id: businessId },
    select: directMessageQuotaBusinessSelect,
  });
}

async function countDirectMessagesInWindow(
  client: QuotaReadClient,
  businessId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return client.smsLog.count({
    where: {
      businessId,
      messageType: 'custom',
      status: { in: [...COUNTED_DIRECT_MESSAGE_STATUSES] },
      createdAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  });
}

export async function getDirectMessageQuotaStatus(
  businessId: string,
  now: Date = new Date(),
) {
  const business = await fetchQuotaBusiness(prisma, businessId);

  if (!business) {
    return null;
  }

  const { periodStart, periodEnd } = getDirectMessageQuotaWindow(business, now);
  const used = await countDirectMessagesInWindow(prisma, business.id, periodStart, periodEnd);

  return buildDirectMessageQuotaSnapshot(business, used, now);
}

function isRetryableSerializationError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function runSerializableQuotaTransaction<T>(
  work: () => Promise<T>,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await work();
    } catch (error) {
      if (!isRetryableSerializationError(error) || attempt >= SERIALIZABLE_RETRY_LIMIT) {
        throw error;
      }

      attempt += 1;
    }
  }
}

export async function reserveDirectMessageQuota(args: {
  businessId: string;
  toPhone: string;
  message: string;
  now?: Date;
}): Promise<DirectMessageQuotaReservation> {
  const { businessId, toPhone, message, now = new Date() } = args;

  return runSerializableQuotaTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const business = await fetchQuotaBusiness(tx, businessId);

        if (!business) {
          return {
            allowed: false as const,
            code: 'BUSINESS_NOT_FOUND' as const,
            error: 'Business not found',
          };
        }

        const { periodStart, periodEnd } = getDirectMessageQuotaWindow(business, now);
        const used = await countDirectMessagesInWindow(tx, business.id, periodStart, periodEnd);
        const snapshot = buildDirectMessageQuotaSnapshot(business, used, now);

        if (!snapshot.isActive) {
          return {
            allowed: false as const,
            code: 'SUBSCRIPTION_REQUIRED' as const,
            error: 'Active subscription required',
            quota: snapshot,
          };
        }

        if (snapshot.remaining <= 0) {
          return {
            allowed: false as const,
            code: 'DIRECT_MESSAGE_LIMIT_REACHED' as const,
            error: 'Monthly direct message limit reached for this subscription period',
            quota: snapshot,
          };
        }

        const log = await tx.smsLog.create({
          data: {
            businessId,
            toPhone,
            message,
            messageType: 'custom',
            status: 'queued',
          },
        });

        return {
          allowed: true as const,
          logId: log.id,
          quota: {
            ...snapshot,
            used: snapshot.used + 1,
            remaining: Math.max(snapshot.remaining - 1, 0),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function finalizeDirectMessageQuotaReservation(args: {
  logId: string;
  success: boolean;
  sid?: string | null;
  error?: string | null;
}) {
  const { logId, success, sid, error } = args;

  return prisma.smsLog.update({
    where: { id: logId },
    data: {
      status: success ? 'sent' : 'failed',
      twilioSid: sid ?? null,
      errorMessage: error ?? null,
    },
  });
}
