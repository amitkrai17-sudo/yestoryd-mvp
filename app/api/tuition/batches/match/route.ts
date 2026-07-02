// GET /api/tuition/batches/match
// Server-side batch suggestion for onboarding: same coach_id + set-equal days + equal time.
// Mode is NOT filtered (locked rule). Reads tuition_batches (the schedule SSOT) — NOT the
// onboarding grouping in batches/route.ts. Callable by admin (passes coachId) or coach (the
// server FORCES the requester's own coachId). Returns candidates with their roster (child
// names) for the picker label. Never ships the full batch list to the client to filter.

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

/** Order-insensitive set equality of two DayKey arrays. */
function sameDaySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((d) => sa.has(d));
}

const hhmm = (t: string | null | undefined): string | null => (t ? String(t).slice(0, 5) : null);

export const GET = withApiHandler(async (req: NextRequest, { auth, supabase }) => {
  const params = req.nextUrl.searchParams;
  const paramCoachId = params.get('coachId');
  const days = params.getAll('days');     // DayKey[] e.g. Mon, Wed
  const time = params.get('time');        // canonical "HH:MM"

  // Coaches may match ONLY their own batches (server-forced); admins pass an explicit coachId.
  const coachId = auth.role === 'coach' ? auth.coachId : paramCoachId;
  if (!coachId || days.length === 0 || !time) {
    return NextResponse.json({ matches: [] });
  }

  // Fetch THIS coach's batches server-side (small N) and set/time-match in code — text[]
  // set-equality isn't expressible as one supabase filter. tuition_batches is not in the
  // generated types yet → 'as any' on the client (same precedent as the 2B reader).
  // 2G-6: only a LIVE, CONFIRMED batch is a join target — require status='active' AND
  // schedule_confirmed=true (on top of the fix3 .neq deleted). Paused / unconfirmed / never-paid
  // batches are not offered as join options.
  const { data: rows } = await (supabase as any)
    .from('tuition_batches')
    .select('id, days, times, default_time, session_mode')
    .eq('coach_id', coachId)
    .neq('status', 'deleted')    // 2G-2.5-fix3: a retired batch is not a join target.
    .eq('status', 'active')      // 2G-6: only a live batch can be joined.
    .eq('schedule_confirmed', true); // 2G-6: an unconfirmed batch isn't a join target yet.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = ((rows ?? []) as any[]).filter((b) => {
    if (!sameDaySet((b.days ?? []) as string[], days)) return false;
    const dt = hhmm(b.default_time);
    const tv = b.times && typeof b.times === 'object'
      ? Object.values(b.times).map((v) => hhmm(String(v)))
      : [];
    // Time match: if the batch carries per-day times, ALL must equal the param; otherwise the
    // batch's default_time must equal it.
    return tv.length > 0 ? tv.every((t) => t === time) : dt === time;
  });

  if (candidates.length === 0) return NextResponse.json({ matches: [] });

  // Roster labels — child names per candidate batch (same status set as the batches GET).
  const ids = candidates.map((b) => b.id as string);
  const { data: members } = await supabase
    .from('tuition_onboarding')
    .select('batch_id, child_name')
    .in('batch_id' as any, ids)
    .in('status', ['parent_completed', 'parent_pending', 'active']);

  const namesByBatch = new Map<string, string[]>();
  for (const m of (members ?? []) as Array<{ batch_id: string | null; child_name: string | null }>) {
    if (!m.batch_id) continue;
    const arr = namesByBatch.get(m.batch_id) ?? [];
    if (m.child_name) arr.push(m.child_name);
    namesByBatch.set(m.batch_id, arr);
  }

  const matches = candidates.map((b) => ({
    batchId: b.id as string,
    days: (b.days ?? []) as string[],
    time,
    mode: (b.session_mode ?? 'offline') as string,
    memberNames: namesByBatch.get(b.id as string) ?? [],
  }));

  return NextResponse.json({ matches });
}, { auth: 'adminOrCoach' });
