// ============================================================
// FILE: app/api/coach/tuition-onboardings/[id]/resend/route.ts
// PURPOSE: Coach-scoped resend of a tuition onboarding magic link.
//   Ownership: the coach may only resend their OWN onboardings
//   (.eq('coach_id', coachId), 2A.5 pattern via requireAdminOrCoach).
//   Behavior (token regen + revive + optional alt_phone + send + log) is
//   identical to the admin route — both call resendOnboardingLink.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { resendOnboardingLink } from '@/lib/tuition/resend-onboarding-link';

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

    // Optional alt_phone (delivery target only). Body may be empty on a plain resend.
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const altPhone = typeof body?.alt_phone === 'string' ? body.alt_phone.trim() : null;

    // Fetch onboarding scoped to THIS coach (ownership gate)
    const { data: onboarding, error: fetchErr } = await supabase
      .from('tuition_onboarding')
      .select('id, child_name, parent_phone, status, created_at')
      .eq('id', id)
      .eq('coach_id', auth.coachId)
      .single();

    if (fetchErr || !onboarding) {
      return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
    }

    const result = await resendOnboardingLink({
      supabase,
      onboarding,
      altPhone,
      actorEmail: auth.email ?? 'coach',
      actorType: 'coach',
      requestId: crypto.randomUUID(),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error('[coach-tuition-resend] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
