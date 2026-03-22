import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { createConnectAccountSession, ensureBusinessConnectAccount } from '@/lib/stripe-connect';

function normalizeAccountSessionError(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  if (message.includes('/settings/connect/platform-profile')) {
    return {
      status: 503,
      body: {
        code: 'platform_profile_incomplete',
        retryable: false,
        error:
          'Secure payout setup is temporarily unavailable while we finish a required Stripe review for live payouts.',
      },
    };
  }

  if (message.includes('/settings/connect/site-links')) {
    return {
      status: 503,
      body: {
        code: 'site_links_incomplete',
        retryable: false,
        error:
          'Secure payout setup is temporarily unavailable while we finish the Stripe payout link configuration for live payouts.',
      },
    };
  }

  return null;
}

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
        ownerPhone: true,
        phone: true,
        businessEmail: true,
        publicId: true,
        slug: true,
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
    const accountSession = await createConnectAccountSession(account);

    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId: account.id,
    });
  } catch (error: any) {
    console.error('POST /api/stripe/connect/account-session error:', error);

    const normalized = normalizeAccountSessionError(error);
    if (normalized) {
      return NextResponse.json(normalized.body, { status: normalized.status });
    }

    return NextResponse.json({ error: 'Failed to create Stripe Connect session' }, { status: 500 });
  }
}
