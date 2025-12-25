// file: app/api/coach/my-referrals/route.ts
// API to get coach referral info - FIXED to use database values
// Returns referral_code and referral_link directly from coaches table

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
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get coach info with referral_code and referral_link FROM DATABASE
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, referral_code, referral_link')
      .eq('email', email.toLowerCase())
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Get referrals (children referred by this coach)
    const { data: referrals, error: referralsError } = await supabase
      .from('children')
      .select('id, name, parent_name, parent_phone, lead_status, created_at')
      .eq('lead_source', 'coach')
      .eq('lead_source_coach_id', coach.id)
      .order('created_at', { ascending: false });

    // Calculate stats
    const totalReferrals = referrals?.length || 0;
    const enrolled = referrals?.filter(r => 
      r.lead_status === 'enrolled' || r.lead_status === 'active'
    ).length || 0;
    const inProgress = referrals?.filter(r => 
      r.lead_status && !['enrolled', 'active', 'lost'].includes(r.lead_status)
    ).length || 0;
    const conversionRate = totalReferrals > 0 
      ? Math.round((enrolled / totalReferrals) * 100) 
      : 0;

    // Get earnings from coach_payouts (lead bonus type)
    let totalEarned = 0;
    let pending = 0;
    let paid = 0;

    try {
      const { data: payouts } = await supabase
        .from('coach_payouts')
        .select('net_amount, status, payout_type')
        .eq('coach_id', coach.id)
        .eq('payout_type', 'lead_bonus');

      if (payouts) {
        payouts.forEach(p => {
          totalEarned += p.net_amount || 0;
          if (p.status === 'paid') {
            paid += p.net_amount || 0;
          } else {
            pending += p.net_amount || 0;
          }
        });
      }
    } catch (e) {
      // Payouts table might not exist yet
      console.log('Payouts fetch error:', e);
    }

    // Map referrals with expected earning
    const mappedReferrals = (referrals || []).map(r => ({
      ...r,
      expected_earning: (r.lead_status === 'enrolled' || r.lead_status === 'active') ? 1200 : 0,
    }));

    return NextResponse.json({
      success: true,
      _debug: new Date().toISOString(),  // ADD THIS LINE
      _supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(-20),  // ADD THIS	
      coach: {
        id: coach.id,
        name: coach.name,
        // IMPORTANT: Use database values directly, not constructed URLs
        referral_code: coach.referral_code,
        referral_link: coach.referral_link,
      },
      referrals: mappedReferrals,
      stats: {
        total_referrals: totalReferrals,
        enrolled,
        in_progress: inProgress,
        conversion_rate: conversionRate,
      },
      earnings: {
        total_earned: totalEarned,
        pending,
        paid,
      },
    });

  } catch (error: any) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}