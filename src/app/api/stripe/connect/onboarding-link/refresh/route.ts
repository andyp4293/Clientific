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

function redirectToSetup(appUrl: string, searchParam?: [string, string]) {
  const url = new URL('/dashboard/payouts/setup', appUrl);
  if (searchParam) {
    url.searchParams.set(searchParam[0], searchParam[1]);
  }
  return NextResponse.redirect(url);
}

function redirectToLogin(appUrl: string) {
  const url = new URL('/login', appUrl);
  url.searchParams.set('callbackUrl', '/dashboard/payouts/setup');
  return NextResponse.redirect(url);
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

export async function GET(req: NextRequest) {
  const appUrl = getAppBaseUrlFromRequest(req.url);

  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return redirectToLogin(appUrl);
    }

    const business = await findBusiness(businessId);
    if (!business) {
      return redirectToSetup(appUrl, ['stripe_onboarding', 'missing_business']);
    }

    const account = await ensureBusinessConnectAccount(business, appUrl);
    const onboardingLink = await createConnectOnboardingLink({
      accountId: account.id,
      ...buildHostedOnboardingUrls(appUrl),
    });

    return NextResponse.redirect(onboardingLink.url);
  } catch (error) {
    console.error('GET /api/stripe/connect/onboarding-link/refresh error:', error);
    return redirectToSetup(appUrl, ['stripe_onboarding', 'refresh_error']);
  }
}
