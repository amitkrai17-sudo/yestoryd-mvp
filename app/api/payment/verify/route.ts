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
  productCode: z.enum(['starter', 'continuation', 'full', 'tuition']).optional().nullable(),
  enrollmentId: z.string().uuid().optional().nullable(),
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

    // ============================================================
    // TUITION BRANCH: Update existing enrollment, don't create new
    // ============================================================
    const orderNotes = paymentVerification.orderNotes || {};
    const isTuition = orderNotes.enrollment_type === 'tuition' || orderNotes.productCode === 'tuition' || body.productCode === 'tuition';

    if (isTuition) {
      const tuitionEnrollmentId = orderNotes.enrollmentId || body.enrollmentId;
      if (!tuitionEnrollmentId) {
        return NextResponse.json({ success: false, error: 'Missing tuition enrollment ID' }, { status: 400 });
      }

      // Fetch existing tuition enrollment
      const { data: tuitionEnrollment, error: tuitionErr } = await supabase
        .from('enrollments')
        .select('id, child_id, parent_id, coach_id, session_rate, sessions_purchased, sessions_remaining, amount, status, program_start')
        .eq('id', tuitionEnrollmentId)
        .single();

      if (tuitionErr || !tuitionEnrollment) {
        return NextResponse.json({ success: false, error: 'Tuition enrollment not found' }, { status: 404 });
      }

      // Record payment
      const { error: paymentError } = await supabase.from('payments').insert({
        parent_id: tuitionEnrollment.parent_id,
        child_id: tuitionEnrollment.child_id,
        razorpay_order_id: body.razorpay_order_id,
        razorpay_payment_id: body.razorpay_payment_id,
        amount: verifiedAmount,
        currency: (await loadPaymentConfig()).currency,
        status: 'captured',
        captured_at: new Date().toISOString(),
      });
      if (paymentError) {
        console.error(JSON.stringify({ requestId, event: 'tuition_payment_record_error', error: paymentError.message }));
      }

      // Calculate new balance
      const currentRemaining = tuitionEnrollment.sessions_remaining || 0;
      const sessionsPurchased = tuitionEnrollment.sessions_purchased || 0;
      const newRemaining = currentRemaining + sessionsPurchased;
      const isFirstPayment = !tuitionEnrollment.program_start;
      const existingAmount = tuitionEnrollment.amount || 0;

      // Update enrollment
      const enrollmentUpdate: Record<string, unknown> = {
        status: 'active',
        sessions_remaining: newRemaining,
        amount: existingAmount + verifiedAmount,
        payment_id: body.razorpay_payment_id,
        updated_at: new Date().toISOString(),
      };
      if (isFirstPayment) {
        enrollmentUpdate.program_start = new Date().toISOString();
        enrollmentUpdate.actual_start_date = new Date().toISOString().split('T')[0];
      }

      await supabase.from('enrollments').update(enrollmentUpdate).eq('id', tuitionEnrollmentId);

      // Ledger entry
      await supabase.from('tuition_session_ledger').insert({
        enrollment_id: tuitionEnrollmentId,
        change_amount: sessionsPurchased,
        balance_after: newRemaining,
        reason: isFirstPayment ? 'initial_purchase' : 'renewal',
        payment_id: body.razorpay_payment_id,
        notes: `Payment of ₹${verifiedAmount} — ${sessionsPurchased} sessions credited`,
        created_by: body.parentEmail || 'system',
      });

      // Update child as enrolled + safety net: ensure name is populated
      if (tuitionEnrollment.child_id) {
        await supabase.from('children').update({
          is_enrolled: true,
          enrollment_status: 'enrolled',
          lead_status: 'enrolled',
          coach_id: tuitionEnrollment.coach_id,
          enrolled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', tuitionEnrollment.child_id);

        // Safety net: backfill children.name if still NULL
        if (body.childName) {
          await supabase
            .from('children')
            .update({ name: body.childName, child_name: body.childName })
            .eq('id', tuitionEnrollment.child_id)
            .is('name', null);
        }
      }

      // Revenue split — internal coach path (Rucha)
      try {
        const coach = await getCoach(tuitionEnrollment.coach_id || null, requestId);
        await calculateRevenueSplit(
          tuitionEnrollmentId, verifiedAmount, coach, 'yestoryd', null,
          tuitionEnrollment.child_id || '', body.childName, requestId, 1,
        );
      } catch (revErr: unknown) {
        console.error(JSON.stringify({ requestId, event: 'tuition_revenue_error', error: revErr instanceof Error ? revErr.message : String(revErr) }));
      }

      // Queue enrollment-complete for calendar scheduling (only on first payment)
      if (isFirstPayment) {
        try {
          const coach = await getCoach(tuitionEnrollment.coach_id || null, requestId);
          const { data: parentData } = await supabase.from('parents').select('name, email, phone').eq('id', tuitionEnrollment.parent_id!).single();

          await queueEnrollmentComplete({
            enrollmentId: tuitionEnrollmentId,
            childId: tuitionEnrollment.child_id || '',
            childName: body.childName,
            parentId: tuitionEnrollment.parent_id || '',
            parentEmail: parentData?.email || body.parentEmail,
            parentName: parentData?.name || body.parentName,
            parentPhone: parentData?.phone || body.parentPhone || '',
            coachId: coach.id,
            coachEmail: coach.email,
            coachName: coach.name,
          });
        } catch (queueErr: unknown) {
          console.error(JSON.stringify({ requestId, event: 'tuition_queue_error', error: queueErr instanceof Error ? queueErr.message : String(queueErr) }));
        }
      }

      // Send payment confirmation WhatsApp + Email (all payments: first + renewals)
      try {
        const { sendCommunication } = await import('@/lib/communication');
        const { getProgramLabel, getScheduleDescription } = await import('@/lib/utils/program-label');
        // Fetch program label for tuition (may have a linked category)
        const { data: onboardingForLabel } = await supabase
          .from('tuition_onboarding')
          .select('category_id, skill_categories!category_id(parent_label)')
          .eq('enrollment_id', tuitionEnrollmentId)
          .single();
        const catLabel = (onboardingForLabel?.skill_categories as any)?.parent_label ?? null;
        const tuitionEnr = { billing_model: 'prepaid_sessions' as const, sessions_remaining: sessionsPurchased };
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
        await sendCommunication({
          templateCode: 'P14_payment_confirmed',
          recipientType: 'parent',
          recipientId: tuitionEnrollment.parent_id || undefined,
          recipientPhone: body.parentPhone,
          recipientEmail: body.parentEmail,
          recipientName: body.parentName,
          variables: {
            parent_first_name: body.parentName?.split(' ')[0] || 'Parent',
            amount: String(verifiedAmount),
            child_name: body.childName,
            enrollment_id: tuitionEnrollmentId,
            sessions_count: String(sessionsPurchased),
            dashboard_link: `${baseUrl}/parent/dashboard`,
            program_label: getProgramLabel(tuitionEnr, catLabel),
            schedule_description: getScheduleDescription(tuitionEnr),
          },
          relatedEntityType: 'enrollment',
          relatedEntityId: tuitionEnrollmentId,
        });
      } catch (waErr: unknown) {
        console.error(JSON.stringify({ requestId, event: 'payment_wa_send_failed', path: 'tuition_verify', error: waErr instanceof Error ? waErr.message : String(waErr) }));
        try {
          await supabase.from('activity_log').insert({
            action: 'payment_wa_send_failed',
            user_email: body.parentEmail || 'unknown',
            user_type: 'system',
            metadata: {
              error: waErr instanceof Error ? waErr.message : String(waErr),
              template: 'P14_payment_confirmed',
              parent_id: tuitionEnrollment.parent_id,
              enrollment_id: tuitionEnrollmentId,
              payment_path: 'tuition_verify',
            },
          });
        } catch (_) { /* swallow logging failure */ }
      }

      // Activity log
      await supabase.from('activity_log').insert({
        action: 'tuition_payment_verified',
        user_email: body.parentEmail || 'unknown',
        user_type: 'parent',
        metadata: {
          enrollment_id: tuitionEnrollmentId,
          amount: verifiedAmount,
          sessions_purchased: sessionsPurchased,
          new_balance: newRemaining,
          is_first_payment: isFirstPayment,
          payment_id: body.razorpay_payment_id,
        },
      });

      console.log(JSON.stringify({
        requestId,
        event: 'tuition_payment_verified',
        enrollmentId: tuitionEnrollmentId,
        amount: verifiedAmount,
        newBalance: newRemaining,
        isFirstPayment,
      }));

      return NextResponse.json({
        success: true,
        message: 'Payment verified — sessions credited',
        enrollmentId: tuitionEnrollmentId,
        redirectUrl: `/tuition/pay/${tuitionEnrollmentId}?success=true`,
        data: {
          enrollmentId: tuitionEnrollmentId,
          childId: tuitionEnrollment.child_id,
          amountPaid: verifiedAmount,
          sessionsAdded: sessionsPurchased,
          newBalance: newRemaining,
          enrollmentType: 'tuition',
        },
      });
    }

    // ============================================================
    // STANDARD COACHING BRANCH (starter/continuation/full)
    // ============================================================

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
    // RECORD COUPON USAGE (after enrollment created)
    // =====================================================
    try {
      const orderNotes = paymentVerification.orderNotes || {};
      const couponCode = orderNotes.couponCode || body.couponCode || null;
      const couponId = orderNotes.couponId || null;
      const couponDiscount = Number(orderNotes.couponDiscount) || 0;
      const basePriceFromNotes = Number(orderNotes.basePrice) || verifiedAmount;
      const referralCreditFromNotes = Number(orderNotes.referralCreditUsed) || 0;

      if (couponCode && couponDiscount > 0) {
        // Resolve couponId if not in order notes (legacy orders)
        let resolvedCouponId = couponId;
        if (!resolvedCouponId) {
          const { data: couponRow } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', couponCode.toUpperCase())
            .single();
          resolvedCouponId = couponRow?.id || null;
        }

        if (resolvedCouponId) {
          // Idempotency: check if already recorded for this order
          const { count: existingUsage } = await supabase
            .from('coupon_usages')
            .select('*', { count: 'exact', head: true })
            .eq('coupon_id', resolvedCouponId)
            .eq('parent_id', parent.id)
            .eq('enrollment_id', enrollment.id);

          if (!existingUsage || existingUsage === 0) {
            await supabase.from('coupon_usages').insert({
              coupon_id: resolvedCouponId,
              parent_id: parent.id,
              enrollment_id: enrollment.id,
              coupon_discount: couponDiscount,
              original_amount: basePriceFromNotes,
              final_amount: verifiedAmount,
              total_discount: couponDiscount + referralCreditFromNotes,
              product_type: productInfo.productCode,
            });

            // Increment current_uses + successful_conversions on coupons table
            const { data: couponRow } = await supabase
              .from('coupons')
              .select('current_uses, successful_conversions')
              .eq('id', resolvedCouponId)
              .single();

            if (couponRow) {
              await supabase.from('coupons').update({
                current_uses: (couponRow.current_uses || 0) + 1,
                successful_conversions: (couponRow.successful_conversions || 0) + 1,
                updated_at: new Date().toISOString(),
              }).eq('id', resolvedCouponId);
            }

            console.log(JSON.stringify({ requestId, event: 'coupon_usage_recorded', couponId: resolvedCouponId, couponCode, enrollmentId: enrollment.id }));
          }
        }
      }
    } catch (couponErr: any) {
      console.error(JSON.stringify({ requestId, event: 'coupon_usage_record_error', error: couponErr.message }));
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

    // Send payment confirmation WhatsApp + Email
    try {
      const { sendCommunication } = await import('@/lib/communication');
      const { getScheduleDescription } = await import('@/lib/utils/program-label');
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
      const coachingEnr = { billing_model: 'prepaid_season' as const };
      await sendCommunication({
        templateCode: 'P14_payment_confirmed',
        recipientType: 'parent',
        recipientId: parent.id,
        recipientPhone: body.parentPhone,
        recipientEmail: body.parentEmail,
        recipientName: body.parentName,
        variables: {
          parent_first_name: body.parentName?.split(' ')[0] || 'Parent',
          amount: String(verifiedAmount),
          child_name: body.childName,
          enrollment_id: enrollment.id,
          sessions_count: String(sessionsCount),
          dashboard_link: `${baseUrl}/parent/dashboard`,
          program_label: 'English Coaching Program',
          schedule_description: getScheduleDescription(coachingEnr),
        },
        relatedEntityType: 'enrollment',
        relatedEntityId: enrollment.id,
      });
    } catch (waErr: unknown) {
      console.error(JSON.stringify({ requestId, event: 'payment_wa_send_failed', path: 'standard_verify', error: waErr instanceof Error ? waErr.message : String(waErr) }));
      try {
        await supabase.from('activity_log').insert({
          action: 'payment_wa_send_failed',
          user_email: body.parentEmail || 'unknown',
          user_type: 'system',
          metadata: {
            error: waErr instanceof Error ? waErr.message : String(waErr),
            template: 'P14_payment_confirmed',
            parent_id: parent.id,
            enrollment_id: enrollment.id,
            payment_path: 'standard_verify',
          },
        });
      } catch (_) { /* swallow logging failure */ }
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
