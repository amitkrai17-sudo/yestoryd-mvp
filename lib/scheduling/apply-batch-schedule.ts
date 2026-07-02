// ============================================================================
// FILE: lib/scheduling/apply-batch-schedule.ts
// PURPOSE: Canonical reconciler (2D) — recompute ONE tuition member's FUTURE
//   scheduled_sessions against a batch definition. Past rows are immutable;
//   regeneration is balance-bounded; rows stay per-child.
//
//   It COMPOSES the existing seams — it invents nothing:
//     • CANCEL FUTURE   → transitionSessionStatus('cancelled')  (SOLE status writer;
//       POLICY D keeps a shared batch event alive while live siblings remain).
//       Same pattern as lib/tuition/remove-lapsed-member.ts.
//     • REGENERATE      → scheduleTuitionSessions(enrollmentId, startAfter)  (the 2B
//       generator: balance-bounded sessions_remaining−open delta, reads the batch row,
//       stamps batch_id, born skipCalendar:true). No payment event needed. The generator
//       ALSO owns the post-generation calendar reconcile (2E) — it shares one
//       (batch,date,time) occurrence event for BOTH offline and online — so this helper
//       does NOT reconcile per row (single seam, no double-reconcile).
//
//   MONEY-INERT — writes NONE of: sessions_remaining, tuition_session_ledger,
//   payments, revenue, or any onboarding money field. The ONLY onboarding write is the
//   batch_id membership pointer. "Balance follows the kid": sessions_remaining is
//   untouched; only the DATES move.
//
//   NO auth (callers own it). NO UI. NOT wired to any caller yet (reassign-batch stays
//   as-is until 2F).
//
//   IDEMPOTENCY: re-running with the same (enrollment, batch, fromDate) cancels the
//   just-made future rows and regenerates the same balance-bounded set — net stable.
// ============================================================================

import { transitionSessionStatus, type TransitionActor } from './transition-session-status';
import { scheduleTuitionSessions } from './enrollment-scheduler';
import { formatDateISO } from '@/lib/utils/date-format';

export interface ApplyBatchScheduleArgs {
  /** Admin client from the caller's scope (caller owns auth + ownership). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  enrollmentId: string;
  /** Target batch this member should follow from fromDate forward. */
  batchId: string;
  /** YYYY-MM-DD (IST). Rows on/after this date are recomputed; earlier rows are immutable.
   *  Defaults to today IST. */
  fromDate?: string;
  /** WHO initiated — forwarded to the status writer + activity_log. */
  actor: Extract<TransitionActor, 'admin' | 'coach' | 'system'>;
  /** Human reason (audit + cancel-loop reason text). */
  reason: string;
  requestId: string;
}

export interface ApplyBatchScheduleResult {
  cancelled: number;
  created: number;
  batchId: string;
  status: number;
  body: Record<string, unknown>;
}

export async function applyBatchScheduleToMember(
  args: ApplyBatchScheduleArgs,
): Promise<ApplyBatchScheduleResult> {
  const { supabase, enrollmentId, batchId, actor, reason, requestId } = args;
  const fromDate = args.fromDate ?? formatDateISO(new Date());

  // 1. Load enrollment + the target batch. sessions_per_week / child schedule reads stay
  //    inside the 2B generator (single source — not duplicated here).
  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollments')
    .select('id, child_id, enrollment_type')
    .eq('id', enrollmentId)
    .single();

  if (enrErr || !enrollment) {
    return { cancelled: 0, created: 0, batchId, status: 404, body: { error: 'Enrollment not found' } };
  }
  if (enrollment.enrollment_type !== 'tuition') {
    return { cancelled: 0, created: 0, batchId, status: 400, body: { error: 'Not a tuition enrollment' } };
  }

  // GATE: never regenerate on an unconfirmed batch (tuition_batches not in generated types
  // yet → 'as any' on the client, mirroring the 2B reader).
  const { data: batch } = await (supabase as any)
    .from('tuition_batches')
    .select('id, schedule_confirmed')
    .eq('id', batchId)
    .single();

  if (!batch) {
    return { cancelled: 0, created: 0, batchId, status: 404, body: { error: `Batch not found: ${batchId}` } };
  }
  if (!batch.schedule_confirmed) {
    console.log(JSON.stringify({ requestId, event: 'batch_schedule_unconfirmed', enrollmentId, batchId }));
    return { cancelled: 0, created: 0, batchId, status: 409, body: { error: 'batch_schedule_unconfirmed', batchId } };
  }

  // 2. Re-stamp membership pointer ONLY (batch_id — not money). The 2B generator reads
  //    onboarding.batch_id to know which batch to schedule against, so this MUST precede
  //    regeneration.
  await supabase
    .from('tuition_onboarding')
    .update({ batch_id: batchId, updated_at: new Date().toISOString() })
    .eq('enrollment_id', enrollmentId);

  // 3. CANCEL FUTURE (scheduled_date >= fromDate) through the SOLE status writer. POLICY D
  //    handles batch-safe calendar/Recall teardown — a shared (batch,date,time) event is
  //    preserved while live siblings remain. Past rows (< fromDate) are NEVER selected.
  //    Same loop pattern as removeLapsedMember.
  let cancelled = 0;
  const { data: futureRows } = await supabase
    .from('scheduled_sessions')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['scheduled', 'pending'])
    .gte('scheduled_date', fromDate);

  for (const s of (futureRows ?? []) as Array<{ id: string }>) {
    try {
      const t = await transitionSessionStatus({
        sessionId: s.id,
        to: 'cancelled',
        actor,
        reason,
        requestId,
        opts: { supabase, notify: false },
      });
      if (t.ok && !t.noop) cancelled++;
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'apply_batch_cancel_error', enrollmentId, sessionId: s.id, error: e instanceof Error ? e.message : String(e) }));
    }
  }

  // 4. REGENERATE FUTURE on the batch's schedule from fromDate. The generator anchors at
  //    (startAfterDate + 1 day), so pass (fromDate − 1 day) to land the first session ON
  //    fromDate. It is balance-bounded (sessions_remaining − open rows), reads the batch
  //    row, stamps batch_id, and is born skipCalendar:true. No payment event required.
  const anchor = new Date(`${fromDate}T12:00:00+05:30`);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  const startAfter = formatDateISO(anchor);

  const gen = await scheduleTuitionSessions(enrollmentId, startAfter, supabase);
  const created = gen.sessionsCreated;

  if (!gen.success) {
    console.error(JSON.stringify({ requestId, event: 'apply_batch_regenerate_failed', enrollmentId, batchId, errors: gen.errors }));
  }

  // 5. CALENDAR — owned by the generator (2E). scheduleTuitionSessions now reconciles each
  //    row it creates onto its shared (batch,date,time) occurrence event, so this helper no
  //    longer reconciles per row (single seam, no double-reconcile).

  // 6. Audit.
  await supabase.from('activity_log').insert({
    action: 'batch_schedule_applied',
    user_email: actor,
    user_type: actor,
    metadata: {
      enrollment_id: enrollmentId,
      child_id: enrollment.child_id,
      batch_id: batchId,
      from_date: fromDate,
      cancelled,
      created,
      reason,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'batch_schedule_applied', enrollmentId, batchId, fromDate, cancelled, created }));

  return {
    cancelled,
    created,
    batchId,
    status: gen.success ? 200 : 500,
    body: gen.success
      ? { success: true, enrollmentId, batchId, fromDate, cancelled, created }
      : { error: 'regeneration_failed', enrollmentId, batchId, fromDate, cancelled, created, generatorErrors: gen.errors },
  };
}
