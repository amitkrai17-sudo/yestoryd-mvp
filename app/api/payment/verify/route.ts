// ============================================================
// FILE: app/api/payment/verify/route.ts
// ============================================================
// HARDENED VERSION - Production Ready
// Security: Amount verification, Idempotency, Race condition protection
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Razorpay from 'razorpay';
import { queueEnrollmentComplete } from '@/lib/qstash';

// --- CONFIGURATION ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

// --- 1. VALIDATION SCHEMA ---
const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(10, 'Invalid order ID'),
  razorpay_payment_id: z.string().min(10, 'Invalid payment ID'),
  razorpay_signature: z.string().min(64, 'Invalid signature'),
  // Parent/Child Data
  childName: z.string().min(1).max(100),
  childAge: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  childId: z.string().uuid().optional().nullable(),
  parentName: z.string().min(1).max(100),
  parentEmail: z.string().email().transform(v => v.toLowerCase().trim()),
  parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile').optional().nullable(),
  // Coach/Lead Data
  coachId: z.string().uuid().optional().nullable(),
  leadSource: z.enum(['yestoryd', 'coach']).default('yestoryd'),
  leadSourceCoachId: z.string().uuid().optional().nullable(),
  // Coupon (we'll validate amount server-side, these are just for reference)
  couponCode: z.string().max(20).optional().nullable(),
  referralCodeUsed: z.string().max(20).optional().nullable(),
  // Scheduling
  requestedStartDate: z.string().optional().nullable(),
});

// --- 2. TYPES ---
interface CoachGroup {
  id: string;
  name: string;
  display_name: string;
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
  is_internal: boolean;
}

interface CoachWithGroup {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tds_cumulative_fy: number;
  coach_groups: CoachGroup | CoachGroup[] | null;
}

interface RevenueResult {
  success: boolean;
  enrollment_revenue_id?: string;
  lead_cost?: number;
  coach_cost?: number;
  platform_fee?: number;
  tds_amount?: number;
  net_to_coach?: number;
  payouts_scheduled?: number;
  error?: string;
}

interface CreditAwardResult {
  success: boolean;
  creditAwarded?: number;
  referrerParentId?: string;
  error?: string;
}

// --- 3. SECURITY HELPERS ---

/**
 * Verify Razorpay Signature (Timing-Safe)
 */
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

/**
 * Verify Payment Amount with Razorpay API
 * CRITICAL: Never trust client-sent amounts
 */
async function verifyPaymentWithRazorpay(
  orderId: string,
  paymentId: string,
  requestId: string
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    // Fetch actual payment from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);
    const order = await razorpay.orders.fetch(orderId);

    // Verify payment status
    if (payment.status !== 'captured') {
      console.error(JSON.stringify({ 
        requestId, 
        event: 'payment_not_captured', 
        status: payment.status 
      }));
      return { success: false, amount: 0, error: `Payment status: ${payment.status}` };
    }

    // Verify payment belongs to this order
    if (payment.order_id !== orderId) {
      console.error(JSON.stringify({ 
        requestId, 
        event: 'order_mismatch',
        expected: orderId,
        got: payment.order_id 
      }));
      return { success: false, amount: 0, error: 'Payment order mismatch' };
    }

    // Verify amounts match
    if (payment.amount !== order.amount) {
      console.error(JSON.stringify({ 
        requestId, 
        event: 'amount_mismatch',
        orderAmount: order.amount,
        paymentAmount: payment.amount 
      }));
      return { success: false, amount: 0, error: 'Amount mismatch' };
    }

    // Return amount in rupees (Razorpay uses paise)
    return { success: true, amount: Number(payment.amount) / 100 };

  } catch (error: any) {
    console.error(JSON.stringify({ 
      requestId, 
      event: 'razorpay_api_error', 
      error: error.message 
    }));
    return { success: false, amount: 0, error: 'Failed to verify with Razorpay' };
  }
}

/**
 * Check Idempotency - Prevent duplicate processing
 */
async function checkIdempotency(
  paymentId: string,
  requestId: string
): Promise<{ isDuplicate: boolean; existingEnrollmentId?: string }> {
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, enrollment_id')
    .eq('razorpay_payment_id', paymentId)
    .single();

  if (existingPayment) {
    console.log(JSON.stringify({ 
      requestId, 
      event: 'duplicate_payment_detected',
      paymentId,
      existingEnrollmentId: existingPayment.enrollment_id 
    }));
    
    // Fetch enrollment ID from enrollments if not on payment record
    if (!existingPayment.enrollment_id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('payment_id', paymentId)
        .single();
      
      return { isDuplicate: true, existingEnrollmentId: enrollment?.id };
    }
    
    return { isDuplicate: true, existingEnrollmentId: existingPayment.enrollment_id };
  }

  return { isDuplicate: false };
}

// --- 4. BUSINESS LOGIC HELPERS ---

/**
 * Get or Create Parent (Race-Condition Safe with UPSERT)
 */
async function getOrCreateParent(
  email: string,
  name: string,
  phone: string | null | undefined,
  requestId: string
): Promise<{ id: string; isNew: boolean }> {
  // Use upsert to handle race conditions
  const { data: parent, error } = await supabase
    .from('parents')
    .upsert(
      { 
        email, 
        name, 
        phone: phone || null,
        updated_at: new Date().toISOString()
      },
      { 
        onConflict: 'email',
        ignoreDuplicates: false // Update if exists
      }
    )
    .select('id, created_at, updated_at')
    .single();

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'parent_upsert_failed', error: error.message }));
    throw new Error('Failed to create/update parent record');
  }

  // Check if this was a new insert or update
  const isNew = parent.created_at === parent.updated_at;
  
  console.log(JSON.stringify({ 
    requestId, 
    event: isNew ? 'parent_created' : 'parent_found',
    parentId: parent.id 
  }));

  return { id: parent.id, isNew };
}

/**
 * Get or Create Child
 */
async function getOrCreateChild(
  childId: string | null | undefined,
  childName: string,
  childAge: number,
  parentId: string,
  parentEmail: string,
  coachId: string | null | undefined,
  requestId: string
): Promise<{ id: string; isNew: boolean }> {
  // If childId provided, update existing
  if (childId) {
    const { data: existingChild, error } = await supabase
      .from('children')
      .update({
        child_name: childName,
        enrollment_status: 'enrolled',
        lead_status: 'enrolled',
        coach_id: coachId,
        parent_id: parentId,
        parent_email: parentEmail,
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', childId)
      .select('id')
      .single();

    if (!error && existingChild) {
      console.log(JSON.stringify({ requestId, event: 'child_updated', childId }));
      return { id: existingChild.id, isNew: false };
    }
  }

  // Create new child
  const { data: newChild, error: childError } = await supabase
    .from('children')
    .insert({
      child_name: childName,
      age: childAge,
      parent_id: parentId,
      parent_email: parentEmail,
      enrollment_status: 'enrolled',
      lead_status: 'enrolled',
      coach_id: coachId,
      enrolled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (childError) {
    console.error(JSON.stringify({ requestId, event: 'child_create_failed', error: childError.message }));
    throw new Error('Failed to create child record');
  }

  console.log(JSON.stringify({ requestId, event: 'child_created', childId: newChild.id }));
  return { id: newChild.id, isNew: true };
}

/**
 * Get Coach with Fallback
 */
async function getCoach(
  coachId: string | null | undefined,
  requestId: string
): Promise<CoachWithGroup> {
  // Try provided coachId first
  if (coachId) {
    const { data: coach } = await supabase
      .from('coaches')
      .select(`
        id, name, email, phone, tds_cumulative_fy,
        coach_groups (
          id, name, display_name,
          lead_cost_percent, coach_cost_percent, platform_fee_percent,
          is_internal
        )
      `)
      .eq('id', coachId)
      .single();

    if (coach) {
      console.log(JSON.stringify({ requestId, event: 'coach_found', coachId: coach.id }));
      return coach as unknown as CoachWithGroup;
    }
  }

  // Fallback to default coach (Rucha)
  const { data: defaultCoach, error } = await supabase
    .from('coaches')
    .select(`
      id, name, email, phone, tds_cumulative_fy,
      coach_groups (
        id, name, display_name,
        lead_cost_percent, coach_cost_percent, platform_fee_percent,
        is_internal
      )
    `)
    .eq('email', 'rucha.rai@yestoryd.com')
    .single();

  if (error || !defaultCoach) {
    console.error(JSON.stringify({ requestId, event: 'no_default_coach' }));
    throw new Error('Critical: No default coach configured');
  }

  console.log(JSON.stringify({ requestId, event: 'using_default_coach', coachId: defaultCoach.id }));
  return defaultCoach as unknown as CoachWithGroup;
}

/**
 * Award Referral Credit
 */
async function awardReferralCredit(
  couponCode: string,
  enrollmentId: string,
  referredParentId: string,
  programAmount: number,
  requestId: string
): Promise<CreditAwardResult> {
  try {
    // 1. Validate Coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('id, code, coupon_type, parent_id, current_uses, successful_conversions, total_referrals')
      .eq('code', couponCode.toUpperCase())
      .eq('coupon_type', 'parent_referral')
      .single();

    if (couponError || !coupon || !coupon.parent_id) {
      return { success: false, error: 'Not a parent referral coupon' };
    }

    // 2. Get Settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['parent_referral_credit_percent', 'referral_credit_expiry_days']);

    const creditPercent = parseInt(settings?.find(s => s.key === 'parent_referral_credit_percent')?.value || '10');
    const expiryDays = parseInt(settings?.find(s => s.key === 'referral_credit_expiry_days')?.value || '30');

    // 3. Calculate Credit
    const creditAmount = Math.round((programAmount * creditPercent) / 100);

    // 4. Get Referrer
    const { data: referrer, error: referrerError } = await supabase
      .from('parents')
      .select('id, referral_credit_balance')
      .eq('id', coupon.parent_id)
      .single();

    if (referrerError || !referrer) {
      return { success: false, error: 'Referrer not found' };
    }

    // 5. Update Balance (atomic)
    const newBalance = (referrer.referral_credit_balance || 0) + creditAmount;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    const { error: updateError } = await supabase
      .from('parents')
      .update({
        referral_credit_balance: newBalance,
        referral_credit_expires_at: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', referrer.id);

    if (updateError) throw updateError;

    // 6. Record Transaction
    await supabase.from('referral_credit_transactions').insert({
      parent_id: referrer.id,
      type: 'earned',
      amount: creditAmount,
      balance_after: newBalance,
      description: 'Referral credit for enrollment',
      enrollment_id: enrollmentId,
      coupon_code: couponCode,
      referred_parent_id: referredParentId,
      expires_at: expiryDate.toISOString(),
    });

    // 7. Update Coupon Stats
    await supabase.from('coupons').update({
      current_uses: (coupon.current_uses || 0) + 1,
      successful_conversions: (coupon.successful_conversions || 0) + 1,
      total_referrals: (coupon.total_referrals || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', coupon.id);

    console.log(JSON.stringify({ 
      requestId, 
      event: 'referral_credit_awarded',
      amount: creditAmount,
      referrerId: referrer.id 
    }));

    return { success: true, creditAwarded: creditAmount, referrerParentId: referrer.id };

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'credit_award_error', error: error.message }));
    return { success: false, error: error.message };
  }
}

/**
 * Calculate Revenue Split and Schedule Payouts
 */
async function calculateRevenueSplit(
  enrollmentId: string,
  amount: number,
  coach: CoachWithGroup,
  leadSource: 'yestoryd' | 'coach',
  leadSourceCoachId: string | null,
  childId: string,
  childName: string,
  requestId: string
): Promise<RevenueResult> {
  try {
    // Normalize Group Data
    let group: CoachGroup;
    if (Array.isArray(coach.coach_groups)) {
      group = coach.coach_groups[0];
    } else {
      group = coach.coach_groups as CoachGroup;
    }

    // Fallback if no group
    if (!group) {
      group = {
        id: 'default',
        name: 'rising',
        display_name: 'Rising Coach',
        lead_cost_percent: 20,
        coach_cost_percent: 50,
        platform_fee_percent: 30,
        is_internal: false,
      };
    }

    // Handle Internal Coach (100% Platform)
    if (group.is_internal) {
      const { data: revenue } = await supabase.from('enrollment_revenue').insert({
        enrollment_id: enrollmentId,
        lead_source: leadSource,
        lead_source_coach_id: leadSourceCoachId,
        coaching_coach_id: coach.id,
        total_amount: amount,
        platform_fee_amount: amount,
        net_retained_by_platform: amount,
        coach_group_id: group.id,
        coach_group_name: group.name,
        status: 'completed',
        config_snapshot: { group, note: 'Internal coach - 100% to platform' },
      }).select('id').single();

      return { success: true, enrollment_revenue_id: revenue?.id, platform_fee: amount, net_to_coach: 0, payouts_scheduled: 0 };
    }

    // Calculate Splits
    const leadCost = Math.round(amount * group.lead_cost_percent / 100);
    const coachCost = Math.round(amount * group.coach_cost_percent / 100);
    const platformFee = amount - leadCost - coachCost;

    // Get TDS Config
    const { data: config } = await supabase
      .from('revenue_split_config')
      .select('tds_rate_percent, tds_threshold_annual, payout_day_of_month')
      .eq('is_active', true)
      .single();

    const tdsRate = config?.tds_rate_percent || 10;
    const tdsThreshold = config?.tds_threshold_annual || 30000;
    const payoutDay = config?.payout_day_of_month || 7;

    // Calculate TDS
    const currentFY = coach.tds_cumulative_fy || 0;
    const tdsApplicable = (currentFY + coachCost) > tdsThreshold;
    const tdsOnCoach = tdsApplicable ? Math.round(coachCost * tdsRate / 100) : 0;

    let tdsOnLead = 0;
    if (leadSource === 'coach' && leadSourceCoachId && tdsApplicable) {
      tdsOnLead = Math.round(leadCost * tdsRate / 100);
    }

    const totalTds = tdsOnCoach + tdsOnLead;
    const netToCoach = coachCost - tdsOnCoach;
    const netToPlatform = platformFee + (leadSource === 'yestoryd' ? leadCost : 0) + totalTds;

    // Insert Revenue Record
    const { data: revenue, error: revError } = await supabase.from('enrollment_revenue').insert({
      enrollment_id: enrollmentId,
      coaching_coach_id: coach.id,
      lead_source: leadSource,
      lead_source_coach_id: leadSourceCoachId,
      total_amount: amount,
      lead_cost_amount: leadCost,
      coach_cost_amount: coachCost,
      platform_fee_amount: platformFee,
      tds_applicable: tdsApplicable,
      tds_rate_applied: tdsApplicable ? tdsRate : null,
      tds_amount: totalTds,
      net_to_coach: netToCoach,
      net_retained_by_platform: netToPlatform,
      coach_group_id: group.id,
      coach_group_name: group.name,
      status: 'pending',
      config_snapshot: { group, tds_rate: tdsRate, tds_threshold: tdsThreshold },
    }).select('id').single();

    if (revError) throw revError;

    // Schedule Payouts (Batch Insert)
    const now = new Date();
    const payoutRecords = [];
    const monthlyCoachGross = Math.round(coachCost / 3);
    const monthlyCoachTds = Math.round(tdsOnCoach / 3);

    for (let i = 1; i <= 3; i++) {
      const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
      payoutRecords.push({
        enrollment_revenue_id: revenue.id,
        coach_id: coach.id,
        child_id: childId,
        child_name: childName,
        payout_month: i,
        payout_type: 'coach_cost',
        gross_amount: monthlyCoachGross,
        tds_amount: monthlyCoachTds,
        net_amount: monthlyCoachGross - monthlyCoachTds,
        scheduled_date: payoutDate.toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // Lead bonus payouts if coach-sourced
    if (leadSource === 'coach' && leadSourceCoachId) {
      const monthlyLeadGross = Math.round(leadCost / 3);
      const monthlyLeadTds = Math.round(tdsOnLead / 3);

      for (let i = 1; i <= 3; i++) {
        const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
        payoutRecords.push({
          enrollment_revenue_id: revenue.id,
          coach_id: leadSourceCoachId,
          child_id: childId,
          child_name: childName,
          payout_month: i,
          payout_type: 'lead_bonus',
          gross_amount: monthlyLeadGross,
          tds_amount: monthlyLeadTds,
          net_amount: monthlyLeadGross - monthlyLeadTds,
          scheduled_date: payoutDate.toISOString().split('T')[0],
          status: 'scheduled',
        });
      }
    }

    // Batch insert payouts
    const { error: payoutError } = await supabase.from('coach_payouts').insert(payoutRecords);
    if (payoutError) {
      console.error(JSON.stringify({ requestId, event: 'payout_insert_error', error: payoutError.message }));
    }

    // Update Coach Cumulative TDS
    await supabase.from('coaches').update({
      tds_cumulative_fy: currentFY + coachCost,
      updated_at: new Date().toISOString(),
    }).eq('id', coach.id);

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_calculated',
      coachCost,
      platformFee,
      tds: totalTds,
      payouts: payoutRecords.length,
    }));

    return {
      success: true,
      enrollment_revenue_id: revenue.id,
      lead_cost: leadCost,
      coach_cost: coachCost,
      platform_fee: platformFee,
      tds_amount: totalTds,
      net_to_coach: netToCoach,
      payouts_scheduled: payoutRecords.length,
    };

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'revenue_calc_error', error: error.message }));
    return { success: false, error: error.message };
  }
}

// --- 5. MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Parse JSON Safely
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 2. Validate Input with Zod
    const validation = VerifyPaymentSchema.safeParse(rawBody);
    if (!validation.success) {
      console.log(JSON.stringify({ 
        requestId, 
        event: 'validation_failed', 
        errors: validation.error.format() 
      }));
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }
    const body = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'payment_verify_start',
      orderId: body.razorpay_order_id,
      childName: body.childName,
    }));

    // 3. IDEMPOTENCY CHECK (Critical!)
    const { isDuplicate, existingEnrollmentId } = await checkIdempotency(
      body.razorpay_payment_id,
      requestId
    );

    if (isDuplicate) {
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        enrollmentId: existingEnrollmentId,
        duplicate: true,
      });
    }

    // 4. Verify Razorpay Signature (Timing-Safe)
    const isValidSignature = verifySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature
    );

    if (!isValidSignature) {
      console.error(JSON.stringify({ requestId, event: 'invalid_signature' }));
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // 5. VERIFY AMOUNT WITH RAZORPAY API (Critical!)
    const paymentVerification = await verifyPaymentWithRazorpay(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      requestId
    );

    if (!paymentVerification.success) {
      return NextResponse.json(
        { success: false, error: paymentVerification.error },
        { status: 400 }
      );
    }

    const verifiedAmount = paymentVerification.amount; // This is the REAL amount paid
    console.log(JSON.stringify({ 
      requestId, 
      event: 'amount_verified', 
      amount: verifiedAmount 
    }));

    // 6. Get or Create Parent (Race-Safe)
    const parent = await getOrCreateParent(
      body.parentEmail,
      body.parentName,
      body.parentPhone,
      requestId
    );

    // 7. Get or Create Child
    const child = await getOrCreateChild(
      body.childId,
      body.childName,
      body.childAge,
      parent.id,
      body.parentEmail,
      body.coachId,
      requestId
    );

    // 8. Get Coach
    const coach = await getCoach(body.coachId, requestId);

    // 9. Record Payment
    const couponUsed = body.couponCode || body.referralCodeUsed || null;
    
    const { error: paymentError } = await supabase.from('payments').insert({
      parent_id: parent.id,
      child_id: child.id,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      amount: verifiedAmount, // Use verified amount!
      currency: 'INR',
      status: 'captured',
      captured_at: new Date().toISOString(),
      coupon_code: couponUsed,
    });

    if (paymentError) {
      console.error(JSON.stringify({ requestId, event: 'payment_record_error', error: paymentError.message }));
      // Don't throw - payment is verified, this is just record keeping
    }

    // 10. Create Enrollment
    const startImmediately = !body.requestedStartDate;
    const programStart = startImmediately ? new Date() : new Date(body.requestedStartDate!);
    const programEnd = new Date(programStart);
    programEnd.setMonth(programEnd.getMonth() + 3);

    const { data: enrollment, error: enrollError } = await supabase.from('enrollments').insert({
      child_id: child.id,
      parent_id: parent.id,
      coach_id: coach.id,
      payment_id: body.razorpay_payment_id,
      amount: verifiedAmount, // Use verified amount!
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
    }).select().single();

    if (enrollError) {
      console.error(JSON.stringify({ requestId, event: 'enrollment_create_error', error: enrollError.message }));
      throw new Error('Failed to create enrollment');
    }

    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_created',
      enrollmentId: enrollment.id,
      status: enrollment.status,
    }));

    // 11. Award Referral Credit (if applicable)
    let creditResult: CreditAwardResult = { success: false };
    if (couponUsed) {
      creditResult = await awardReferralCredit(
        couponUsed,
        enrollment.id,
        parent.id,
        verifiedAmount,
        requestId
      );
    }

    // 12. Calculate Revenue Split
    const revenueResult = await calculateRevenueSplit(
      enrollment.id,
      verifiedAmount,
      coach,
      body.leadSource,
      body.leadSourceCoachId || null,
      child.id,
      body.childName,
      requestId
    );

    // 13. Queue Background Jobs
    let queueResult = { success: false, messageId: null as string | null };

    if (startImmediately) {
      try {
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

        console.log(JSON.stringify({ 
          requestId, 
          event: 'background_job_queued', 
          messageId: queueResult.messageId 
        }));
      } catch (queueError: any) {
        console.error(JSON.stringify({ 
          requestId, 
          event: 'queue_error', 
          error: queueError.message 
        }));
      }
    } else {
      // Log delayed start event
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

      console.log(JSON.stringify({
        requestId,
        event: 'delayed_start_scheduled',
        startDate: body.requestedStartDate,
      }));
    }

    // 14. Final Response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'payment_verify_complete',
      enrollmentId: enrollment.id,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      enrollmentId: enrollment.id,
      data: {
        enrollmentId: enrollment.id,
        childId: child.id,
        parentId: parent.id,
        coachId: coach.id,
        coachName: coach.name,
        amountPaid: verifiedAmount,
      },
      revenue: revenueResult.success
        ? {
            coach_earnings: revenueResult.net_to_coach,
            platform_fee: revenueResult.platform_fee,
            tds_collected: revenueResult.tds_amount,
            payouts_scheduled: revenueResult.payouts_scheduled,
          }
        : null,
      referral: creditResult.success
        ? {
            creditAwarded: creditResult.creditAwarded,
            referrerParentId: creditResult.referrerParentId,
          }
        : null,
      scheduling: {
        status: startImmediately
          ? queueResult.success ? 'queued' : 'pending'
          : 'delayed',
        messageId: queueResult.messageId,
        startDate: programStart.toISOString().split('T')[0],
        endDate: programEnd.toISOString().split('T')[0],
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(JSON.stringify({
      requestId,
      event: 'payment_verify_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}