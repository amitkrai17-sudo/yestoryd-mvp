import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Development: localhost:3000
  // Use query param ?coach=rucha for testing coach pages
  if (hostname.includes('localhost')) {
    const coachParam = request.nextUrl.searchParams.get('coach');
    if (coachParam && !pathname.startsWith('/coach/')) {
      const url = request.nextUrl.clone();
      url.pathname = `/coach/${coachParam}${pathname === '/' ? '' : pathname}`;
      url.searchParams.delete('coach');
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Production: Parse subdomain from hostname
  const parts = hostname.split('.');

  // Main domain: yestoryd.com or www.yestoryd.com
  if (
    hostname === 'yestoryd.com' ||
    hostname === 'www.yestoryd.com' ||
    parts.length < 3
  ) {
    return NextResponse.next();
  }

  // Coach subdomain: {coach}.yestoryd.com
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();

    // Skip special subdomains
    const reservedSubdomains = ['www', 'admin', 'api', 'app', 'dashboard', 'mail', 'email'];
    if (reservedSubdomains.includes(subdomain)) {
      return NextResponse.next();
    }

    // Rewrite to /coach/[subdomain] route
    const url = request.nextUrl.clone();
    
    // If already on a coach path, don't rewrite again
    if (pathname.startsWith('/coach/')) {
      return NextResponse.next();
    }

    url.pathname = `/coach/${subdomain}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes
     * - _next (Next.js internals)
     * - static files (files with extensions)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
