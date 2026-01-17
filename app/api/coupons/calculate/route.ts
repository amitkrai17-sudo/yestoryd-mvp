// ============================================================
// FILE: app/api/coupons/calculate/route.ts
// ============================================================
// HARDENED VERSION - Discount Calculation with 20% Cap
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Session-based parentId for credit checks (CRITICAL)
// - Rate limiting
// - Input validation with Zod
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOptionalAuth, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20; // 20 calculations per minute

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
const calculateSchema = z.object({
  couponCode: z.string().max(50).transform(val => val?.toUpperCase().trim()).optional(),
  applyCredit: z.boolean().optional().default(false),
  productType: z.enum(['coaching', 'elearning_quarterly', 'elearning_annual', 'group_class']),
  customAmount: z.number().positive().max(1000000).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateCheck = checkRateLimit(`coupon-calc:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.', requestId },
        { 
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfter || 60) },
        }
      );
    }

    // 2. Get session (required for credit application)
    const session = await getOptionalAuth();
    const sessionParentId = session?.parentId;

    // 3. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', requestId },
        { status: 400 }
      );
    }

    const validationResult = calculateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { couponCode, applyCredit, productType, customAmount } = validationResult.data;

    // SECURITY: If applying credit, must have session
    if (applyCredit && !sessionParentId) {
      return NextResponse.json(
        { error: 'Login required to apply credits', requestId },
        { status: 401 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'discount_calculation_request',
      productType,
      hasCoupon: !!couponCode,
      applyCredit,
      hasSession: !!session,
    }));

    const supabase = getSupabase();

    // =================================================================
    // STEP 1: Get base price from appropriate source
    // Fetch settings and pricing in PARALLEL to avoid waterfall
    // =================================================================

    const [settingsResult, pricingResult] = await Promise.all([
      // Settings for discount limits and e-learning prices
      supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'max_discount_percent',
          'referral_discount_percent',
          'referral_credit_percent',
          'elearning_quarterly_price',
          'elearning_annual_price',
          'group_class_price',
        ]),
      // Coaching price (always fetch, may not use)
      supabase
        .from('pricing_plans')
        .select('discounted_price')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const settings = settingsResult.data;
    const pricingPlan = pricingResult.data;

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      settingsMap[s.key] = s.value?.toString().replace(/"/g, '') || '';
    });

    let originalAmount = customAmount || 5999;

    if (productType === 'coaching') {
      // Use pricing_plans table (single source of truth)
      if (pricingPlan) {
        originalAmount = customAmount || pricingPlan.discounted_price;
      }
    } else if (productType === 'elearning_quarterly') {
      originalAmount = customAmount || parseInt(settingsMap.elearning_quarterly_price || '999');
    } else if (productType === 'elearning_annual') {
      originalAmount = customAmount || parseInt(settingsMap.elearning_annual_price || '2999');
    } else if (productType === 'group_class') {
      originalAmount = customAmount || parseInt(settingsMap.group_class_price || '499');
    }

    const maxDiscountPercent = parseInt(settingsMap.max_discount_percent || '20');
    const maxDiscount = Math.round(originalAmount * maxDiscountPercent / 100);

    // =================================================================
    // STEP 2: Validate and calculate coupon discount
    // =================================================================
    let couponDiscount = 0;
    let couponInfo = null;
    let leadSource: 'yestoryd' | 'coach' | 'parent' = 'yestoryd';

    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('is_active', true)
        .single();

      if (coupon && !couponError) {
        // Check validity dates
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

        const isDateValid = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
        const isUsageValid = !coupon.max_uses || (coupon.current_uses || 0) < coupon.max_uses;

        if (isDateValid && isUsageValid) {
          couponInfo = {
            id: coupon.id,
            code: coupon.code,
            couponType: coupon.coupon_type,
            title: coupon.title,
            discountType: coupon.discount_type,
            discountValue: coupon.discount_value,
            maxDiscount: coupon.max_discount,
            coachId: coupon.coach_id,
            parentId: coupon.parent_id,
          };

          // Calculate raw coupon discount
          if (coupon.discount_type === 'percent' || coupon.discount_type === 'percentage') {
            couponDiscount = Math.round(originalAmount * coupon.discount_value / 100);
          } else {
            couponDiscount = coupon.discount_value || 0;
          }

          // Apply max_discount cap from coupon itself
          if (coupon.max_discount && couponDiscount > coupon.max_discount) {
            couponDiscount = coupon.max_discount;
          }

          // Determine lead source from coupon type
          if (coupon.coupon_type === 'coach_referral') {
            leadSource = 'coach';
          } else if (coupon.coupon_type === 'parent_referral') {
            leadSource = 'parent';
          }
        }
      }
    }

    // Cap coupon discount at max allowed
    const cappedCouponDiscount = Math.min(couponDiscount, maxDiscount);

    // =================================================================
    // STEP 3: Calculate credit application (SESSION-BASED - CRITICAL!)
    // =================================================================
    let creditApplied = 0;
    let creditRemaining = 0;
    let availableCredit = 0;

    // SECURITY: Only check credits for the LOGGED-IN user, not client-provided ID
    if (applyCredit && sessionParentId) {
      const { data: parent } = await supabase
        .from('parents')
        .select('referral_credit_balance, referral_credit_expires_at')
        .eq('id', sessionParentId) // Use SESSION parentId, not client-provided!
        .single();

      if (parent?.referral_credit_balance) {
        const expiresAt = parent.referral_credit_expires_at
          ? new Date(parent.referral_credit_expires_at)
          : null;

        if (!expiresAt || expiresAt > new Date()) {
          availableCredit = parent.referral_credit_balance;
          const remainingCap = maxDiscount - cappedCouponDiscount;
          creditApplied = Math.min(availableCredit, remainingCap);
          creditRemaining = availableCredit - creditApplied;
        }
      }
    }

    // =================================================================
    // STEP 4: Calculate final amounts
    // =================================================================
    const totalDiscount = cappedCouponDiscount + creditApplied;
    const finalAmount = Math.max(0, originalAmount - totalDiscount);
    
    // UX flags for frontend tooltips
    const wasCapped = totalDiscount >= maxDiscount;
    const creditWasLimited = availableCredit > 0 && creditApplied < availableCredit;
    const unusedCredit = availableCredit - creditApplied;
    const couponWasCapped = couponDiscount > cappedCouponDiscount;

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'discount_calculated',
      originalAmount,
      totalDiscount,
      finalAmount,
      wasCapped,
      creditWasLimited,
      duration: `${duration}ms`,
    }));

    // =================================================================
    // STEP 5: Return breakdown
    // =================================================================
    return NextResponse.json({
      success: true,
      requestId,
      breakdown: {
        originalAmount,
        couponDiscount: cappedCouponDiscount,
        couponCode: couponCode || null,
        couponInfo: couponInfo ? {
          type: couponInfo.couponType,
          title: couponInfo.title,
          discountType: couponInfo.discountType,
          discountValue: couponInfo.discountValue,
        } : null,
        creditApplied,
        creditRemaining,
        availableCredit,
        totalDiscount,
        finalAmount,
        maxDiscountPercent,
        maxDiscountAmount: maxDiscount,
        // UX flags for frontend tooltips
        wasCapped,               // Total discount hit the cap
        couponWasCapped,         // Coupon alone exceeded cap
        creditWasLimited,        // User had more credit but couldn't use it
        unusedCredit,            // How much credit couldn't be applied
        savings: {
          amount: totalDiscount,
          percent: originalAmount > 0 ? Math.round((totalDiscount / originalAmount) * 100) : 0,
        },
      },
      leadSource,
      productType,
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'discount_calculation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Failed to calculate discount', requestId },
      { status: 500 }
    );
  }
}
