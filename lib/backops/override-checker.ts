// ============================================================
// FILE: lib/backops/override-checker.ts
// PURPOSE: Check for active suppress/pause overrides before
//          crons take action on entities.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Check if nudges are suppressed for an entity.
 * Returns true if nudges should be SKIPPED.
 */
export async function isNudgeSuppressed(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from('ops_events')
      .select('decision_reason')
      .eq('event_type', 'nudge_suppressed')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return false;

    const reason = data[0].decision_reason as Record<string, unknown> | null;
    if (!reason) return false;

    const expiresAt = reason.expires_at as string | undefined;
    if (!expiresAt) return false;

    return new Date(expiresAt) > new Date();
  } catch {
    return false; // On error, don't suppress — let the cron run
  }
}

/**
 * Check if a specific cron is paused via BackOps override.
 * Returns true if the cron should SKIP its run.
 */
export async function isCronPaused(cronName: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Check for pause targeting this cron or 'all'
    const { data } = await supabase
      .from('ops_events')
      .select('decision_made, decision_reason, created_at')
      .eq('event_type', 'override_applied')
      .eq('entity_type', 'cron')
      .in('decision_made', [`pause:${cronName}`, 'pause:all'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return false;

    const reason = data[0].decision_reason as Record<string, unknown> | null;
    if (!reason) return false;

    const expiresAt = reason.expires_at as string | undefined;
    if (!expiresAt) return false;
    if (new Date(expiresAt) <= new Date()) return false;

    // Check for a more recent resume
    const { data: resumed } = await supabase
      .from('ops_events')
      .select('created_at')
      .eq('event_type', 'override_applied')
      .eq('entity_type', 'cron')
      .in('decision_made', [`resume:${cronName}`, 'resume:all'])
      .gt('created_at', data[0].created_at!)
      .limit(1);

    if (resumed && resumed.length > 0) return false;

    return true;
  } catch {
    return false;
  }
}
