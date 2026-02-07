// =============================================================================
// FILE: app/api/group-classes/validate-coupon/route.ts
// PURPOSE: Validate coupon code and calculate final price
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, childId, couponCode } = body;

    // Get session price
    const { data: session } = await supabase
      .from('group_sessions')
      .select('price_inr, class_type_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const originalPrice = session.price_inr;
    let discountAmount = 0;
    let finalPrice = originalPrice;
    let appliedCoupon: any = null;
    let isEnrolledFree = false;

    // Check if child is enrolled (Master Key - FREE access)
    if (childId) {
      const { data: child } = await supabase
        .from('children')
        .select('is_enrolled')
        .eq('id', childId)
        .single();

      if (child?.is_enrolled) {
        isEnrolledFree = true;
        discountAmount = originalPrice;
        finalPrice = 0;
        appliedCoupon = {
          code: 'ENROLLED100',
          name: 'Enrolled Family Benefit',
          discountType: 'percentage',
          discountValue: 100,
        };
      }
    }

    // If not enrolled and coupon provided, validate it
    if (!isEnrolledFree && couponCode) {
      const { data: coupon } = await supabase
        .from('group_class_coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (coupon) {
        // Check validity dates
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

        if (validFrom && now < validFrom) {
          return NextResponse.json({ 
            error: 'Coupon not yet active',
            valid: false 
          });
        }

        if (validUntil && now > validUntil) {
          return NextResponse.json({ 
            error: 'Coupon has expired',
            valid: false 
          });
        }

        // Check usage limits
        if (coupon.max_uses_total && coupon.current_uses >= coupon.max_uses_total) {
          return NextResponse.json({ 
            error: 'Coupon usage limit reached',
            valid: false 
          });
        }

        // Check if enrolled-only coupon
        if (coupon.is_enrolled_only && childId) {
          const { data: child } = await supabase
            .from('children')
            .select('is_enrolled')
            .eq('id', childId)
            .single();

          if (!child?.is_enrolled) {
            return NextResponse.json({ 
              error: 'This coupon is only for enrolled families',
              valid: false 
            });
          }
        }

        // Calculate discount
        if (coupon.discount_type === 'percentage') {
          discountAmount = Math.round((originalPrice * coupon.discount_value) / 100);
        } else {
          // Fixed amount (stored in paise, convert appropriately)
          discountAmount = Math.min(coupon.discount_value / 100, originalPrice);
        }

        finalPrice = Math.max(originalPrice - discountAmount, 0);
        appliedCoupon = {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
        };
      } else {
        return NextResponse.json({ 
          error: 'Invalid coupon code',
          valid: false 
        });
      }
    }

    return NextResponse.json({
      valid: true,
      originalPrice,
      discountAmount,
      finalPrice,
      isEnrolledFree,
      appliedCoupon,
      requiresPayment: finalPrice > 0,
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
