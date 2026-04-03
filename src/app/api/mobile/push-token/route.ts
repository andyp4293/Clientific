import { NextResponse } from 'next/server';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import {
  registerMobilePushDevice,
  unregisterMobilePushDevice,
} from '@/lib/mobile-push';

function parsePlatform(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'ios';
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
  try {
    session = await verifyMobileSessionToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    appIdentifier?: string;
    deviceName?: string;
    platform?: string;
    token?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
  }

  try {
    await registerMobilePushDevice({
      businessId: session.businessId,
      token: body.token,
      platform: parsePlatform(body.platform),
      appIdentifier:
        typeof body.appIdentifier === 'string' ? body.appIdentifier.trim() || null : null,
      deviceName: typeof body.deviceName === 'string' ? body.deviceName.trim() || null : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/mobile/push-token error:', error);
    return NextResponse.json({ error: 'Unable to register push token' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authToken = getBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
  try {
    session = await verifyMobileSessionToken(authToken);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const pushToken = url.searchParams.get('token');
  if (!pushToken) {
    return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
  }

  try {
    await unregisterMobilePushDevice({
      businessId: session.businessId,
      token: pushToken,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/mobile/push-token error:', error);
    return NextResponse.json({ error: 'Unable to unregister push token' }, { status: 500 });
  }
}
