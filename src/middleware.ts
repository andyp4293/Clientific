import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Check if it's the booking subdomain
  if (hostname.startsWith('booking.')) {
    // Extract the path (should be the publicId)
    const pathname = request.nextUrl.pathname;
    const publicId = pathname.split('/')[1]; // Get first segment after /
    
    if (publicId && publicId !== 'api') {
      // Rewrite to /book/[publicId] route
      const url = request.nextUrl.clone();
      url.pathname = `/book/${publicId}`;
      return NextResponse.rewrite(url);
    }
  }
  
  return NextResponse.next();
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
