import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { REFERRAL_COMMISSION_PERCENT } from './referral-config';

const TRANSFER_STATUS_PENDING = 'pending';
const TRANSFER_STATUS_FAILED = 'failed';
const TRANSFER_STATUS_TRANSFERRED = 'transferred';
export const REFERRAL_TRANSFER_STATUS_WAITING_FOR_STRIPE_BALANCE =
  'waiting_for_stripe_balance';
export const DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS = 45;

export type ReferralPayoutSummary = {
  lifetimeEarned: number;
  pendingTransfer: number;
  transferredToConnect: number;
  pendingCount: number;
  transferredCount: number;
  lastTransferredAt: string | null;
};

export type ReferralReconciliationSummary = {
  since: string;
  scannedInvoices: number;
  matchedReferralInvoices: number;
  createdCommissions: number;
  duplicateInvoices: number;
  skippedWithoutCustomer: number;
  skippedWithoutReferral: number;
  skippedZeroAmount: number;
  skippedNonSubscription: number;
};

type ReferralInvoiceCandidate = {
  id: string;
  amountPaid: number;
  customerId: string | null;
  refereeBusinessId: string | null;
  hasSubscription: boolean;
};

export type ReferralTransferRetrySummary = {
  eligibleBusinesses: number;
  transferredAmount: number;
  transferredCount: number;
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

function normalizeStripeId(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }

  return null;
}

function isStripeBalanceInsufficientError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const stripeError = error as {
    code?: unknown;
    type?: unknown;
    message?: unknown;
  };
  const message = typeof stripeError.message === 'string' ? stripeError.message : '';

  return (
    stripeError.code === 'balance_insufficient' ||
    /insufficient funds|insufficient available balance/i.test(message)
  );
}

export function isRetryableReferralTransferFailureReason(reason: string | null | undefined) {
  return /insufficient funds|insufficient available balance/i.test(reason ?? '');
}

export function getVisibleReferralTransferStatus(
  status: string | null | undefined,
  failureReason?: string | null
) {
  if (
    (status === TRANSFER_STATUS_FAILED || status === TRANSFER_STATUS_PENDING) &&
    isRetryableReferralTransferFailureReason(failureReason)
  ) {
    return REFERRAL_TRANSFER_STATUS_WAITING_FOR_STRIPE_BALANCE;
  }

  return status ?? TRANSFER_STATUS_PENDING;
}

function getInvoiceSourceChargeId(invoice: Stripe.Invoice) {
  const expandedInvoice = invoice as Stripe.Invoice & {
    charge?: string | Stripe.Charge | null;
    payment_intent?:
      | string
      | (Stripe.PaymentIntent & {
          latest_charge?: string | Stripe.Charge | null;
        })
      | null;
  };
  const paymentIntent = expandedInvoice.payment_intent;
  const paymentIntentCharge =
    paymentIntent && typeof paymentIntent === 'object'
      ? normalizeStripeId(paymentIntent.latest_charge)
      : null;

  return paymentIntentCharge ?? normalizeStripeId(expandedInvoice.charge);
}

async function getInvoiceSourceTransactionId(stripeInvoiceId: string) {
  try {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['payment_intent.latest_charge', 'charge'],
    });

    return getInvoiceSourceChargeId(invoice);
  } catch (error) {
    if (isMissingStripeCustomerError(error) || isMissingStripeInvoiceError(error)) {
      return null;
    }

    throw error;
  }
}

async function listReferralTransfersForDestination(destinationAccountId: string) {
  const transferByCommissionId = new Map<string, Stripe.Transfer>();
  let startingAfter: string | undefined;

  do {
    const page = await stripe.transfers.list({
      destination: destinationAccountId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const transfer of page.data) {
      const referralCommissionId = transfer.metadata?.referralCommissionId;
      if (referralCommissionId && !transferByCommissionId.has(referralCommissionId)) {
        transferByCommissionId.set(referralCommissionId, transfer);
      }
    }

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
  } while (startingAfter);

  return transferByCommissionId;
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

function isMissingStripeCustomerError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const stripeError = error as {
    code?: unknown;
    param?: unknown;
  };

  return stripeError.code === 'resource_missing' && stripeError.param === 'customer';
}

function isMissingStripeInvoiceError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const stripeError = error as {
    code?: unknown;
    param?: unknown;
  };

  return stripeError.code === 'resource_missing' && stripeError.param === 'invoice';
}

function emptyReferralReconciliationSummary(since: Date): ReferralReconciliationSummary {
  return {
    since: since.toISOString(),
    scannedInvoices: 0,
    matchedReferralInvoices: 0,
    createdCommissions: 0,
    duplicateInvoices: 0,
    skippedWithoutCustomer: 0,
    skippedWithoutReferral: 0,
    skippedZeroAmount: 0,
    skippedNonSubscription: 0,
  };
}

async function listPaidInvoicesSince(
  since: Date,
  customerId?: string | null
) {
  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await stripe.invoices.list({
      status: 'paid',
      limit: 100,
      created: {
        gte: Math.floor(since.getTime() / 1000),
      },
      ...(customerId ? { customer: customerId } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    invoices.push(...page.data);

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
  } while (startingAfter);

  return invoices;
}

async function listPaidDatabaseInvoicesSince(
  since: Date,
  businessId?: string | null
): Promise<ReferralInvoiceCandidate[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: 'paid',
      createdAt: {
        gte: since,
      },
      ...(businessId ? { businessId } : {}),
    },
    select: {
      stripeInvoiceId: true,
      amount: true,
      businessId: true,
    },
  });

  return invoices.map(invoice => ({
    id: invoice.stripeInvoiceId,
    amountPaid: invoice.amount,
    customerId: null,
    refereeBusinessId: invoice.businessId,
    hasSubscription: true,
  }));
}

function getInvoiceSubscriptionReference(invoice: Stripe.Invoice) {
  const legacyInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  return (
    invoice.parent?.subscription_details?.subscription ??
    legacyInvoice.subscription ??
    null
  );
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
      transferFailureReason: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const existingTransferByCommissionId =
    await listReferralTransfersForDestination(connectAccountId);

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
      const existingTransfer = existingTransferByCommissionId.get(commission.id);
      if (existingTransfer) {
        await prisma.referralCommission.update({
          where: { id: commission.id },
          data: {
            transferStatus: TRANSFER_STATUS_TRANSFERRED,
            stripeTransferId: existingTransfer.id,
            transferredAt: new Date(existingTransfer.created * 1000),
            transferFailureReason: null,
          },
        });
        transferredAmount += amount;
        transferredCount += 1;
        continue;
      }

      const sourceTransaction = await getInvoiceSourceTransactionId(commission.stripeInvoiceId);
      const transfer = await stripe.transfers.create(
        {
          amount,
          currency: 'usd',
          destination: connectAccountId,
          ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
          description: 'Referral commission payout',
          metadata: {
            referralCommissionId: commission.id,
            referrerBusinessId: businessId,
            stripeInvoiceId: commission.stripeInvoiceId,
          },
        },
        {
          idempotencyKey: sourceTransaction
            ? `referral-commission-${commission.id}-source-${sourceTransaction}`
            : `referral-commission-${commission.id}`,
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
      const retryableBalanceError = isStripeBalanceInsufficientError(error);
      await prisma.referralCommission.update({
        where: { id: commission.id },
        data: {
          transferStatus: retryableBalanceError
            ? TRANSFER_STATUS_PENDING
            : TRANSFER_STATUS_FAILED,
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

export async function reconcileReferralCommissions(params?: {
  lookbackDays?: number;
  businessId?: string;
}): Promise<ReferralReconciliationSummary> {
  const lookbackDays =
    params?.lookbackDays ?? DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const summary = emptyReferralReconciliationSummary(since);
  const targetBusiness = params?.businessId
    ? await prisma.business.findUnique({
        where: { id: params.businessId },
        select: {
          id: true,
          stripeCustomerId: true,
        },
      })
    : null;
  let stripeInvoices: Stripe.Invoice[] = [];
  try {
    stripeInvoices = await listPaidInvoicesSince(
      since,
      targetBusiness?.stripeCustomerId ?? null
    );
  } catch (error) {
    if (targetBusiness?.stripeCustomerId && isMissingStripeCustomerError(error)) {
      await prisma.business.update({
        where: { id: targetBusiness.id },
        data: {
          stripeCustomerId: null,
        },
      });
      stripeInvoices = [];
    } else {
      throw error;
    }
  }
  const databaseInvoices = await listPaidDatabaseInvoicesSince(
    since,
    targetBusiness?.id ?? null
  );
  const candidateMap = new Map<string, ReferralInvoiceCandidate>();

  for (const invoice of stripeInvoices) {
    const existing = candidateMap.get(invoice.id);
    candidateMap.set(invoice.id, {
      id: invoice.id,
      amountPaid: invoice.amount_paid,
      customerId: typeof invoice.customer === 'string' ? invoice.customer : null,
      refereeBusinessId: existing?.refereeBusinessId ?? null,
      hasSubscription:
        Boolean(getInvoiceSubscriptionReference(invoice)) || existing?.hasSubscription || false,
    });
  }

  for (const invoice of databaseInvoices) {
    const existing = candidateMap.get(invoice.id);
    candidateMap.set(invoice.id, {
      id: invoice.id,
      amountPaid: existing?.amountPaid ?? invoice.amountPaid,
      customerId: existing?.customerId ?? invoice.customerId,
      refereeBusinessId: invoice.refereeBusinessId,
      hasSubscription: existing?.hasSubscription ?? invoice.hasSubscription,
    });
  }

  const invoices = Array.from(candidateMap.values());

  if (!invoices.length) {
    return summary;
  }

  summary.scannedInvoices = invoices.length;

  const candidateInvoices = invoices.filter(invoice => {
    if (!invoice.customerId && !invoice.refereeBusinessId) {
      summary.skippedWithoutCustomer += 1;
      return false;
    }

    if (invoice.amountPaid <= 0) {
      summary.skippedZeroAmount += 1;
      return false;
    }

    if (!invoice.hasSubscription) {
      summary.skippedNonSubscription += 1;
      return false;
    }

    return true;
  });

  if (!candidateInvoices.length) {
    return summary;
  }

  const customerIds = Array.from(
    new Set(
      candidateInvoices
        .map(invoice => invoice.customerId)
        .filter((customerId): customerId is string => Boolean(customerId))
    )
  );
  const refereeBusinessIds = Array.from(
    new Set(
      candidateInvoices
        .map(invoice => invoice.refereeBusinessId)
        .filter((refereeBusinessId): refereeBusinessId is string => Boolean(refereeBusinessId))
    )
  );

  const referrals = await prisma.referral.findMany({
    where: {
      status: {
        in: ['pending', 'active', 'credited'],
      },
      OR: [
        customerIds.length
          ? {
              referee: {
                stripeCustomerId: {
                  in: customerIds,
                },
              },
            }
          : undefined,
        refereeBusinessIds.length
          ? {
              refereeId: {
                in: refereeBusinessIds,
              },
            }
          : undefined,
      ].filter(Boolean) as any,
    },
    select: {
      id: true,
      referrerId: true,
      refereeId: true,
      referee: {
        select: {
          stripeCustomerId: true,
        },
      },
    },
  });

  const referralByCustomerId = new Map(
    referrals
      .filter(referral => referral.referee.stripeCustomerId)
      .map(referral => [referral.referee.stripeCustomerId as string, referral])
  );
  const referralByBusinessId = new Map(
    referrals.map(referral => [referral.refereeId, referral])
  );

  for (const invoice of candidateInvoices) {
    const referral =
      (invoice.customerId ? referralByCustomerId.get(invoice.customerId) : null) ??
      (invoice.refereeBusinessId ? referralByBusinessId.get(invoice.refereeBusinessId) : null);

    if (!referral) {
      summary.skippedWithoutReferral += 1;
      continue;
    }

    summary.matchedReferralInvoices += 1;

    const result = await recordReferralCommission({
      referralId: referral.id,
      referrerId: referral.referrerId,
      stripeInvoiceId: invoice.id,
      commissionCents: Math.round(invoice.amountPaid * REFERRAL_COMMISSION_PERCENT),
    });

    if (result.created) {
      summary.createdCommissions += 1;
      continue;
    }

    if (result.duplicate) {
      summary.duplicateInvoices += 1;
    }
  }

  return summary;
}

export async function retryPendingReferralTransfers(): Promise<ReferralTransferRetrySummary> {
  const eligibleBusinesses = await prisma.business.findMany({
    where: {
      stripeConnectAccountId: {
        not: null,
      },
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
      referralsMade: {
        some: {
          commissions: {
            some: {
              transferStatus: {
                in: [TRANSFER_STATUS_PENDING, TRANSFER_STATUS_FAILED],
              },
            },
          },
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

  for (const business of eligibleBusinesses) {
    if (!business.stripeConnectAccountId) {
      continue;
    }

    const result = await settlePendingReferralCommissions({
      businessId: business.id,
      connectAccountId: business.stripeConnectAccountId,
    });

    transferredAmount += result.transferredAmount;
    transferredCount += result.transferredCount;
  }

  return {
    eligibleBusinesses: eligibleBusinesses.length,
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
