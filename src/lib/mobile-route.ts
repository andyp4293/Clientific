import { NextResponse } from 'next/server';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';

export function mobileUnauthorizedResponse(message = 'Mobile sign-in is required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function mobileForbiddenResponse(
  message = 'Employee accounts can only access assigned appointments.',
) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireMobileSession(
  request: Request,
  options: { allowStaff?: boolean } = {},
) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: mobileUnauthorizedResponse() } as const;
  }

  try {
    const session = await verifyMobileSessionToken(token);
    if (session.accountType === 'staff' && !options.allowStaff) {
      return { error: mobileForbiddenResponse() } as const;
    }
    return { session } as const;
  } catch {
    return { error: mobileUnauthorizedResponse() } as const;
  }
}
