// ============================================================
// FILE: lib/admin-auth.ts
// ============================================================
// Reusable Admin Authentication Helper
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Use in all /api/admin/* routes for consistent auth
// Uses @supabase/ssr for proper cookie handling in API routes
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Admin email whitelist (keep in sync with app/admin/layout.tsx)
const ADMIN_EMAILS = [
  'rucha.rai@yestoryd.com',
  'rucha@yestoryd.com',
  'amitkrai17@gmail.com',
  'amitkrai17@yestoryd.com',
  'engage@yestoryd.com',
];

// Service role client for database operations (bypasses RLS)
export const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auth client using @supabase/ssr for proper cookie reading
export const getSupabaseAuth = async () => {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
};

export interface AdminAuthResult {
  authorized: boolean;
  email?: string;
  error?: string;
  userId?: string;
}

/**
 * Verify admin authentication for API routes
 * Uses @supabase/ssr to correctly read session cookies
 * 
 * Usage:
 * ```typescript
 * const auth = await requireAdmin();
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
 * }
 * // auth.email is available for audit logging
 * ```
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  try {
    // Use @supabase/ssr to properly read cookies
    const supabase = await getSupabaseAuth();

    // Get user from session cookie
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { 
        authorized: false, 
        error: 'Authentication required - please log in' 
      };
    }

    const email = user.email?.toLowerCase();

    if (!email) {
      return { 
        authorized: false, 
        error: 'Invalid session - no email found' 
      };
    }

    // Check if email is in admin whitelist
    if (!ADMIN_EMAILS.includes(email)) {
      // Security logging - privilege escalation attempt detection
      console.warn(JSON.stringify({
        event: 'admin_access_denied',
        email,
        userId: user.id,
        timestamp: new Date().toISOString(),
        message: 'Valid user attempted admin access without permission',
      }));
      
      return { 
        authorized: false, 
        error: 'Admin access required',
        email, // Include for logging
      };
    }

    return { 
      authorized: true, 
      email,
      userId: user.id,
    };

  } catch (err) {
    console.error('Admin auth error:', err);
    return { 
      authorized: false, 
      error: 'Authentication check failed' 
    };
  }
}

/**
 * Quick admin email check (for use when you already have the email)
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Get admin emails list (for testing/debugging)
 */
export function getAdminEmails(): readonly string[] {
  return ADMIN_EMAILS;
}
