/**
 * Shared helpers for session operations
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import type { ScheduledSessionWithRelations } from './types';

export function getSupabase() {
  return createAdminClient();
}

export async function logAudit(
  supabase: ReturnType<typeof createAdminClient>,
  action: string,
  details: Record<string, unknown>
) {
  try {
    await supabase.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action,
      metadata: { ...details, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SessionManager] Audit log error:', error);
  }
}

export async function getSessionWithRelations(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<{ session: ScheduledSessionWithRelations | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      children:child_id (id, name, child_name, parent_name, parent_email, parent_phone),
      coaches:coach_id (id, name, email)
    `)
    .eq('id', sessionId)
    .single();

  // The Supabase join returns arrays for relations; we pick the single item
  const session = data ? {
    ...data,
    children: Array.isArray(data.children) ? data.children[0] ?? null : data.children,
    coaches: Array.isArray(data.coaches) ? data.coaches[0] ?? null : data.coaches,
  } as unknown as ScheduledSessionWithRelations : null;

  return { session, error: error as Error | null };
}
