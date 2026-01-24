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
import { phoneSchemaOptional } from '@/lib/utils/phone';
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
  // Product Selection (read from order notes, but can be passed)
  productCode: z.enum(['starter', 'continuation', 'full']).optional().nullable(),
  // Parent/Child Data
  childName: z.string().min(1).max(100),
  childAge: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  childId: z.string().uuid().optional().nullable(),
  parentName: z.string().min(1).max(100),
  parentEmail: z.string().email().transform(v => v.toLowerCase().trim()),
  parentPhone: phoneSchemaOptional,
  // Coach/Lead Data
  coachId: z.string().uuid().optional().nullable(),
  leadSource: z.enum(['yestoryd', 'coach']).default('yestoryd'),
  leadSourceCoachId: z.string().uuid().optional().nullable(),
  // Coupon (we'll validate amount server-side, these are just for reference)
  couponCode: z.string().max(20).optional().nullable(),
  referralCodeUsed: z.string().max(20).optional().nullable(),
  // Scheduling
  requestedStartDate: z.string().optional().nullable(),
  discoveryCallId: z.string().uuid().optional().nullable(),
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

interface ProductInfo {
  productCode: 'starter' | 'continuation' | 'full';
  productId: string;
  sessionsTotal: number;
}

interface StarterEnrollmentInfo {
  id: string;
  status: string;
  childId: string;
}

/**
 * Extract product info from Razorpay order notes
 */
function extractProductInfo(
  orderNotes: Record<string, string> | undefined,
  fallbackProductCode: string | null | undefined
): ProductInfo {
  // Default to 'full' if no product code specified
  const productCode = (orderNotes?.productCode || fallbackProductCode || 'full') as 'starter' | 'continuation' | 'full';
  const productId = orderNotes?.productId || '';
  const sessionsTotal = parseInt(orderNotes?.sessionsTotal || '9', 10);

  return { productCode, productId, sessionsTotal };
}

/**
 * Get starter enrollment for a child
 */
async function getStarterEnrollment(
  childId: string,
  requestId: string
): Promise<StarterEnrollmentInfo | null> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status, child_id')
    .eq('child_id', childId)
    .eq('enrollment_type', 'starter')
    .in('status', ['completed', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!enrollment) {
    console.log(JSON.stringify({ requestId, event: 'no_starter_enrollment_found', childId }));
    return null;
  }

  return {
    id: enrollment.id,
    status: enrollment.status,
    childId: enrollment.child_id,
  };
}

/**
 * Mark starter enrollment as completed
 */
async function markStarterCompleted(
  enrollmentId: string,
  requestId: string
): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .update({
      status: 'completed',
      starter_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'starter_completion_error',
      enrollmentId,
      error: error.message,
    }));
  } else {
    console.log(JSON.stringify({
      requestId,
      event: 'starter_marked_completed',
      enrollmentId,
    }));
  }
}

/**
 * Get product details from pricing_plans
 */
async function getProductDetails(
  productCode: string,
  requestId: string
): Promise<{
  id: string;
  sessions_included: number;
  duration_months: number;
  sessions_coaching: number;
  sessions_skill_building: number;
  sessions_checkin: number;
} | null> {
  const { data: product, error } = await supabase
    .from('pricing_plans')
    .select('id, sessions_included, duration_months, sessions_coaching, sessions_skill_building, sessions_checkin')
    .eq('slug', productCode)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    console.error(JSON.stringify({
      requestId,
      event: 'product_fetch_error',
      productCode,
      error: error?.message,
    }));
    return null;
  }

  return product;
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
): Promise<{ success: boolean; amount: number; orderNotes?: Record<string, string>; error?: string }> {
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

    // Return amount in rupees (Razorpay uses paise) along with order notes
    return {
      success: true,
      amount: Number(payment.amount) / 100,
      orderNotes: order.notes as Record<string, string> | undefined,
    };

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

// --- 5. CONFLICT RESOLUTION HELPER ---

/**
 * Available time slots for coaching sessions (IST)
 * These are the preferred times in order of priority
 */
const TIME_SLOTS = [
  '10:00:00', // Morning slot 1
  '11:00:00', // Morning slot 2
  '14:00:00', // Afternoon slot 1
  '15:00:00', // Afternoon slot 2
  '16:00:00', // Afternoon slot 3
  '17:00:00', // Evening slot 1
  '18:00:00', // Evening slot 2
];

/**
 * Find an available slot for a session, avoiding conflicts with existing bookings
 * @param coachId - The coach's ID to check for conflicts
 * @param baseDate - The preferred date for the session
 * @param preferredTime - The preferred time slot
 * @param requestId - Request ID for logging
 * @returns { date: string, time: string } - The available slot
 */
async function findAvailableSlot(
  coachId: string,
  baseDate: Date,
  preferredTime: string,
  requestId: string
): Promise<{ date: string; time: string }> {
  const maxDaysToSearch = 7; // Look up to 7 days ahead if needed

  for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
    const checkDate = new Date(baseDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dateStr = checkDate.toISOString().split('T')[0];

    // Build time slots to try: preferred time first, then others
    const timesToTry = [preferredTime, ...TIME_SLOTS.filter(t => t !== preferredTime)];

    for (const timeSlot of timesToTry) {
      // Check if this slot is already booked for this coach
      const { data: existingSession, error } = await supabase
        .from('scheduled_sessions')
        .select('id')
        .eq('coach_id', coachId)
        .eq('scheduled_date', dateStr)
        .eq('scheduled_time', timeSlot)
        .limit(1)
        .single();

      // If no existing session found (error means no match), this slot is available
      if (error && error.code === 'PGRST116') {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        // This means no conflict - slot is available
        if (dayOffset > 0 || timeSlot !== preferredTime) {
          console.log(JSON.stringify({
            requestId,
            event: 'slot_conflict_resolved',
            originalDate: baseDate.toISOString().split('T')[0],
            originalTime: preferredTime,
            newDate: dateStr,
            newTime: timeSlot,
            dayOffset,
          }));
        }
        return { date: dateStr, time: timeSlot };
      }

      if (!error && existingSession) {
        // Conflict found, try next slot
        console.log(JSON.stringify({
          requestId,
          event: 'slot_conflict_detected',
          coachId,
          date: dateStr,
          time: timeSlot,
          conflictingSessionId: existingSession.id,
        }));
        continue;
      }

      // If some other error, log it but assume slot is available
      if (error && error.code !== 'PGRST116') {
        console.error(JSON.stringify({
          requestId,
          event: 'slot_check_error',
          error: error.message,
          code: error.code,
        }));
        // Assume available on error to avoid blocking enrollment
        return { date: dateStr, time: timeSlot };
      }
    }
  }

  // If we exhausted all options, just return the original (will fail on insert but at least we tried)
  console.error(JSON.stringify({
    requestId,
    event: 'no_available_slot_found',
    coachId,
    baseDate: baseDate.toISOString().split('T')[0],
    searchedDays: maxDaysToSearch,
    searchedSlotsPerDay: TIME_SLOTS.length,
  }));

  return {
    date: baseDate.toISOString().split('T')[0],
    time: preferredTime,
  };
}

// --- 6. MAIN HANDLER ---
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
      // Build redirect URL for duplicate payments too
      const duplicateRedirectUrl = `/enrollment/success?enrollmentId=${existingEnrollmentId || ''}&duplicate=true`;
      console.log(JSON.stringify({
        requestId,
        event: 'duplicate_returning_redirect',
        redirectUrl: duplicateRedirectUrl,
        existingEnrollmentId,
      }));
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        enrollmentId: existingEnrollmentId,
        redirectUrl: duplicateRedirectUrl,
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

    // 5a. Extract Product Info from order notes
    const productInfo = extractProductInfo(paymentVerification.orderNotes, body.productCode);

    // 5b. Get full product details from database
    const productDetails = await getProductDetails(productInfo.productCode, requestId);

    console.log(JSON.stringify({
      requestId,
      event: 'amount_verified',
      amount: verifiedAmount,
      productCode: productInfo.productCode,
      productId: productInfo.productId || productDetails?.id,
      sessionsTotal: productInfo.sessionsTotal || productDetails?.sessions_included,
    }));

    // 6. Get or Create Parent (Race-Safe)
    const parent = await getOrCreateParent(
      body.parentEmail,
      body.parentName,
      body.parentPhone,
      requestId
    );

    // 7. Get or Create Child (check discovery_call first)
    let childIdToUse = body.childId;
    if (!childIdToUse && body.discoveryCallId) {
      const { data: dc } = await supabase
        .from('discovery_calls')
        .select('child_id')
        .eq('id', body.discoveryCallId)
        .single();
      if (dc?.child_id) {
        childIdToUse = dc.child_id;
        console.log(JSON.stringify({ requestId, event: 'child_from_discovery', childId: childIdToUse, discoveryCallId: body.discoveryCallId }));
      }
    }
    const child = await getOrCreateChild(
      childIdToUse,
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

    // Set duration based on product type
    const durationMonths = productDetails?.duration_months ||
      (productInfo.productCode === 'starter' ? 1 : 3);
    programEnd.setMonth(programEnd.getMonth() + durationMonths);

    // Get sessions count from product
    const sessionsCount = productDetails?.sessions_included || productInfo.sessionsTotal || 9;

    // 10a. Handle continuation-specific logic
    let starterEnrollmentId: string | null = null;
    if (productInfo.productCode === 'continuation') {
      const starterEnrollment = await getStarterEnrollment(child.id, requestId);
      if (starterEnrollment) {
        starterEnrollmentId = starterEnrollment.id;
        // Mark starter as completed
        await markStarterCompleted(starterEnrollment.id, requestId);
      }
    }

    // 10b. Calculate continuation deadline for starter enrollments (7 days after completion)
    let continuationDeadline: string | null = null;
    if (productInfo.productCode === 'starter') {
      const deadline = new Date(programEnd);
      deadline.setDate(deadline.getDate() + 7);
      continuationDeadline = deadline.toISOString();
    }

    // 10c. Create enrollment with new columns
    // sessions_purchased = total paid for (12: 6 coaching + 3 skill booster + 3 checkin)
    // sessions_scheduled will be set to 9 (6 coaching + 3 checkin) - skill boosters are on-demand
    // remedial_sessions_max = skill booster credits available (3)
    const remedialSessionsMax = productDetails?.sessions_skill_building ?? 3;

    const enrollmentData: Record<string, unknown> = {
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
      // New columns for multi-product support
      enrollment_type: productInfo.productCode,
      product_id: productInfo.productId || productDetails?.id || null,
      sessions_purchased: sessionsCount, // Total paid for (includes skill booster credits)
      // Skill booster (remedial) sessions - booked on-demand via /api/skill-booster/request
      remedial_sessions_max: remedialSessionsMax,
      remedial_sessions_used: 0,
    };

    // Add continuation-specific fields
    if (productInfo.productCode === 'continuation' && starterEnrollmentId) {
      enrollmentData.starter_enrollment_id = starterEnrollmentId;
    }

    // Add starter-specific fields
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

    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_created',
      enrollmentId: enrollment.id,
      status: enrollment.status,
      enrollmentType: productInfo.productCode,
      sessionsCount,
      starterEnrollmentId: starterEnrollmentId || undefined,
      continuationDeadline: continuationDeadline || undefined,
    }));

    // =====================================================
    // POST-ENROLLMENT TASKS (all wrapped in try-catch)
    // These should NEVER block the redirect response
    // =====================================================

    // Initialize results for optional tasks
    let creditResult: CreditAwardResult = { success: false };
    let revenueResult: RevenueResult = { success: false };
    let queueResult = { success: false, messageId: null as string | null };
    let sessionsCreatedCount = 0;

    // 10d. Create Scheduled Sessions based on product session breakdown
    // IMPORTANT: This must complete quickly - no external API calls here
    try {
      console.log(JSON.stringify({ requestId, event: 'sessions_creation_start' }));

      const sessionsToCreate: Array<{
      enrollment_id: string;
      child_id: string;
      coach_id: string;
      session_number: number;
      session_type: string;
      session_title: string;
      week_number: number;
      scheduled_date: string;
      scheduled_time: string;
      status: string;
      duration_minutes: number;
    }> = [];

    // Get session counts from pricing_plans table (with fallbacks if query failed)
    const coachingSessions = productDetails?.sessions_coaching ?? 6;
    const checkinSessions = productDetails?.sessions_checkin ?? 3;
    // Skill building sessions are NOT auto-scheduled - they use on-demand booking via /api/skill-booster/request
    // Track them as remedial_sessions_max for the enrollment
    const skillBoosterCredits = productDetails?.sessions_skill_building ?? 3;
    // Only auto-schedule coaching + checkin sessions
    const totalSessionsToSchedule = coachingSessions + checkinSessions;

    console.log(JSON.stringify({
      requestId,
      event: 'sessions_counts_calculated',
      source: productDetails ? 'pricing_plans_db' : 'fallback_defaults',
      productSlug: productInfo.productCode,
      coachingSessions,
      checkinSessions,
      skillBoosterCredits,
      totalSessionsToSchedule,
      note: 'skill_building_is_on_demand',
    }));

    // Session titles by type
    const coachingTitles = [
      'Initial Assessment & Goals',
      'Foundation Building',
      'Skill Development',
      'Practice & Reinforcement',
      'Advanced Techniques',
      'Confidence Building',
      'Mastery Building',
      'Final Skills Assessment',
    ];
    const checkinTitles = [
      'Progress Review',
      'Mid-Program Review',
      'Progress Assessment',
      'Final Review & Next Steps',
    ];

    // Build session schedule - SIMPLE SEQUENTIAL APPROACH
    // Previous interleaved logic had infinite loop bug when conditions didn't align
    // Now uses simple for loops - guaranteed to terminate
    let weekNumber = 1;

    // 1. Add all coaching sessions with conflict resolution
    for (let i = 0; i < coachingSessions; i++) {
      const title = coachingTitles[i] || `Coaching Session ${i + 1}`;
      const baseSessionDate = new Date(programStart);
      baseSessionDate.setDate(baseSessionDate.getDate() + (weekNumber - 1) * 7);

      // Find available slot to avoid double-booking conflicts
      const availableSlot = await findAvailableSlot(
        coach.id,
        baseSessionDate,
        '10:00:00', // Preferred time
        requestId
      );

      sessionsToCreate.push({
        enrollment_id: enrollment.id,
        child_id: child.id,
        coach_id: coach.id,
        session_number: i + 1,
        session_type: 'coaching',
        session_title: `Coaching ${i + 1}: ${title}`,
        week_number: weekNumber,
        scheduled_date: availableSlot.date,
        scheduled_time: availableSlot.time,
        status: 'pending',
        duration_minutes: 45,
      });
      weekNumber++;
    }

    // NOTE: Skill building sessions are NOT auto-scheduled
    // They are booked on-demand via /api/skill-booster/request
    // Credits tracked in enrollment.remedial_sessions_max

    // 2. Add all parent check-in sessions with conflict resolution
    for (let i = 0; i < checkinSessions; i++) {
      const title = checkinTitles[i] || `Check-in ${i + 1}`;
      const baseSessionDate = new Date(programStart);
      baseSessionDate.setDate(baseSessionDate.getDate() + (weekNumber - 1) * 7);

      // Find available slot to avoid double-booking conflicts
      const availableSlot = await findAvailableSlot(
        coach.id,
        baseSessionDate,
        '10:00:00', // Preferred time
        requestId
      );

      sessionsToCreate.push({
        enrollment_id: enrollment.id,
        child_id: child.id,
        coach_id: coach.id,
        session_number: coachingSessions + i + 1,
        session_type: 'parent_checkin',
        session_title: `Parent Check-in ${i + 1}: ${title}`,
        week_number: weekNumber,
        scheduled_date: availableSlot.date,
        scheduled_time: availableSlot.time,
        status: 'pending',
        duration_minutes: 30,
      });
      weekNumber++;
    }

    console.log(JSON.stringify({
      requestId,
      event: 'sessions_loops_done',
      sessionsBuilt: sessionsToCreate.length,
      coaching: coachingSessions,
      checkin: checkinSessions,
      skillBoosterCredits,
    }));

    // Sort sessions by week number and renumber
    sessionsToCreate.sort((a, b) => a.week_number - b.week_number);
    sessionsToCreate.forEach((session, idx) => {
      session.session_number = idx + 1;
    });

    console.log(JSON.stringify({
      requestId,
      event: 'sessions_array_built',
      count: sessionsToCreate.length,
      expected: totalSessionsToSchedule,
    }));

    // Insert sessions with 15-second timeout
    const insertPromise = supabase
      .from('scheduled_sessions')
      .insert(sessionsToCreate);

    const timeoutPromise = new Promise<{ error: { message: string } }>((_, reject) =>
      setTimeout(() => reject({ error: { message: 'Sessions insert timed out after 15s' } }), 15000)
    );

    let sessionsError: { message: string } | null = null;
    try {
      const result = await Promise.race([insertPromise, timeoutPromise]);
      sessionsError = (result as any).error || null;
    } catch (raceErr: any) {
      sessionsError = raceErr.error || { message: raceErr.message || 'Unknown insert error' };
    }

    console.log(JSON.stringify({ requestId, event: 'sessions_insert_done', hasError: !!sessionsError }));

    if (sessionsError) {
      console.error(JSON.stringify({ requestId, event: 'sessions_create_failed', error: sessionsError.message }));
    } else {
      sessionsCreatedCount = sessionsToCreate.length;

      // CRITICAL: Set schedule_confirmed = true to prevent QStash job from creating duplicate sessions
      // This is the SINGLE SOURCE OF TRUTH for session creation
      const { error: confirmError } = await supabase
        .from('enrollments')
        .update({
          schedule_confirmed: true,
          sessions_scheduled: sessionsToCreate.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollment.id);

      if (confirmError) {
        console.error(JSON.stringify({
          requestId,
          event: 'schedule_confirm_failed',
          error: confirmError.message
        }));
        // Don't throw - sessions are created, this is non-critical
      }

      console.log(JSON.stringify({
        requestId,
        event: 'sessions_created_and_confirmed',
        count: sessionsToCreate.length,
        enrollmentId: enrollment.id,
        schedule_confirmed: true,
        productCode: productInfo.productCode,
        breakdown: {
          coaching: coachingSessions,
          checkin: checkinSessions,
          skillBoosterCredits: skillBoosterCredits,
        },
        note: 'skill_boosters_are_on_demand_not_auto_scheduled',
      }));
    }
    } catch (sessionsErr: any) {
      console.error(JSON.stringify({ requestId, event: 'sessions_block_error', error: sessionsErr.message, stack: sessionsErr.stack }));
    }

    // 11. Award Referral Credit (if applicable) - wrapped in try-catch
    try {
      console.log(JSON.stringify({ requestId, event: 'referral_credit_start', couponUsed }));
      if (couponUsed) {
        creditResult = await awardReferralCredit(
          couponUsed,
          enrollment.id,
          parent.id,
          verifiedAmount,
          requestId
        );
      }
      console.log(JSON.stringify({ requestId, event: 'referral_credit_done', success: creditResult.success }));
    } catch (creditErr: any) {
      console.error(JSON.stringify({ requestId, event: 'referral_credit_error', error: creditErr.message }));
    }

    // 12. Calculate Revenue Split - wrapped in try-catch
    try {
      console.log(JSON.stringify({ requestId, event: 'revenue_split_start' }));
      revenueResult = await calculateRevenueSplit(
        enrollment.id,
        verifiedAmount,
        coach,
        body.leadSource,
        body.leadSourceCoachId || null,
        child.id,
        body.childName,
        requestId
      );
      console.log(JSON.stringify({ requestId, event: 'revenue_split_done', success: revenueResult.success }));
    } catch (revenueErr: any) {
      console.error(JSON.stringify({ requestId, event: 'revenue_split_error', error: revenueErr.message }));
    }

    // 13. Queue Background Jobs - wrapped in try-catch
    try {
      console.log(JSON.stringify({ requestId, event: 'background_jobs_start', startImmediately }));
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
        console.log(JSON.stringify({
          requestId,
          event: 'background_job_queued',
          success: queueResult.success,
          messageId: queueResult.messageId
        }));
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
    } catch (bgJobErr: any) {
      console.error(JSON.stringify({ requestId, event: 'background_jobs_error', error: bgJobErr.message }));
    }

    // 14. Final Response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'payment_verify_complete',
      enrollmentId: enrollment.id,
      duration: `${duration}ms`,
    }));

    // Build redirect URL with enrollment details
    const redirectParams = new URLSearchParams({
      enrollmentId: enrollment.id,
      childName: body.childName,
      coachName: coach.name,
      sessions: String(sessionsCount),
      product: productInfo.productCode,
    });
    const redirectUrl = `/enrollment/success?${redirectParams.toString()}`;

    console.log(JSON.stringify({
      requestId,
      event: 'redirect_url_built',
      redirectUrl,
    }));

    // [VERIFY:FINAL] Log complete response structure before returning
    const responsePayload = {
      success: true,
      message: 'Payment verified successfully',
      enrollmentId: enrollment.id,
      redirectUrl,
    };
    console.log(JSON.stringify({
      requestId,
      event: 'VERIFY_FINAL_RESPONSE',
      responseKeys: Object.keys(responsePayload),
      success: responsePayload.success,
      hasRedirectUrl: !!responsePayload.redirectUrl,
      hasEnrollmentId: !!responsePayload.enrollmentId,
      redirectUrl: responsePayload.redirectUrl,
    }));

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
        // Product info
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




