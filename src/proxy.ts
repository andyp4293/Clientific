import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

function rateLimitResponse(request: NextRequest, decision: ReturnType<typeof checkRateLimit>) {
  const headers = new Headers(decision.headers);
  headers.set('Cache-Control', 'no-store');

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: decision.message || 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      },
      { status: 429, headers },
    );
  }

  return new NextResponse(
    decision.message || 'Too many requests. Please wait a moment and try again.',
    {
      status: 429,
      headers,
    },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rateLimitDecision = checkRateLimit({
    pathname,
    method: request.method,
    headers: request.headers,
  });

  if (!rateLimitDecision.allowed) {
    return rateLimitResponse(request, rateLimitDecision);
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Redirect authenticated users from landing page straight to dashboard
  if (pathname === '/') {
    if (token) {
      if (token.accountType === 'staff' && token.staffPortalAccessRevoked) {
        return NextResponse.redirect(new URL('/signout', request.url));
      }
      const staffTarget = token.staffPasswordChangeRequired
        ? '/staff/set-password'
        : '/staff/appointments';
      return NextResponse.redirect(
        new URL(token.accountType === 'staff' ? staffTarget : '/dashboard', request.url),
      );
    }
  }

  if (token?.accountType === 'staff' && token.staffPortalAccessRevoked) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Employee login has been disabled.' },
        { status: 401 },
      );
    }
    if (pathname !== '/signout' && !pathname.startsWith('/api/auth')) {
      return NextResponse.redirect(new URL('/signout', request.url));
    }
  }

  if (pathname.startsWith('/dashboard') && token?.accountType === 'staff') {
    return NextResponse.redirect(
      new URL(
        token.staffPasswordChangeRequired ? '/staff/set-password' : '/staff/appointments',
        request.url,
      ),
    );
  }

  if (
    token?.accountType === 'staff' &&
    token.staffPasswordChangeRequired &&
    pathname.startsWith('/staff') &&
    !pathname.startsWith('/staff/set-password')
  ) {
    return NextResponse.redirect(new URL('/staff/set-password', request.url));
  }

  if (pathname.startsWith('/api/')) {
    if (
      token?.accountType === 'staff' &&
      !pathname.startsWith('/api/auth') &&
      !pathname.startsWith('/api/staff/password') &&
      !pathname.startsWith('/api/public')
    ) {
      return NextResponse.json(
        { error: 'Employee accounts can only access assigned appointments.' },
        { status: 403 },
      );
    }

    return NextResponse.next();
  }

  const hostname = request.headers.get('host') || '';

  // Check if it's the booking subdomain
  if (hostname.startsWith('booking.')) {
    // Extract the path (should be the publicId)
    const publicId = pathname.split('/')[1]; // Get first segment after /
    
    if (publicId && publicId !== 'api') {
      // Rewrite to /book/[publicId] route
      const url = request.nextUrl.clone();
      url.pathname = `/book/${publicId}`;
      const rewriteResponse = NextResponse.rewrite(url);
      rewriteResponse.headers.set('x-pathname', request.nextUrl.pathname);
      return rewriteResponse;
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
