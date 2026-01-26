/**
 * Supabase Server Client - API Routes & Server Components
 * 
 * Use this for:
 * - API routes (app/api/*)
 * - Server components
 * - Server actions
 * - Any server-side data operations
 * 
 * Uses SERVICE_ROLE_KEY for elevated permissions (bypasses RLS)
 * 
 * Usage:
 * import { supabaseAdmin } from '@/lib/supabase/server';
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Admin client with service role - bypasses RLS
// Use this in API routes for admin operations
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to create a client with user's auth context (for future use with auth)
export function createServerClient(accessToken?: string) {
  if (accessToken) {
    return createClient<Database>(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
  return supabaseAdmin;
}

// Re-export for convenience
export { createClient };
