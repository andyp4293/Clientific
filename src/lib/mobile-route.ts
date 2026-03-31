import { NextResponse } from 'next/server';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';

export function mobileUnauthorizedResponse(message = 'Mobile sign-in is required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function requireMobileSession(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: mobileUnauthorizedResponse() } as const;
  }

  try {
    const session = await verifyMobileSessionToken(token);
    return { session } as const;
  } catch {
    return { error: mobileUnauthorizedResponse() } as const;
  }
}
