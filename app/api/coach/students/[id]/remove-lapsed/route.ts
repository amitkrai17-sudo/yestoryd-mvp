// ============================================================
// FILE: app/api/coach/students/[id]/remove-lapsed/route.ts
// PURPOSE: Coach-scoped soft-remove of a lapsed tuition member. [id] = enrollment id
//   (same convention as the sibling pay-link route). Ownership: the coach may only
//   act on their OWN enrollments (.eq('coach_id', coachId), requireAdminOrCoach
//   pattern). The shared SSOT helper removeLapsedMember (2C-3) owns the lapse guard
//   (at_risk_reason='tuition_lapse_7d'), the terminate write, and the batch-safe
//   session teardown. NO refund, NO money, NO raw calendar calls.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { removeLapsedMember } from '@/lib/tuition/remove-lapsed-member';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.coachId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    // Optional reason (audit only). Body may be empty.
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'coach_lapse_removal';

    // Ownership gate: enrollment must belong to THIS coach. A coach must not be able
    // to remove another coach's student.
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select('id, coach_id')
      .eq('id', id)
      .eq('coach_id', auth.coachId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const result = await removeLapsedMember({
      supabase,
      enrollmentId: id,
      actorEmail: auth.email ?? 'coach',
      actorType: 'coach',
      reason,
      requestId: crypto.randomUUID(),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error('[coach-remove-lapsed] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
