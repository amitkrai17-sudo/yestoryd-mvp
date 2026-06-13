// ============================================================
// FILE: lib/tuition/pay-link-lifecycle.ts
// PURPOSE: Single source of truth for tuition pay-link VOID + REISSUE,
//   shared by the admin and coach routes (caller owns auth + ownership +
//   the enrollment fetch). Both actions are valid ONLY for a payment_pending
//   enrollment (the initial pre-payment link); active enrollments (renewals)
//   are never touched.
//   - void:    set pay_link_voided_at, activity_log, NO parent notification.
//   - reissue: re-price (validated), reset expiry (+7d), clear voided_at,
//              activity_log, and re-send the pay link via WhatsApp.
//   alt_phone (reissue) is a DELIVERY TARGET ONLY — validated, never persisted.
// ============================================================

import { sendNotification } from '@/lib/communication/notify';
import { getServiceSupabase } from '@/lib/api-auth';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

// Single definition — the v4 swap later is a one-line change here.
export const PAY_LINK_TEMPLATE_CODE = 'parent_tuition_payment_v4';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Reissue re-pricing bounds — mirror the admin create schema (paise / sessions).
export const PAY_LINK_RATE_MIN_PAISE = 5000;
export const PAY_LINK_RATE_MAX_PAISE = 100000;
export const PAY_LINK_SESSIONS_MIN = 1;
export const PAY_LINK_SESSIONS_MAX = 50;

export interface EnrollmentForPayLink {
  id: string;
  status: string | null;
  parent_id: string | null;
  child_id: string | null;
  session_rate: number | null;
  sessions_purchased: number | null;
}

export interface PayLinkResult {
  status: number;
  body: Record<string, unknown>;
}

interface BaseArgs {
  supabase: ServiceSupabase;
  enrollment: EnrollmentForPayLink;
  actorEmail: string;
  actorType: 'admin' | 'coach';
  requestId: string;
}

/** VOID — disable the initial pay link. No parent notification (silent). */
export async function voidPayLink(args: BaseArgs): Promise<PayLinkResult> {
  const { supabase, enrollment, actorEmail, actorType, requestId } = args;

  if (enrollment.status !== 'payment_pending') {
    return {
      status: 400,
      body: { error: `Cannot void — status is '${enrollment.status}', expected 'payment_pending'` },
    };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('enrollments')
    .update({ pay_link_voided_at: nowIso, updated_at: nowIso })
    .eq('id', enrollment.id);

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'pay_link_void_error', error: error.message }));
    return { status: 500, body: { error: 'Failed to void pay link' } };
  }

  await supabase.from('activity_log').insert({
    action: 'tuition_pay_link_voided',
    user_email: actorEmail,
    user_type: actorType,
    metadata: { enrollment_id: enrollment.id },
  });

  return { status: 200, body: { enrollmentId: enrollment.id, voidedAt: nowIso } };
}

export interface ReissueArgs extends BaseArgs {
  sessionsPurchased: number;
  sessionRate: number; // paise
  altPhone?: string | null;
}

/** REISSUE — re-price, reset expiry, clear void, and re-send the pay link. */
export async function reissuePayLink(args: ReissueArgs): Promise<PayLinkResult> {
  const { supabase, enrollment, sessionsPurchased, sessionRate, altPhone, actorEmail, actorType, requestId } = args;

  if (enrollment.status !== 'payment_pending') {
    return {
      status: 400,
      body: { error: `Cannot reissue — status is '${enrollment.status}', expected 'payment_pending'` },
    };
  }

  if (!Number.isInteger(sessionRate) || sessionRate < PAY_LINK_RATE_MIN_PAISE || sessionRate > PAY_LINK_RATE_MAX_PAISE) {
    return { status: 400, body: { error: 'Rate must be 5000–100000 paise (₹50–₹1,000) per session' } };
  }
  if (!Number.isInteger(sessionsPurchased) || sessionsPurchased < PAY_LINK_SESSIONS_MIN || sessionsPurchased > PAY_LINK_SESSIONS_MAX) {
    return { status: 400, body: { error: 'Sessions must be between 1 and 50' } };
  }

  // alt_phone: delivery target only, validated, never persisted.
  let usedAlt = false;
  if (altPhone != null && altPhone !== '') {
    if (!/^[6-9]\d{9}$/.test(altPhone)) {
      return { status: 400, body: { error: 'Alternate number must be a valid 10-digit Indian mobile number' } };
    }
    usedAlt = true;
  }

  const nowIso = new Date().toISOString();
  const newExpiry = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  // Re-price + reset lifecycle. total_sessions kept in sync (no payment yet, so
  // sessions_remaining stays 0 until the webhook credits on capture).
  const { error: updateErr } = await supabase
    .from('enrollments')
    .update({
      session_rate: sessionRate,
      sessions_purchased: sessionsPurchased,
      total_sessions: sessionsPurchased,
      pay_link_expires_at: newExpiry,
      pay_link_voided_at: null,
      updated_at: nowIso,
    })
    .eq('id', enrollment.id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'pay_link_reissue_update_error', error: updateErr.message }));
    return { status: 500, body: { error: 'Failed to reissue pay link' } };
  }

  // Resolve recipient + names for the send.
  const { data: parent } = enrollment.parent_id
    ? await supabase.from('parents').select('name, phone').eq('id', enrollment.parent_id).single()
    : { data: null };
  const { data: child } = enrollment.child_id
    ? await supabase.from('children').select('child_name').eq('id', enrollment.child_id).single()
    : { data: null };

  // AiSensy wants bare 91XXXXXXXXXX. Parent phone is stored E.164 (+91…); strip to
  // last-10 then prefix. alt_phone is already a bare 10-digit when present.
  const bare10 = usedAlt
    ? (altPhone as string)
    : (parent?.phone || '').replace(/\D/g, '').slice(-10);

  let waStatus = 'failed';
  if (bare10) {
    try {
      const waResult = await sendNotification(PAY_LINK_TEMPLATE_CODE, `91${bare10}`, {
        parent_name: parent?.name || 'Parent',
        child_name: child?.child_name || 'your child',
      }, {
        templateButtons: { category: 'utility_cta', url: enrollment.id },
        triggeredBy: actorType,
        contextType: 'tuition_pay_link_reissue',
        contextId: enrollment.id,
        idempotencySalt: newExpiry, // unique per reissue so a re-send always delivers
        forceImmediate: true,
      });
      waStatus = waResult.success ? 'sent' : (waResult.reason ?? 'failed');
    } catch (waErr) {
      console.error(JSON.stringify({ requestId, event: 'pay_link_reissue_wa_error', error: waErr instanceof Error ? waErr.message : String(waErr) }));
    }
  }

  await supabase.from('activity_log').insert({
    action: 'tuition_pay_link_reissued',
    user_email: actorEmail,
    user_type: actorType,
    metadata: {
      enrollment_id: enrollment.id,
      session_rate: sessionRate,
      sessions_purchased: sessionsPurchased,
      ...(usedAlt ? { alt_phone: bare10 } : {}),
    },
  });

  return {
    status: 200,
    body: {
      enrollmentId: enrollment.id,
      sessionRate,
      sessionsPurchased,
      expiresAt: newExpiry,
      waStatus,
    },
  };
}
