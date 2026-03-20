import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const TRANSFER_STATUS_PENDING = 'pending';
const TRANSFER_STATUS_FAILED = 'failed';
const TRANSFER_STATUS_TRANSFERRED = 'transferred';

export type ReferralPayoutSummary = {
  lifetimeEarned: number;
  pendingTransfer: number;
  transferredToConnect: number;
  pendingCount: number;
  transferredCount: number;
  lastTransferredAt: string | null;
};

function dollarsToCents(amountDollars: number) {
  return Math.round(amountDollars * 100);
}

function normalizeTransferFailureReason(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : 'Unknown Stripe transfer failure';

  return message.slice(0, 500);
}

export function emptyReferralPayoutSummary(): ReferralPayoutSummary {
  return {
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    lastTransferredAt: null,
  };
}

export async function recordReferralCommission(params: {
  referralId: string;
  referrerId: string;
  stripeInvoiceId: string;
  commissionCents: number;
}) {
  const { referralId, referrerId, stripeInvoiceId, commissionCents } = params;

  if (commissionCents <= 0) {
    return { created: false, duplicate: false, amountCents: 0 };
  }

  const existing = await prisma.referralCommission.findUnique({
    where: { stripeInvoiceId },
  });

  if (existing) {
    return {
      created: false,
      duplicate: true,
      amountCents: dollarsToCents(existing.amountDollars),
    };
  }

  const commissionDollars = commissionCents / 100;

  await prisma.$transaction([
    prisma.referralCommission.create({
      data: {
        referralId,
        stripeInvoiceId,
        amountDollars: commissionDollars,
      },
    }),
    prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'active',
        creditedAt: new Date(),
        creditAmount: { increment: commissionDollars },
      },
    }),
    prisma.business.update({
      where: { id: referrerId },
      data: {
        referralCredits: { increment: commissionDollars },
      },
    }),
  ]);

  return {
    created: true,
    duplicate: false,
    amountCents: commissionCents,
  };
}

export async function settlePendingReferralCommissions(params: {
  businessId: string;
  connectAccountId: string;
}) {
  const { businessId, connectAccountId } = params;

  const pendingCommissions = await prisma.referralCommission.findMany({
    where: {
      transferStatus: {
        in: [TRANSFER_STATUS_PENDING, TRANSFER_STATUS_FAILED],
      },
      referral: {
        referrerId: businessId,
      },
    },
    select: {
      id: true,
      stripeInvoiceId: true,
      amountDollars: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let transferredAmount = 0;
  let transferredCount = 0;

  for (const commission of pendingCommissions) {
    const amount = dollarsToCents(commission.amountDollars);

    if (amount <= 0) {
      await prisma.referralCommission.update({
        where: { id: commission.id },
        data: {
          transferStatus: TRANSFER_STATUS_TRANSFERRED,
          transferredAt: new Date(),
          transferFailureReason: null,
        },
      });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount,
          currency: 'usd',
          destination: connectAccountId,
          description: 'Referral commission payout',
          metadata: {
            referralCommissionId: commission.id,
            referrerBusinessId: businessId,
            stripeInvoiceId: commission.stripeInvoiceId,
          },
        },
        {
          idempotencyKey: `referral-commission-${commission.id}`,
        }
      );

      await prisma.referralCommission.update({
        where: { id: commission.id },
        data: {
          transferStatus: TRANSFER_STATUS_TRANSFERRED,
          stripeTransferId: transfer.id,
          transferredAt: new Date(),
          transferFailureReason: null,
        },
      });

      transferredAmount += amount;
      transferredCount += 1;
    } catch (error) {
      await prisma.referralCommission.update({
        where: { id: commission.id },
        data: {
          transferStatus: TRANSFER_STATUS_FAILED,
          transferFailureReason: normalizeTransferFailureReason(error),
        },
      });
    }
  }

  return {
    transferredAmount,
    transferredCount,
  };
}

export async function getReferralPayoutSummary(
  businessId: string
): Promise<ReferralPayoutSummary> {
  const commissions = await prisma.referralCommission.findMany({
    where: {
      referral: {
        referrerId: businessId,
      },
    },
    select: {
      amountDollars: true,
      transferStatus: true,
      transferredAt: true,
    },
  });

  if (!commissions.length) {
    return emptyReferralPayoutSummary();
  }

  let lifetimeEarned = 0;
  let pendingTransfer = 0;
  let transferredToConnect = 0;
  let pendingCount = 0;
  let transferredCount = 0;
  let lastTransferredAt: string | null = null;

  for (const commission of commissions) {
    const amount = dollarsToCents(commission.amountDollars);
    lifetimeEarned += amount;

    if (commission.transferStatus === TRANSFER_STATUS_TRANSFERRED) {
      transferredToConnect += amount;
      transferredCount += 1;
      if (
        commission.transferredAt &&
        (!lastTransferredAt || commission.transferredAt.toISOString() > lastTransferredAt)
      ) {
        lastTransferredAt = commission.transferredAt.toISOString();
      }
      continue;
    }

    pendingTransfer += amount;
    pendingCount += 1;
  }

  return {
    lifetimeEarned,
    pendingTransfer,
    transferredToConnect,
    pendingCount,
    transferredCount,
    lastTransferredAt,
  };
}

export function canAutoTransferReferralPayouts(
  business:
    | {
        stripeConnectAccountId: string | null;
        stripeConnectChargesEnabled: boolean;
        stripeConnectPayoutsEnabled: boolean;
        stripeConnectDetailsSubmitted: boolean;
      }
    | null
    | undefined
) {
  return Boolean(
    business?.stripeConnectAccountId &&
      business.stripeConnectChargesEnabled &&
      business.stripeConnectPayoutsEnabled &&
      business.stripeConnectDetailsSubmitted
  );
}
