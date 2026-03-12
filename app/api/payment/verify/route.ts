// ============================================================
// FILE: app/api/payment/verify/route.ts
// PURPOSE: Thin orchestrator — verify Razorpay payment, create enrollment
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import Razorpay from 'razorpay';
import { queueEnrollmentComplete } from '@/lib/qstash';
import {
  scheduleEnrollmentSessions,
  createSessionsSimple,
  type TimePreference,
} from '@/lib/scheduling';
import { loadPaymentConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionsForTier, getBoosterCreditsForTier } from '@/types/v2-schema';

// Extracted modules
import {
  getAgeBandConfig,
  extractProductInfo,
  getStarterEnrollment,
  markStarterCompleted,
  getProductDetails,
  getOrCreateParent,
  getOrCreateChild,
  awardReferralCredit,
  type CreditAwardResult,
} from '@/lib/payment/enrollment-creator';
import { getCoach } from '@/lib/payment/coach-assigner';
import { calculateRevenueSplit, type RevenueResult } from '@/lib/payment/post-payment-notifications';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

// --- VALIDATION SCHEMA ---
const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(10, 'Invalid order ID'),
  razorpay_payment_id: z.string().min(10, 'Invalid payment ID'),
  razorpay_signature: z.string().min(64, 'Invalid signature'),
  productCode: z.enum(['starter', 'continuation', 'full']).optional().nullable(),
  childName: z.string().min(1).max(100),
  childAge: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  childId: z.string().uuid().optional().nullable(),
  parentName: z.string().min(1).max(100),
  parentEmail: z.string().email().transform(v => v.toLowerCase().trim()),
  parentPhone: phoneSchemaOptional,
  coachId: z.string().uuid().optional().nullable(),
  leadSource: z.enum(['yestoryd', 'coach']).default('yestoryd'),
  leadSourceCoachId: z.string().uuid().optional().nullable(),
  couponCode: z.string().max(20).optional().nullable(),
  referralCodeUsed: z.string().max(20).optional().nullable(),
  requestedStartDate: z.string().optional().nullable(),
  discoveryCallId: z.string().uuid().optional().nullable(),
  preferenceTimeBucket: z.enum(['morning', 'afternoon', 'evening', 'any']).optional().default('any'),
  preferenceDays: z.array(z.number().min(0).max(6)).optional().nullable(),
});

// --- SECURITY HELPERS ---

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const generatedBuffer = Buffer.from(generatedSignature);

  if (signatureBuffer.length !== generatedBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, generatedBuffer);
}

async function verifyPaymentWithRazorpay(
  orderId: string,
  paymentId: string,
  requestId: string
): Promise<{ success: boolean; amount: number; orderNotes?: Record<string, string>; error?: string }> {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    const order = await razorpay.orders.fetch(orderId);

    if (payment.status !== 'captured') {
      console.error(JSON.stringify({ requestId, event: 'payment_not_captured', status: payment.status }));
      return { success: false, amount: 0, error: `Payment status: ${payment.status}` };
    }

    if (payment.order_id !== orderId) {
      console.error(JSON.stringify({ requestId, event: 'order_mismatch', expected: orderId, got: payment.order_id }));
      return { success: false, amount: 0, error: 'Payment order mismatch' };
    }

    if (payment.amount !== order.amount) {
      console.error(JSON.stringify({ requestId, event: 'amount_mismatch', orderAmount: order.amount, paymentAmount: payment.amount }));
      return { success: false, amount: 0, error: 'Amount mismatch' };
    }

    return {
      success: true,
      amount: Number(payment.amount) / 100,
      orderNotes: order.notes as Record<string, string> | undefined,
    };
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'razorpay_api_error', error: error.message }));
    return { success: false, amount: 0, error: 'Failed to verify with Razorpay' };
  }
}

async function checkIdempotency(
  paymentId: string,
  requestId: string
): Promise<{ isDuplicate: boolean; existingEnrollmentId?: string }> {
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .single();

  if (existingPayment) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('payment_id', paymentId)
      .single();

    console.log(JSON.stringify({ requestId, event: 'duplicate_payment_detected', paymentId, existingEnrollmentId: enrollment?.id }));
    return { isDuplicate: true, existingEnrollmentId: enrollment?.id };
  }

  return { isDuplicate: false };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Parse + Validate
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = VerifyPaymentSchema.safeParse(rawBody);
    if (!validation.success) {
      console.log(JSON.stringify({ requestId, event: 'validation_failed', errors: validation.error.format() }));
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }
    const body = validation.data;

    console.log(JSON.stringify({ requestId, event: 'payment_verify_start', orderId: body.razorpay_order_id, childName: body.childName }));

    // 2. Idempotency check
    const { isDuplicate, existingEnrollmentId } = await checkIdempotency(body.razorpay_payment_id, requestId);
    if (isDuplicate) {
      const duplicateRedirectUrl = `/enrollment/success?enrollmentId=${existingEnrollmentId || ''}&duplicate=true`;
      return NextResponse.json({ success: true, message: 'Payment already processed', enrollmentId: existingEnrollmentId, redirectUrl: duplicateRedirectUrl, duplicate: true });
    }

    // 3. Verify Razorpay signature
    if (!verifySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      console.error(JSON.stringify({ requestId, event: 'invalid_signature' }));
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
    }

    // 4. Verify amount with Razorpay API
    const paymentVerification = await verifyPaymentWithRazorpay(body.razorpay_order_id, body.razorpay_payment_id, requestId);
    if (!paymentVerification.success) {
      return NextResponse.json({ success: false, error: paymentVerification.error }, { status: 400 });
    }
    const verifiedAmount = paymentVerification.amount;

    // 5. Product info + age band (fetched early so sessions_included fallback is accurate)
    const productInfo = extractProductInfo(paymentVerification.orderNotes, body.productCode);
    const [ageBandConfigEarly] = await Promise.all([
      getAgeBandConfig(body.childAge, requestId),
    ]);
    const productDetails = await getProductDetails(productInfo.productCode, requestId, ageBandConfigEarly?.total_sessions);

    console.log(JSON.stringify({ requestId, event: 'amount_verified', amount: verifiedAmount, productCode: productInfo.productCode }));

    // 6. Parent + Child + Coach
    const parent = await getOrCreateParent(body.parentEmail, body.parentName, body.parentPhone, requestId);

    let childIdToUse = body.childId;
    let coachIdToUse = body.coachId;
    if (body.discoveryCallId) {
      const { data: dc } = await supabase
        .from('discovery_calls')
        .select('child_id, assigned_coach_id')
        .eq('id', body.discoveryCallId)
        .single();
      if (dc) {
        if (!childIdToUse && dc.child_id) childIdToUse = dc.child_id;
        if (!coachIdToUse && dc.assigned_coach_id) coachIdToUse = dc.assigned_coach_id;
      }
    }

    const child = await getOrCreateChild(childIdToUse, body.childName, body.childAge, parent.id, body.parentEmail, coachIdToUse, requestId);
    const coach = await getCoach(coachIdToUse, requestId);

    // 7. Record Payment
    const couponUsed = body.couponCode || body.referralCodeUsed || null;
    const { error: paymentError } = await supabase.from('payments').insert({
      parent_id: parent.id,
      child_id: child.id,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      amount: verifiedAmount,
      currency: (await loadPaymentConfig()).currency,
      status: 'captured',
      captured_at: new Date().toISOString(),
      coupon_code: couponUsed,
    });
    if (paymentError) {
      console.error(JSON.stringify({ requestId, event: 'payment_record_error', error: paymentError.message }));
    }

    // 8. Create Enrollment
    const startImmediately = !body.requestedStartDate;
    let programStart = startImmediately ? new Date() : new Date(body.requestedStartDate!);
    const programEnd = new Date(programStart);

    const durationMonths = productDetails?.duration_months || (productInfo.productCode === 'starter' ? 1 : 3);
    const durationWeeks = productDetails?.duration_weeks || (productInfo.productCode === 'starter' ? 4 : productInfo.productCode === 'continuation' ? 8 : 12);
    programEnd.setMonth(programEnd.getMonth() + durationMonths);

    const ageBandConfig = ageBandConfigEarly;

    // Handle continuation-specific logic
    let starterEnrollmentId: string | null = null;
    let startWeek = 0;
    if (productInfo.productCode === 'continuation') {
      startWeek = 4;
      const starterEnrollment = await getStarterEnrollment(child.id, requestId);
      if (starterEnrollment) {
        starterEnrollmentId = starterEnrollment.id;
        await markStarterCompleted(starterEnrollment.id, requestId);

        const { data: lastSession } = await supabase
          .from('scheduled_sessions')
          .select('scheduled_date')
          .eq('enrollment_id', starterEnrollment.id)
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .single();

        if (lastSession?.scheduled_date && startImmediately) {
          const nextWeekStart = new Date(lastSession.scheduled_date);
          nextWeekStart.setDate(nextWeekStart.getDate() + 7);
          programStart = nextWeekStart;
          programEnd.setTime(nextWeekStart.getTime());
          programEnd.setMonth(programEnd.getMonth() + durationMonths);
        }
      }
    }

    // Derive session count from weekly_pattern + duration
    const weeklyPattern = ageBandConfig?.weekly_pattern || [];
    let sessionsCount: number;
    let remedialSessionsMax: number;

    if (weeklyPattern.length > 0) {
      sessionsCount = getSessionsForTier(weeklyPattern, durationWeeks, startWeek);
      remedialSessionsMax = getBoosterCreditsForTier(ageBandConfig!.skill_booster_credits, durationWeeks, ageBandConfig!.program_duration_weeks);
    } else {
      sessionsCount = ageBandConfig?.total_sessions || productDetails?.sessions_included || productInfo.sessionsTotal || 0;
      remedialSessionsMax = productDetails?.sessions_skill_building ?? 3;
    }

    let continuationDeadline: string | null = null;
    if (productInfo.productCode === 'starter') {
      const deadline = new Date(programEnd);
      deadline.setDate(deadline.getDate() + 7);
      continuationDeadline = deadline.toISOString();
    }

    const enrollmentData: Record<string, unknown> = {
      child_id: child.id,
      parent_id: parent.id,
      coach_id: coach.id,
      payment_id: body.razorpay_payment_id,
      amount: verifiedAmount,
      status: startImmediately ? 'active' : 'pending_start',
      program_start: programStart.toISOString(),
      program_end: programEnd.toISOString(),
      schedule_confirmed: false,
      sessions_scheduled: 0,
      lead_source: body.leadSource,
      lead_source_coach_id: body.leadSourceCoachId || null,
      referral_code_used: couponUsed,
      requested_start_date: body.requestedStartDate || null,
      actual_start_date: startImmediately ? new Date().toISOString().split('T')[0] : null,
      enrollment_type: productInfo.productCode,
      product_id: productInfo.productId || productDetails?.id || null,
      sessions_purchased: sessionsCount,
      remedial_sessions_max: remedialSessionsMax,
      remedial_sessions_used: 0,
      preference_time_bucket: body.preferenceTimeBucket || null,
      preference_days: body.preferenceDays || null,
      preference_start_type: body.requestedStartDate ? 'later' : 'immediate',
      preference_start_date: body.requestedStartDate || null,
      age_band: ageBandConfig?.age_band || null,
      season_number: 1,
      total_sessions: sessionsCount,
      session_duration_minutes: ageBandConfig?.session_duration_minutes || 45,
      sessions_per_week: ageBandConfig?.sessions_per_week || null,
    };

    if (productInfo.productCode === 'continuation' && starterEnrollmentId) {
      enrollmentData.starter_enrollment_id = starterEnrollmentId;
    }
    if (productInfo.productCode === 'starter' && continuationDeadline) {
      enrollmentData.continuation_deadline = continuationDeadline;
    }

    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert(enrollmentData)
      .select()
      .single();

    if (enrollError) {
      console.error(JSON.stringify({ requestId, event: 'enrollment_create_error', error: enrollError.message }));
      throw new Error('Failed to create enrollment');
    }

    console.log(JSON.stringify({ requestId, event: 'enrollment_created', enrollmentId: enrollment.id, enrollmentType: productInfo.productCode, sessionsCount }));

    // Audit trail
    try {
      await supabase.from('activity_log').insert({
        action: 'enrollment_created',
        user_email: body.parentEmail || 'unknown',
        user_type: 'parent',
        metadata: {
          enrollment_id: enrollment.id,
          child_id: child.id,
          child_name: body.childName,
          amount: verifiedAmount,
          plan: productInfo.productCode,
          payment_id: body.razorpay_payment_id,
          coach_id: coach.id,
          coach_name: coach.name,
          sessions_count: sessionsCount,
          age_band: ageBandConfig?.age_band || null,
        },
      });
    } catch (logErr: any) {
      console.error(JSON.stringify({ requestId, event: 'activity_log_error', error: logErr.message }));
    }

    // =====================================================
    // POST-ENROLLMENT TASKS (non-blocking)
    // =====================================================

    let creditResult: CreditAwardResult = { success: false };
    let revenueResult: RevenueResult = { success: false };
    let queueResult = { success: false, messageId: null as string | null };
    let sessionsCreatedCount = 0;

    // Schedule sessions
    try {
      const preference: TimePreference = {
        bucket: body.preferenceTimeBucket || 'any',
        preferredDays: body.preferenceDays || undefined,
      };

      const schedulerOptions = {
        enrollmentId: enrollment.id,
        childId: child.id,
        coachId: coach.id,
        planSlug: productInfo.productCode,
        programStart,
        preference,
        requestId,
        weeklyPattern: weeklyPattern.length > 0 ? weeklyPattern : undefined,
        sessionDurationMinutes: ageBandConfig?.session_duration_minutes,
        startWeek,
        durationWeeks,
      };

      let schedulerResult;
      try {
        schedulerResult = await scheduleEnrollmentSessions(schedulerOptions, supabase as any);
      } catch (smartErr: any) {
        console.warn(JSON.stringify({ requestId, event: 'smart_scheduler_failed_using_fallback', error: smartErr.message }));
        schedulerResult = await createSessionsSimple(schedulerOptions, supabase as any);
      }

      if (schedulerResult.success) {
        sessionsCreatedCount = schedulerResult.sessionsCreated;
      }
    } catch (sessionsErr: any) {
      console.error(JSON.stringify({ requestId, event: 'sessions_block_error', error: sessionsErr.message }));
    }

    // Referral credit
    try {
      if (couponUsed) {
        creditResult = await awardReferralCredit(couponUsed, enrollment.id, parent.id, verifiedAmount, requestId);
      }
    } catch (creditErr: any) {
      console.error(JSON.stringify({ requestId, event: 'referral_credit_error', error: creditErr.message }));
    }

    // Revenue split
    try {
      revenueResult = await calculateRevenueSplit(
        enrollment.id, verifiedAmount, coach, body.leadSource,
        body.leadSourceCoachId || null, child.id, body.childName, requestId, durationMonths
      );
    } catch (revenueErr: any) {
      console.error(JSON.stringify({ requestId, event: 'revenue_split_error', error: revenueErr.message }));
    }

    // Queue background jobs
    try {
      if (startImmediately) {
        queueResult = await queueEnrollmentComplete({
          enrollmentId: enrollment.id,
          childId: child.id,
          childName: body.childName,
          parentId: parent.id,
          parentEmail: body.parentEmail,
          parentName: body.parentName,
          parentPhone: body.parentPhone || '',
          coachId: coach.id,
          coachEmail: coach.email,
          coachName: coach.name,
        });
      } else {
        await supabase.from('enrollment_events').insert({
          enrollment_id: enrollment.id,
          event_type: 'payment_received_delayed_start',
          event_data: {
            requested_start_date: body.requestedStartDate,
            payment_id: body.razorpay_payment_id,
            child_name: body.childName,
            coach_name: coach.name,
          },
          triggered_by: 'system',
        });
      }
    } catch (bgJobErr: any) {
      console.error(JSON.stringify({ requestId, event: 'background_jobs_error', error: bgJobErr.message }));
    }

    // Final Response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'payment_verify_complete', enrollmentId: enrollment.id, duration: `${duration}ms` }));

    const redirectParams = new URLSearchParams({
      enrollmentId: enrollment.id,
      childName: body.childName,
      coachName: coach.name,
      sessions: String(sessionsCount),
      product: productInfo.productCode,
    });
    const redirectUrl = `/enrollment/success?${redirectParams.toString()}`;

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      enrollmentId: enrollment.id,
      redirectUrl,
      data: {
        enrollmentId: enrollment.id,
        childId: child.id,
        parentId: parent.id,
        coachId: coach.id,
        coachName: coach.name,
        amountPaid: verifiedAmount,
        product: {
          code: productInfo.productCode,
          id: productInfo.productId || productDetails?.id,
          sessionsIncluded: sessionsCount,
        },
        enrollmentType: productInfo.productCode,
        starterEnrollmentId: starterEnrollmentId || undefined,
        continuationDeadline: continuationDeadline || undefined,
      },
      revenue: revenueResult.success
        ? { coach_earnings: revenueResult.net_to_coach, platform_fee: revenueResult.platform_fee, tds_collected: revenueResult.tds_amount, payouts_scheduled: revenueResult.payouts_scheduled }
        : null,
      referral: creditResult.success
        ? { creditAwarded: creditResult.creditAwarded, referrerParentId: creditResult.referrerParentId }
        : null,
      scheduling: {
        status: startImmediately ? (queueResult.success ? 'queued' : 'pending') : 'delayed',
        messageId: queueResult.messageId,
        startDate: programStart.toISOString().split('T')[0],
        endDate: programEnd.toISOString().split('T')[0],
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({ requestId, event: 'payment_verify_error', error: error.message, duration: `${duration}ms` }));
    return NextResponse.json({ success: false, error: error.message || 'Payment verification failed' }, { status: 500 });
  }
}
