// =============================================================================
// FILE: app/api/parent/referral/route.ts
// PURPOSE: Get parent's referral code, credit balance, and history
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    if (!parentId) {
      return NextResponse.json({ error: 'Parent ID required' }, { status: 400 });
    }

    // Get parent's referral coupon
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('parent_id', parentId)
      .eq('coupon_type', 'parent_referral')
      .single();

    // Get discount and credit percentages from settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'parent_referral_discount_percent',
        'parent_referral_credit_percent',
        'coaching_program_price'
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      settingsMap[s.key] = s.value?.replace(/"/g, '') || '';
    });

    const discountPercent = parseInt(settingsMap.parent_referral_discount_percent || '10');
    const creditPercent = parseInt(settingsMap.parent_referral_credit_percent || '10');
    const programPrice = parseInt(settingsMap.coaching_program_price || '5999');
    const creditAmount = Math.round(programPrice * creditPercent / 100);

    // Get parent's credit balance
    const { data: parent } = await supabase
      .from('parents')
      .select('referral_credit_balance, referral_credit_expires_at, total_referrals, total_credit_earned')
      .eq('id', parentId)
      .single();

    // Get referral history (children who used this parent's code)
    const { data: history } = await supabase
      .from('children')
      .select(`
        id,
        child_name,
        created_at,
        enrollments(id, status, created_at)
      `)
      .eq('referred_by_parent_id', parentId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Format history
    const formattedHistory = history?.map(child => {
      const enrollment = child.enrollments?.[0];
      return {
        id: child.id,
        childName: child.child_name,
        status: enrollment?.status === 'active' || enrollment?.status === 'completed' 
          ? 'enrolled' 
          : 'pending',
        creditAwarded: enrollment ? creditAmount : 0,
        date: enrollment?.created_at || child.created_at,
      };
    }) || [];

    return NextResponse.json({
      referral: coupon ? {
        code: coupon.code,
        discountPercent,
        creditPercent,
        creditAmount,
      } : null,
      credit: {
        balance: parent?.referral_credit_balance || 0,
        expiresAt: parent?.referral_credit_expires_at,
        totalEarned: parent?.total_credit_earned || 0,
        totalReferrals: parent?.total_referrals || 0,
      },
      history: formattedHistory,
    });

  } catch (error) {
    console.error('Parent referral GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
