// ============================================================
// FILE: app/api/coach/students/[id]/pay-link/route.ts
// PURPOSE: Coach-scoped void / reissue of a tuition enrollment's initial pay
//   link. [id] = enrollment id. Ownership: the coach may only act on their
//   OWN enrollments (.eq('coach_id', coachId), requireAdminOrCoach pattern).
//   Branches on body.action; logic shared via lib/tuition/pay-link-lifecycle.ts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { voidPayLink, reissuePayLink } from '@/lib/tuition/pay-link-lifecycle';

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
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = body?.action;
    const requestId = crypto.randomUUID();

    // Ownership gate: enrollment must belong to this coach.
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select('id, status, parent_id, child_id, session_rate, sessions_purchased, enrollment_type')
      .eq('id', id)
      .eq('enrollment_type', 'tuition')
      .eq('coach_id', auth.coachId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Tuition enrollment not found' }, { status: 404 });
    }

    if (action === 'void') {
      const r = await voidPayLink({ supabase, enrollment, actorEmail: auth.email ?? 'coach', actorType: 'coach', requestId });
      return NextResponse.json(r.body, { status: r.status });
    }

    if (action === 'reissue') {
      const r = await reissuePayLink({
        supabase,
        enrollment,
        sessionsPurchased: Number(body.sessionsPurchased),
        sessionRate: Number(body.sessionRate),
        altPhone: typeof body.alt_phone === 'string' ? body.alt_phone.trim() : null,
        actorEmail: auth.email ?? 'coach',
        actorType: 'coach',
        requestId,
      });
      return NextResponse.json(r.body, { status: r.status });
    }

    return NextResponse.json({ error: "Unknown action — expected 'void' or 'reissue'" }, { status: 400 });
  } catch (err: any) {
    console.error('[coach-pay-link] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
