// ============================================================
// FILE: app/api/admin/tuition/[id]/resend/route.ts
// PURPOSE: Regenerate magic-link token and resend WhatsApp
//          to parent for tuition onboarding completion.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { sendNotification } from '@/lib/communication/notify';
import { resolveParentFullName } from '@/lib/communication/resolveParentName';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

export const POST = withParamsHandler<{ id: string }>(async (_req: NextRequest, { id }, { auth, supabase, requestId }) => {
  // 1. Fetch existing onboarding
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, child_id, parent_phone, parent_name_hint, coach_id, status, sessions_purchased, session_rate, created_at')
    .eq('id', id)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  // Resend is allowed for pending records OR expired records (UI-1.2 revive).
  // Reviving an expired record resets it to parent_pending so it re-enters the
  // normal nudge/expire lifecycle (see below).
  if (onboarding.status !== 'parent_pending' && onboarding.status !== 'expired') {
    return NextResponse.json(
      { error: `Cannot resend — status is '${onboarding.status}', expected 'parent_pending' or 'expired'` },
      { status: 400 },
    );
  }

  const wasExpired = onboarding.status === 'expired';

  // 2. Generate new token
  const newToken = crypto.randomBytes(32).toString('hex');
  const nowIso = new Date().toISOString();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // On revive, also flip status back to parent_pending AND restart the lifecycle
  // clock (created_at = now). The tuition-onboarding-nudge cron keys both its
  // nudge-send and expire-sweep on status='parent_pending' AND created_at windows,
  // so without the created_at reset a revived (>7d-old) record would be immediately
  // re-expired on the next cron run. tuition_onboarding is not a protected table;
  // this is a single-row, by-id soft lifecycle update — no counter/balance write.
  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({
      parent_form_token: newToken,
      parent_form_token_expires_at: newExpiry.toISOString(),
      updated_at: nowIso,
      ...(wasExpired ? { status: 'parent_pending', created_at: nowIso } : {}),
    })
    .eq('id', id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_resend_update_error', error: updateErr.message }));
    return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
  }

  const magicLink = `${APP_URL}/tuition/onboard/${newToken}`;

  // 4. Resend WhatsApp
  try {
    const parentFullName = await resolveParentFullName(
      onboarding.parent_name_hint,
      onboarding.child_id
    );
    await sendNotification('parent_tuition_onboarding_v4', `91${onboarding.parent_phone}`, {
      parent_name: parentFullName,
      child_name: onboarding.child_name && !onboarding.child_name.startsWith('Pending')
        ? onboarding.child_name
        : 'your child',
    }, {
      templateButtons: { category: 'utility_cta', url: newToken },
      // WA-FIX.1: a deliberate admin resend must NOT be deduped against the same-day
      // create send. The STEP-6 idempotency key is template:phone:todayIST:firstParam[:contextId];
      // without a contextId the resend collides with create (identical other elements).
      // newToken is regenerated per click → unique key every resend → always delivers.
      triggeredBy: 'admin',
      contextType: 'tuition_onboarding_resend',
      contextId: newToken,
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

  // 5. Activity log (revive vs plain resend)
  await supabase.from('activity_log').insert({
    action: wasExpired ? 'tuition_onboarding_revived' : 'tuition_onboarding_resent',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      onboarding_id: id,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
      ...(wasExpired ? { previous_status: 'expired', original_created_at: onboarding.created_at } : {}),
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
