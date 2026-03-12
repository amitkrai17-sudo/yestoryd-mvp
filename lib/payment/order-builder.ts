// ============================================================
// FILE: lib/payment/order-builder.ts
// PURPOSE: Pricing, coupon validation, product lookup for order creation
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// --- Types ---

export interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  discountPercent: number;
  couponId?: string;
  couponType?: string;
  error?: string;
}

export interface PricingResult {
  basePrice: number;
  couponDiscount: number;
  referralCreditUsed: number;
  finalAmount: number;
  couponCode?: string;
  couponId?: string;
  productId?: string;
  productCode?: string;
  sessionsTotal?: number;
}

export interface ProductInfo {
  id: string;
  slug: string;
  name: string;
  discounted_price: number;
  sessions_included: number;
  sessions_coaching: number;
  sessions_skill_building: number;
  sessions_checkin: number;
  duration_months: number;
}

// --- Functions ---

/**
 * Get Product by slug from pricing_plans (Server-Controlled)
 */
export async function getProductBySlug(
  productCode: string,
  requestId: string
): Promise<ProductInfo | { locked: true; message: string } | null> {
  const { data: product, error } = await supabase
    .from('pricing_plans')
    .select('id, slug, name, discounted_price, sessions_included, sessions_coaching, sessions_skill_building, sessions_checkin, duration_months, is_locked, lock_message')
    .eq('slug', productCode)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    console.error(JSON.stringify({ requestId, event: 'product_not_found', productCode, error: error?.message }));
    return null;
  }

  if (product.is_locked) {
    console.log(JSON.stringify({ requestId, event: 'product_locked', productCode, lockMessage: product.lock_message }));
    return { locked: true, message: product.lock_message || 'This product is not available yet' };
  }

  console.log(JSON.stringify({ requestId, event: 'product_fetched', productCode, productId: product.id, price: product.discounted_price, sessions: product.sessions_included }));
  return product as ProductInfo;
}

/**
 * Check if child has completed starter enrollment
 */
export async function checkStarterCompleted(
  childId: string,
  requestId: string
): Promise<{ completed: boolean; starterEnrollmentId: string | null }> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status, enrollment_type, starter_completed_at')
    .eq('child_id', childId)
    .eq('enrollment_type', 'starter')
    .in('status', ['completed', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!enrollment) {
    console.log(JSON.stringify({ requestId, event: 'no_starter_found', childId }));
    return { completed: false, starterEnrollmentId: null };
  }

  const isCompleted = enrollment.status === 'completed' || enrollment.starter_completed_at !== null;
  return { completed: isCompleted, starterEnrollmentId: enrollment.id };
}

/**
 * Validate Coupon and Calculate Discount (Server-Side)
 */
export async function validateCoupon(
  couponCode: string,
  basePrice: number,
  parentEmail: string,
  productCode: string,
  requestId: string
): Promise<CouponValidationResult> {
  try {
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select(`
        id, code, coupon_type, discount_type, discount_value,
        min_order_value, max_discount, max_uses, current_uses,
        valid_from, valid_until, is_active, applicable_to, per_user_limit
      `)
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Invalid coupon code' };
    }

    // Check product applicability
    const applicableTo = coupon.applicable_to || [];
    if (applicableTo.length > 0 && !applicableTo.includes(productCode)) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: `Coupon not valid for ${productCode} product` };
    }

    // Check validity period
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon not yet active' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon expired' };
    }

    // Check usage limits
    if (coupon.max_uses && (coupon.current_uses ?? 0) >= coupon.max_uses) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon usage limit reached' };
    }

    // Check per-user limit
    if (coupon.per_user_limit) {
      const { data: existingParent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', parentEmail)
        .maybeSingle();

      if (existingParent) {
        const { count: userUses } = await supabase
          .from('coupon_usages')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('parent_id', existingParent.id);

        if (userUses && userUses >= coupon.per_user_limit) {
          return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon usage limit reached for this user' };
        }
      }
    }

    // Check minimum order amount
    if (coupon.min_order_value && basePrice < coupon.min_order_value) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: `Minimum order ₹${coupon.min_order_value} required` };
    }

    // Calculate discount
    let discountAmount = 0;
    let discountPercent = 0;

    if (coupon.discount_type === 'percentage' || coupon.discount_type === 'percent') {
      discountPercent = coupon.discount_value || 0;
      discountAmount = Math.round((basePrice * discountPercent) / 100);
    } else if (coupon.discount_type === 'fixed' || coupon.discount_type === 'fixed_discount' || coupon.discount_type === 'amount') {
      discountAmount = coupon.discount_value || 0;
      discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
    } else {
      discountAmount = coupon.discount_value || 0;
      discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
    }

    // Apply max discount cap
    if (coupon.max_discount && discountAmount > coupon.max_discount) {
      discountAmount = coupon.max_discount;
    }

    // Ensure discount doesn't exceed price
    if (discountAmount > basePrice) {
      discountAmount = basePrice;
    }

    console.log(JSON.stringify({ requestId, event: 'coupon_validated', code: couponCode, discountAmount, discountPercent }));

    return { valid: true, discountAmount, discountPercent, couponId: coupon.id, couponType: coupon.coupon_type };
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coupon_validation_error', error: error.message }));
    return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon validation failed' };
  }
}

/**
 * Validate Referral Credit Balance
 */
export async function validateReferralCredit(
  parentEmail: string,
  requestedAmount: number,
  requestId: string
): Promise<{ valid: boolean; availableCredit: number; usableAmount: number }> {
  const { data: parent } = await supabase
    .from('parents')
    .select('id, referral_credit_balance, referral_credit_expires_at')
    .eq('email', parentEmail)
    .single();

  if (!parent || !parent.referral_credit_balance) {
    return { valid: false, availableCredit: 0, usableAmount: 0 };
  }

  if (parent.referral_credit_expires_at) {
    const expiry = new Date(parent.referral_credit_expires_at);
    if (expiry < new Date()) {
      console.log(JSON.stringify({ requestId, event: 'referral_credit_expired' }));
      return { valid: false, availableCredit: 0, usableAmount: 0 };
    }
  }

  const availableCredit = parent.referral_credit_balance;
  const usableAmount = Math.min(requestedAmount, availableCredit);

  console.log(JSON.stringify({ requestId, event: 'referral_credit_validated', available: availableCredit, usable: usableAmount }));
  return { valid: true, availableCredit, usableAmount };
}

/**
 * Simple In-Memory Rate Limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(email: string, maxRequests: number, windowSeconds: number): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);
  const windowMs = windowSeconds * 1000;

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}
