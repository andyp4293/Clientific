import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS,
  reconcileReferralCommissions,
  retryPendingReferralTransfers,
} from '@/lib/referral-payouts';

function parseLookbackDays(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('lookbackDays');

  if (!raw) {
    return DEFAULT_REFERRAL_RECONCILIATION_LOOKBACK_DAYS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 90) {
    return null;
  }

  return parsed;
}

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = authorizeCronRequest(request);
  if (authError) {
    return authError;
  }

  const lookbackDays = parseLookbackDays(request);
  if (lookbackDays === null) {
    return NextResponse.json(
      { error: 'lookbackDays must be an integer between 1 and 90' },
      { status: 400 }
    );
  }

  try {
    const reconciliation = await reconcileReferralCommissions({
      lookbackDays,
    });
    const transferRetry = await retryPendingReferralTransfers();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      lookbackDays,
      reconciliation,
      transferRetry,
    });
  } catch (error) {
    console.error('GET /api/cron/referral-payouts error:', error);
    return NextResponse.json(
      { error: 'Referral payout maintenance failed' },
      { status: 500 }
    );
  }
}
