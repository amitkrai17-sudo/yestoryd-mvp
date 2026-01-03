// =============================================================================
// FILE: app/api/parent/referral/generate/route.ts
// PURPOSE: Generate a unique referral code for a parent
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate a unique referral code
function generateReferralCode(name: string): string {
  // Extract first name and clean it
  const firstName = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  // Generate random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${firstName}-${randomSuffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Find parent by email
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, name, email, referral_code, referral_credit_balance, referral_credit_expires_at')
      .eq('email', email.toLowerCase())
      .single();

    if (parentError || !parent) {
      return NextResponse.json(
        { success: false, error: 'Parent not found' },
        { status: 404 }
      );
    }

    // If already has a referral code, return it
    if (parent.referral_code) {
      return NextResponse.json({
        success: true,
        data: {
          referralCode: parent.referral_code,
          creditBalance: parent.referral_credit_balance || 0,
          creditExpiry: parent.referral_credit_expires_at,
          totalReferrals: 0,
          successfulReferrals: 0,
          pendingReferrals: 0,
          totalEarned: 0,
        },
        message: 'Existing referral code returned',
      });
    }

    // Generate a new unique referral code
    let referralCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      referralCode = generateReferralCode(parent.name || 'USER');
      
      // Check if code already exists
      const { data: existing } = await supabase
        .from('parents')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate unique code' },
        { status: 500 }
      );
    }

    // Update parent with new referral code
    const { error: updateError } = await supabase
      .from('parents')
      .update({ referral_code: referralCode })
      .eq('id', parent.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save referral code' },
        { status: 500 }
      );
    }

    // Also create a coupon entry for this referral code
    try {
      await supabase
        .from('coupons')
        .insert({
          code: referralCode,
          coupon_type: 'parent_referral',
          discount_type: 'percentage',
          discount_value: 10, // Will be overridden by site_settings
          max_discount: null,
          valid_from: new Date().toISOString(),
          valid_until: null, // Never expires
          max_uses: null, // Unlimited uses
          current_uses: 0,
          is_active: true,
          title: `Parent Referral - ${parent.name}`,
          description: `Referral code for ${parent.name}`,
          parent_id: parent.id,
          created_by: parent.id,
        });
    } catch (e) {
      // Coupon creation is optional, don't fail the request
      console.log('Coupon creation skipped:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        creditBalance: 0,
        creditExpiry: null,
        totalReferrals: 0,
        successfulReferrals: 0,
        pendingReferrals: 0,
        totalEarned: 0,
      },
      message: 'Referral code generated successfully',
    });

  } catch (error) {
    console.error('Generate referral error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate referral code' },
      { status: 500 }
    );
  }
}
