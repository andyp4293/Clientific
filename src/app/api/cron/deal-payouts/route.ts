import { NextRequest, NextResponse } from 'next/server';
import { retryPendingDealPurchaseTransfers } from '@/lib/deal-payouts';

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

  try {
    const transferRetry = await retryPendingDealPurchaseTransfers();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      transferRetry,
    });
  } catch (error) {
    console.error('GET /api/cron/deal-payouts error:', error);
    return NextResponse.json(
      { error: 'Deal payout maintenance failed' },
      { status: 500 }
    );
  }
}
