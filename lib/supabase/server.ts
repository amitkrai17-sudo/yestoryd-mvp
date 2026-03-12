/**
 * Supabase Server Client - API Routes & Server Components
 *
 * CANONICAL PATTERN: Use `createAdminClient()` from '@/lib/supabase/admin'.
 * This file re-exports `supabaseAdmin` as a singleton for legacy compatibility.
 *
 * Usage:
 * import { supabaseAdmin } from '@/lib/supabase/server';      // legacy singleton
 * import { createAdminClient } from '@/lib/supabase/admin';    // preferred
 */

import { createAdminClient } from './admin';

// Singleton admin client — prefer createAdminClient() in new code
export const supabaseAdmin = createAdminClient();
