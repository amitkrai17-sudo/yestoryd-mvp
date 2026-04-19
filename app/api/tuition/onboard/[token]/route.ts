// ============================================================
// FILE: app/api/tuition/onboard/[token]/route.ts
// PURPOSE: Token-gated tuition onboarding API.
//   GET  — validate token, return pre-filled onboarding data
//   POST — parent submits details, creates child + parent + enrollment
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/api-auth';
import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { parentDetailsSchema, childDetailsSchema, addressSchema } from '@/components/forms/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

// ============================================================
// HELPERS
// ============================================================

async function resolveOnboarding(token: string, supabase: ReturnType<typeof getServiceSupabase>) {
  const { data, error } = await supabase
    .from('tuition_onboarding')
    .select(`
      id, child_name, child_approximate_age, session_rate, sessions_purchased,
      session_duration_minutes, sessions_per_week, schedule_preference,
      default_session_mode, coach_id, parent_phone, parent_name_hint,
      enrollment_id, child_id, parent_id, category_id,
      parent_form_token_expires_at, status,
      skill_categories!category_id(parent_label)
    `)
    .eq('parent_form_token', token)
    .single();

  if (error || !data) return { onboarding: null, error: 'not_found' as const };

  const expired = new Date(data.parent_form_token_expires_at) < new Date();
  if (expired) return { onboarding: data, error: 'expired' as const };

  if (data.status !== 'parent_pending' && data.status !== 'parent_completed') {
    return { onboarding: data, error: 'invalid_status' as const };
  }

  return { onboarding: data, error: null };
}

// ============================================================
// GET — Validate token, return onboarding data for form
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  const { onboarding, error } = await resolveOnboarding(token, supabase);

  if (error === 'not_found') {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  if (error === 'expired') {
    return NextResponse.json({
      expired: true,
      message: 'This link has expired. Please contact your coach to get a new one.',
    }, { status: 410 });
  }

  if (error === 'invalid_status') {
    return NextResponse.json({ error: 'This link is no longer active' }, { status: 400 });
  }

  if (!onboarding) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  // Fetch coach name
  const { data: coach } = await supabase
    .from('coaches')
    .select('name')
    .eq('id', onboarding.coach_id)
    .single();

  const rateRupees = onboarding.session_rate / 100;
  const totalRupees = rateRupees * onboarding.sessions_purchased;

  return NextResponse.json({
    sessionRate: onboarding.session_rate,
    sessionRateDisplay: rateRupees,
    sessionsPurchased: onboarding.sessions_purchased,
    sessionDurationMinutes: onboarding.session_duration_minutes,
    sessionsPerWeek: onboarding.sessions_per_week,
    schedulePreference: onboarding.schedule_preference,
    coachName: coach?.name || 'Your coach',
    totalAmount: totalRupees,
    parentPhone: onboarding.parent_phone,
    alreadyCompleted: onboarding.status === 'parent_completed',
    enrollmentId: onboarding.enrollment_id,
  });
}

// ============================================================
// POST — Parent submits form → create child, parent, enrollment
// ============================================================

const SubmitSchema = parentDetailsSchema
  .merge(childDetailsSchema)
  .merge(addressSchema)
  .extend({
    learningConcerns: z.string().max(500).optional(),
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = crypto.randomUUID();
  const { token } = await params;
  const supabase = getServiceSupabase();

  try {
    // 1. Validate token
    const { onboarding, error: tokenErr } = await resolveOnboarding(token, supabase);

    if (tokenErr === 'not_found') {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }
    if (tokenErr === 'expired') {
      return NextResponse.json({ expired: true, message: 'This link has expired.' }, { status: 410 });
    }
    if (tokenErr === 'invalid_status' || !onboarding) {
      return NextResponse.json({ error: 'This link is no longer active' }, { status: 400 });
    }

    // If already completed, return existing enrollment
    if (onboarding.status === 'parent_completed' && onboarding.enrollment_id) {
      return NextResponse.json({
        success: true,
        enrollmentId: onboarding.enrollment_id,
        checkoutUrl: `${APP_URL}/tuition/pay/${onboarding.enrollment_id}`,
        alreadyCompleted: true,
      });
    }

    // 2. Parse + validate input
    const body = await request.json();
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // 3. Upsert parent (by email)
    const { data: parent, error: parentErr } = await supabase
      .from('parents')
      .upsert(
        {
          email: input.parentEmail,
          name: input.parentName,
          phone: input.parentPhone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();

    if (parentErr || !parent) {
      console.error(JSON.stringify({ requestId, event: 'tuition_parent_upsert_error', error: parentErr?.message }));
      return NextResponse.json({ error: 'Failed to create parent record' }, { status: 500 });
    }

    // 4. Upsert child (by name + parent)
    const childAge = Math.floor((Date.now() - new Date(input.childDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const learningProfile = {
      school: input.childSchool,
      grade: input.childGrade,
      address: { pincode: input.pincode, city: input.city, state: input.state, country: input.country },
    };

    let childId: string;
    const { data: existingChild } = await supabase
      .from('children')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('child_name', input.childFullName)
      .maybeSingle();

    if (existingChild) {
      childId = existingChild.id;
      await supabase.from('children').update({
        name: input.childFullName,
        age: childAge,
        dob: input.childDob,
        grade: input.childGrade,
        school_name: input.childSchool,
        parent_email: input.parentEmail,
        parent_phone: input.parentPhone,
        learning_profile: learningProfile,
        updated_at: new Date().toISOString(),
      }).eq('id', childId);
    } else {
      const { data: newChild, error: childErr } = await supabase
        .from('children')
        .insert({
          child_name: input.childFullName,
          name: input.childFullName,
          age: childAge,
          dob: input.childDob,
          grade: input.childGrade,
          school_name: input.childSchool,
          parent_id: parent.id,
          parent_email: input.parentEmail,
          parent_phone: input.parentPhone,
          learning_profile: learningProfile,
          lead_status: 'tuition_onboarding',
        })
        .select('id')
        .single();

      if (childErr || !newChild) {
        console.error(JSON.stringify({ requestId, event: 'tuition_child_create_error', error: childErr?.message }));
        return NextResponse.json({ error: 'Failed to create child record' }, { status: 500 });
      }
      childId = newChild.id;
    }

    // 5. Create enrollment — auto-populate program_description from category
    const categoryParentLabel = (onboarding.skill_categories as any)?.parent_label ?? null;
    const programDescription = categoryParentLabel
      ? `${categoryParentLabel} Sessions`
      : null; // falls back to "English Classes" in getProgramLabel()

    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .insert({
        enrollment_type: 'tuition',
        billing_model: 'prepaid_sessions',
        child_id: childId,
        parent_id: parent.id,
        coach_id: onboarding.coach_id,
        session_rate: onboarding.session_rate,
        sessions_purchased: onboarding.sessions_purchased,
        sessions_remaining: 0,
        session_duration_minutes: onboarding.session_duration_minutes,
        sessions_per_week: onboarding.sessions_per_week,
        total_sessions: onboarding.sessions_purchased,
        status: 'payment_pending',
        program_description: programDescription,
      })
      .select('id')
      .single();

    if (enrollErr || !enrollment) {
      console.error(JSON.stringify({ requestId, event: 'tuition_enrollment_create_error', error: enrollErr?.message }));
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    // 6. Update tuition_onboarding with real child name
    await supabase
      .from('tuition_onboarding')
      .update({
        child_name: input.childFullName,
        child_approximate_age: childAge,
        enrollment_id: enrollment.id,
        child_id: childId,
        parent_id: parent.id,
        parent_name_hint: input.parentName,
        parent_form_completed_at: new Date().toISOString(),
        status: 'parent_completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboarding.id);

    // 7. Insert ledger row for initial balance (0 sessions — awaiting payment)
    await supabase
      .from('tuition_session_ledger')
      .insert({
        enrollment_id: enrollment.id,
        change_amount: 0,
        balance_after: 0,
        reason: 'enrollment_created',
        notes: `Onboarding completed by parent. ${onboarding.sessions_purchased} sessions pending payment.`,
        created_by: input.parentEmail,
      });

    // 8. Save learning concerns as parent_goals if provided
    if (input.learningConcerns) {
      await supabase
        .from('children')
        .update({
          parent_goals: [input.learningConcerns],
          goals_captured_at: new Date().toISOString(),
          goals_capture_method: 'tuition_onboarding',
        })
        .eq('id', childId);
    }

    const checkoutUrl = `${APP_URL}/tuition/pay/${enrollment.id}`;
    const rateRupees = onboarding.session_rate / 100;
    const totalRupees = rateRupees * onboarding.sessions_purchased;

    // 9. Send payment WA to parent
    try {
      await sendNotification('parent_tuition_payment_v3', `91${input.parentPhone}`, {
        parent_first_name: input.parentName.split(' ')[0],
        child_full_name: input.childFullName,
        sessions_purchased: String(onboarding.sessions_purchased),
        rate_rupees: String(rateRupees),
        total_rupees: String(totalRupees),
        checkout_url: checkoutUrl,
      });
    } catch (waErr) {
      console.error(JSON.stringify({ requestId, event: 'tuition_payment_wa_error', error: waErr instanceof Error ? waErr.message : String(waErr) }));
    }

    // 10. Assessment invite disabled — tuition students don't need diagnostic
    // TODO: Re-enable when tuition-to-coaching upgrade adds diagnostic assessment

    // 11. Activity log
    await supabase.from('activity_log').insert({
      action: 'tuition_onboarding_completed',
      user_email: input.parentEmail,
      user_type: 'parent',
      metadata: {
        onboarding_id: onboarding.id,
        enrollment_id: enrollment.id,
        child_id: childId,
        parent_id: parent.id,
        sessions_purchased: onboarding.sessions_purchased,
        session_rate: onboarding.session_rate,
      },
    });

    console.log(JSON.stringify({
      requestId,
      event: 'tuition_onboarding_completed',
      onboardingId: onboarding.id,
      enrollmentId: enrollment.id,
      childId,
    }));

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
      checkoutUrl,
    });
  } catch (err) {
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_onboard_submit_error',
      error: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
