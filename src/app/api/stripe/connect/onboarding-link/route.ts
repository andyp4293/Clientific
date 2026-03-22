import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import {
  createConnectOnboardingLink,
  ensureBusinessConnectAccount,
} from '@/lib/stripe-connect';

function buildHostedOnboardingUrls(appUrl: string) {
  return {
    refreshUrl: `${appUrl}/api/stripe/connect/onboarding-link/refresh`,
    returnUrl: `${appUrl}/dashboard/payouts/setup?stripe_onboarding=return`,
  };
}

async function findBusiness(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      email: true,
      name: true,
      ownerPhone: true,
      phone: true,
      businessEmail: true,
      publicId: true,
      slug: true,
      stripeConnectAccountId: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await findBusiness(businessId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const appUrl = getAppBaseUrlFromRequest(req.url);
    const account = await ensureBusinessConnectAccount(business, appUrl);
    const onboardingLink = await createConnectOnboardingLink({
      accountId: account.id,
      ...buildHostedOnboardingUrls(appUrl),
    });

    return NextResponse.json({ url: onboardingLink.url, accountId: account.id });
  } catch (error) {
    console.error('POST /api/stripe/connect/onboarding-link error:', error);
    return NextResponse.json({ error: 'Failed to create Stripe onboarding link' }, { status: 500 });
  }
}
