import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { fetchConnectPayoutsOverview } from '@/lib/stripe-connect';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectOnboardedAt: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const accountId = business.stripeConnectAccountId;
    const onboardingComplete = Boolean(
      business.stripeConnectChargesEnabled &&
        business.stripeConnectPayoutsEnabled &&
        business.stripeConnectOnboardedAt
    );

    if (!accountId) {
      return NextResponse.json({
        notConnected: true,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
        balances: null,
        payouts: [],
      });
    }

    if (!onboardingComplete) {
      return NextResponse.json({
        notConnected: false,
        chargesEnabled: Boolean(business.stripeConnectChargesEnabled),
        payoutsEnabled: Boolean(business.stripeConnectPayoutsEnabled),
        onboardingComplete: false,
        balances: null,
        payouts: [],
      });
    }

    const overview = await fetchConnectPayoutsOverview(accountId);

    return NextResponse.json({
      notConnected: false,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingComplete: true,
      balances: {
        available: overview.balance.available,
        pending: overview.balance.pending,
      },
      payouts: overview.payouts,
    });
  } catch (error: any) {
    console.error('GET /api/stripe/connect/payouts error:', error);
    return NextResponse.json({ error: 'Failed to load payout data' }, { status: 500 });
  }
}
