// ============================================================
// FILE: app/api/coach/tuition-onboardings/[id]/sessions/route.ts
// PURPOSE: Coach-scoped edit of sessions_purchased on a pending tuition
//   onboarding. Ownership: the coach may only edit their OWN onboardings
//   (.eq('coach_id', coachId), same pattern as the coach archive route).
//   Hard-gated to status='parent_pending' inside the shared SSOT helper.
//   sessions_purchased ONLY — no rate/duration/derived fields.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { updateOnboardingSessions } from '@/lib/tuition/update-onboarding-sessions';

export const dynamic = 'force-dynamic';

const SessionsSchema = z.object({
  sessionsPurchased: z.number().int().min(1).max(50),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
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
    const parsed = SessionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Ownership gate — coach may only edit their OWN onboarding.
    const { data: onboarding, error: fetchErr } = await supabase
      .from('tuition_onboarding')
      .select('id')
      .eq('id', id)
      .eq('coach_id', auth.coachId)
      .single();

    if (fetchErr || !onboarding) {
      return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
    }

    const result = await updateOnboardingSessions({
      supabase,
      onboardingId: id,
      sessionsPurchased: parsed.data.sessionsPurchased,
      actorEmail: auth.email ?? 'coach',
      actorType: 'coach',
      reason: parsed.data.reason,
      requestId: crypto.randomUUID(),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error('[coach-tuition-sessions] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
