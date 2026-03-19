import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import {
  ensureBusinessConnectAccount,
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

async function getAuthenticatedBusiness() {
  const session = await getServerSession(authOptions);
  const businessId = getSessionBusinessId(session);
  if (!businessId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    },
  });

  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };
  }

  return { business };
}

function notConnectedPayload() {
  return {
    notConnected: true,
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
    const { business, error } = await getAuthenticatedBusiness();
    if (error) {
      return error;
    }

    if (!business?.stripeConnectAccountId) {
      return NextResponse.json(notConnectedPayload());
    }

    try {
      const status = await syncBusinessConnectState(
        business.id,
        business.stripeConnectAccountId
      );

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
      });
    } catch (error: any) {
      if (isRecoverableConnectAccountError(error)) {
        await clearStaleConnectState(business.id);
        return NextResponse.json(notConnectedPayload());
      }

      throw error;
    }
  } catch (error: any) {
    console.error('GET /api/stripe/connect/account error:', error);
    return NextResponse.json({ error: 'Failed to load Stripe Connect account' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { business, error } = await getAuthenticatedBusiness();
    if (error) {
      return error;
    }

    const account = await ensureBusinessConnectAccount(
      {
        id: business!.id,
        email: business!.email,
        name: business!.name,
        stripeConnectAccountId: business!.stripeConnectAccountId,
      },
      getAppBaseUrlFromRequest(req.url)
    );

    const status = await syncBusinessConnectState(business!.id, account.id);

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
    });
  } catch (error: any) {
    console.error('POST /api/stripe/connect/account error:', error);
    return NextResponse.json({ error: 'Failed to set up Stripe Connect account' }, { status: 500 });
  }
}
