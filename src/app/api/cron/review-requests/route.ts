import { NextRequest, NextResponse } from 'next/server';
import { processPendingCheckInReviewRequests } from '@/lib/review-requests';

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
    const summary = await processPendingCheckInReviewRequests();

    return NextResponse.json(summary);
  } catch (error) {
    console.error('GET /api/cron/review-requests error:', error);
    return NextResponse.json(
      { error: 'Review request maintenance failed' },
      { status: 500 }
    );
  }
}
