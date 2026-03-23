import { prisma } from '@/lib/prisma';
import { formatPhoneNumber } from '@/lib/twilio';
import { buildCustomerPhoneData, buildCustomerPhoneMatchClauses } from '@/lib/phone';

const DEAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type ClaimDealOptions = {
  dealId: string;
  businessId?: string;
  customerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
};

type ClaimableDeal = {
  id: string;
  businessId: string;
  title: string;
  startsAt: Date;
  expiresAt: Date;
  active: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
};

export type ClaimedDealResult = {
  code: string;
  created: boolean;
  customerId: string | null;
  deal: ClaimableDeal;
  expiresAt: Date;
};

export class DealClaimError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DealClaimError';
    this.status = status;
  }
}

function generateDealCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += DEAL_CODE_ALPHABET[Math.floor(Math.random() * DEAL_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueDealCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateDealCode();
    const existing = await prisma.dealRedemption.findUnique({ where: { code } });
    if (!existing) return code;
  }

  throw new DealClaimError('Failed to generate a unique deal code', 500);
}

type ResolvedCustomer = {
  id: string;
  name: string;
};

function normalizeCustomerPhone(customerPhone: string | null | undefined): string | null {
  const rawPhone = customerPhone?.trim();
  if (!rawPhone) return null;
  return formatPhoneNumber(rawPhone);
}

async function findExistingCustomer(
  businessId: string,
  customerPhone: string | null | undefined
): Promise<ResolvedCustomer | null> {
  const rawPhone = customerPhone?.trim();
  if (!rawPhone) return null;

  const normalizedPhone = formatPhoneNumber(rawPhone);
  const customer = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: buildCustomerPhoneMatchClauses(rawPhone),
    },
    select: { id: true, name: true },
  });

  return customer ?? null;
}

async function updateCustomerNameIfNeeded(
  customerId: string,
  existingName: string,
  customerName: string | null | undefined
): Promise<void> {
  const trimmedName = customerName?.trim();
  if (!trimmedName || trimmedName === existingName) {
    return;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: trimmedName,
      smsConsent: true,
    },
  });
}

async function createCustomerForDealClaim(
  businessId: string,
  customerPhone: string,
  customerName: string
): Promise<string> {
  const customerPhoneData = buildCustomerPhoneData(customerPhone);
  const customer = await prisma.customer.create({
    data: {
      businessId,
      name: customerName,
      phone: customerPhoneData.phone,
      phoneLookupKey: customerPhoneData.phoneLookupKey,
      smsConsent: true,
      smsMarketingConsent: false,
    },
    select: { id: true },
  });

  return customer.id;
}

export async function claimDealForCustomer({
  dealId,
  businessId,
  customerId,
  customerPhone,
  customerName,
}: ClaimDealOptions): Promise<ClaimedDealResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      businessId: true,
      title: true,
      startsAt: true,
      expiresAt: true,
      active: true,
      maxRedemptions: true,
      redemptionCount: true,
    },
  });

  if (!deal || !deal.active || (businessId && deal.businessId !== businessId)) {
    throw new DealClaimError('Deal not found or inactive', 404);
  }

  const now = new Date();
  if (deal.startsAt > now || deal.expiresAt <= now) {
    throw new DealClaimError('Deal is not currently active', 400);
  }

  const normalizedCustomerPhone = normalizeCustomerPhone(customerPhone);
  let resolvedCustomerId = customerId ?? null;

  if (!resolvedCustomerId && normalizedCustomerPhone) {
    const existingCustomer = await findExistingCustomer(deal.businessId, customerPhone);
    if (existingCustomer) {
      resolvedCustomerId = existingCustomer.id;
      await updateCustomerNameIfNeeded(existingCustomer.id, existingCustomer.name, customerName);
    }
  }

  if (resolvedCustomerId) {
    const existingRedemption = await prisma.dealRedemption.findFirst({
      where: {
        dealId: deal.id,
        customerId: resolvedCustomerId,
      },
      select: { code: true },
    });

    if (existingRedemption) {
      return {
        code: existingRedemption.code,
        created: false,
        customerId: resolvedCustomerId,
        deal,
        expiresAt: deal.expiresAt,
      };
    }
  }

  if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
    throw new DealClaimError('Deal has reached maximum redemptions', 400);
  }

  if (!resolvedCustomerId && normalizedCustomerPhone) {
    const trimmedCustomerName = customerName?.trim();
    if (trimmedCustomerName) {
      resolvedCustomerId = await createCustomerForDealClaim(
        deal.businessId,
        normalizedCustomerPhone,
        trimmedCustomerName
      );
    }
  }

  const code = await generateUniqueDealCode();
  const [redemption] = await prisma.$transaction([
    prisma.dealRedemption.create({
      data: {
        dealId: deal.id,
        customerId: resolvedCustomerId,
        code,
      },
    }),
    prisma.deal.update({
      where: { id: deal.id },
      data: { redemptionCount: { increment: 1 } },
    }),
  ]);

  return {
    code: redemption.code,
    created: true,
    customerId: resolvedCustomerId,
    deal,
    expiresAt: deal.expiresAt,
  };
}
