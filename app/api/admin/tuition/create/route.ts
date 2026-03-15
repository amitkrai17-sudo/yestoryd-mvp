// ============================================================
// FILE: app/api/admin/tuition/create/route.ts
// PURPOSE: Admin creates a tuition onboarding record, sends
//          magic-link WhatsApp to parent for Step 2 completion.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

const CreateTuitionSchema = z.object({
  childName: z.string().min(1).max(100),
  childApproximateAge: z.number().int().min(3).max(16),
  sessionRate: z.number().int().min(5000).max(100000), // paise — Rs 50 to Rs 1,000
  sessionsPurchased: z.number().int().min(1).max(50),
  sessionDurationMinutes: z.number().int().min(15).max(120).default(60),
  sessionsPerWeek: z.number().int().min(1).max(7).default(2),
  schedulePreference: z.string().max(500).optional(),
  defaultSessionMode: z.enum(['offline', 'online']).default('offline'),
  parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number required'),
  parentNameHint: z.string().max(100).optional(),
  coachId: z.string().uuid(),
  adminNotes: z.string().max(1000).optional(),
});

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  // 1. Parse + validate
  const body = await req.json();
  const parsed = CreateTuitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 2. Verify coach exists
  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('id', input.coachId)
    .single();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // 3. Generate magic-link token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // 4. Insert tuition_onboarding
  const { data: onboarding, error: insertErr } = await supabase
    .from('tuition_onboarding')
    .insert({
      child_name: input.childName,
      child_approximate_age: input.childApproximateAge,
      session_rate: input.sessionRate,
      sessions_purchased: input.sessionsPurchased,
      session_duration_minutes: input.sessionDurationMinutes,
      sessions_per_week: input.sessionsPerWeek,
      schedule_preference: input.schedulePreference ?? null,
      default_session_mode: input.defaultSessionMode,
      parent_phone: input.parentPhone,
      parent_name_hint: input.parentNameHint ?? null,
      coach_id: input.coachId,
      admin_notes: input.adminNotes ?? null,
      admin_filled_by: auth.email ?? null,
      admin_filled_at: new Date().toISOString(),
      parent_form_token: token,
      parent_form_token_expires_at: expiresAt.toISOString(),
      status: 'parent_pending',
    })
    .select('id')
    .single();

  if (insertErr || !onboarding) {
    console.error(JSON.stringify({ requestId, event: 'tuition_create_insert_error', error: insertErr?.message }));
    return NextResponse.json({ error: 'Failed to create onboarding record' }, { status: 500 });
  }

  const magicLink = `${APP_URL}/tuition/onboard/${token}`;
  const coachFirstName = (coach.name || 'Your coach').split(' ')[0];

  // 5. Send WhatsApp to parent
  try {
    await sendWhatsAppMessage({
      to: `91${input.parentPhone}`,
      templateName: 'tuition_parent_form',
      variables: [
        coachFirstName,
        input.childName,
        input.childName,
        magicLink,
        String(input.sessionsPurchased),
        String(Math.round(input.sessionRate / 100)),
      ],
    });

    console.log(JSON.stringify({
      requestId,
      event: 'tuition_wa_sent',
      onboardingId: onboarding.id,
      parentPhone: input.parentPhone,
    }));
  } catch (waErr) {
    // Non-fatal — admin can resend later
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_wa_send_error',
      error: waErr instanceof Error ? waErr.message : String(waErr),
    }));
  }

  // 6. Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_created',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      onboarding_id: onboarding.id,
      child_name: input.childName,
      coach_id: input.coachId,
      sessions_purchased: input.sessionsPurchased,
      session_rate: input.sessionRate,
      parent_phone: input.parentPhone,
    },
  });

  return NextResponse.json({
    onboardingId: onboarding.id,
    token,
    magicLink,
    status: 'parent_pending',
  });
}, { auth: 'admin' });
