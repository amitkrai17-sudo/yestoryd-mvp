// =============================================================================
// FILE: app/api/parent/referral/generate/route.ts
// PURPOSE: Generate a new referral code for a parent
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { parentId, parentName } = await request.json();

    if (!parentId || !parentName) {
      return NextResponse.json(
        { error: 'Parent ID and name required' },
        { status: 400 }
      );
    }

    // Check if parent already has a referral code
    const { data: existingCoupon } = await supabase
      .from('coupons')
      .select('code')
      .eq('parent_id', parentId)
      .eq('coupon_type', 'parent_referral')
      .single();

    if (existingCoupon) {
      return NextResponse.json({ 
        success: true, 
        code: existingCoupon.code,
        message: 'Referral code already exists'
      });
    }

    // Get discount percentage from settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'parent_referral_discount_percent')
      .single();

    const discountPercent = parseInt(
      settings?.value?.replace(/"/g, '') || '10'
    );

    // Generate unique code
    const firstName = parentName.split(' ')[0].toUpperCase();
    let code = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `REF-${firstName}-${suffix}`;

      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', code)
        .single();

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Could not generate unique code' },
        { status: 500 }
      );
    }

    // Create the coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        code,
        coupon_type: 'parent_referral',
        title: `Parent Referral - ${parentName}`,
        description: `Referral code for ${parentName}. New parent gets discount, referrer gets credit.`,
        discount_type: 'percentage',
        discount_value: discountPercent,
        referrer_type: 'parent',
        parent_id: parentId,
        applicable_to: ['coaching', 'elearning', 'group_classes'],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating referral code:', error);
      return NextResponse.json(
        { error: 'Failed to create referral code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      code: coupon.code,
    });

  } catch (error) {
    console.error('Generate referral code error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
