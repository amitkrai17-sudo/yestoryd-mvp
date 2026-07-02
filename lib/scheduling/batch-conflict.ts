// ============================================================================
// FILE: lib/scheduling/batch-conflict.ts
// PURPOSE: Coach-level batch time-conflict guard (2G-2.5 → 2G-2.5-fix3). Now a HARD
//   single-tier guard with a turnaround buffer:
//   - a strict interval overlap OR a gap smaller than BUFFER_MINUTES on either side
//     (same day, ALL modes) → 'block'
//   - else → 'clear'
//   There is NO 'warn' tier anymore (create-new is block/clear only). 'warn' is kept in
//   the return-type union purely for back-compat with older callers; it is never produced.
//   Deleted batches (status='deleted') are excluded — a retired slot cannot conflict.
//   READ-ONLY — no writes.
//
//   Same-day interval math uses minutes-since-midnight (no Date needed — the comparison
//   is within one weekday). This mirrors the wall-clock convention of session-engine
//   buildStartEnd (setMinutes on a +05:30-anchored Date) without dragging in a date/tz.
// ============================================================================

/** Minimum turnaround gap (minutes) a coach needs between two same-day batches. A gap
 *  strictly smaller than this (or any overlap) is a conflict; a gap of EXACTLY this is allowed. */
const BUFFER_MINUTES = 15;

export interface BatchConflict {
  batchId: string;
  day: string;    // DayKey, e.g. 'Mon'
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  label: string;  // roster child names, or the time range as a fallback
}

export interface BatchConflictResult {
  level: 'block' | 'warn' | 'clear';
  conflicts: BatchConflict[];
}

/** Thrown by the create path (inside createTuitionOnboarding) so routes can map it to a 409. */
export class BatchConflictError extends Error {
  conflicts: BatchConflict[];
  constructor(conflicts: BatchConflict[]) {
    super('batch_time_conflict');
    this.name = 'BatchConflictError';
    this.conflicts = conflicts;
  }
}

/** "HH:MM" or "HH:MM:SS" → minutes since midnight, or null if unparseable. */
function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function checkBatchConflict(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  coachId: string;
  day: string;            // DayKey
  startTime: string;      // "HH:MM" or "HH:MM:SS"
  durationMinutes: number;
  excludeBatchId?: string;
}): Promise<BatchConflictResult> {
  const newStart = toMinutes(args.startTime);
  if (newStart === null || !args.durationMinutes) return { level: 'clear', conflicts: [] };
  const newEnd = newStart + args.durationMinutes;

  // Same-coach batches that run on this day (text[] contains the day) — ALL modes; a row with no
  // resolvable time for the day is skipped below.
  // 2G-6: only a LIVE, CONFIRMED batch occupies the coach's time — require status='active' AND
  // schedule_confirmed=true (on top of the fix3 .neq deleted). Paused / unconfirmed / never-paid
  // batches neither block a create nor surface as a conflict.
  const { data: rows } = await args.supabase
    .from('tuition_batches')
    .select('id, days, times, default_time, duration_minutes')
    .eq('coach_id', args.coachId)
    .neq('status', 'deleted')          // 2G-2.5-fix3: a retired batch's slot cannot conflict.
    .eq('status', 'active')            // 2G-6: only a live batch occupies time.
    .eq('schedule_confirmed', true)    // 2G-6: an unconfirmed batch holds no slot yet.
    .contains('days', [args.day]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sameDay = ((rows ?? []) as any[]).filter((b) => b.id !== args.excludeBatchId);

  const conflicts: BatchConflict[] = [];
  for (const b of sameDay) {
    // Per-day start = COALESCE(times->>day, default_time).
    const raw = (b.times && typeof b.times === 'object' && b.times[args.day]) || b.default_time;
    const exStart = raw ? toMinutes(String(raw)) : null;
    if (exStart === null) continue; // no resolvable time for this day → cannot conflict
    const exEnd = exStart + (b.duration_minutes || args.durationMinutes);
    const c: BatchConflict = {
      batchId: b.id,
      day: args.day,
      start: toHHMM(exStart),
      end: toHHMM(exEnd),
      label: b.id,
    };
    // 2G-2.5-fix3: buffered conflict — an overlap OR a gap smaller than BUFFER_MINUTES on either
    // side. conflict iff newStart < exEnd + BUFFER AND exStart < newEnd + BUFFER. Strict '<' →
    // a gap of EXACTLY BUFFER_MINUTES is NOT a conflict (allowed). No 'warn' tier: buffered → block.
    if (newStart < exEnd + BUFFER_MINUTES && exStart < newEnd + BUFFER_MINUTES) conflicts.push(c);
  }

  // Roster labels for the surfaced conflicts (like the match endpoint).
  if (conflicts.length > 0) {
    const ids = conflicts.map((c) => c.batchId);
    const { data: members } = await args.supabase
      .from('tuition_onboarding')
      .select('batch_id, child_name')
      .in('batch_id', ids)
      .in('status', ['parent_completed', 'parent_pending', 'active']);
    const byBatch = new Map<string, string[]>();
    for (const m of (members ?? []) as Array<{ batch_id: string | null; child_name: string | null }>) {
      if (!m.batch_id) continue;
      const arr = byBatch.get(m.batch_id) ?? [];
      if (m.child_name) arr.push(m.child_name);
      byBatch.set(m.batch_id, arr);
    }
    for (const c of conflicts) {
      const names = byBatch.get(c.batchId) ?? [];
      c.label = names.length ? names.join(', ') : `${c.start}–${c.end}`;
    }
  }

  if (conflicts.length > 0) return { level: 'block', conflicts };
  return { level: 'clear', conflicts: [] };
}
