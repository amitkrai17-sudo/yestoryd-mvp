// =============================================================================
// FILE: app/api/admin/coupons/route.ts
// PURPOSE: Admin CRUD operations for coupons
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List all coupons with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'referral' | 'promo' | 'all'
    const status = searchParams.get('status'); // 'active' | 'expired' | 'all'

    let query = supabase
      .from('coupons')
      .select(`
        *,
        coach:coaches(id, name, email),
        parent:parents(id, name, email)
      `)
      .order('created_at', { ascending: false });

    // Filter by type
    if (type === 'referral') {
      query = query.in('coupon_type', ['coach_referral', 'parent_referral']);
    } else if (type === 'promo') {
      query = query.in('coupon_type', ['fixed_discount', 'percent_discount', 'first_time', 'event']);
    }

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'expired') {
      query = query.or(`is_active.eq.false,valid_until.lt.${new Date().toISOString()}`);
    }

    const { data: coupons, error } = await query;

    if (error) {
      console.error('Error fetching coupons:', error);
      return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: coupons?.length || 0,
      active: coupons?.filter(c => c.is_active).length || 0,
      referrals: coupons?.filter(c => ['coach_referral', 'parent_referral'].includes(c.coupon_type)).length || 0,
      promos: coupons?.filter(c => !['coach_referral', 'parent_referral'].includes(c.coupon_type)).length || 0,
      totalUsage: coupons?.reduce((sum, c) => sum + (c.current_uses || 0), 0) || 0,
      totalDiscountGiven: coupons?.reduce((sum, c) => sum + (c.total_discount_given || 0), 0) || 0,
    };

    return NextResponse.json({ coupons, stats });

  } catch (error) {
    console.error('Coupons GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new promotional coupon
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      code,
      couponType,
      title,
      description,
      discountType,
      discountValue,
      maxDiscount,
      maxUses,
      perUserLimit = 1,
      firstEnrollmentOnly = false,
      validFrom,
      validUntil,
      applicableTo = ['coaching', 'elearning', 'group_classes'],
      minOrderValue = 0,
    } = body;

    // Validate required fields
    if (!code || !couponType) {
      return NextResponse.json(
        { error: 'Code and coupon type are required' },
        { status: 400 }
      );
    }

    // Check if coupon type requires discount
    if (['fixed_discount', 'percent_discount', 'first_time', 'event'].includes(couponType)) {
      if (!discountType || !discountValue) {
        return NextResponse.json(
          { error: 'Discount type and value are required for promotional coupons' },
          { status: 400 }
        );
      }
    }

    // Normalize code
    const normalizedCode = code.toUpperCase().trim();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', normalizedCode)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A coupon with this code already exists' },
        { status: 409 }
      );
    }

    // Create coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        code: normalizedCode,
        coupon_type: couponType,
        title,
        description,
        discount_type: discountType,
        discount_value: discountValue,
        max_discount: maxDiscount,
        max_uses: maxUses,
        per_user_limit: perUserLimit,
        first_enrollment_only: firstEnrollmentOnly,
        valid_from: validFrom || new Date().toISOString(),
        valid_until: validUntil,
        applicable_to: applicableTo,
        min_order_value: minOrderValue,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating coupon:', error);
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }

    return NextResponse.json({ success: true, coupon }, { status: 201 });

  } catch (error) {
    console.error('Coupons POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
