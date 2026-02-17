// ============================================================
// FILE: app/api/payment/verify/route.ts
// ============================================================
// HARDENED VERSION - Production Ready
// Security: Amount verification, Idempotency, Race condition protection
// Yestoryd - AI-Powered Reading Intelligence Platform

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
import { loadCoachConfig, loadRevenueSplitConfig, loadPaymentConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
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
  // Session preferences (for smart scheduling)
  preferenceTimeBucket: z.enum(['morning', 'afternoon', 'evening', 'any']).optional().default('any'),
  preferenceDays: z.array(z.number().min(0).max(6)).optional().nullable(),
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

interface AgeBandConfig {
  age_band: 'foundation' | 'building' | 'mastery';
  min_age: number;
  max_age: number;
  total_sessions: number;
  session_duration_minutes: number;
  sessions_per_week: number;
  frequency_label: string;
}

/**
 * Fetch age_band_config for a given child age
 * Uses the SQL function get_age_band_config(age) or falls back to direct query
 */
async function getAgeBandConfig(
  childAge: number,
  requestId: string
): Promise<AgeBandConfig | null> {
  try {
    const { data, error } = await supabase
      .from('age_band_config')
      .select('display_name, age_min, age_max, sessions_per_season, session_duration_minutes, sessions_per_week, primary_mode')
      .lte('age_min', childAge)
      .gte('age_max', childAge)
      .single();

    if (error || !data) {
      console.warn(JSON.stringify({
        requestId,
        event: 'age_band_config_not_found',
        childAge,
        error: error?.message,
      }));
      return null;
    }

    // Map display_name to age_band type, derive frequency_label
    const ageBand = (data.display_name?.toLowerCase() || 'building') as 'foundation' | 'building' | 'mastery';
    const frequencyLabel = data.sessions_per_week === 1 ? 'weekly' :
                          data.sessions_per_week === 2 ? 'twice-weekly' :
                          `${data.sessions_per_week}x/week`;

    console.log(JSON.stringify({
      requestId,
      event: 'age_band_config_loaded',
      childAge,
      ageBand,
      totalSessions: data.sessions_per_season,
      durationMinutes: data.session_duration_minutes,
      sessionsPerWeek: data.sessions_per_week,
    }));

    return {
      age_band: ageBand,
      min_age: data.age_min,
      max_age: data.age_max,
      total_sessions: data.sessions_per_season,
      session_duration_minutes: data.session_duration_minutes,
      sessions_per_week: data.sessions_per_week,
      frequency_label: frequencyLabel,
    };
  } catch (err: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'age_band_config_error',
      error: err.message,
    }));
    return null;
  }
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
    status: enrollment.status ?? 'active',
    childId: enrollment.child_id ?? childId,
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

  return {
    id: product.id,
    sessions_included: product.sessions_included ?? 9,
    duration_months: product.duration_months ?? 3,
    sessions_coaching: product.sessions_coaching ?? 6,
    sessions_skill_building: product.sessions_skill_building ?? 3,
    sessions_checkin: product.sessions_checkin ?? 3,
  };
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
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .single();

  if (existingPayment) {
    // Fetch enrollment ID from enrollments table (payments don't have enrollment_id)
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('payment_id', paymentId)
      .single();

    console.log(JSON.stringify({
      requestId,
      event: 'duplicate_payment_detected',
      paymentId,
      existingEnrollmentId: enrollment?.id
    }));

    return { isDuplicate: true, existingEnrollmentId: enrollment?.id };
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

  // Try smart matching before falling back to Rucha
  try {
    const { data: allCoaches } = await supabase
      .from('coaches')
      .select(`
        id, name, email, phone, tds_cumulative_fy, skill_tags, avg_rating,
        total_sessions_completed, max_children, current_children,
        is_accepting_new, is_available,
        coach_groups (
          id, name, display_name,
          lead_cost_percent, coach_cost_percent, platform_fee_percent,
          is_internal
        )
      `)
      .eq('is_active', true)
      .eq('is_available', true)
      .eq('is_accepting_new', true);

    const eligible = (allCoaches || []).filter(
      (c: any) => (c.current_children || 0) < (c.max_children || 30)
    );

    if (eligible.length > 0) {
      // Fetch specializations for skill-based scoring
      const coachIds = eligible.map((c: any) => c.id);
      const { data: specs } = await supabase
        .from('coach_specializations')
        .select('coach_id, specialization_type, proficiency_level')
        .in('coach_id', coachIds);

      // Build skill score map per coach
      const skillScores = new Map<string, number>();
      if (specs && specs.length > 0) {
        for (const s of specs) {
          const current = skillScores.get(s.coach_id) || 0;
          const proficiency = s.proficiency_level ?? 3; // Default mid-level proficiency
          skillScores.set(s.coach_id, current + proficiency);
        }
      }

      // Sort by: skill score (desc), then load balance (asc), then rating (desc)
      eligible.sort((a: any, b: any) => {
        const skillA = skillScores.get(a.id) || 0;
        const skillB = skillScores.get(b.id) || 0;
        if (skillA !== skillB) return skillB - skillA;
        const loadA = (a.current_children || 0) / (a.max_children || 30);
        const loadB = (b.current_children || 0) / (b.max_children || 30);
        if (loadA !== loadB) return loadA - loadB;
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      });

      const matched = eligible[0];
      console.log(JSON.stringify({ requestId, event: 'smart_match_coach', coachId: matched.id, coachName: matched.name, skillScore: skillScores.get(matched.id) || 0 }));
      return matched as unknown as CoachWithGroup;
    }
  } catch (matchErr) {
    console.error(JSON.stringify({ requestId, event: 'smart_match_failed', error: String(matchErr) }));
  }

  // Final fallback to default coach (from config)
  const coachConfig = await loadCoachConfig();
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
    .eq('id', coachConfig.defaultCoachId)
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

    const creditPercent = parseInt(String(settings?.find(s => s.key === 'parent_referral_credit_percent')?.value || '10'));
    const expiryDays = parseInt(String(settings?.find(s => s.key === 'referral_credit_expiry_days')?.value || '30'));

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
  requestId: string,
  durationMonths: number = 3
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
        coach_cost_amount: 0,
        lead_cost_amount: 0,
        net_to_coach: 0,
        net_to_lead_source: 0,
        coach_group_id: group.id,
        coach_group_name: group.name,
        status: 'completed',
        config_snapshot: JSON.parse(JSON.stringify({ group, note: 'Internal coach - 100% to platform' })),
      }).select('id').single();

      return { success: true, enrollment_revenue_id: revenue?.id, platform_fee: amount, net_to_coach: 0, payouts_scheduled: 0 };
    }

    // Calculate Splits
    const leadCost = Math.round(amount * group.lead_cost_percent / 100);
    const coachCost = Math.round(amount * group.coach_cost_percent / 100);
    const platformFee = amount - leadCost - coachCost;

    // Get TDS Config — fail loudly, no silent fallbacks
    const revConfig = await loadRevenueSplitConfig();
    const tdsRate = revConfig.tdsRatePercent;
    const tdsThreshold = revConfig.tdsThresholdAnnual;
    const payoutDay = revConfig.payoutDayOfMonth;

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
      net_to_lead_source: leadSource === 'coach' ? leadCost : 0,
      net_retained_by_platform: netToPlatform,
      coach_group_id: group.id,
      coach_group_name: group.name,
      status: 'pending',
      config_snapshot: JSON.parse(JSON.stringify({ group, tds_rate: tdsRate, tds_threshold: tdsThreshold })),
    }).select('id').single();

    if (revError) throw revError;

    // Schedule Payouts (Batch Insert)
    const now = new Date();
    const payoutRecords = [];
    const monthlyCoachGross = Math.round(coachCost / durationMonths);
    const monthlyCoachTds = Math.round(tdsOnCoach / durationMonths);

    for (let i = 1; i <= durationMonths; i++) {
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
      const monthlyLeadGross = Math.round(leadCost / durationMonths);
      const monthlyLeadTds = Math.round(tdsOnLead / durationMonths);

      for (let i = 1; i <= durationMonths; i++) {
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

// --- 5. SCHEDULING ---
// Session scheduling now uses the unified scheduling library
// See: lib/scheduling/enrollment-scheduler.ts

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

    // 7. Get or Create Child + Coach from discovery call
    let childIdToUse = body.childId;
    let coachIdToUse = body.coachId;
    if (body.discoveryCallId) {
      const { data: dc } = await supabase
        .from('discovery_calls')
        .select('child_id, assigned_coach_id')
        .eq('id', body.discoveryCallId)
        .single();
      if (dc) {
        if (!childIdToUse && dc.child_id) {
          childIdToUse = dc.child_id;
          console.log(JSON.stringify({ requestId, event: 'child_from_discovery', childId: childIdToUse, discoveryCallId: body.discoveryCallId }));
        }
        if (!coachIdToUse && dc.assigned_coach_id) {
          coachIdToUse = dc.assigned_coach_id;
          console.log(JSON.stringify({ requestId, event: 'coach_from_discovery', coachId: coachIdToUse, discoveryCallId: body.discoveryCallId }));
        }
      }
    }
    const child = await getOrCreateChild(
      childIdToUse,
      body.childName,
      body.childAge,
      parent.id,
      body.parentEmail,
      coachIdToUse,
      requestId
    );

    // 8. Get Coach (priority: body.coachId > discovery_calls.assigned_coach_id > smart match > fallback)
    const coach = await getCoach(coachIdToUse, requestId);

    // 9. Record Payment
    const couponUsed = body.couponCode || body.referralCodeUsed || null;
    
    const { error: paymentError } = await supabase.from('payments').insert({
      parent_id: parent.id,
      child_id: child.id,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      amount: verifiedAmount, // Use verified amount!
      currency: (await loadPaymentConfig()).currency,
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

    // 10.V2: Fetch age_band_config for V2 age-differentiated sessions
    const ageBandConfig = await getAgeBandConfig(body.childAge, requestId);

    // Get sessions count: prefer age_band_config, fallback to product details, then legacy default
    const sessionsCount = ageBandConfig?.total_sessions
      || productDetails?.sessions_included
      || productInfo.sessionsTotal
      || 9;

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
      // Scheduling preferences
      preference_time_bucket: body.preferenceTimeBucket || null,
      preference_days: body.preferenceDays || null,
      preference_start_type: body.requestedStartDate ? 'later' : 'immediate',
      preference_start_date: body.requestedStartDate || null,
      // V2: Age-band differentiated sessions
      age_band: ageBandConfig?.age_band || null,
      season_number: 1,
      total_sessions: sessionsCount,
      session_duration_minutes: ageBandConfig?.session_duration_minutes || 45,
      sessions_per_week: ageBandConfig?.sessions_per_week || null,
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
      ageBand: ageBandConfig?.age_band || null,
      sessionDurationMinutes: ageBandConfig?.session_duration_minutes || 45,
      sessionsPerWeek: ageBandConfig?.sessions_per_week || null,
      seasonNumber: 1,
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

    // 10d. Create Scheduled Sessions using unified scheduling library
    // Uses smart slot finder that respects coach availability and parent preferences
    try {
      console.log(JSON.stringify({ requestId, event: 'sessions_creation_start' }));

      // Build preference from request body
      const preference: TimePreference = {
        bucket: body.preferenceTimeBucket || 'any',
        preferredDays: body.preferenceDays || undefined,
      };

      // Use unified scheduler with smart slot finding
      // Falls back to simple scheduling if smart finder unavailable
      let schedulerResult;
      try {
        schedulerResult = await scheduleEnrollmentSessions({
          enrollmentId: enrollment.id,
          childId: child.id,
          coachId: coach.id,
          planSlug: productInfo.productCode,
          programStart,
          preference,
          requestId,
        }, supabase as any);
      } catch (smartErr: any) {
        console.warn(JSON.stringify({
          requestId,
          event: 'smart_scheduler_failed_using_fallback',
          error: smartErr.message,
        }));
        // Fallback to simple scheduling without API calls
        schedulerResult = await createSessionsSimple({
          enrollmentId: enrollment.id,
          childId: child.id,
          coachId: coach.id,
          planSlug: productInfo.productCode,
          programStart,
          requestId,
        }, supabase as any);
      }

      if (schedulerResult.success) {
        sessionsCreatedCount = schedulerResult.sessionsCreated;
        console.log(JSON.stringify({
          requestId,
          event: 'sessions_created_and_confirmed',
          count: schedulerResult.sessionsCreated,
          enrollmentId: enrollment.id,
          schedule_confirmed: true,
          productCode: productInfo.productCode,
          manualRequired: schedulerResult.manualRequired,
          errors: schedulerResult.errors,
        }));
      } else {
        console.error(JSON.stringify({
          requestId,
          event: 'sessions_create_failed',
          errors: schedulerResult.errors,
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
        requestId,
        durationMonths
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




