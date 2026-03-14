import { prisma } from '@/lib/prisma';
import { formatPhoneNumber } from '@/lib/twilio';

const DEAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type ClaimDealOptions = {
  dealId: string;
  businessId?: string;
  customerId?: string | null;
  customerPhone?: string | null;
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

async function resolveCustomerId(
  businessId: string,
  customerPhone: string | null | undefined
): Promise<string | null> {
  const rawPhone = customerPhone?.trim();
  if (!rawPhone) return null;

  const normalizedPhone = formatPhoneNumber(rawPhone);
  const customer = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: [{ phone: normalizedPhone }, { phone: rawPhone }],
    },
    select: { id: true },
  });

  return customer?.id ?? null;
}

export async function claimDealForCustomer({
  dealId,
  businessId,
  customerId,
  customerPhone,
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

  if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
    throw new DealClaimError('Deal has reached maximum redemptions', 400);
  }

  const resolvedCustomerId =
    customerId ?? (await resolveCustomerId(deal.businessId, customerPhone));

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
