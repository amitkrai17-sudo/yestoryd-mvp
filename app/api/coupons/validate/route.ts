// ============================================================
// FILE: app/api/coupons/validate/route.ts
// ============================================================
// HARDENED VERSION - Coupon Validation
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Rate limiting to prevent coupon enumeration
// - Session-based parentId for per-user checks
// - Input validation with Zod
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOptionalAuth, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- RATE LIMITING ---
// Prevent coupon enumeration attacks
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 validations per minute per IP

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

// --- VALIDATION SCHEMA ---
const validateCouponSchema = z.object({
  code: z.string().min(1).max(50).transform(val => val.toUpperCase().trim()),
  productType: z.enum(['coaching', 'elearning', 'elearning_quarterly', 'elearning_annual', 'group_class']),
  amount: z.number().positive().max(1000000),
});

// --- TYPES ---
interface CouponValidationResponse {
  valid: boolean;
  error?: string;
  coupon?: {
    id: string;
    code: string;
    couponType: string;
    discountType: 'fixed' | 'percentage' | null;
    discountValue: number | null;
    maxDiscount: number | null;
  };
  discount?: {
    type: 'fixed' | 'percentage';
    value: number;
    calculatedAmount: number;
  };
  referralImpact?: {
    leadSource: 'coach' | 'parent' | 'yestoryd';
    revenueSplit?: '70-30' | '50-50';
    creditToReferrer?: number;
    referrerName?: string;
  };
  requestId?: string;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateCheck = checkRateLimit(`coupon-validate:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json<CouponValidationResponse>(
        { 
          valid: false, 
          error: 'Too many validation attempts. Please wait.',
          requestId,
        },
        { 
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfter || 60) },
        }
      );
    }

    // 2. Get session (optional - for per-user checks)
    const session = await getOptionalAuth();
    const sessionParentId = session?.parentId;

    // 3. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'Invalid JSON body', requestId },
        { status: 400 }
      );
    }

    const validationResult = validateCouponSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'Invalid input', requestId },
        { status: 400 }
      );
    }

    const { code, productType, amount } = validationResult.data;

    console.log(JSON.stringify({
      requestId,
      event: 'coupon_validation_request',
      code: code.slice(0, 3) + '***', // Log partial code only
      productType,
      hasSession: !!session,
    }));

    const supabase = getSupabase();

    // 4. Find coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select(`
        *,
        coach:coaches(id, name),
        parent:parents(id, name)
      `)
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      // Don't reveal if code exists but is inactive
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'Invalid coupon code', requestId },
        { status: 200 }
      );
    }

    // 5. Check validity dates
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon is not yet active', requestId },
        { status: 200 }
      );
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon has expired', requestId },
        { status: 200 }
      );
    }

    // 6. Check usage limits
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon has reached its usage limit', requestId },
        { status: 200 }
      );
    }

    // 7. Check per-user limit (USE SESSION parentId, not client-provided)
    if (sessionParentId && coupon.per_user_limit) {
      const { count: userUsage } = await supabase
        .from('coupon_usages')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('parent_id', sessionParentId);

      if (userUsage && userUsage >= coupon.per_user_limit) {
        return NextResponse.json<CouponValidationResponse>(
          { valid: false, error: 'You have already used this coupon', requestId },
          { status: 200 }
        );
      }
    }

    // 8. Check first-enrollment-only (USE SESSION parentId)
    if (coupon.first_enrollment_only && sessionParentId) {
      const { count: enrollments } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', sessionParentId)
        .in('status', ['active', 'completed']);

      if (enrollments && enrollments > 0) {
        return NextResponse.json<CouponValidationResponse>(
          { valid: false, error: 'This coupon is for first-time enrollments only', requestId },
          { status: 200 }
        );
      }
    }

    // 9. Check applicable products
    const applicableTo = coupon.applicable_to || [];
    // Normalize product type for matching
    const normalizedProductType = productType.startsWith('elearning') ? 'elearning' : productType;
    
    if (applicableTo.length > 0 && !applicableTo.includes(normalizedProductType) && !applicableTo.includes(productType)) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: `This coupon is not valid for ${productType}`, requestId },
        { status: 200 }
      );
    }

    // 10. Check minimum order value
    if (coupon.min_order_value && amount < coupon.min_order_value) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: `Minimum order value is ₹${coupon.min_order_value}`, requestId },
        { status: 200 }
      );
    }

    // 11. Calculate discount
    let calculatedDiscount = 0;
    if (coupon.discount_type && coupon.discount_value) {
      if (coupon.discount_type === 'fixed') {
        calculatedDiscount = Math.min(coupon.discount_value, amount);
      } else if (coupon.discount_type === 'percentage' || coupon.discount_type === 'percent') {
        calculatedDiscount = Math.round(amount * coupon.discount_value / 100);
        if (coupon.max_discount) {
          calculatedDiscount = Math.min(calculatedDiscount, coupon.max_discount);
        }
      }
    }

    // 12. Build response
    const response: CouponValidationResponse = {
      valid: true,
      requestId,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        couponType: coupon.coupon_type,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        maxDiscount: coupon.max_discount,
      },
    };

    // Add discount info if applicable
    if (coupon.discount_type && coupon.discount_value) {
      response.discount = {
        type: coupon.discount_type === 'percent' ? 'percentage' : coupon.discount_type,
        value: coupon.discount_value,
        calculatedAmount: calculatedDiscount,
      };
    }

    // 13. Add referral impact info
    if (coupon.coupon_type === 'coach_referral') {
      response.referralImpact = {
        leadSource: 'coach',
        revenueSplit: '70-30',
        referrerName: coupon.coach?.name,
      };
    } else if (coupon.coupon_type === 'parent_referral') {
      // Fetch settings and pricing in PARALLEL to avoid waterfall
      const [settingsResult, pricingResult] = await Promise.all([
        supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'parent_referral_credit_percent')
          .single(),
        supabase
          .from('pricing_plans')
          .select('discounted_price')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      const creditPercent = parseInt(
        settingsResult.data?.value?.replace(/"/g, '') || '10'
      );
      const programPrice = pricingResult.data?.discounted_price || 5999;

      response.referralImpact = {
        leadSource: 'parent',
        revenueSplit: '50-50',
        creditToReferrer: Math.round(programPrice * creditPercent / 100),
        referrerName: coupon.parent?.name,
      };
    } else {
      response.referralImpact = {
        leadSource: 'yestoryd',
      };
    }

    console.log(JSON.stringify({
      requestId,
      event: 'coupon_validated',
      couponId: coupon.id,
      discountAmount: calculatedDiscount,
    }));

    return NextResponse.json<CouponValidationResponse>(response);

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'coupon_validation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return NextResponse.json<CouponValidationResponse>(
      { valid: false, error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
