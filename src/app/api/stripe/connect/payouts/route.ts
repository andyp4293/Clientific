import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import {
  emptyDealPayoutSummary,
  getDealPayoutSummary,
  settlePendingDealPurchasePayouts,
} from '@/lib/deal-payouts';
import {
  emptyReferralPayoutSummary,
  getReferralPayoutSummary,
  reconcileReferralCommissions,
  settlePendingReferralCommissions,
} from '@/lib/referral-payouts';
import {
  fetchConnectPayoutsOverview,
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function withNoStoreHeaders<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(init?.headers ?? {}),
    },
  });
}

function emptyResponse(
  notConnected: boolean,
  referralPayouts = emptyReferralPayoutSummary(),
  dealPayouts = emptyDealPayoutSummary(),
  businessType: string | null = null,
  businessName: string | null = null,
  businessEmail: string | null = null
) {
  const isReferralOnly = businessType === 'Referral Partner';

  return {
    notConnected,
    accountId: null,
    businessName,
    businessEmail,
    businessType,
    isReferralOnly,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    onboardingComplete: false,
    readyForPaidDeals: false,
    bankAccountConnected: false,
    externalAccount: null,
    payoutSchedule: null,
    requirements: {
      currentlyDue: [],
      eventuallyDue: [],
      pastDue: [],
      pendingVerification: [],
      disabledReason: null,
    },
    balances: null,
    payouts: [],
    dealPayouts,
    referralPayouts,
  };
}

async function clearStaleConnectState(businessId: string) {
  await Promise.all([
    prisma.business.update({
      where: { id: businessId },
      data: {
        stripeConnectAccountId: null,
        stripeConnectChargesEnabled: false,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectOnboardedAt: null,
        stripeConnectLastSyncedAt: new Date(),
      },
    }),
    prisma.businessBankAccount.deleteMany({
      where: { businessId },
    }),
  ]);
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return withNoStoreHeaders({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessType: true,
        stripeConnectAccountId: true,
      },
    });

    if (!business) {
      return withNoStoreHeaders({ error: 'Business not found' }, { status: 404 });
    }

    await reconcileReferralCommissions({
      businessId: business.id,
      lookbackDays: 90,
    });

    const [referralPayouts, dealPayouts] = await Promise.all([
      getReferralPayoutSummary(business.id),
      getDealPayoutSummary(business.id),
    ]);

    if (!business.stripeConnectAccountId) {
      return withNoStoreHeaders(
        emptyResponse(
          true,
          referralPayouts,
          dealPayouts,
          business.businessType,
          business.name,
          business.email
        )
      );
    }

    try {
      const status = await syncBusinessConnectState(
        business.id,
        business.stripeConnectAccountId
      );
      if (status.onboardingComplete) {
        await settlePendingDealPurchasePayouts({
          businessId: business.id,
          connectAccountId: status.accountId,
        });
        await settlePendingReferralCommissions({
          businessId: business.id,
          connectAccountId: status.accountId,
        });
      }

      const [refreshedReferralPayouts, refreshedDealPayouts] = await Promise.all([
        getReferralPayoutSummary(business.id),
        getDealPayoutSummary(business.id),
      ]);
      const overview = status.onboardingComplete
        ? await fetchConnectPayoutsOverview(status.accountId)
        : null;

      return withNoStoreHeaders({
        notConnected: false,
        accountId: status.accountId,
        businessName: business.name,
        businessEmail: business.email,
        businessType: business.businessType,
        isReferralOnly: business.businessType === 'Referral Partner',
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
        onboardingComplete: status.onboardingComplete,
        readyForPaidDeals: status.onboardingComplete,
        bankAccountConnected: status.bankAccountConnected,
        externalAccount: status.externalAccount,
        payoutSchedule: status.payoutSchedule,
        requirements: status.requirements,
        balances: overview
          ? {
              available: overview.balance.available,
              pending: overview.balance.pending,
            }
          : null,
        payouts: overview?.payouts ?? [],
        dealPayouts: refreshedDealPayouts,
        referralPayouts: refreshedReferralPayouts,
      });
    } catch (error: any) {
      if (isRecoverableConnectAccountError(error)) {
        await clearStaleConnectState(business.id);
        return withNoStoreHeaders(
          emptyResponse(
            true,
            referralPayouts,
            dealPayouts,
            business.businessType,
            business.name,
            business.email
          )
        );
      }

      throw error;
    }
  } catch (error: any) {
    console.error('GET /api/stripe/connect/payouts error:', error);
    return withNoStoreHeaders({ error: 'Failed to load payout data' }, { status: 500 });
  }
}
