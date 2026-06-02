import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Resolve the active-enrollment coach for a child.
 *
 * Canonical source for "the enrolled coach of a child" is enrollments.coach_id.
 * A child can have more than one enrollment row (e.g. a completed Starter plus an
 * active Continuance, or multiple seasons), so the active-pick rule is:
 *   status = 'active', tiebreak most-recent (created_at desc), limit 1.
 *
 * Returns null when the child has no active enrollment (e.g. pure lead stage).
 * Single source of truth for the active-pick rule — do not inline this logic elsewhere.
 */
export async function resolveEnrolledCoachId(
  supabase: SupabaseClient<Database>,
  childId: string | null | undefined
): Promise<string | null> {
  if (!childId) return null;

  const { data } = await supabase
    .from('enrollments')
    .select('coach_id')
    .eq('child_id', childId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.coach_id ?? null;
}
