// ============================================================================
// FILE: lib/scheduling/reschedule-occurrence.ts
// PURPOSE: 2G-4 — reschedule a WHOLE batch OCCURRENCE (all kids that share one
//   (batch_id, scheduled_date, scheduled_time) slot) to a new date/time.
//
//   It COMPOSES the existing per-row primitive — it invents nothing:
//     • sibling key   → (batch_id, scheduled_date, scheduled_time), the SAME key
//       the calendar writer's resolveBatchRoom groups a shared occurrence event by
//       (session-calendar-writer.ts:199-201).
//     • per-row move  → rescheduleSession(id, {date,time}, reason) — the SOLE
//       reschedule primitive (DB date/time write + reconcileSessionCalendarEvent +
//       recall-cancel + reminder-reset + notify). Moving every sibling to the SAME
//       new slot re-forms the shared occurrence event at the new (batch,date,time).
//
//   This is NOT a standing-schedule change: it moves ONE date's rows, never
//   tuition_batches, never other dates, never generation.
//   MONEY-INERT — writes NONE of sessions_remaining / ledger / payments / balance.
//   The route owns auth + ownership; this helper owns none.
// ============================================================================

import { rescheduleSession } from './operations/reschedule-session';

// Live (movable) statuses — excludes completed/cancelled, which rescheduleSession rejects anyway.
const MOVABLE_STATUSES = ['scheduled', 'pending', 'confirmed', 'rescheduled'];

export interface RescheduleOccurrenceArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  /** Any session in the occurrence — its (batch,date,time) defines the group. */
  sessionId: string;
  newDate: string;   // "YYYY-MM-DD"
  newTime: string;   // "HH:MM"
  reason: string;
  requestId: string;
}

export interface RescheduleOccurrenceResult {
  status: number;
  batchId: string | null;
  moved: number;
  failures: { sessionId: string; error: string }[];
  body: Record<string, unknown>;
}

export async function rescheduleOccurrence(
  args: RescheduleOccurrenceArgs,
): Promise<RescheduleOccurrenceResult> {
  const { supabase, sessionId, newDate, newTime, reason, requestId } = args;

  // 1. Resolve the anchor row → its batch + original slot. batch_id is a migration-added
  //    column not in the generated types → select('*') / 'as any' (2B precedent).
  const { data: anchor } = await supabase
    .from('scheduled_sessions')
    .select('id, batch_id, scheduled_date, scheduled_time, coach_id')
    .eq('id', sessionId)
    .single();

  if (!anchor) {
    return { status: 404, batchId: null, moved: 0, failures: [], body: { error: 'Session not found' } };
  }
  if (!(anchor as any).batch_id) {
    // Not batched — there is no "whole occurrence"; the single-session path owns this.
    return { status: 400, batchId: null, moved: 0, failures: [], body: { error: 'not_batched' } };
  }

  const batchId = (anchor as any).batch_id as string;

  // 2. Siblings sharing the SAME (batch_id, date, time) occurrence — INCLUDING the anchor.
  //    Only live rows; completed/cancelled are immutable.
  const { data: siblings } = await supabase
    .from('scheduled_sessions')
    .select('id')
    .eq('batch_id', batchId)
    .eq('scheduled_date', anchor.scheduled_date)
    .eq('scheduled_time', anchor.scheduled_time)
    .in('status', MOVABLE_STATUSES);

  const rows = (siblings ?? []) as Array<{ id: string }>;

  // 3. Move EACH sibling via the per-row primitive (transition + calendar reconcile). Same slot
  //    for all → the shared occurrence event re-forms at the new (batch,date,time). No batch /
  //    standing-schedule / balance writes anywhere in this loop.
  let moved = 0;
  const failures: { sessionId: string; error: string }[] = [];
  for (const r of rows) {
    try {
      const res = await rescheduleSession(r.id, { date: newDate, time: newTime }, reason);
      if (res.success) moved++;
      else failures.push({ sessionId: r.id, error: res.error || 'reschedule failed' });
    } catch (e) {
      failures.push({ sessionId: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  console.log(JSON.stringify({ requestId, event: 'occurrence_rescheduled', batchId, newDate, newTime, moved, failed: failures.length }));

  // All ok → 200; some moved → 207 partial; none moved → 500.
  const status = failures.length === 0 ? 200 : moved > 0 ? 207 : 500;
  return {
    status,
    batchId,
    moved,
    failures,
    body: { success: failures.length === 0, batchId, moved, failures },
  };
}
