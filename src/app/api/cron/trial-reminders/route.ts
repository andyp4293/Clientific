import { NextRequest, NextResponse } from 'next/server';
import { sendDueTrialEndingReminders } from '@/lib/trial-reminders';

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
    const ranAt = new Date();
    const summary = await sendDueTrialEndingReminders({ now: ranAt });

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error('GET /api/cron/trial-reminders error:', error);
    return NextResponse.json(
      { error: 'Trial reminder maintenance failed' },
      { status: 500 },
    );
  }
}
