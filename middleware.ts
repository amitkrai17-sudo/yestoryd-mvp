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
  '/coach/earnings',
  '/coach/profile',
  '/coach/capture',
  '/coach/onboarding',
  '/coach/templates',
  '/coach/ai-assistant',
  '/coach/discovery-calls',
  '/parent/dashboard',
  '/parent/progress',
  '/parent/sessions',
  '/parent/journey',
  '/parent/tasks',
  '/parent/support',
];

// Routes that are always public (use exact prefixes, not broad catch-alls)
const PUBLIC_ROUTES = [
  '/admin/login',
  '/coach/login',
  '/coach/confirm',
  '/parent/login',
  '/login',
  '/register',
  '/assessment',
  '/discovery',
  '/api',
  '/images',
];

// Admin email whitelist — cached from database
let _adminEmailsCache: { emails: string[]; loadedAt: number } | null = null;
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAdminEmailsList(): Promise<string[]> {
  if (_adminEmailsCache && Date.now() - _adminEmailsCache.loadedAt < ADMIN_CACHE_TTL) {
    return _adminEmailsCache.emails;
  }
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );
  const { data } = await serviceClient
    .from('site_settings')
    .select('value')
    .eq('category', 'auth')
    .eq('key', 'admin_emails')
    .single();

  if (!data?.value) {
    console.error('[Middleware] CRITICAL: No admin_emails in site_settings');
    return [];
  }

  const emails: string[] = (typeof data.value === 'string' ? JSON.parse(data.value) : data.value).map((e: string) => e.toLowerCase());
  _adminEmailsCache = { emails, loadedAt: Date.now() };
  return emails;
}

// ==================== HELPER FUNCTIONS ====================

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

function isCoachRoute(pathname: string): boolean {
  return pathname.startsWith('/coach/') &&
         !pathname.startsWith('/coach/login') &&
         !pathname.startsWith('/coach/confirm');
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
    // 6. Exchange PKCE code if present (OAuth / magic link callback)
    // When Supabase redirects back with ?code=..., we must exchange it
    // for a session BEFORE calling getUser(). This sets auth cookies.
    const code = request.nextUrl.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[Middleware] Code exchange failed:', exchangeError.message);
      } else {
        // Strip the code param and redirect to clean URL.
        // Copy auth cookies from the current response to the redirect.
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete('code');
        const redirectResponse = NextResponse.redirect(cleanUrl);
        response.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
      }
    }

    // 7. Get User (Use getUser instead of getSession for better security)
    const { data: { user }, error } = await supabase.auth.getUser();

    // 8. No session → redirect to login
    if (error || !user) {
      const loginUrl = getLoginUrl(pathname, request.nextUrl);
      return NextResponse.redirect(loginUrl);
    }

    const userEmail = user.email?.toLowerCase() || '';

    // 8. Admin route → check admin whitelist
    if (isAdminRoute(pathname)) {
      const adminEmails = await getAdminEmailsList();
    if (!adminEmails.includes(userEmail)) {
        console.log(`[Middleware] Unauthorized admin access attempt: ${userEmail}`);
        return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
      }
    }

    // 9. Coach route → verify coach is active in database
    if (isCoachRoute(pathname)) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isActiveCoach = !!coach;

      if (!isActiveCoach) {
        console.log(`[Middleware] Unauthorized coach access attempt: ${userEmail} (DB check)`);
        return NextResponse.redirect(new URL('/coach/login?error=unauthorized', request.url));
      }
    }

    // 10. Parent route → verify parent exists from metadata
    if (isParentRoute(pathname)) {
      const isParent = user.user_metadata?.role === 'parent';

      if (!isParent) {
        console.log(`[Middleware] Unauthorized parent access attempt: ${userEmail} (metadata check)`);
        return NextResponse.redirect(new URL('/parent/login?error=unauthorized', request.url));
      }
    }

    // 11. All checks passed
    return response;

  } catch (error: any) {
    // Fail-open on network errors (ECONNRESET, ECONNREFUSED, timeouts).
    // Better to let an unauthenticated user see a page (client layout
    // will redirect) than to lock everyone out during a Supabase outage.
    const isNetworkError = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']
      .some(code => error?.code === code || error?.cause?.code === code || String(error).includes(code));

    if (isNetworkError) {
      console.error('[Middleware] Network error during auth check, failing open:', error?.code || error?.message);
      return response;
    }

    console.error('[Middleware] Auth check error:', error);
    const loginUrl = getLoginUrl(pathname, request.nextUrl);
    return NextResponse.redirect(loginUrl);
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





