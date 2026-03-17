import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { createConnectAccountSession, ensureBusinessConnectAccount } from '@/lib/stripe-connect';

export async function POST(req: NextRequest) {
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
        email: true,
        name: true,
        stripeConnectAccountId: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const account = await ensureBusinessConnectAccount(
      business,
      getAppBaseUrlFromRequest(req.url)
    );
    const accountSession = await createConnectAccountSession(account.id);

    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId: account.id,
    });
  } catch (error: any) {
    console.error('POST /api/stripe/connect/account-session error:', error);
    return NextResponse.json({ error: 'Failed to create Stripe Connect session' }, { status: 500 });
  }
}
