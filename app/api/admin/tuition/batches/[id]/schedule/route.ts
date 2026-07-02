// PATCH /api/admin/tuition/batches/[id]/schedule
// Change a batch's STANDING schedule, then cancel+regenerate every member's FUTURE sessions
// via the canonical reconciler (per child). Ownership-scoped (coach → own batch only; admin →
// any). NO money writes — the reconciler guarantees per-child balance/ledger are untouched.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { applyBatchScheduleToMember } from '@/lib/scheduling/apply-batch-schedule';
import { checkBatchConflict } from '@/lib/scheduling/batch-conflict';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  days: z.array(z.string()).min(1),
  times: z.record(z.string()).optional(),
  default_time: z.string().nullable().optional(),
  session_mode: z.enum(['online', 'offline']),
  duration_minutes: z.number().int().min(15).max(120).optional(),
});

export const PATCH = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Concrete time required (mirrors the schedule_confirmed rule: days + a real time).
  const hasTime = !!input.default_time || (!!input.times && Object.keys(input.times).length > 0);
  if (!hasTime) {
    return NextResponse.json({ error: 'A concrete time (default_time or per-day times) is required' }, { status: 400 });
  }

  // Ownership — load the batch's coach; a coach may only edit a batch they own.
  const { data: batch } = await (supabase as any)
    .from('tuition_batches')
    .select('id, coach_id, duration_minutes')
    .eq('id', id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  if (auth.role === 'coach' && batch.coach_id !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2G-2.5-fix3: coach batch-time guard is a HARD block again — check EACH new day, excluding THIS
  // batch. A buffered conflict (overlap or <15min gap, all modes) → 409 (NO update, NO reconcile).
  const effDuration = input.duration_minutes ?? batch.duration_minutes ?? 60;
  const warnings: string[] = [];
  for (const day of input.days) {
    const dayStart = (input.times && input.times[day]) || input.default_time || undefined;
    if (!dayStart) continue;
    const conf = await checkBatchConflict({
      supabase,
      coachId: batch.coach_id,
      day,
      startTime: dayStart,
      durationMinutes: effDuration,
      excludeBatchId: id,
    });
    if (conf.level === 'block') {
      return NextResponse.json({ error: 'batch_time_conflict', conflicts: conf.conflicts }, { status: 409 });
    }
  }

  // Step 1: update the batch's standing schedule + confirm it.
  const upd: Record<string, unknown> = {
    days: input.days,
    session_mode: input.session_mode,
    schedule_confirmed: true,
    updated_at: new Date().toISOString(),
  };
  if (input.times !== undefined) upd.times = input.times;
  if (input.default_time !== undefined) upd.default_time = input.default_time;
  if (input.duration_minutes !== undefined) upd.duration_minutes = input.duration_minutes;

  const { error: updErr } = await (supabase as any).from('tuition_batches').update(upd).eq('id', id);
  if (updErr) {
    return NextResponse.json({ error: `Failed to update batch: ${updErr.message}` }, { status: 500 });
  }

  // Step 2: members (active + payment_pending) via tuition_onboarding.batch_id → enrollments.
  const { data: onbs } = await supabase
    .from('tuition_onboarding')
    .select('child_name, enrollment_id')
    .eq('batch_id' as any, id);
  const nameByEnr = new Map<string, string>();
  const enrollmentIds: string[] = [];
  for (const o of (onbs ?? []) as Array<{ child_name: string; enrollment_id: string | null }>) {
    if (o.enrollment_id) { nameByEnr.set(o.enrollment_id, o.child_name); enrollmentIds.push(o.enrollment_id); }
  }
  let members: { id: string }[] = [];
  if (enrollmentIds.length > 0) {
    const { data: enrs } = await supabase
      .from('enrollments')
      .select('id')
      .in('id', enrollmentIds)
      .in('status', ['active', 'payment_pending']);
    members = (enrs ?? []) as { id: string }[];
  }

  // Step 3 + 4: reconcile each member, aggregate. Per-member non-200 is surfaced, not swallowed.
  const actor = auth.role === 'coach' ? ('coach' as const) : ('admin' as const);
  let cancelled = 0;
  let created = 0;
  const failures: { enrollmentId: string; childName: string; status: number }[] = [];
  for (const m of members) {
    const r = await applyBatchScheduleToMember({
      supabase,
      enrollmentId: m.id,
      batchId: id,
      actor,
      reason: 'batch_schedule_change',
      requestId,
    });
    cancelled += r.cancelled;
    created += r.created;
    if (r.status !== 200) {
      failures.push({ enrollmentId: m.id, childName: nameByEnr.get(m.id) || 'Student', status: r.status });
    }
  }

  await supabase.from('activity_log').insert({
    action: 'batch_schedule_changed',
    user_email: auth.email ?? actor,
    user_type: actor,
    metadata: { batch_id: id, actor, member_count: members.length, cancelled, created, failures },
  });

  const status = failures.length > 0 ? 207 : 200;
  return NextResponse.json({ batchId: id, memberCount: members.length, cancelled, created, failures, warnings }, { status });
}, { auth: 'adminOrCoach' });
