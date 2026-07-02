// GET /api/tuition/batches/candidates?onboardingId=<uuid>
// Target-batch picker source for reassign (2G-3): the confirmed batches a member could be
// MOVED to. Keyed by the member's onboardingId — the server resolves the child's coach +
// current batch from it, so the client never picks the coach or computes "exclude current".
//
// Candidates = same coach + schedule_confirmed=true + id != current batch_id. Reads
// tuition_batches (the schedule SSOT) — NOT the onboarding grouping in batches/route.ts, and
// NOT the day/time-narrowed match reader. Returns each candidate with its roster (child names)
// for the picker label, mirroring the match endpoint's shape.
//
// Ownership-scoped (the reconciler does NOT check ownership — this read does, mirroring 2G-1b):
// a coach may only list candidates for a child in one of THEIR batches; an admin may list any.

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

const hhmm = (t: string | null | undefined): string | null => (t ? String(t).slice(0, 5) : null);

export const GET = withApiHandler(async (req: NextRequest, { auth, supabase }) => {
  const onboardingId = req.nextUrl.searchParams.get('onboardingId');
  if (!onboardingId) {
    return NextResponse.json({ error: 'onboardingId required' }, { status: 400 });
  }

  // 1. Resolve the member → coach + current batch. select('*') because batch_id is a
  //    migration-added column not in the generated types (same precedent as reassign/create).
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('*')
    .eq('id', onboardingId)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  const coachId = onboarding.coach_id as string;
  const currentBatchId = (onboarding as any).batch_id as string | null;

  // Ownership — a coach may only list candidates for a child in one of their own batches.
  if (auth.role === 'coach' && coachId !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Candidate batches: this coach's CONFIRMED batches, excluding the child's current batch.
  //    tuition_batches not in generated types yet → 'as any' on the client (2B precedent).
  const { data: rows } = await (supabase as any)
    .from('tuition_batches')
    .select('id, days, times, default_time, session_mode, schedule_confirmed')
    .eq('coach_id', coachId)
    .eq('schedule_confirmed', true)
    .neq('status', 'deleted');   // 2G-2.5-fix3: a retired batch is not a reassign target.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = ((rows ?? []) as any[]).filter((b) => b.id !== currentBatchId);

  if (candidates.length === 0) return NextResponse.json({ candidates: [] });

  // 3. Roster labels — child names per candidate batch (same live-status set as the readers).
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

  // Representative time for the label: default_time, else the first per-day time.
  const pickTime = (b: any): string | null => {
    const dt = hhmm(b.default_time);
    if (dt) return dt;
    const tv = b.times && typeof b.times === 'object' ? Object.values(b.times) : [];
    return tv.length > 0 ? hhmm(String(tv[0])) : null;
  };

  const list = candidates.map((b) => ({
    batchId: b.id as string,
    days: (b.days ?? []) as string[],
    time: pickTime(b),
    mode: (b.session_mode ?? 'offline') as string,
    memberNames: namesByBatch.get(b.id as string) ?? [],
  }));

  return NextResponse.json({ candidates: list });
}, { auth: 'adminOrCoach' });
