import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { ensureBusinessConnectAccount, syncBusinessConnectAccount } from '@/lib/stripe-connect';

async function handleAccountRequest(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const businessId = getSessionBusinessId(session);
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, email: true, name: true, stripeConnectAccountId: true },
  });

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const appUrl = getAppBaseUrlFromRequest(req.url);
  const account = await ensureBusinessConnectAccount(business, appUrl);
  await syncBusinessConnectAccount(business.id, account);

  return NextResponse.json({
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    onboardingComplete: account.charges_enabled && account.payouts_enabled,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await handleAccountRequest(req);
  } catch (error: any) {
    console.error('GET /api/stripe/connect/account error:', error);
    return NextResponse.json({ error: 'Failed to load Stripe Connect account' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handleAccountRequest(req);
  } catch (error: any) {
    console.error('POST /api/stripe/connect/account error:', error);
    return NextResponse.json({ error: 'Failed to set up Stripe Connect account' }, { status: 500 });
  }
}
