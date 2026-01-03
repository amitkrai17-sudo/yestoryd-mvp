// =============================================================================
// FILE: app/api/coupons/calculate/route.ts
// PURPOSE: Calculate total discount with 20% cap, stacking coupon + credit
// READS: Base prices from pricing_plans and site_settings tables
// REFACTORED: Direct Supabase query instead of internal API fetch
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CalculateRequest {
  couponCode?: string;
  applyCredit?: boolean;
  parentId?: string;
  productType: 'coaching' | 'elearning_quarterly' | 'elearning_annual' | 'group_class';
  customAmount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CalculateRequest = await request.json();
    const { couponCode, applyCredit, parentId, productType, customAmount } = body;

    // =================================================================
    // STEP 1: Get base price from appropriate source
    // =================================================================
    
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'max_discount_percent',
        'referral_discount_percent',
        'referral_credit_percent',
        'elearning_quarterly_price',
        'elearning_annual_price',
        'group_class_price',
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      settingsMap[s.key] = s.value?.toString().replace(/"/g, '') || '';
    });

    let originalAmount = customAmount || 5999;

    if (productType === 'coaching') {
      const { data: pricingPlan } = await supabase
        .from('pricing_plans')
        .select('discounted_price')
        .eq('slug', 'coaching-3month')
        .eq('is_active', true)
        .single();
      
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
    // STEP 2: Validate and calculate coupon discount (DIRECT QUERY)
    // =================================================================
    let couponDiscount = 0;
    let couponInfo = null;
    let leadSource: 'yestoryd' | 'coach' | 'parent' = 'yestoryd';

    if (couponCode) {
      // Query coupon directly from database
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (coupon && !couponError) {
        // Check validity dates
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

        const isDateValid = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
        
        // Check usage limits
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
            couponDiscount = coupon.discount_value;
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
    // STEP 3: Calculate credit application
    // =================================================================
    let creditApplied = 0;
    let creditRemaining = 0;
    let availableCredit = 0;

    if (applyCredit && parentId) {
      const { data: parent } = await supabase
        .from('parents')
        .select('referral_credit_balance, referral_credit_expires_at')
        .eq('id', parentId)
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
    const finalAmount = originalAmount - totalDiscount;
    const wasCapped = totalDiscount >= maxDiscount;

    // =================================================================
    // STEP 5: Return breakdown
    // =================================================================
    return NextResponse.json({
      success: true,
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
        totalDiscount,
        finalAmount,
        maxDiscountPercent,
        maxDiscountAmount: maxDiscount,
        wasCapped,
        savings: {
          amount: totalDiscount,
          percent: Math.round((totalDiscount / originalAmount) * 100),
        },
      },
      leadSource,
      productType,
    });

  } catch (error) {
    console.error('Calculate discount error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate discount' },
      { status: 500 }
    );
  }
}