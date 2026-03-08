import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect authenticated users from landing page straight to dashboard
  if (pathname === '/') {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
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
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
