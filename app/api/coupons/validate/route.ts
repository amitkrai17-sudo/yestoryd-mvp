// =============================================================================
// FILE: app/api/coupons/validate/route.ts
// PURPOSE: Validate coupon codes at checkout
// PATTERNS: Next.js 15 compatible, proper TypeScript, error handling
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface CouponValidationRequest {
  code: string;
  parentId?: string;
  parentEmail?: string;
  productType: 'coaching' | 'elearning' | 'group_class';
  amount: number;
}

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
}

export async function POST(request: NextRequest) {
  try {
    const body: CouponValidationRequest = await request.json();
    const { code, parentId, parentEmail, productType, amount } = body;

    // Validate input
    if (!code || !productType || !amount) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'Missing required fields: code, productType, amount' },
        { status: 400 }
      );
    }

    // Normalize code
    const normalizedCode = code.toUpperCase().trim();

    // Find coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select(`
        *,
        coach:coaches(id, name),
        parent:parents(id, name)
      `)
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'Invalid coupon code' },
        { status: 200 }
      );
    }

    // Check validity dates
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon is not yet active' },
        { status: 200 }
      );
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon has expired' },
        { status: 200 }
      );
    }

    // Check usage limits
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: 'This coupon has reached its usage limit' },
        { status: 200 }
      );
    }

    // Check per-user limit (if parent provided)
    if (parentId && coupon.per_user_limit) {
      const { count: userUsage } = await supabase
        .from('coupon_usages')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('parent_id', parentId);

      if (userUsage && userUsage >= coupon.per_user_limit) {
        return NextResponse.json<CouponValidationResponse>(
          { valid: false, error: 'You have already used this coupon' },
          { status: 200 }
        );
      }
    }

    // Check first-enrollment-only
    if (coupon.first_enrollment_only && parentId) {
      const { count: enrollments } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', parentId)
        .in('status', ['active', 'completed']);

      if (enrollments && enrollments > 0) {
        return NextResponse.json<CouponValidationResponse>(
          { valid: false, error: 'This coupon is for first-time enrollments only' },
          { status: 200 }
        );
      }
    }

    // Check applicable products
    if (!coupon.applicable_to?.includes(productType)) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: `This coupon is not valid for ${productType}` },
        { status: 200 }
      );
    }

    // Check minimum order value
    if (coupon.min_order_value && amount < coupon.min_order_value) {
      return NextResponse.json<CouponValidationResponse>(
        { valid: false, error: `Minimum order value is ₹${coupon.min_order_value}` },
        { status: 200 }
      );
    }

    // Calculate discount
    let calculatedDiscount = 0;
    if (coupon.discount_type && coupon.discount_value) {
      if (coupon.discount_type === 'fixed') {
        calculatedDiscount = Math.min(coupon.discount_value, amount);
      } else if (coupon.discount_type === 'percentage') {
        calculatedDiscount = Math.round(amount * coupon.discount_value / 100);
        if (coupon.max_discount) {
          calculatedDiscount = Math.min(calculatedDiscount, coupon.max_discount);
        }
      }
    }

    // Build response
    const response: CouponValidationResponse = {
      valid: true,
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
        type: coupon.discount_type,
        value: coupon.discount_value,
        calculatedAmount: calculatedDiscount,
      };
    }

    // Add referral impact info
    if (coupon.coupon_type === 'coach_referral') {
      response.referralImpact = {
        leadSource: 'coach',
        revenueSplit: '70-30',
        referrerName: coupon.coach?.name,
      };
    } else if (coupon.coupon_type === 'parent_referral') {
      // Get credit percentage from settings
      const { data: settings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'parent_referral_credit_percent')
        .single();

      const creditPercent = parseInt(
        settings?.value?.replace(/"/g, '') || '10'
      );

      // Get program price from settings
      const { data: priceSettings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'coaching_program_price')
        .single();

      const programPrice = parseInt(
        priceSettings?.value?.replace(/"/g, '') || '5999'
      );

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

    return NextResponse.json<CouponValidationResponse>(response);

  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json<CouponValidationResponse>(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
