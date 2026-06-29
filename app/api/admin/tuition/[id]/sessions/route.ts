// ============================================================
// FILE: app/api/admin/tuition/[id]/sessions/route.ts
// PURPOSE: Admin edit of sessions_purchased on a pending tuition
//   onboarding. Hard-gated to status='parent_pending' inside the shared
//   SSOT helper. sessions_purchased ONLY — no rate/duration/derived fields.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { updateOnboardingSessions } from '@/lib/tuition/update-onboarding-sessions';

export const dynamic = 'force-dynamic';

const SessionsSchema = z.object({
  sessionsPurchased: z.number().int().min(1).max(50),
  reason: z.string().max(500).optional(),
});

export const PATCH = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = SessionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await updateOnboardingSessions({
    supabase,
    onboardingId: id,
    sessionsPurchased: parsed.data.sessionsPurchased,
    actorEmail: auth.email ?? 'admin',
    actorType: 'admin',
    reason: parsed.data.reason,
    requestId,
  });

  return NextResponse.json(result.body, { status: result.status });
}, { auth: 'admin' });
