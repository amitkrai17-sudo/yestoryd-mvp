// ============================================================
// FILE: lib/scheduling/resolve-session-creation.ts
// PURPOSE: ONE creation-decision used by all paid paths (payment verify +
//   record-offline + webhook) so a tuition renewal schedules dated sessions on
//   EVERY path — not just the webhook. Before this, verify/record-offline gated
//   scheduling behind `if (isFirstPayment)`, so a renewal credited the ledger but
//   created no dated rows unless the async webhook happened to run.
//
//   Behavior:
//     - First payment (isFirstPayment=true): startAfter undefined → the scheduler
//       starts from enrollment.program_start (initial activation).
//     - Renewal/top-up (isFirstPayment=false): startAfter = latest existing
//       scheduled_date for the enrollment, so new sessions APPEND after the last
//       one (mirrors the prior webhook block exactly).
//
//   Session mode is still read from tuition_onboarding.default_session_mode inside
//   scheduleTuitionSessions — NO mode param here (the per-renewal mode toggle is a
//   later step). The idempotent delta guard in enrollment-scheduler (counts open
//   sessions, schedules only sessions_remaining - alreadyScheduled) prevents
//   duplicates, so this helper does not re-implement that logic.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleTuitionSessions, type TuitionSchedulerResult } from './enrollment-scheduler';

export async function resolveSessionCreation(
  enrollmentId: string,
  isFirstPayment: boolean,
  supabaseClient?: ReturnType<typeof createAdminClient>,
): Promise<TuitionSchedulerResult> {
  const supabase = supabaseClient || createAdminClient();

  // Renewal/top-up: append after the last existing session (mirror webhook:301-309).
  let startAfter: string | undefined;
  if (!isFirstPayment) {
    const { data: lastSession } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date')
      .eq('enrollment_id', enrollmentId)
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .single();
    startAfter = lastSession?.scheduled_date || undefined;
  }

  return scheduleTuitionSessions(enrollmentId, startAfter, supabase);
}
