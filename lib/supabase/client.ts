/**
 * Supabase Client - Browser/Client Components
 *
 * Uses @supabase/ssr createBrowserClient which stores auth tokens
 * in cookies (via document.cookie) instead of localStorage.
 * This ensures server components and middleware can read the session.
 *
 * Usage:
 * import { supabase } from '@/lib/supabase/client';
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Singleton pattern - only create one instance
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

// Default export for convenience
export const supabase = getSupabaseClient();
