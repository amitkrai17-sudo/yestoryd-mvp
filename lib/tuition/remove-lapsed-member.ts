// ============================================================
// FILE: lib/tuition/remove-lapsed-member.ts
// PURPOSE: Single source of truth for SOFT-REMOVING a lapsed tuition member
//   (2C-3). Terminates a 2C-1-flagged lapsed enrollment and cancels its future
//   sessions through the SOLE status writer — POLICY D (post-2A/2B) handles the
//   batch-safe calendar/Recall teardown, so a shared batch event is preserved
//   while live siblings remain. NEVER deletes the row.
//
//   NO refund, NO money, NO ledger, NO payout, NO enrollment_terminations row,
//   NO raw calendar calls. Re-entry preserves the batch: tuition_onboarding
//   (batch_id / meet_link / calendar_event_id) is left UNTOUCHED.
//
//   The caller is responsible for auth + ownership (admin: any; coach: own
//   coach_id). This helper does the guard, the terminate write, the session
//   cancel loop, and the activity_log write, then returns a {status, body}
//   envelope the route hands straight to NextResponse.json (mirrors
//   lib/tuition/archive-onboarding.ts).
// ============================================================

import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';

export interface RemoveLapsedResult {
  status: number;
  body: Record<string, unknown>;
}

export interface RemoveLapsedArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  enrollmentId: string;
  actorEmail: string;
  actorType: 'admin' | 'coach' | 'system';
  /** Human reason (audit + cancel notification text). */
  reason: string;
  requestId: string;
}

export async function removeLapsedMember(
  args: RemoveLapsedArgs,
): Promise<RemoveLapsedResult> {
  const { supabase, enrollmentId, actorEmail, actorType, reason, requestId } = args;

  // 1. Fetch enrollment.
  const { data: enrollment, error: fetchErr } = await supabase
    .from('enrollments')
    .select('id, status, billing_model, sessions_remaining, at_risk, at_risk_reason, child_id, coach_id')
    .eq('id', enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return { status: 404, body: { error: 'Enrollment not found' } };
  }

  // 2. GUARD — blast-radius rail. Remove ONLY a 2C-1-flagged lapse; idempotent
  //    (already terminated → reject); never remove a recharged (active) member.
  if (
    enrollment.billing_model !== 'prepaid_sessions' ||
    enrollment.at_risk_reason !== 'tuition_lapse_7d' ||
    enrollment.status === 'terminated' ||
    enrollment.status === 'active'
  ) {
    return {
      status: enrollment.status === 'terminated' ? 409 : 400,
      body: {
        error: `Cannot remove — not a removable lapsed member (status='${enrollment.status}', billing_model='${enrollment.billing_model}', at_risk_reason='${enrollment.at_risk_reason}'). Requires billing_model='prepaid_sessions', at_risk_reason='tuition_lapse_7d', status NOT IN ('terminated','active').`,
      },
    };
  }

  // 3. Terminate — single update; populates the (otherwise dormant) terminated_* columns.
  //    No refund, no ledger, no payout, no enrollment_terminations row.
  const nowIso = new Date().toISOString();
  const { error: termErr } = await supabase
    .from('enrollments')
    .update({
      status: 'terminated',
      terminated_at: nowIso,
      termination_reason: reason,
      terminated_by: actorEmail,
      updated_at: nowIso,
    })
    .eq('id', enrollmentId);

  if (termErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_lapse_remove_update_error', enrollmentId, error: termErr.message }));
    return { status: 500, body: { error: 'Failed to terminate enrollment' } };
  }

  // 4. Cancel future sessions via the SOLE status writer. POLICY D (post-2A/2B) does the
  //    batch-safe calendar/Recall teardown — the shared batch event is preserved while
  //    live siblings remain. This helper adds NO cancelEvent / events.delete / calendar code.
  let sessionsCancelled = 0;
  const { data: futureSessions } = await supabase
    .from('scheduled_sessions')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['scheduled', 'pending']);

  for (const s of (futureSessions ?? []) as Array<{ id: string }>) {
    try {
      const r = await transitionSessionStatus({
        sessionId: s.id,
        to: 'cancelled',
        actor: actorType,
        reason,
        requestId,
        opts: { supabase, notify: false },
      });
      if (r.ok && !r.noop) sessionsCancelled++;
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'tuition_lapse_remove_cancel_error', enrollmentId, sessionId: s.id, error: e instanceof Error ? e.message : String(e) }));
    }
  }

  // 5. Activity log — mirror archive-onboarding.ts shape.
  await supabase.from('activity_log').insert({
    action: 'tuition_lapse_removed',
    user_email: actorEmail,
    user_type: actorType,
    metadata: {
      enrollment_id: enrollmentId,
      child_id: enrollment.child_id,
      actor_type: actorType,
      reason,
      sessions_cancelled: sessionsCancelled,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'tuition_lapse_removed', enrollmentId, sessionsCancelled }));

  return { status: 200, body: { success: true, id: enrollmentId, status: 'terminated', sessionsCancelled } };
}
