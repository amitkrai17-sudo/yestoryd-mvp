// POST /api/admin/tuition/reassign-batch
// Move a tuition student to a different batch.
//
// 2F: the full relocation — re-stamp membership + cancel/regenerate future sessions on the
// TARGET batch's schedule + per-occurrence calendar reconcile — is delegated to the canonical
// reconciler applyBatchScheduleToMember. This route owns ONLY auth, request parsing, the
// no-op / pre-enrollment early-exits, and the response shape the admin UI consumes (it checks
// res.ok then refetches). The pre-2F bespoke logic — bulk scheduled_sessions.batch_id update,
// meet_link copy, and the STALE single per-batch calendar_event_id attendee add/remove (audit
// S2) — is removed; the reconciler owns calendar per (batch,date,time) occurrence.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { applyBatchScheduleToMember } from '@/lib/scheduling/apply-batch-schedule';

export const dynamic = 'force-dynamic';

const ReassignSchema = z.object({
  onboardingId: z.string().uuid(),
  newBatchId: z.string().uuid(),
});

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  const body = await req.json();
  const parsed = ReassignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { onboardingId, newBatchId } = parsed.data;

  // 1. Resolve onboarding → current batch + enrollment. select('*') because batch_id is a
  //    migration-added column not in the generated types (same precedent as create/route.ts).
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('*')
    .eq('id', onboardingId)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  const oldBatchId = (onboarding as any).batch_id as string | null;
  if (oldBatchId === newBatchId) {
    return NextResponse.json({ message: 'Already in this batch', changed: false });
  }

  // Ownership (2G-3): the reconciler does NOT check ownership — this route does. A coach may
  // reassign only BETWEEN batches they own: both the source child (onboarding.coach_id) AND
  // the target batch (tuition_batches.coach_id) must be theirs. Admin may reassign any.
  if (auth.role === 'coach') {
    if (onboarding.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // tuition_batches not in generated types yet → 'as any' on the client (2B precedent).
    const { data: targetBatch } = await (supabase as any)
      .from('tuition_batches')
      .select('coach_id')
      .eq('id', newBatchId)
      .maybeSingle();
    if (!targetBatch || targetBatch.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const reason = `Batch reassignment from ${oldBatchId ?? 'none'} to ${newBatchId}`;

  // 2. Pre-enrollment onboarding (no enrollment yet → no sessions to relocate): the move is a
  //    pure membership pointer. Re-stamp batch_id directly; nothing else to do.
  if (!onboarding.enrollment_id) {
    await supabase
      .from('tuition_onboarding')
      .update({ batch_id: newBatchId, updated_at: new Date().toISOString() } as any)
      .eq('id', onboardingId);
    return NextResponse.json({ success: true, changed: true, newBatchId });
  }

  // 3. Enrolled member: delegate the full relocation to the canonical reconciler. It re-stamps
  //    membership, cancels future sessions (POLICY D batch-safe teardown), regenerates them on
  //    the target batch's schedule (balance-bounded), and reconciles each onto its shared
  //    (batch,date,time) occurrence event. fromDate defaults to today IST inside the helper.
  //    NO balance / ledger / payment writes.
  const result = await applyBatchScheduleToMember({
    supabase,
    enrollmentId: onboarding.enrollment_id,
    batchId: newBatchId,
    actor: auth.role === 'coach' ? 'coach' : 'admin',
    reason,
    requestId,
  });

  // Propagate a non-200 (409 unconfirmed batch, 404 not found, 500 regen failure) so the
  // operator sees the partial-state failure rather than a false success.
  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    changed: true,
    newBatchId,
    cancelled: result.cancelled,
    created: result.created,
  });
}, { auth: 'adminOrCoach' });
