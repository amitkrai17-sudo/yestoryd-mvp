/**
 * Supabase Admin Client Factory - API Routes & Server-Side
 *
 * Use this for:
 * - API routes that need service role access
 * - Server-side operations that bypass RLS
 * - Cron jobs and background tasks
 *
 * Creates a typed client with service role key each time.
 * For a singleton, use `supabaseAdmin` from './server'.
 *
 * Usage:
 * import { createAdminClient } from '@/lib/supabase/admin';
 * const supabase = createAdminClient();
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
