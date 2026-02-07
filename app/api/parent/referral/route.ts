// =============================================================================
// FILE: app/api/parent/referral/route.ts
// PURPOSE: Get parent's referral code and stats
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

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

    // If no referral code yet, return empty data
    if (!parent.referral_code) {
      return NextResponse.json({
        success: false,
        error: 'No referral code generated yet',
        needsGeneration: true,
      });
    }

    // Count referrals (enrollments where this code was used)
    let successfulReferrals = 0;
    try {
      const { count } = await supabase
        .from('coupon_usages')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_code', parent.referral_code);
      successfulReferrals = count || 0;
    } catch (e) {
      // Table might not exist yet
    }

    // Calculate total earned
    let totalEarned = 0;
    try {
      const { data: transactions } = await supabase
        .from('referral_credit_transactions')
        .select('amount')
        .eq('parent_id', parent.id)
        .eq('type', 'earned');
      totalEarned = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    } catch (e) {
      // Table might not exist yet
    }

    return NextResponse.json({
      success: true,
      data: {
        referralCode: parent.referral_code,
        creditBalance: parent.referral_credit_balance || 0,
        creditExpiry: parent.referral_credit_expires_at,
        totalReferrals: successfulReferrals,
        successfulReferrals: successfulReferrals,
        pendingReferrals: 0,
        totalEarned,
      },
    });

  } catch (error) {
    console.error('Get referral error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get referral data' },
      { status: 500 }
    );
  }
}
