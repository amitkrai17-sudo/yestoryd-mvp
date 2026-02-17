export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

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

    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    const { data: referrals } = await supabase
      .from('children')
      .select('id, name, parent_name, parent_phone, lead_status, created_at')
      .eq('lead_source', 'coach')
      .eq('lead_source_coach_id', coach.id)
      .order('created_at', { ascending: false });

    const totalReferrals = referrals?.length || 0;
    const enrolled = referrals?.filter(r => 
      r.lead_status === 'enrolled' || r.lead_status === 'active'
    ).length || 0;
    const inProgress = referrals?.filter(r => 
      r.lead_status && !['enrolled', 'active', 'lost'].includes(r.lead_status)
    ).length || 0;

    return NextResponse.json({
      success: true,
      coach: {
        id: coach.id,
        name: coach.name,
        referral_code: coach.referral_code,
        referral_link: coach.referral_link,
      },
      referrals: (referrals || []).map(r => ({
        ...r,
        expected_earning: (r.lead_status === 'enrolled' || r.lead_status === 'active') ? 1200 : 0,
      })),
      stats: {
        total_referrals: totalReferrals,
        enrolled,
        in_progress: inProgress,
        conversion_rate: totalReferrals > 0 ? Math.round((enrolled / totalReferrals) * 100) : 0,
      },
      earnings: { total_earned: 0, pending: 0, paid: 0 },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}