// =============================================================================
// FILE: app/api/coupons/calculate/route.ts
// PURPOSE: Calculate total discount with 20% cap, stacking coupon + credit
// READS: Base prices from site_settings table
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
  customAmount?: number; // For group classes or custom pricing
}

export async function POST(request: NextRequest) {
  try {
    const body: CalculateRequest = await request.json();
    const { couponCode, applyCredit, parentId, productType, customAmount } = body;

    // =================================================================
    // STEP 1: Get base price from appropriate source
    // =================================================================
    
    // Get discount settings from site_settings
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
      // Remove quotes from JSON string values
      settingsMap[s.key] = s.value?.toString().replace(/"/g, '') || '';
    });

    // Get base price based on product type
    let originalAmount = customAmount || 5999; // Default fallback

    if (productType === 'coaching') {
      // Read coaching price from pricing_plans table (same as enroll page)
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
    // STEP 2: Calculate coupon discount
    // =================================================================
    let couponDiscount = 0;
    let couponInfo = null;
    let leadSource: 'yestoryd' | 'coach' | 'parent' = 'yestoryd';

    if (couponCode) {
      // Validate coupon
      const validateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/coupons/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: couponCode,
            parentId,
            productType,
            amount: originalAmount,
          }),
        }
      );

      const validateResult = await validateResponse.json();

      if (validateResult.valid) {
        const coupon = validateResult.coupon;
        couponInfo = coupon;

        // Calculate raw coupon discount
        // Handle both 'percent' and 'percentage' as percentage discount
        if (coupon.discountType === 'percent' || coupon.discountType === 'percentage') {
          couponDiscount = Math.round(originalAmount * coupon.discountValue / 100);
        } else {
          couponDiscount = coupon.discountValue;
        }

        // Apply max_discount cap from coupon itself
        if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
          couponDiscount = coupon.maxDiscount;
        }

        // Determine lead source from coupon type
        if (coupon.couponType === 'coach_referral') {
          leadSource = 'coach';
        } else if (coupon.couponType === 'parent_referral') {
          leadSource = 'parent';
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
      // Get parent's credit balance
      const { data: parent } = await supabase
        .from('parents')
        .select('referral_credit_balance, referral_credit_expires_at')
        .eq('id', parentId)
        .single();

      if (parent?.referral_credit_balance) {
        // Check if credit is not expired
        const expiresAt = parent.referral_credit_expires_at 
          ? new Date(parent.referral_credit_expires_at) 
          : null;
        
        if (!expiresAt || expiresAt > new Date()) {
          availableCredit = parent.referral_credit_balance;
          
          // Calculate remaining cap after coupon discount
          const remainingCap = maxDiscount - cappedCouponDiscount;
          
          // Apply credit up to remaining cap
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
