// ============================================================
// FILE: app/api/admin/tuition/[id]/resend/route.ts
// PURPOSE: Regenerate magic-link token and resend WhatsApp
//          to parent for tuition onboarding completion.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { sendNotification } from '@/lib/communication/notify';
import { resolveParentName } from '@/lib/communication/resolveParentName';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

export const POST = withParamsHandler<{ id: string }>(async (_req: NextRequest, { id }, { auth, supabase, requestId }) => {
  // 1. Fetch existing onboarding
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, child_id, parent_phone, parent_name_hint, coach_id, status, sessions_purchased, session_rate')
    .eq('id', id)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  // Only resend for pending records
  if (onboarding.status !== 'parent_pending') {
    return NextResponse.json(
      { error: `Cannot resend — status is '${onboarding.status}', expected 'parent_pending'` },
      { status: 400 },
    );
  }

  // 2. Generate new token
  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({
      parent_form_token: newToken,
      parent_form_token_expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_resend_update_error', error: updateErr.message }));
    return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
  }

  const magicLink = `${APP_URL}/tuition/onboard/${newToken}`;

  // 4. Resend WhatsApp
  try {
    const parentFirstName = await resolveParentName(
      onboarding.parent_name_hint,
      onboarding.child_id
    );
    await sendNotification('parent_tuition_onboarding_v4', `91${onboarding.parent_phone}`, {
      parent_first_name: parentFirstName,
      child_name: onboarding.child_name && !onboarding.child_name.startsWith('Pending')
        ? onboarding.child_name
        : 'your child',
      magic_link: magicLink,
    });

    console.log(JSON.stringify({
      requestId,
      event: 'tuition_resend_wa_sent',
      onboardingId: id,
    }));
  } catch (waErr) {
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_resend_wa_error',
      error: waErr instanceof Error ? waErr.message : String(waErr),
    }));
  }

  // 5. Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_resent',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      onboarding_id: id,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
    },
  });

  return NextResponse.json({
    onboardingId: id,
    token: newToken,
    magicLink,
    expiresAt: newExpiry.toISOString(),
    status: 'parent_pending',
  });
}, { auth: 'admin' });
