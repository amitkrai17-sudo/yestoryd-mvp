// ============================================================
// FILE: app/api/coach-application/route.ts
// ============================================================
// Coach application — Step 1 submit (server-side).
//
// PUBLIC route. Replaces the old direct-from-browser insert in
// app/yestoryd-academy/apply/page.tsx, which used the anon client and
// silently failed under RLS for anonymous / mismatched-email submitters.
//
// This route uses createAdminClient() (service role, bypasses RLS) so the
// insert always succeeds regardless of sign-in state. Sign-in is optional;
// googleId is captured when present but never required.
//
// On success it fires a best-effort admin alert (WhatsApp via notify.ts +
// Resend email). Alert failures NEVER block or mask a successful insert.
// On insert failure it still fires a best-effort alert so the lead is not
// lost, then returns a structured error.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { sendEmail } from '@/lib/email/resend-client';
import { normalizePhone } from '@/lib/utils/phone';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import type { Database } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CoachApplicationInsert =
  Database['public']['Tables']['coach_applications']['Insert'];

// Statuses that mean an application is finished / not actively in flight.
// A row in any of these does NOT block a fresh submit (reapply is allowed).
// Anything else (started, applied, *_in_progress, qualified, interview_*, etc.)
// is treated as a live application → soft-dedup.
const TERMINAL_STATUSES = ['rejected', 'withdrawn', 'not_qualified'] as const;

// --- VALIDATION SCHEMA ---
const utmSchema = z
  .object({
    source: z.string().max(200).optional(),
    medium: z.string().max(200).optional(),
    campaign: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
  })
  .optional();

const submitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email').max(200),
  phone: z.string().min(1, 'Phone is required').max(20),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().max(100).optional().default('India'),
  referralCode: z.string().max(100).optional(),
  utm: utmSchema,
  // Anonymous submitters send `null` (not undefined) — must accept both.
  googleId: z.string().max(200).nullable().optional(),
});

type ErrorCode = 'invalid_input' | 'duplicate_application' | 'system_error';

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

/**
 * Escape untrusted values before interpolating them into the admin email's
 * HTML body. Applicant-supplied fields (name, city, referral code, utm) are
 * free text and would otherwise allow HTML/script injection into the admin's
 * inbox. The plaintext `text` body needs no escaping.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a human-readable description of where this lead came from, for the
 * admin alert note. Mirrors the lead_source derivation but in prose.
 */
function describeSource(
  leadSource: string,
  referralCode: string | null,
  utm: z.infer<typeof submitSchema>['utm'],
): string {
  if (utm?.source) {
    const parts = [utm.source, utm.medium, utm.campaign].filter(Boolean);
    return `Campaign: ${parts.join(' / ')}`;
  }
  if (leadSource === 'referral') {
    return `Referral${referralCode ? ` (code: ${referralCode})` : ''}`;
  }
  return 'Direct (website)';
}

/**
 * Fire the admin alert through both channels. Each channel is independently
 * guarded so one failing never blocks the other, and neither ever throws out
 * of this function — the caller's insert result must not depend on alerting.
 */
async function dispatchAdminAlert(params: {
  name: string;
  phone: string;
  city: string;
  note: string;
}): Promise<{ waOk: boolean; emailOk: boolean }> {
  const { name, phone, city, note } = params;

  let waOk = false;
  try {
    const result = await sendNotification(
      'admin_coach_lead_v1',
      'admin',
      { coach_name: name, phone, city, note },
      { triggeredBy: 'system', contextType: 'coach_application' },
    );
    waOk = result.success;
  } catch (err) {
    console.error('[coach-application] admin WA alert threw:', err);
  }

  let emailOk = false;
  try {
    const result = await sendEmail({
      to: COMPANY_CONFIG.adminEmail,
      subject: `New coach application: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">New coach application</h2>
          <table style="width: 100%; color: #475569; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 120px;">Name</td><td style="padding: 6px 0;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Phone</td><td style="padding: 6px 0;">${escapeHtml(phone)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">City</td><td style="padding: 6px 0;">${escapeHtml(city)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Source</td><td style="padding: 6px 0;">${escapeHtml(note)}</td></tr>
          </table>
          <p style="margin-top: 20px;">
            <a href="${COMPANY_CONFIG.websiteUrl}/admin/coach-applications" style="color: #ec4899; font-weight: bold;">Review applications</a>
          </p>
        </div>
      `,
      text: `New coach application\n\nName: ${name}\nPhone: ${phone}\nCity: ${city}\nSource: ${note}\n\nReview: ${COMPANY_CONFIG.websiteUrl}/admin/coach-applications`,
    });
    emailOk = result.success;
  } catch (err) {
    console.error('[coach-application] admin email alert threw:', err);
  }

  return { waOk, emailOk };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const supabase = createAdminClient();

  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_input', 'Invalid JSON body', 400);
  }

  // 2. Validate
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      JSON.stringify({ requestId, event: 'coach_application_invalid_input', issues: parsed.error.flatten() }),
    );
    return errorResponse('invalid_input', 'Please fill in all required fields correctly', 400);
  }

  const { name, email, phone, city, country, referralCode, utm, googleId } = parsed.data;

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = normalizePhone(phone.trim());
  const cleanCity = city.trim();
  const cleanReferral = referralCode?.trim() || null;
  const leadSource = utm?.source ?? (cleanReferral ? 'referral' : 'direct');
  const note = describeSource(leadSource, cleanReferral, utm);

  // 3. Soft dedup — existing live (non-terminal) application for this email.
  //    Never blocks on parents-table overlap (a parent can become a coach).
  try {
    const { data: existing, error: dupErr } = await supabase
      .from('coach_applications')
      .select('id, status')
      .eq('email', cleanEmail)
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
      .limit(1);

    if (dupErr) {
      console.error(JSON.stringify({ requestId, event: 'coach_application_dedup_error', error: dupErr.message }));
      // Fall through — a dedup read failure should not block a genuine submit.
    } else if (existing && existing.length > 0) {
      console.log(
        JSON.stringify({ requestId, event: 'coach_application_duplicate', email: cleanEmail, existingId: existing[0].id }),
      );
      return NextResponse.json(
        { ok: false, code: 'duplicate_application', message: 'You already have an application in progress.' },
        { status: 200 },
      );
    }
  } catch (err) {
    console.error(JSON.stringify({ requestId, event: 'coach_application_dedup_threw', error: String(err) }));
    // Fall through — best effort.
  }

  // 4. Insert (fully typed against the regenerated coach_applications Insert).
  const payload: CoachApplicationInsert = {
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    city: cleanCity,
    country,
    referral_code_used: cleanReferral,
    google_id: googleId?.trim() || null,
    lead_source: leadSource,
    utm: utm ?? null,
    status: 'started',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('coach_applications')
    .insert(payload)
    .select('id')
    .single();

  // 5a. Insert failure → best-effort alert so the lead is never lost, then 500.
  if (insertError || !inserted) {
    console.error(
      JSON.stringify({ requestId, event: 'coach_application_insert_failed', error: insertError?.message ?? 'no row returned' }),
    );

    await dispatchAdminAlert({
      name: cleanName,
      phone: cleanPhone,
      city: cleanCity,
      note: `Submit failed — needs manual follow-up: ${cleanEmail} / ${cleanPhone}`,
    });

    return errorResponse('system_error', 'Something went wrong. Our team has been notified.', 500);
  }

  const applicationId = inserted.id;

  // 5b. Success → best-effort alert (WA + email). Failures never block.
  const alert = await dispatchAdminAlert({ name: cleanName, phone: cleanPhone, city: cleanCity, note });

  // 6. Audit log (send-confirmation shape; anonymous applicant → user_type 'system').
  try {
    await supabase.from('activity_log').insert({
      user_email: cleanEmail,
      user_type: 'system',
      action: 'coach_application_submitted',
      metadata: {
        request_id: requestId,
        application_id: applicationId,
        name: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        country,
        lead_source: leadSource,
        referral_code_used: cleanReferral,
        utm: utm ?? null,
        google_id: googleId?.trim() || null,
        alert_wa_ok: alert.waOk,
        alert_email_ok: alert.emailOk,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(JSON.stringify({ requestId, event: 'coach_application_activity_log_failed', error: String(err) }));
    // Non-fatal — the application row is the source of truth.
  }

  console.log(JSON.stringify({ requestId, event: 'coach_application_submitted', applicationId, leadSource }));

  return NextResponse.json({ ok: true, applicationId }, { status: 201 });
}
