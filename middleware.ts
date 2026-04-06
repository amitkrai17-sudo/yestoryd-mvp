// ============================================================
// FILE: middleware.ts
// ============================================================
// HARDENED VERSION - Route Protection + Subdomain Routing
// Fixed: Uses @supabase/ssr instead of deprecated auth-helpers
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import * as Sentry from '@sentry/nextjs';
import { normalizePhone } from '@/lib/utils/phone';

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('[Middleware] Missing Supabase env vars for admin email check');
    return [];
  }

  const serviceClient = createServerClient(
    url,
    serviceKey,
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

  // 1. Skip static files, internal Next.js routes, and API routes
  // Belt-and-suspenders with matcher config — catches anything matcher misses
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
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

  // 3. Handle subdomain routing
  const subdomainResult = handleSubdomainRouting(request, hostname, pathname);
  if (subdomainResult) {
    return subdomainResult;
  }

  // 4. Check if route is public (skip auth)
  if (isPublicRoute(pathname)) {
    return response;
  }

  // 5. Check if route requires auth — if not, skip all Supabase calls
  if (!isProtectedRoute(pathname)) {
    return response;
  }

  // 6. Guard: Supabase env vars must be available (Edge runtime can miss them)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] Supabase env vars missing, failing open');
    return response;
  }

  // 7. Initialize Supabase SSR Client
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
    // 8. Exchange PKCE code if present (OAuth / magic link callback)
    const code = request.nextUrl.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[Middleware] Code exchange failed:', exchangeError.message);
        Sentry.captureMessage(`Code exchange failed: ${exchangeError.message}`, { level: 'warning', extra: { pathname } });
        // Redirect to login with clear error instead of silent fail
        const loginPath = pathname.startsWith('/coach') ? '/coach/login' : '/parent/login';
        return NextResponse.redirect(new URL(`${loginPath}?error=link_expired`, request.url));
      } else {
        // Strip the code param and redirect to clean URL.
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete('code');
        const redirectResponse = NextResponse.redirect(cleanUrl);
        response.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
      }
    }

    // 9. Get User (getUser validates JWT server-side, more secure than getSession)
    const { data: { user }, error } = await supabase.auth.getUser();

    // 10. No valid session → clear stale cookies and redirect to login
    //     This prevents redirect loops: without clearing cookies, the login page
    //     sees stale tokens via getSession() and redirects back to dashboard.
    if (error || !user) {
      const loginUrl = getLoginUrl(pathname, request.nextUrl);
      const redirectResponse = NextResponse.redirect(loginUrl);

      // Clear all Supabase auth cookies to prevent stale-session redirect loops
      request.cookies.getAll().forEach(cookie => {
        if (cookie.name.startsWith('sb-')) {
          redirectResponse.cookies.delete(cookie.name);
        }
      });

      return redirectResponse;
    }

    const userEmail = user.email?.toLowerCase() || '';

    // 11. Admin route → check admin whitelist
    if (isAdminRoute(pathname)) {
      const adminEmails = await getAdminEmailsList();
      if (!adminEmails.includes(userEmail)) {
        console.log(`[Middleware] Unauthorized admin access attempt: ${userEmail}`);
        return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
      }
    }

    // 12. Coach route → verify coach is active in database
    //     Try user_id first; fall back to email (handles coaches who haven't
    //     had their auth user linked yet, e.g. user_id is NULL).
    if (isCoachRoute(pathname)) {
      const { data: coachById } = await supabase
        .from('coaches')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!coachById) {
        // Fallback: match by email (covers user_id = NULL case)
        const { data: coachByEmail } = await supabase
          .from('coaches')
          .select('id, is_active')
          .eq('email', userEmail)
          .eq('is_active', true)
          .single();

        if (!coachByEmail) {
          console.log(`[Middleware] Unauthorized coach access attempt: ${userEmail} (DB check)`);
          return NextResponse.redirect(new URL('/coach/login?error=unauthorized', request.url));
        }

        // Auto-link: set user_id on the coach record so future checks are fast.
        // Uses service-role client since anon can't update coaches.
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const serviceClient = createServerClient(
            supabaseUrl,
            serviceKey,
            { cookies: { getAll() { return []; }, setAll() {} } }
          );
          await serviceClient
            .from('coaches')
            .update({ user_id: user.id })
            .eq('id', coachByEmail.id);
          console.log(`[Middleware] Auto-linked coach ${userEmail} → user_id ${user.id}`);
        }
      }
    }

    // 13. Parent route → verify parent exists in database
    //     Tier 1: user_id match (fast path for returning users)
    //     Tier 2: email match (first login, user_id not yet linked)
    //     Tier 2.5: phone match via auth metadata (Google email mismatch)
    //     Tier 3: children table match (assessment-only, no parent record yet)
    if (isParentRoute(pathname)) {
      // Helper: get service client for writes (bypasses RLS)
      const getServiceClient = () => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) return null;
        return createServerClient(
          supabaseUrl,
          serviceKey,
          { cookies: { getAll() { return []; }, setAll() {} } }
        );
      };

      // Tier 1: match by user_id (fast path)
      const { data: parentById } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!parentById) {
        // Tier 2: match by email
        const { data: parentByEmail } = await supabase
          .from('parents')
          .select('id')
          .eq('email', userEmail)
          .single();

        if (parentByEmail) {
          // Auto-link user_id for future fast path
          const sc = getServiceClient();
          if (sc) {
            await sc.from('parents').update({ user_id: user.id }).eq('id', parentByEmail.id);
            console.log(`[Middleware] Auto-linked parent ${userEmail} → user_id ${user.id}`);
          }
        } else {
          // Tier 2.5: match by phone from auth metadata (handles Google email mismatch)
          const authPhone = user.user_metadata?.phone || user.phone;
          let parentByPhone = null;
          if (authPhone) {
            const e164 = normalizePhone(authPhone);
            const { data } = await supabase
              .from('parents')
              .select('id')
              .or(`phone.eq.${e164},phone.eq.${e164.slice(1)},phone.eq.${e164.slice(3)}`)
              .single();
            parentByPhone = data;
          }

          if (parentByPhone) {
            // Link user_id + update email to match auth
            const sc = getServiceClient();
            if (sc) {
              await sc.from('parents')
                .update({ user_id: user.id, email: userEmail, updated_at: new Date().toISOString() })
                .eq('id', parentByPhone.id);
              console.log(`[Middleware] Phone-matched parent → linked user_id ${user.id}, updated email to ${userEmail}`);
            }
          } else {
            // Tier 3: check children table for parent_email or parent_phone
            const { data: childRecord } = await supabase
              .from('children')
              .select('id, parent_email, parent_phone, parent_name')
              .eq('parent_email', userEmail)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!childRecord) {
              Sentry.captureMessage(`Parent login denied: no parent/child record for ${userEmail}`, { level: 'warning', extra: { authUserId: user.id } });
              console.log(`[Middleware] Unauthorized parent access attempt: ${userEmail} (DB check)`);
              return NextResponse.redirect(new URL('/parent/login?error=unauthorized', request.url));
            }

            // Auto-create parent record from children data
            const sc = getServiceClient();
            if (sc) {
              const { error: createErr } = await sc.from('parents').insert({
                email: userEmail,
                name: childRecord.parent_name || 'Parent',
                phone: childRecord.parent_phone ? normalizePhone(childRecord.parent_phone) : null,
                user_id: user.id,
                created_at: new Date().toISOString(),
              });

              if (createErr) {
                // Duplicate email = parent was created between Tier 2 check and now (race condition)
                // Try linking instead
                if (createErr.code === '23505') {
                  await sc.from('parents').update({ user_id: user.id }).eq('email', userEmail);
                  console.log(`[Middleware] Race condition: linked existing parent ${userEmail} → user_id ${user.id}`);
                } else {
                  Sentry.captureMessage(`Middleware parent auto-create failed: ${createErr.message}`, { level: 'error', extra: { email: userEmail, code: createErr.code } });
                  console.error(`[Middleware] Failed to auto-create parent for ${userEmail}:`, createErr.message);
                  // Don't block — layout will show Access Denied
                }
              } else {
                console.log(`[Middleware] Auto-created parent for ${userEmail} from children data`);
              }
            }
          }
        }
      }
    }

    // 14. All checks passed
    return response;

  } catch (error: any) {
    // Fail-open on ALL errors. Client layouts validate auth as fallback.
    // Better to let a request through than to crash middleware or
    // redirect-loop during Supabase outages / cold starts / ECONNRESET.
    Sentry.captureException(error, { extra: { context: 'middleware-auth-check', pathname: request.nextUrl.pathname } });
    console.error('[Middleware] Auth check error, failing open:', error?.code || error?.message || error);
    return response;
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
    '/((?!_next/static|_next/image|_next/data|_next/webpack-hmr|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|txt|xml|woff|woff2)$).*)',
  ],
};





