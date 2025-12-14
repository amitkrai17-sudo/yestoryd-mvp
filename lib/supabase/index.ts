/**
 * Supabase Client Exports
 * 
 * Usage:
 * 
 * Client Components:
 * import { supabase } from '@/lib/supabase';
 * 
 * Server/API Routes:
 * import { supabaseAdmin } from '@/lib/supabase/server';
 */

export { supabase, getSupabaseClient } from './client';
export { supabaseAdmin, createServerClient } from './server';
