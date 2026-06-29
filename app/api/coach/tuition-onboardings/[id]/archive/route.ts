// ============================================================
// FILE: app/api/coach/tuition-onboardings/[id]/archive/route.ts
// PURPOSE: Coach-scoped soft-dismiss (archive) of a tuition onboarding.
//   Ownership: the coach may only archive their OWN onboardings
//   (.eq('coach_id', coachId), same pattern as the coach resend route).
//   Behavior (idempotency + ARCHIVABLE guard + status flip + activity_log)
//   is identical to the admin route — both call archiveOnboarding.
//   NEVER deletes the row (audit trail preserved).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { archiveOnboarding } from '@/lib/tuition/archive-onboarding';

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

    // Optional reason (audit only). Body may be empty on a plain archive.
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;

    // Fetch onboarding scoped to THIS coach (ownership gate)
    const { data: onboarding, error: fetchErr } = await supabase
      .from('tuition_onboarding')
      .select('id, child_name, parent_phone, status, enrollment_id')
      .eq('id', id)
      .eq('coach_id', auth.coachId)
      .single();

    if (fetchErr || !onboarding) {
      return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
    }

    const result = await archiveOnboarding({
      supabase,
      onboarding,
      actorEmail: auth.email ?? 'coach',
      actorType: 'coach',
      reason,
      requestId: crypto.randomUUID(),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error('[coach-tuition-archive] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
