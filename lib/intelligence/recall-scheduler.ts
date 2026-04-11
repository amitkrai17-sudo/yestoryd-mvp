// ============================================================
// Recall Bot Scheduling Decision Engine
// Determines whether an online session needs a Recall.ai bot.
// SCF is primary intelligence source; Recall is secondary (enrichment/audit).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

interface ScheduleDecision {
  schedule: boolean;
  reason: string;
}

/**
 * Decides whether to schedule a Recall bot for a given session.
 * Returns { schedule: true, reason } or { schedule: false, reason }.
 *
 * Rules (checked in order, first match wins):
 * 1. New coach (< 5 completed sessions) → always record for calibration
 * 2. Score drop (last 2 captures both < 70) → record for intervention
 * 3. Periodic assessment (every 4th child session) → record for benchmarking
 * 4. Random audit (every 3rd online session per coach) → record for integrity
 * 5. Otherwise → skip (SCF is sufficient)
 */
export async function shouldScheduleRecallBot(
  sessionId: string,
  coachId: string,
  childId: string
): Promise<ScheduleDecision> {
  const supabase = createAdminClient();

  // 1. New coach check — first 5 sessions always recorded
  const { count: coachSessionCount } = await supabase
    .from('scheduled_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'completed');

  if ((coachSessionCount ?? 0) < 5) {
    return { schedule: true, reason: 'new_coach_calibration' };
  }

  // 2. Score drop — last 2 captures below 70
  const { data: recentScores } = await supabase
    .from('structured_capture_responses')
    .select('intelligence_score')
    .eq('coach_id', coachId)
    .eq('coach_confirmed', true)
    .order('submitted_at', { ascending: false })
    .limit(2);

  if (
    recentScores?.length === 2 &&
    recentScores.every(s => (s.intelligence_score ?? 0) < 70)
  ) {
    return { schedule: true, reason: 'score_drop_intervention' };
  }

  // 3. Periodic assessment — every 4th child session
  const { count: childSessionCount } = await supabase
    .from('scheduled_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('status', 'completed');

  if ((childSessionCount ?? 0) > 0 && (childSessionCount ?? 0) % 4 === 0) {
    return { schedule: true, reason: 'periodic_assessment' };
  }

  // 4. Random audit — every 3rd online session per coach
  const { count: coachOnlineCount } = await supabase
    .from('scheduled_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .not('google_meet_link', 'is', null)
    .in('status', ['completed', 'scheduled', 'confirmed']);

  if ((coachOnlineCount ?? 0) % 3 === 0) {
    return { schedule: true, reason: 'random_audit' };
  }

  // 5. Default: SCF is sufficient
  return { schedule: false, reason: 'scf_sufficient' };
}
