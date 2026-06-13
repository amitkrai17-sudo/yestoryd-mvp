// ============================================================
// FILE: lib/tuition/resend-onboarding-link.ts
// PURPOSE: Single source of truth for regenerating a tuition onboarding
//   magic-link token and resending the parent_tuition_onboarding_v5 WhatsApp.
//   Used by BOTH the admin resend route and the coach resend route so the
//   token-regen / send / activity-log block is never duplicated.
//
//   Optional alt_phone is a DELIVERY TARGET ONLY — it is never written to
//   tuition_onboarding.parent_phone (identity is unchanged). communication_logs
//   captures the actual recipient automatically.
//
//   The caller is responsible for auth + ownership (admin: any; coach: own
//   coach_id) and for fetching the onboarding row. This helper does status
//   validation, alt_phone validation, token regen (+ revive), the send, and
//   the activity_log write, then returns a {status, body} envelope the route
//   hands straight to NextResponse.json.
// ============================================================

import crypto from 'crypto';
import { sendNotification } from '@/lib/communication/notify';
import { getServiceSupabase } from '@/lib/api-auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

/** Minimal onboarding shape the resend needs (caller fetches with auth/ownership). */
export interface OnboardingForResend {
  id: string;
  child_name: string | null;
  parent_phone: string | null;
  status: string | null;
  created_at: string | null;
}

export interface ResendOnboardingResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ResendOnboardingArgs {
  supabase: ServiceSupabase;
  onboarding: OnboardingForResend;
  /** Optional alternate delivery number (10-digit). Validated here; never stored. */
  altPhone?: string | null;
  actorEmail: string;
  actorType: 'admin' | 'coach';
  requestId: string;
}

export async function resendOnboardingLink(
  args: ResendOnboardingArgs,
): Promise<ResendOnboardingResult> {
  const { supabase, onboarding, altPhone, actorEmail, actorType, requestId } = args;

  // Resend allowed for pending OR expired (revive). Mirrors the original guard.
  if (onboarding.status !== 'parent_pending' && onboarding.status !== 'expired') {
    return {
      status: 400,
      body: { error: `Cannot resend — status is '${onboarding.status}', expected 'parent_pending' or 'expired'` },
    };
  }

  // alt_phone: delivery target only. Validate before any token regen / send.
  let usedAlt = false;
  let deliveryPhone = onboarding.parent_phone ?? '';
  if (altPhone != null && altPhone !== '') {
    if (!/^[6-9]\d{9}$/.test(altPhone)) {
      return {
        status: 400,
        body: { error: 'Alternate number must be a valid 10-digit Indian mobile number' },
      };
    }
    deliveryPhone = altPhone;
    usedAlt = true;
  }

  if (!deliveryPhone) {
    return { status: 400, body: { error: 'No recipient phone on record' } };
  }

  const wasExpired = onboarding.status === 'expired';
  const newToken = crypto.randomBytes(32).toString('hex');
  const nowIso = new Date().toISOString();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Regenerate token (+ on revive: restart status + lifecycle clock so the
  // nudge/expire cron treats it as fresh). Single-row, by-id soft update.
  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({
      parent_form_token: newToken,
      parent_form_token_expires_at: newExpiry.toISOString(),
      updated_at: nowIso,
      ...(wasExpired ? { status: 'parent_pending', created_at: nowIso } : {}),
    })
    .eq('id', onboarding.id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_resend_update_error', error: updateErr.message }));
    return { status: 500, body: { error: 'Failed to regenerate token' } };
  }

  const magicLink = `${APP_URL}/tuition/onboard/${newToken}`;

  // Send v5 to the delivery target. contextId = onboarding.id (stable);
  // per-click uniqueness via idempotencySalt = newToken. forceImmediate
  // bypasses quiet hours (interactive resend).
  let waStatus = 'failed';
  try {
    const waResult = await sendNotification('parent_tuition_onboarding_v5', `91${deliveryPhone}`, {}, {
      templateButtons: { category: 'utility_cta', url: newToken },
      triggeredBy: actorType,
      contextType: 'tuition_onboarding_resend',
      contextId: onboarding.id,
      idempotencySalt: newToken,
      forceImmediate: true,
    });
    waStatus = waResult.success ? 'sent' : (waResult.reason ?? 'failed');

    console.log(JSON.stringify({
      requestId,
      event: waResult.success ? 'tuition_wa_sent' : 'tuition_wa_not_sent',
      onboardingId: onboarding.id,
      reason: waResult.reason ?? null,
    }));
  } catch (waErr) {
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_resend_wa_error',
      error: waErr instanceof Error ? waErr.message : String(waErr),
    }));
  }

  await supabase.from('activity_log').insert({
    action: wasExpired ? 'tuition_onboarding_revived' : 'tuition_onboarding_resent',
    user_email: actorEmail,
    user_type: actorType,
    metadata: {
      onboarding_id: onboarding.id,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
      ...(usedAlt ? { alt_phone: deliveryPhone } : {}),
      ...(wasExpired ? { previous_status: 'expired', original_created_at: onboarding.created_at } : {}),
    },
  });

  // The magic link is a bearer credential. Admins get it back for break-glass
  // "copy link" support; coaches never do (their UI doesn't use it, and a coach
  // must not be able to read the parent's onboarding link from the response).
  const adminOnly = actorType === 'admin' ? { token: newToken, magicLink } : {};

  return {
    status: 200,
    body: {
      onboardingId: onboarding.id,
      expiresAt: newExpiry.toISOString(),
      status: 'parent_pending',
      waStatus,
      ...adminOnly,
    },
  };
}
