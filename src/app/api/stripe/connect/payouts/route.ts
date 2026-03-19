import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import {
  fetchConnectPayoutsOverview,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

function emptyResponse(notConnected: boolean) {
  return {
    notConnected,
    accountId: null,
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
  };
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        stripeConnectAccountId: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.stripeConnectAccountId) {
      return NextResponse.json(emptyResponse(true));
    }

    try {
      const status = await syncBusinessConnectState(
        business.id,
        business.stripeConnectAccountId
      );
      const overview = status.onboardingComplete
        ? await fetchConnectPayoutsOverview(status.accountId)
        : null;

      return NextResponse.json({
        notConnected: false,
        accountId: status.accountId,
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
      });
    } catch (error: any) {
      if (error?.code === 'resource_missing') {
        await prisma.business.update({
          where: { id: business.id },
          data: {
            stripeConnectAccountId: null,
            stripeConnectChargesEnabled: false,
            stripeConnectPayoutsEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectOnboardedAt: null,
            stripeConnectLastSyncedAt: new Date(),
          },
        });

        return NextResponse.json(emptyResponse(true));
      }

      throw error;
    }
  } catch (error: any) {
    console.error('GET /api/stripe/connect/payouts error:', error);
    return NextResponse.json({ error: 'Failed to load payout data' }, { status: 500 });
  }
}
