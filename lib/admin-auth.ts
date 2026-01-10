// ============================================================
// FILE: lib/admin-auth.ts
// ============================================================
// Reusable Admin Authentication Helper
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Use in all /api/admin/* routes for consistent auth
// Supports both cookie-based and token-based authentication
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';

// Admin email whitelist (keep in sync with middleware.ts)
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
 * Checks both: 1) Authorization Bearer token, 2) Session cookies
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    let user = null;
    let error = null;

    // Method 1: Check Bearer token first
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error: tokenError } = await supabase.auth.getUser(token);
      user = data?.user;
      error = tokenError;
    }

    // Method 2: Fallback to cookie-based auth
    if (!user) {
      const supabase = await getSupabaseAuth();
      const { data, error: cookieError } = await supabase.auth.getUser();
      user = data?.user;
      if (!error) error = cookieError;
    }

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
      console.warn(JSON.stringify({
        event: 'admin_access_denied',
        email,
        userId: user.id,
        timestamp: new Date().toISOString(),
      }));

      return {
        authorized: false,
        error: 'Admin access required',
        email,
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
 * Quick admin email check
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Get admin emails list
 */
export function getAdminEmails(): readonly string[] {
  return ADMIN_EMAILS;
}
