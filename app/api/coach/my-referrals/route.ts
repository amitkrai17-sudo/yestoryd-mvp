// file: app/api/coach/my-referrals/route.ts
// Fixed API for coaches to see their referrals
// Properly fetches coach data and generates referral link if missing

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachEmail = searchParams.get('email');

    console.log('📧 Fetching referrals for coach:', coachEmail);

    if (!coachEmail) {
      return NextResponse.json(
        { success: false, error: 'Coach email required' },
        { status: 400 }
      );
    }

    // Get the coach's details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, referral_code, referral_link')
      .eq('email', coachEmail)
      .single();

    if (coachError) {
      console.error('❌ Coach fetch error:', coachError);
      return NextResponse.json(
        { success: false, error: 'Coach not found. Please complete your profile.' },
        { status: 404 }
      );
    }

    if (!coach) {
      return NextResponse.json(
        { success: false, error: 'Coach profile not found' },
        { status: 404 }
      );
    }

    console.log('✅ Coach found:', coach.name, 'Code:', coach.referral_code);

    // If coach doesn't have a referral code, generate one
    let referralCode = coach.referral_code;
    let referralLink = coach.referral_link;

    if (!referralCode) {
      // Generate referral code from name
      const namePart = coach.name
        .split(' ')[0]
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 5);
      const year = new Date().getFullYear();
      referralCode = `REF-${namePart}-${year}`;
      referralLink = `https://yestoryd.com/assess?ref=${referralCode}`;

      // Update coach with new referral code
      const { error: updateError } = await supabase
        .from('coaches')
        .update({
          referral_code: referralCode,
          referral_link: referralLink,
        })
        .eq('id', coach.id);

      if (updateError) {
        console.error('⚠️ Could not update referral code:', updateError);
      } else {
        console.log('✅ Generated new referral code:', referralCode);
      }
    }

    // Ensure referral link exists
    if (!referralLink && referralCode) {
      referralLink = `https://yestoryd.com/assess?ref=${referralCode}`;
      
      // Update coach with referral link
      await supabase
        .from('coaches')
        .update({ referral_link: referralLink })
        .eq('id', coach.id);
    }

    // Get all leads referred by this coach
    const { data: referrals, error: referralsError } = await supabase
      .from('children')
      .select(`
        id,
        name,
        age,
        parent_name,
        parent_email,
        lead_status,
        lead_source,
        created_at,
        enrolled_at,
        latest_assessment_score
      `)
      .eq('lead_source_coach_id', coach.id)
      .order('created_at', { ascending: false });

    if (referralsError) {
      console.error('⚠️ Error fetching referrals:', referralsError);
      // Don't fail, just return empty referrals
    }

    const referralsList = referrals || [];
    console.log(`📊 Found ${referralsList.length} referrals for ${coach.name}`);

    // Get earnings data for enrolled referrals
    let earnings = {
      total_earned: 0,
      pending: 0,
      paid: 0,
    };

    // Try to get payout data
    try {
      const { data: payouts } = await supabase
        .from('coach_payouts')
        .select('net_amount, status, payout_type')
        .eq('coach_id', coach.id)
        .eq('payout_type', 'lead_bonus');

      if (payouts && payouts.length > 0) {
        earnings.total_earned = payouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);
        earnings.paid = payouts
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + (p.net_amount || 0), 0);
        earnings.pending = earnings.total_earned - earnings.paid;
      }
    } catch (err) {
      console.log('ℹ️ No payout data yet (table may not exist)');
    }

    // Calculate stats
    const enrolledStatuses = ['enrolled', 'active', 'completed'];
    const inProgressStatuses = ['contacted', 'call_scheduled', 'call_done'];
    
    const stats = {
      total_referrals: referralsList.length,
      assessed: referralsList.filter(r => r.lead_status === 'assessed').length,
      in_progress: referralsList.filter(r => inProgressStatuses.includes(r.lead_status || '')).length,
      enrolled: referralsList.filter(r => enrolledStatuses.includes(r.lead_status || '')).length,
      lost: referralsList.filter(r => r.lead_status === 'lost').length,
      conversion_rate: referralsList.length > 0
        ? Math.round((referralsList.filter(r => enrolledStatuses.includes(r.lead_status || '')).length / referralsList.length) * 100)
        : 0,
    };

    // Calculate expected earnings based on enrolled leads (not from payouts table)
    const enrolledCount = stats.enrolled;
    const expectedEarningPerLead = 1200; // 20% of ₹5,999
    
    // If no payout data, calculate from enrolled count
    if (earnings.total_earned === 0 && enrolledCount > 0) {
      earnings.total_earned = enrolledCount * expectedEarningPerLead;
      earnings.pending = earnings.total_earned; // All pending if no payouts processed
    }

    // Transform referrals with earnings info
    const transformedReferrals = referralsList.map(ref => ({
      ...ref,
      expected_earning: enrolledStatuses.includes(ref.lead_status || '') ? expectedEarningPerLead : 0,
      status_display: getStatusDisplay(ref.lead_status),
    }));

    return NextResponse.json({
      success: true,
      coach: {
        id: coach.id,
        name: coach.name,
        referral_code: referralCode,
        referral_link: referralLink,
      },
      referrals: transformedReferrals,
      stats,
      earnings,
    });

  } catch (error) {
    console.error('❌ My Referrals API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals. Please try again.' },
      { status: 500 }
    );
  }
}

function getStatusDisplay(status: string | null): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    assessed: { label: 'Assessed', color: 'blue' },
    contacted: { label: 'Contacted', color: 'yellow' },
    call_scheduled: { label: 'Call Scheduled', color: 'purple' },
    call_done: { label: 'Call Done', color: 'indigo' },
    enrolled: { label: 'Enrolled', color: 'green' },
    active: { label: 'Active', color: 'emerald' },
    completed: { label: 'Completed', color: 'teal' },
    lost: { label: 'Lost', color: 'red' },
  };
  
  return statusMap[status || ''] || { label: status || 'Unknown', color: 'gray' };
}
