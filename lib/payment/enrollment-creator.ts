// ============================================================
// FILE: lib/payment/enrollment-creator.ts
// PURPOSE: Enrollment creation helpers — parent/child records, age band, product info
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteSettings } from '@/lib/config/site-settings-loader';
import { normalizePhone } from '@/lib/utils/phone';

const supabase = createAdminClient();

// --- Types ---

export interface AgeBandConfig {
  age_band: 'foundation' | 'building' | 'mastery';
  min_age: number;
  max_age: number;
  total_sessions: number;
  session_duration_minutes: number;
  sessions_per_week: number;
  frequency_label: string;
  weekly_pattern: number[];
  skill_booster_credits: number;
  program_duration_weeks: number;
}

export interface StarterEnrollmentInfo {
  id: string;
  status: string;
  childId: string;
}

export interface ProductInfo {
  productCode: 'starter' | 'continuation' | 'full';
  productId: string;
  sessionsTotal: number;
}

export interface ProductDetails {
  id: string;
  sessions_included: number;
  duration_months: number;
  duration_weeks: number;
  sessions_coaching: number;
  sessions_skill_building: number;
  sessions_checkin: number;
}

export interface CreditAwardResult {
  success: boolean;
  creditAwarded?: number;
  referrerParentId?: string;
  error?: string;
}

// --- Functions ---

/**
 * Fetch age_band_config for a given child age
 */
export async function getAgeBandConfig(
  childAge: number,
  requestId: string
): Promise<AgeBandConfig | null> {
  try {
    const { data, error } = await supabase
      .from('age_band_config')
      .select('display_name, age_min, age_max, sessions_per_season, session_duration_minutes, sessions_per_week, primary_mode, weekly_pattern, skill_booster_credits, program_duration_weeks')
      .lte('age_min', childAge)
      .gte('age_max', childAge)
      .single() as { data: {
        display_name: string | null;
        age_min: number;
        age_max: number;
        sessions_per_season: number;
        session_duration_minutes: number;
        sessions_per_week: number;
        primary_mode: string | null;
        weekly_pattern: unknown;
        skill_booster_credits: number | null;
        program_duration_weeks: number | null;
      } | null; error: any };

    if (error || !data) {
      console.warn(JSON.stringify({
        requestId,
        event: 'age_band_config_not_found',
        childAge,
        error: error?.message,
      }));
      return null;
    }

    const ageBand = (data.display_name?.toLowerCase() || 'building') as 'foundation' | 'building' | 'mastery';
    const frequencyLabel = data.sessions_per_week === 1 ? 'weekly' :
                          data.sessions_per_week === 2 ? 'twice-weekly' :
                          `${data.sessions_per_week}x/week`;

    let weeklyPattern: number[] = [];
    if (data.weekly_pattern) {
      if (Array.isArray(data.weekly_pattern)) {
        weeklyPattern = data.weekly_pattern;
      } else if (typeof data.weekly_pattern === 'string') {
        try { weeklyPattern = JSON.parse(data.weekly_pattern); } catch { /* fallback empty */ }
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'age_band_config_loaded',
      childAge,
      ageBand,
      totalSessions: data.sessions_per_season,
      durationMinutes: data.session_duration_minutes,
      sessionsPerWeek: data.sessions_per_week,
      weeklyPattern,
      skillBoosterCredits: data.skill_booster_credits,
    }));

    return {
      age_band: ageBand,
      min_age: data.age_min,
      max_age: data.age_max,
      total_sessions: data.sessions_per_season,
      session_duration_minutes: data.session_duration_minutes,
      sessions_per_week: data.sessions_per_week,
      frequency_label: frequencyLabel,
      weekly_pattern: weeklyPattern,
      skill_booster_credits: data.skill_booster_credits ?? 3,
      program_duration_weeks: data.program_duration_weeks ?? 12,
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

/**
 * Extract product info from Razorpay order notes
 */
export function extractProductInfo(
  orderNotes: Record<string, string> | undefined,
  fallbackProductCode: string | null | undefined
): ProductInfo {
  const productCode = (orderNotes?.productCode || fallbackProductCode || 'full') as 'starter' | 'continuation' | 'full';
  const productId = orderNotes?.productId || '';
  const sessionsTotal = parseInt(orderNotes?.sessionsTotal || '9', 10);

  return { productCode, productId, sessionsTotal };
}

/**
 * Get starter enrollment for a child
 */
export async function getStarterEnrollment(
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
export async function markStarterCompleted(
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
export async function getProductDetails(
  productCode: string,
  requestId: string,
  ageBandTotalSessions?: number | null
): Promise<ProductDetails | null> {
  const { data: product, error } = await supabase
    .from('pricing_plans')
    .select('id, sessions_included, duration_months, duration_weeks, sessions_coaching, sessions_skill_building, sessions_checkin')
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

  const defaultWeeks = productCode === 'starter' ? 4 : productCode === 'continuation' ? 8 : 12;

  return {
    id: product.id,
    sessions_included: product.sessions_included ?? ageBandTotalSessions ?? 0,
    duration_months: product.duration_months ?? 3,
    duration_weeks: product.duration_weeks ?? defaultWeeks,
    sessions_coaching: product.sessions_coaching ?? 6,
    sessions_skill_building: product.sessions_skill_building ?? 3,
    sessions_checkin: product.sessions_checkin ?? 3,
  };
}

/**
 * Get or Create Parent (Race-Condition Safe with UPSERT)
 */
export async function getOrCreateParent(
  email: string,
  name: string,
  phone: string | null | undefined,
  requestId: string
): Promise<{ id: string; isNew: boolean }> {
  const { data: parent, error } = await supabase
    .from('parents')
    .upsert(
      {
        email,
        name,
        phone: phone ? normalizePhone(phone) : null,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'email',
        ignoreDuplicates: false
      }
    )
    .select('id, created_at, updated_at')
    .single();

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'parent_upsert_failed', error: error.message }));
    throw new Error('Failed to create/update parent record');
  }

  const isNew = parent.created_at === parent.updated_at;

  console.log(JSON.stringify({
    requestId,
    event: isNew ? 'parent_created' : 'parent_found',
    parentId: parent.id
  }));

  // Ensure auth account exists (non-blocking)
  try {
    const { ensureParentAuthAccount } = await import('@/lib/auth/create-parent-auth');
    await ensureParentAuthAccount({
      parentId: parent.id,
      phone: phone || '',
      email,
      name,
    });
  } catch (authErr) {
    console.error(JSON.stringify({ requestId, event: 'parent_auth_creation_failed', error: authErr instanceof Error ? authErr.message : String(authErr) }));
  }

  return { id: parent.id, isNew };
}

/**
 * Get or Create Child
 */
export async function getOrCreateChild(
  childId: string | null | undefined,
  childName: string,
  childAge: number,
  parentId: string,
  parentEmail: string,
  coachId: string | null | undefined,
  requestId: string
): Promise<{ id: string; isNew: boolean }> {
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
 * Award Referral Credit
 */
export async function awardReferralCredit(
  couponCode: string,
  enrollmentId: string,
  referredParentId: string,
  programAmount: number,
  requestId: string
): Promise<CreditAwardResult> {
  try {
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('id, code, coupon_type, parent_id, current_uses, successful_conversions, total_referrals')
      .eq('code', couponCode.toUpperCase())
      .eq('coupon_type', 'parent_referral')
      .single();

    if (couponError || !coupon || !coupon.parent_id) {
      return { success: false, error: 'Not a parent referral coupon' };
    }

    const settings = await getSiteSettings(['parent_referral_credit_percent', 'referral_credit_expiry_days']);

    const creditPercent = parseInt(settings.parent_referral_credit_percent || '10');
    const expiryDays = parseInt(settings.referral_credit_expiry_days || '30');

    const creditAmount = Math.round((programAmount * creditPercent) / 100);

    const { data: referrer, error: referrerError } = await supabase
      .from('parents')
      .select('id, referral_credit_balance')
      .eq('id', coupon.parent_id)
      .single();

    if (referrerError || !referrer) {
      return { success: false, error: 'Referrer not found' };
    }

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

    // NOTE: current_uses and successful_conversions are now incremented
    // universally in verify/webhook routes for ALL coupon types (including referrals).
    // Only update total_referrals here (referral-specific counter).
    await supabase.from('coupons').update({
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
