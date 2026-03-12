# 🎫 Technical Debt Ticket: Restore Server-Side Middleware Protection

## Title
Restore Server-Side Middleware Protection for Admin Routes

## Priority
**Medium** (Post-Launch)

## Tags
`security`, `refactor`, `tech-debt`, `authentication`, `middleware`

---

## Context

During Session 9 (January 10, 2026), we encountered a conflict between:
- **Supabase Client-Side Auth** → stores tokens in `localStorage`
- **Next.js Middleware** → can only read `cookies`

### Workaround Applied
To unblock the Admin Login flow for launch, we:
1. Moved `/admin/*` routes to `PUBLIC_ROUTES` in `middleware.ts`
2. Added a fetch interceptor in `layout.tsx` to inject Bearer tokens
3. Updated `lib/admin-auth.ts` to accept both token and cookie auth

### Current Protection Layers
| Layer | Status | Location |
|-------|--------|----------|
| Middleware (Edge) | ❌ Bypassed | `middleware.ts` |
| Layout (Client) | ✅ Active | `app/admin/layout.tsx` |
| API Routes | ✅ Active | `lib/admin-auth.ts` |

**Data is still protected** - API routes require valid authentication. However, admin pages are downloaded to the browser before client-side auth kicks in.

---

## The Goal

Restore "Edge Protection" so that unauthorized requests to `/admin/*` are blocked by Middleware **before** they reach the React application.

### Benefits
- ⚡ **Performance**: Faster 307 redirects at edge (no React download)
- 🔒 **Security**: Tighter perimeter (defense in depth)
- 🧹 **Clean Code**: Remove fetch interceptor hack
- 📊 **Bandwidth**: Don't serve admin JS bundles to unauthorized users

---

## Technical Blockers

1. **Token Storage Mismatch**
   - OAuth stores `sb-access-token` in browser's `localStorage`
   - Middleware runs on Edge, cannot access `localStorage`
   - Only `cookies` are available in middleware

2. **Supabase SSR Configuration**
   - Current setup uses `@supabase/supabase-js` on client
   - Should use `@supabase/ssr` consistently for cookie-based sessions

---

## Proposed Solution

### Phase 1: Migrate to Cookie-Based Auth

1. **Update Supabase Client Initialization**
   ```typescript
   // lib/supabase-browser.ts
   import { createBrowserClient } from '@supabase/ssr';
   
   export const createClient = () =>
     createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     );
   ```

2. **Update Auth Callback Route**
   ```typescript
   // app/auth/callback/route.ts
   import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';
   import { NextResponse } from 'next/server';
   
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const code = searchParams.get('code');
     
     if (code) {
       const cookieStore = cookies();
       const supabase = createServerClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
         {
           cookies: {
             getAll() { return cookieStore.getAll(); },
             setAll(cookiesToSet) {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               );
             },
           },
         }
       );
       await supabase.auth.exchangeCodeForSession(code);
     }
     
     return NextResponse.redirect(new URL('/admin', request.url));
   }
   ```

### Phase 2: Restore Middleware Protection

3. **Revert middleware.ts**
   ```typescript
   // Remove '/admin' from PUBLIC_ROUTES
   const PUBLIC_ROUTES = [
     '/admin/login',
     // '/admin',  ← REMOVE THIS
     '/coach/login',
     ...
   ];
   ```

4. **Verify Middleware Reads Cookies**
   ```typescript
   // middleware.ts - should already work
   const supabase = createServerClient(url, key, {
     cookies: {
       getAll() {
         return request.cookies.getAll();
       },
       // ...
     },
   });
   
   const { data: { user } } = await supabase.auth.getUser();
   // This should now work with cookie-based session
   ```

### Phase 3: Cleanup

5. **Remove Fetch Interceptor**
   - Delete the `useEffect` fetch override from `app/admin/layout.tsx`
   - API routes will use cookie-based auth automatically

6. **Simplify admin-auth.ts**
   - Remove Bearer token logic (optional, can keep for flexibility)
   - Primary auth via cookies

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/supabase-browser.ts` | Create with `@supabase/ssr` |
| `app/auth/callback/route.ts` | Create callback handler |
| `app/admin/login/page.tsx` | Update OAuth redirect |
| `middleware.ts` | Remove `/admin` from PUBLIC_ROUTES |
| `app/admin/layout.tsx` | Remove fetch interceptor |
| `lib/admin-auth.ts` | Optional cleanup |

---

## Acceptance Criteria

- [ ] Hitting `/admin/dashboard` without a session cookie redirects to `/admin/login` instantly (307 Redirect at Edge)
- [ ] The React application for admin is **never downloaded** to unauthorized browsers
- [ ] Google OAuth login correctly sets session cookies
- [ ] API routes continue to function using cookie authentication
- [ ] Admin email whitelist verification works in middleware
- [ ] No regression in existing admin functionality

---

## Testing Plan

1. **Unauthorized Access Test**
   - Open incognito browser
   - Go to `yestoryd.com/admin`
   - Should redirect to `/admin/login` (check Network tab for 307)
   - Admin JS bundle should NOT be downloaded

2. **Authorized Access Test**
   - Login with admin email
   - Should redirect to `/admin` dashboard
   - All data should load correctly

3. **Non-Admin User Test**
   - Login with non-admin Google account
   - Should be blocked and shown error
   - Should NOT see admin dashboard

---

## Estimated Effort

| Task | Time |
|------|------|
| Research @supabase/ssr docs | 1 hour |
| Implement cookie-based auth | 2-3 hours |
| Test OAuth flow | 1 hour |
| Revert middleware | 30 min |
| Cleanup & remove hacks | 1 hour |
| **Total** | **5-6 hours** |

---

## References

- [Supabase SSR Auth Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- Session 9 transcript: `/mnt/transcripts/2026-01-10-10-38-33-session9-journey-testing-bugs.txt`

---

## Created
- **Date**: January 10, 2026
- **Session**: 9 (Customer Journey Audit)
- **Author**: Development Team

## Status
📋 **Backlog** - To be addressed post-launch
