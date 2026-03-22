import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const DEAL_PAYOUT_STATUS_PENDING = 'pending';
const DEAL_PAYOUT_STATUS_FAILED = 'failed';
const DEAL_PAYOUT_STATUS_TRANSFERRED = 'transferred';
const DEAL_PAYOUT_STATUS_AUTOMATIC = 'automatic';

export type DealPayoutSummary = {
  lifetimeEarned: number;
  pendingTransfer: number;
  transferredToConnect: number;
  pendingCount: number;
  transferredCount: number;
  automaticCount: number;
  lastTransferredAt: string | null;
};

export type DealTransferRetrySummary = {
  eligibleBusinesses: number;
  transferredAmount: number;
  transferredCount: number;
  automaticCount: number;
  failedCount: number;
};

type DealPurchasePayoutCandidate = {
  id: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  businessNetAmount: number;
  currency: string;
  payoutTransferStatus: string | null;
  payoutTransferredAt: Date | null;
};

type StripePayoutRouting = {
  chargeId: string | null;
  automaticDestinationAccountId: string | null;
};

async function listTransfersForDestination(destinationAccountId: string) {
  const transfers: Stripe.Transfer[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await stripe.transfers.list({
      destination: destinationAccountId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    transfers.push(...page.data);

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
  } while (startingAfter);

  return transfers;
}

function normalizeTransferFailureReason(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : 'Unknown Stripe transfer failure';

  return message.slice(0, 500);
}

function normalizeDestinationAccountId(
  destination: string | Stripe.Account | null | undefined
) {
  if (!destination) {
    return null;
  }

  return typeof destination === 'string' ? destination : destination.id;
}

export function emptyDealPayoutSummary(): DealPayoutSummary {
  return {
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    automaticCount: 0,
    lastTransferredAt: null,
  };
}

function hasActiveConnectMoneyMovement(
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

export function canAutoTransferDealPayouts(
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
  return hasActiveConnectMoneyMovement(business);
}

async function inspectPaymentIntentRouting(
  paymentIntentId: string
): Promise<StripePayoutRouting> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge', 'transfer_data.destination'],
  });

  const latestCharge =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id ?? null;
  const destination =
    normalizeDestinationAccountId(paymentIntent.transfer_data?.destination);

  return {
    chargeId: latestCharge,
    automaticDestinationAccountId: destination,
  };
}

async function inspectChargeRouting(chargeId: string): Promise<StripePayoutRouting> {
  const charge = await stripe.charges.retrieve(chargeId);
  const destination =
    normalizeDestinationAccountId(charge.transfer_data?.destination);

  return {
    chargeId: charge.id,
    automaticDestinationAccountId: destination,
  };
}

async function inspectPurchasePayoutRouting(
  purchase: Pick<DealPurchasePayoutCandidate, 'stripePaymentIntentId' | 'stripeChargeId'>
): Promise<StripePayoutRouting> {
  if (purchase.stripePaymentIntentId) {
    return inspectPaymentIntentRouting(purchase.stripePaymentIntentId);
  }

  if (purchase.stripeChargeId) {
    return inspectChargeRouting(purchase.stripeChargeId);
  }

  return {
    chargeId: null,
    automaticDestinationAccountId: null,
  };
}

export async function syncDealPurchasePayoutTracking(params: {
  purchaseId: string;
  paymentIntentId?: string | null;
  paymentIntent?: Stripe.PaymentIntent | null;
}) {
  const purchase = await prisma.dealPurchase.findUnique({
    where: { id: params.purchaseId },
    select: {
      id: true,
      stripeChargeId: true,
      stripePaymentIntentId: true,
      businessNetAmount: true,
      payoutTransferStatus: true,
      payoutTransferredAt: true,
    },
  });

  if (!purchase || purchase.businessNetAmount <= 0) {
    return;
  }

  let routing: StripePayoutRouting = {
    chargeId: purchase.stripeChargeId,
    automaticDestinationAccountId: null,
  };

  if (params.paymentIntent) {
    routing = {
      chargeId:
        typeof params.paymentIntent.latest_charge === 'string'
          ? params.paymentIntent.latest_charge
          : params.paymentIntent.latest_charge?.id ?? purchase.stripeChargeId,
      automaticDestinationAccountId:
        normalizeDestinationAccountId(params.paymentIntent.transfer_data?.destination),
    };
  } else if (params.paymentIntentId || purchase.stripePaymentIntentId || purchase.stripeChargeId) {
    routing = await inspectPurchasePayoutRouting({
      stripePaymentIntentId: params.paymentIntentId ?? purchase.stripePaymentIntentId,
      stripeChargeId: purchase.stripeChargeId,
    });
  }

  const data: Record<string, unknown> = {};
  const resolvedChargeId = routing.chargeId ?? purchase.stripeChargeId;

  if (resolvedChargeId && resolvedChargeId !== purchase.stripeChargeId) {
    data.stripeChargeId = resolvedChargeId;
  }

  if (routing.automaticDestinationAccountId) {
    data.payoutTransferStatus = DEAL_PAYOUT_STATUS_AUTOMATIC;
    data.payoutTransferredAt = purchase.payoutTransferredAt ?? new Date();
    data.payoutTransferFailureReason = null;
  } else if (
    resolvedChargeId &&
    purchase.payoutTransferStatus !== DEAL_PAYOUT_STATUS_TRANSFERRED &&
    purchase.payoutTransferStatus !== DEAL_PAYOUT_STATUS_AUTOMATIC
  ) {
    data.payoutTransferStatus = DEAL_PAYOUT_STATUS_PENDING;
    data.payoutTransferFailureReason = null;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.dealPurchase.update({
    where: { id: purchase.id },
    data,
  });
}

export async function settlePendingDealPurchasePayouts(params: {
  businessId: string;
  connectAccountId: string;
}) {
  const existingTransfers = await listTransfersForDestination(params.connectAccountId);
  const transferBySourceTransaction = new Map(
    existingTransfers
      .filter(
        (transfer): transfer is Stripe.Transfer & { source_transaction: string } =>
          typeof transfer.source_transaction === 'string'
      )
      .map((transfer) => [transfer.source_transaction, transfer])
  );

  const pendingPurchases = await prisma.dealPurchase.findMany({
    where: {
      businessId: params.businessId,
      status: { in: ['paid', 'redeemed'] },
      businessNetAmount: { gt: 0 },
      OR: [
        { payoutTransferStatus: null },
        { payoutTransferStatus: DEAL_PAYOUT_STATUS_PENDING },
        { payoutTransferStatus: DEAL_PAYOUT_STATUS_FAILED },
      ],
    },
    select: {
      id: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      businessNetAmount: true,
      currency: true,
      payoutTransferStatus: true,
      payoutTransferredAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let transferredAmount = 0;
  let transferredCount = 0;
  let automaticCount = 0;
  let failedCount = 0;

  for (const purchase of pendingPurchases) {
    try {
      const routing = await inspectPurchasePayoutRouting(purchase);
      const chargeId = routing.chargeId ?? purchase.stripeChargeId;

      if (routing.automaticDestinationAccountId) {
        await prisma.dealPurchase.update({
          where: { id: purchase.id },
          data: {
            stripeChargeId: chargeId,
            payoutTransferStatus: DEAL_PAYOUT_STATUS_AUTOMATIC,
            payoutTransferredAt: purchase.payoutTransferredAt ?? new Date(),
            payoutTransferFailureReason: null,
          },
        });
        automaticCount += 1;
        continue;
      }

      if (!chargeId) {
        await prisma.dealPurchase.update({
          where: { id: purchase.id },
          data: {
            payoutTransferStatus: DEAL_PAYOUT_STATUS_FAILED,
            payoutTransferFailureReason:
              'Stripe charge details are still missing for this deal purchase.',
          },
        });
        failedCount += 1;
        continue;
      }

      const existingTransfer = transferBySourceTransaction.get(chargeId);
      if (existingTransfer) {
        await prisma.dealPurchase.update({
          where: { id: purchase.id },
          data: {
            stripeChargeId: chargeId,
            stripeTransferId: existingTransfer.id,
            payoutTransferStatus: DEAL_PAYOUT_STATUS_TRANSFERRED,
            payoutTransferredAt: purchase.payoutTransferredAt ?? new Date(existingTransfer.created * 1000),
            payoutTransferFailureReason: null,
          },
        });
        transferredAmount += purchase.businessNetAmount;
        transferredCount += 1;
        continue;
      }

      const transfer = await stripe.transfers.create(
        {
          amount: purchase.businessNetAmount,
          currency: purchase.currency,
          destination: params.connectAccountId,
          source_transaction: chargeId,
          description: 'Deal purchase payout',
          metadata: {
            dealPurchaseId: purchase.id,
            businessId: params.businessId,
            stripeChargeId: chargeId,
            payoutOrigin: 'deal_purchase_backfill',
          },
        },
        {
          idempotencyKey: `deal-payout-${purchase.id}`,
        }
      );

      await prisma.dealPurchase.update({
        where: { id: purchase.id },
        data: {
          stripeChargeId: chargeId,
          stripeTransferId: transfer.id,
          payoutTransferStatus: DEAL_PAYOUT_STATUS_TRANSFERRED,
          payoutTransferredAt: new Date(),
          payoutTransferFailureReason: null,
        },
      });

      transferBySourceTransaction.set(chargeId, transfer as Stripe.Transfer & { source_transaction: string });

      transferredAmount += purchase.businessNetAmount;
      transferredCount += 1;
    } catch (error) {
      await prisma.dealPurchase.update({
        where: { id: purchase.id },
        data: {
          payoutTransferStatus: DEAL_PAYOUT_STATUS_FAILED,
          payoutTransferFailureReason: normalizeTransferFailureReason(error),
        },
      });
      failedCount += 1;
    }
  }

  return {
    transferredAmount,
    transferredCount,
    automaticCount,
    failedCount,
  };
}

export async function retryPendingDealPurchaseTransfers(): Promise<DealTransferRetrySummary> {
  const eligibleBusinesses = await prisma.business.findMany({
    where: {
      stripeConnectAccountId: {
        not: null,
      },
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
      dealPurchases: {
        some: {
          status: {
            in: ['paid', 'redeemed'],
          },
          businessNetAmount: {
            gt: 0,
          },
          OR: [
            { payoutTransferStatus: null },
            { payoutTransferStatus: DEAL_PAYOUT_STATUS_PENDING },
            { payoutTransferStatus: DEAL_PAYOUT_STATUS_FAILED },
          ],
        },
      },
    },
    select: {
      id: true,
      stripeConnectAccountId: true,
    },
  });

  let transferredAmount = 0;
  let transferredCount = 0;
  let automaticCount = 0;
  let failedCount = 0;

  for (const business of eligibleBusinesses) {
    if (!business.stripeConnectAccountId) {
      continue;
    }

    const result = await settlePendingDealPurchasePayouts({
      businessId: business.id,
      connectAccountId: business.stripeConnectAccountId,
    });

    transferredAmount += result.transferredAmount;
    transferredCount += result.transferredCount;
    automaticCount += result.automaticCount;
    failedCount += result.failedCount;
  }

  return {
    eligibleBusinesses: eligibleBusinesses.length,
    transferredAmount,
    transferredCount,
    automaticCount,
    failedCount,
  };
}

export async function getDealPayoutSummary(
  businessId: string
): Promise<DealPayoutSummary> {
  const purchases = await prisma.dealPurchase.findMany({
    where: {
      businessId,
      status: { in: ['paid', 'redeemed'] },
      businessNetAmount: { gt: 0 },
    },
    select: {
      businessNetAmount: true,
      payoutTransferStatus: true,
      payoutTransferredAt: true,
    },
  });

  if (!purchases.length) {
    return emptyDealPayoutSummary();
  }

  let lifetimeEarned = 0;
  let pendingTransfer = 0;
  let transferredToConnect = 0;
  let pendingCount = 0;
  let transferredCount = 0;
  let automaticCount = 0;
  let lastTransferredAt: string | null = null;

  for (const purchase of purchases) {
    lifetimeEarned += purchase.businessNetAmount;

    if (
      purchase.payoutTransferStatus === DEAL_PAYOUT_STATUS_TRANSFERRED ||
      purchase.payoutTransferStatus === DEAL_PAYOUT_STATUS_AUTOMATIC
    ) {
      transferredToConnect += purchase.businessNetAmount;
      transferredCount += 1;

      if (purchase.payoutTransferStatus === DEAL_PAYOUT_STATUS_AUTOMATIC) {
        automaticCount += 1;
      }

      if (
        purchase.payoutTransferredAt &&
        (!lastTransferredAt || purchase.payoutTransferredAt.toISOString() > lastTransferredAt)
      ) {
        lastTransferredAt = purchase.payoutTransferredAt.toISOString();
      }

      continue;
    }

    pendingTransfer += purchase.businessNetAmount;
    pendingCount += 1;
  }

  return {
    lifetimeEarned,
    pendingTransfer,
    transferredToConnect,
    pendingCount,
    transferredCount,
    automaticCount,
    lastTransferredAt,
  };
}
