import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUTH_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.pkce.code_verifier',
  '__Secure-next-auth.pkce.code_verifier',
  'next-auth.state',
  '__Secure-next-auth.state',
  'next-auth.nonce',
  '__Secure-next-auth.nonce',
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
] as const;

function getSafeRedirectTarget(request: NextRequest) {
  const fallbackUrl = new URL('/login', request.nextUrl.origin);
  const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');

  if (!callbackUrl || callbackUrl.startsWith('//')) {
    return fallbackUrl;
  }

  if (callbackUrl.startsWith('/')) {
    return new URL(callbackUrl, request.nextUrl.origin);
  }

  try {
    const parsedUrl = new URL(callbackUrl);
    return parsedUrl.origin === request.nextUrl.origin ? parsedUrl : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  const isSecureRequest =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';

  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: '',
      maxAge: 0,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure:
        isSecureRequest ||
        name.startsWith('__Secure-') ||
        name.startsWith('__Host-'),
    });
  }
}

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(getSafeRedirectTarget(request), 303);
  response.headers.set('Cache-Control', 'no-store');
  clearAuthCookies(response, request);
  return response;
}

export const POST = GET;
