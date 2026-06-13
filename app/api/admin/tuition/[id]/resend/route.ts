// ============================================================
// FILE: app/api/admin/tuition/[id]/resend/route.ts
// PURPOSE: Regenerate magic-link token and resend WhatsApp to the parent
//          for tuition onboarding completion. Optional alt_phone delivers
//          the link to a different number (delivery target only — identity
//          unchanged). Token-regen / send / log logic lives in the shared
//          helper lib/tuition/resend-onboarding-link.ts (also used by coach).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { resendOnboardingLink } from '@/lib/tuition/resend-onboarding-link';

export const dynamic = 'force-dynamic';

export const POST = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  // Optional alt_phone (delivery target only). Body may be empty on a plain resend.
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const altPhone = typeof body?.alt_phone === 'string' ? body.alt_phone.trim() : null;

  // 1. Fetch onboarding (admin: any record by id)
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, parent_phone, status, created_at')
    .eq('id', id)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  // 2. Regenerate token + resend via shared helper (status + alt_phone validation inside)
  const result = await resendOnboardingLink({
    supabase,
    onboarding,
    altPhone,
    actorEmail: auth.email ?? 'admin',
    actorType: 'admin',
    requestId,
  });

  return NextResponse.json(result.body, { status: result.status });
}, { auth: 'admin' });
