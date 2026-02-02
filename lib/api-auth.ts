// ============================================================
// FILE: lib/api-auth.ts
// ============================================================
// Universal API Authentication Helper
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Supports: Admin, Coach, and combined access patterns
// Auth Methods: Bearer token (primary) + Cookie fallback
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { loadAuthConfig } from '@/lib/config/loader';

// ==================== TYPES ====================

export interface AuthResult {
  authorized: boolean;
  email?: string;
  userId?: string;
  role?: 'admin' | 'coach' | 'parent';
  coachId?: string;
  error?: string;
}

// ==================== SERVICE CLIENT ====================
// TODO: Add <Database> generic once all consumers handle strict types
// import type { Database } from '@/lib/supabase/database.types';

export const getServiceSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ==================== AUTH HELPERS ====================

/**
 * Get authenticated user from Bearer token or cookies
 */
async function getAuthenticatedUser(): Promise<{ user: any; error: string | null }> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    // Method 1: Bearer token (from fetch interceptor)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return { user: data.user, error: null };
      }
    }

    // Method 2: Cookie-based auth (SSR)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch { /* Server Component context */ }
          },
        },
      }
    );
    
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return { user: data.user, error: null };
    }

    return { user: null, error: 'Authentication required' };
  } catch (err) {
    console.error('Auth error:', err);
    return { user: null, error: 'Authentication check failed' };
  }
}

// ==================== PUBLIC API ====================

/**
 * Require admin access - validates against admin email whitelist
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user, error } = await getAuthenticatedUser();
  
  if (error || !user) {
    return { authorized: false, error: error || 'Authentication required' };
  }

  const email = user.email?.toLowerCase();
  if (!email) {
    return { authorized: false, error: 'Invalid session - no email' };
  }

  const authConfig = await loadAuthConfig();
  if (!authConfig.adminEmails.includes(email)) {
    console.warn(JSON.stringify({
      event: 'admin_access_denied',
      email,
      userId: user.id,
      timestamp: new Date().toISOString(),
    }));
    return { authorized: false, error: 'Admin access required', email };
  }

  return { authorized: true, email, userId: user.id, role: 'admin' };
}

/**
 * Require coach access - validates against coaches table
 */
export async function requireCoach(): Promise<AuthResult> {
  const { user, error } = await getAuthenticatedUser();
  
  if (error || !user) {
    return { authorized: false, error: error || 'Authentication required' };
  }

  const email = user.email?.toLowerCase();
  if (!email) {
    return { authorized: false, error: 'Invalid session - no email' };
  }

  const supabase = getServiceSupabase();
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, is_active')
    .eq('email', email)
    .single();

  if (!coach || !coach.is_active) {
    return { authorized: false, error: 'Coach access required', email };
  }

  return { authorized: true, email, userId: user.id, role: 'coach', coachId: coach.id };
}

/**
 * Require admin OR coach access
 */
export async function requireAdminOrCoach(): Promise<AuthResult> {
  const { user, error } = await getAuthenticatedUser();
  
  if (error || !user) {
    return { authorized: false, error: error || 'Authentication required' };
  }

  const email = user.email?.toLowerCase();
  if (!email) {
    return { authorized: false, error: 'Invalid session - no email' };
  }

  // Check admin first - but also get coachId if they're a coach too
    const authConfig = await loadAuthConfig();
    if (authConfig.adminEmails.includes(email)) {
      const supabase = getServiceSupabase();
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', email)
        .single();
      return { authorized: true, email, userId: user.id, role: 'admin', coachId: coach?.id };
    }

  // Check coach
  const supabase = getServiceSupabase();
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, is_active')
    .eq('email', email)
    .single();

  if (coach && coach.is_active) {
    return { authorized: true, email, userId: user.id, role: 'coach', coachId: coach.id };
  }

  return { authorized: false, error: 'Admin or Coach access required', email };
}

/**
 * Require authenticated user (any role)
 */
export async function requireAuth(): Promise<AuthResult> {
  const { user, error } = await getAuthenticatedUser();
  
  if (error || !user) {
    return { authorized: false, error: error || 'Authentication required' };
  }

  return { 
    authorized: true, 
    email: user.email?.toLowerCase(), 
    userId: user.id 
  };
}

/**
 * Check if email is admin
 */
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const authConfig = await loadAuthConfig();
  return authConfig.adminEmails.includes(email.toLowerCase());
}

/**
 * Get admin emails list
 */
export async function getAdminEmails(): Promise<readonly string[]> {
  const authConfig = await loadAuthConfig();
  return authConfig.adminEmails;
}

/**
 * Get authenticated user if available (optional auth)
 * Returns user info if authenticated, null if not
 * Use this for routes where auth enhances but isn't required
 */
export async function getOptionalAuth(): Promise<{
  email?: string;
  userId?: string;
  parentId?: string;
  coachId?: string;
  role?: string;
} | null> {
  const { user, error } = await getAuthenticatedUser();
  
  if (error || !user) {
    return null;
  }

  const email = user.email?.toLowerCase();
  
  // Check if admin
  const authConfig = await loadAuthConfig();
  if (email && authConfig.adminEmails.includes(email)) {
    return { email, userId: user.id, role: 'admin' };
  }

  // Check if coach
  const supabase = getServiceSupabase();
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('email', email)
    .single();

  if (coach) {
    return { email, userId: user.id, coachId: coach.id, role: 'coach' };
  }

  // Check if parent
  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('email', email)
    .single();

  if (parent) {
    return { email, userId: user.id, parentId: parent.id, role: 'parent' };
  }

  return { email, userId: user.id };
}
