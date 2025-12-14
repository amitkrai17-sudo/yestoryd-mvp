/**
 * Supabase Client - Browser/Client Components
 * 
 * Use this for:
 * - Client components ('use client')
 * - React hooks
 * - Browser-side data fetching
 * 
 * Usage:
 * import { supabase } from '@/lib/supabase/client';
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Singleton pattern - only create one instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
}

// Default export for convenience
export const supabase = getSupabaseClient();

// Re-export createClient for cases where a fresh instance is needed
export { createClient };
