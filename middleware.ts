// ============================================================
// FILE: middleware.ts
// ============================================================
// HARDENED VERSION - Route Protection + Subdomain Routing
// Fixed: Uses @supabase/ssr instead of deprecated auth-helpers
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ==================== CONFIGURATION ====================

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/admin',
  '/coach/dashboard',
  '/coach/sessions',
  '/coach/students',
  '/coach/payouts',
  '/parent/dashboard',
  '/parent/progress',
  '/parent/sessions',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/admin/login',
  '/coach/login',
  '/parent/login',
  '/login',
  '/register',
  '/assessment',
  '/discovery',
  '/api',
  '/images',
];

// Admin email whitelist
const ADMIN_EMAILS = [
  'rucha.rai@yestoryd.com',
  'rucha@yestoryd.com',
  'amitkrai17@gmail.com',
  'amitkrai17@yestoryd.com',
  'engage@yestoryd.com',
];

// ==================== HELPER FUNCTIONS ====================

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

function isCoachRoute(pathname: string): boolean {
  return pathname.startsWith('/coach/dashboard') ||
         pathname.startsWith('/coach/sessions') ||
         pathname.startsWith('/coach/students') ||
         pathname.startsWith('/coach/payouts');
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function isParentRoute(pathname: string): boolean {
  return pathname.startsWith('/parent');
}

// ==================== MAIN MIDDLEWARE ====================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // 1. Skip static files and API routes
  if (
    pathname.includes('.') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // 2. Initialize Response
  // We need to create the response early so Supabase can attach cookies to it
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 3. Handle subdomain routing (Your existing logic)
  const subdomainResult = handleSubdomainRouting(request, hostname, pathname);
  if (subdomainResult) {
    return subdomainResult;
  }

  // 4. Check if route is public (skip auth)
  if (isPublicRoute(pathname)) {
    return response;
  }

  // 5. Check if route requires auth
  if (!isProtectedRoute(pathname)) {
    return response;
  }

  // 5. Initialize Supabase SSR Client
  // This replaces createMiddlewareClient
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // 6. Get User (Use getUser instead of getSession for better security)
    const { data: { user }, error } = await supabase.auth.getUser();

    // 7. No session → redirect to login
    if (error || !user) {
      const loginUrl = getLoginUrl(pathname, request.nextUrl);
      return NextResponse.redirect(loginUrl);
    }

    const userEmail = user.email?.toLowerCase() || '';

    // 8. Admin route → check admin whitelist
    if (isAdminRoute(pathname)) {
      if (!ADMIN_EMAILS.includes(userEmail)) {
        console.log(`[Middleware] Unauthorized admin access attempt: ${userEmail}`);
        return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
      }
    }

    // 9. Coach route → verify coach role
    if (isCoachRoute(pathname)) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, is_active')
        .eq('email', userEmail)
        .single();

      if (!coach || !coach.is_active) {
        console.log(`[Middleware] Unauthorized coach access attempt: ${userEmail}`);
        return NextResponse.redirect(new URL('/coach/login?error=unauthorized', request.url));
      }
    }

    // 10. Parent route → verify parent exists
    if (isParentRoute(pathname)) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (!parent) {
        console.log(`[Middleware] Unauthorized parent access attempt: ${userEmail}`);
        return NextResponse.redirect(new URL('/parent/login?error=unauthorized', request.url));
      }
    }

    // 11. All checks passed
    return response;

  } catch (error) {
    console.error('[Middleware] Auth check error:', error);
    // On critical error, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// ==================== SUBDOMAIN ROUTING ====================

function handleSubdomainRouting(
  request: NextRequest,
  hostname: string,
  pathname: string
): NextResponse | null {
  // Development: localhost with ?coach param
  if (hostname.includes('localhost')) {
    const coachParam = request.nextUrl.searchParams.get('coach');
    if (coachParam && !pathname.startsWith('/coach/')) {
      const url = request.nextUrl.clone();
      url.pathname = `/coach/${coachParam}${pathname === '/' ? '' : pathname}`;
      url.searchParams.delete('coach');
      return NextResponse.rewrite(url);
    }
    return null;
  }

  // Skip Vercel preview URLs
  if (hostname.includes('vercel.app')) {
    return null;
  }

  // Production: Main domain
  if (hostname === 'yestoryd.com' || hostname === 'www.yestoryd.com') {
    return null;
  }

  // Production: Coach subdomain {coach}.yestoryd.com
  if (hostname.endsWith('.yestoryd.com')) {
    const subdomain = hostname.split('.')[0].toLowerCase();

    // Skip reserved subdomains
    const reservedSubdomains = ['www', 'admin', 'api', 'app', 'dashboard', 'mail', 'email'];
    if (reservedSubdomains.includes(subdomain)) {
      return null;
    }

    // Already on coach path
    if (pathname.startsWith('/coach/')) {
      return null;
    }

    // Rewrite to /coach/[subdomain]
    const url = request.nextUrl.clone();
    url.pathname = `/coach/${subdomain}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  return null;
}

// ==================== HELPER: Get Login URL ====================

function getLoginUrl(pathname: string, baseUrl: URL): URL {
  if (pathname.startsWith('/admin')) {
    return new URL('/admin/login', baseUrl);
  }
  if (pathname.startsWith('/coach')) {
    return new URL('/coach/login', baseUrl);
  }
  if (pathname.startsWith('/parent')) {
    return new URL('/parent/login', baseUrl);
  }
  return new URL('/login', baseUrl);
}

// ==================== MATCHER CONFIG ====================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
