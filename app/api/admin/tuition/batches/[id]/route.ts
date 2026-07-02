// GET /api/admin/tuition/batches/[id]     — batch detail (schedule SSOT) + member roster
// DELETE /api/admin/tuition/batches/[id]  — soft-retire a batch (2G-2.5-fix3): cancel members'
//   future sessions (POLICY-D teardown via the sole status writer), set status='deleted', free the
//   slot. NO money/ledger writes, NO hard row delete.
// Both ownership-scoped: a coach may act ONLY on their own batch; an admin may act on any.
// The reconciler does NOT check ownership — this route does (mirrors 2G-1b scoping).

import { NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';

export const dynamic = 'force-dynamic';

export const GET = withParamsHandler<{ id: string }>(async (_req, { id }, { auth, supabase }) => {
  // tuition_batches not in generated types yet → 'as any' on the client (2B precedent).
  // 2G-2.5-fix3: a deleted batch is not editable — exclude it (→ 404).
  const { data: batch } = await (supabase as any)
    .from('tuition_batches')
    .select('id, coach_id, days, times, default_time, session_mode, meet_link, duration_minutes, schedule_confirmed')
    .eq('id', id)
    .neq('status', 'deleted')
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  // Ownership — a coach may only access a batch they own.
  if (auth.role === 'coach' && batch.coach_id !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Roster — members via tuition_onboarding.batch_id → enrollments (active + payment_pending;
  // terminated/archived excluded by the status filter).
  const { data: onbs } = await supabase
    .from('tuition_onboarding')
    .select('child_name, enrollment_id')
    .eq('batch_id' as any, id);

  const nameByEnr = new Map<string, string>();
  const enrollmentIds: string[] = [];
  for (const o of (onbs ?? []) as Array<{ child_name: string; enrollment_id: string | null }>) {
    if (o.enrollment_id) { nameByEnr.set(o.enrollment_id, o.child_name); enrollmentIds.push(o.enrollment_id); }
  }

  let roster: { enrollmentId: string; childName: string; status: string }[] = [];
  if (enrollmentIds.length > 0) {
    const { data: enrs } = await supabase
      .from('enrollments')
      .select('id, status')
      .in('id', enrollmentIds)
      .in('status', ['active', 'payment_pending']);
    roster = (enrs ?? []).map((e) => ({
      enrollmentId: e.id,
      childName: nameByEnr.get(e.id) || 'Student',
      status: e.status as string,
    }));
  }

  return NextResponse.json({
    batchId: batch.id,
    coachId: batch.coach_id,
    days: batch.days ?? [],
    times: batch.times ?? {},
    default_time: batch.default_time ?? null,
    session_mode: batch.session_mode ?? 'offline',
    meet_link: batch.meet_link ?? null,
    duration_minutes: batch.duration_minutes ?? null,
    schedule_confirmed: !!batch.schedule_confirmed,
    roster,
  });
}, { auth: 'adminOrCoach' });

// DELETE /api/admin/tuition/batches/[id]
// Soft-retire a batch: cancel every member's FUTURE sessions via the sole status writer (POLICY-D
// does the batch-safe calendar/Recall teardown), flip tuition_batches.status='deleted', free the
// slot. Ownership-scoped (coach → own only). NO money/ledger/payment writes; NEVER a hard row delete.
export const DELETE = withParamsHandler<{ id: string }>(async (_req, { id }, { auth, supabase, requestId }) => {
  // 1. Load batch + ownership. tuition_batches not in generated types → 'as any' (2B precedent).
  const { data: batch } = await (supabase as any)
    .from('tuition_batches')
    .select('id, coach_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  if (auth.role === 'coach' && batch.coach_id !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Idempotent: already retired → report zero effect, don't re-teardown.
  if (batch.status === 'deleted') {
    return NextResponse.json({ deleted: true, sessionsCancelled: 0, membersAffected: 0, alreadyDeleted: true });
  }

  const actor = auth.role === 'coach' ? ('coach' as const) : ('admin' as const);

  // 2. Members (active + payment_pending) via tuition_onboarding.batch_id → enrollments.
  const { data: onbs } = await supabase
    .from('tuition_onboarding')
    .select('enrollment_id')
    .eq('batch_id' as any, id);
  const enrollmentIds: string[] = [];
  for (const o of (onbs ?? []) as Array<{ enrollment_id: string | null }>) {
    if (o.enrollment_id) enrollmentIds.push(o.enrollment_id);
  }
  let memberEnrollmentIds: string[] = [];
  if (enrollmentIds.length > 0) {
    const { data: enrs } = await supabase
      .from('enrollments')
      .select('id')
      .in('id', enrollmentIds)
      .in('status', ['active', 'payment_pending']);
    memberEnrollmentIds = ((enrs ?? []) as Array<{ id: string }>).map((e) => e.id);
  }

  // 3. Cancel each member's FUTURE sessions through the SOLE status writer (POLICY-D teardown —
  //    same pattern as removeLapsedMember). No bespoke cancelEvent / calendar code here.
  let sessionsCancelled = 0;
  for (const enrollmentId of memberEnrollmentIds) {
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
          actor,
          reason: 'batch_deleted',
          requestId,
          opts: { supabase, notify: false },
        });
        if (r.ok && !r.noop) sessionsCancelled++;
      } catch (e) {
        console.error(JSON.stringify({ requestId, event: 'batch_delete_cancel_error', batchId: id, sessionId: s.id, error: e instanceof Error ? e.message : String(e) }));
      }
    }
  }

  // 4. Soft-delete — flip status; free the slot for a new batch. NEVER a hard DROP/row delete.
  const nowIso = new Date().toISOString();
  const { error: updErr } = await (supabase as any)
    .from('tuition_batches')
    .update({ status: 'deleted', updated_at: nowIso })
    .eq('id', id);
  if (updErr) {
    return NextResponse.json({ error: `Failed to delete batch: ${updErr.message}` }, { status: 500 });
  }

  // 5. Audit — no money/ledger/payment writes anywhere in this path.
  await supabase.from('activity_log').insert({
    action: 'batch_deleted',
    user_email: auth.email ?? actor,
    user_type: actor,
    metadata: {
      batch_id: id,
      actor,
      members_affected: memberEnrollmentIds.length,
      sessions_cancelled: sessionsCancelled,
    },
  });

  return NextResponse.json({ deleted: true, sessionsCancelled, membersAffected: memberEnrollmentIds.length });
}, { auth: 'adminOrCoach' });
