// file: app/api/coach/earnings/route.ts
// Fetch coach earnings summary and payout history

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coach_id');

    if (!coachId) {
      return NextResponse.json({ success: false, error: 'Coach ID required' }, { status: 400 });
    }

    // Get earnings summary
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    // Total earned (paid payouts)
    const { data: paidPayouts } = await supabase
      .from('coach_payouts')
      .select('net_amount, tds_amount, payout_type, paid_at')
      .eq('coach_id', coachId)
      .eq('status', 'paid');

    // Pending payouts
    const { data: pendingPayouts } = await supabase
      .from('coach_payouts')
      .select('net_amount')
      .eq('coach_id', coachId)
      .eq('status', 'scheduled');

    // Successful referrals
    const { count: referralCount } = await supabase
      .from('children')
      .select('id', { count: 'exact' })
      .eq('lead_source_coach_id', coachId)
      .eq('lead_status', 'enrolled');

    // Calculate summary
    const totalEarned = paidPayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
    const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
    const thisMonthEarned = paidPayouts
      ?.filter(p => p.paid_at && new Date(p.paid_at) >= monthStart)
      .reduce((sum, p) => sum + p.net_amount, 0) || 0;
    const coachingEarnings = paidPayouts
      ?.filter(p => p.payout_type === 'coach_cost')
      .reduce((sum, p) => sum + p.net_amount, 0) || 0;
    const referralEarnings = paidPayouts
      ?.filter(p => p.payout_type === 'lead_bonus')
      .reduce((sum, p) => sum + p.net_amount, 0) || 0;

    // Get recent payouts with child names
    const { data: allPayouts } = await supabase
      .from('coach_payouts')
      .select(`
        id,
        payout_type,
        payout_month,
        gross_amount,
        tds_amount,
        net_amount,
        scheduled_date,
        status,
        paid_at,
        payment_reference,
        enrollment_revenue:enrollment_revenue_id (
          enrollments:enrollment_id (
            children:child_id (name)
          )
        )
      `)
      .eq('coach_id', coachId)
      .order('scheduled_date', { ascending: false })
      .limit(20);

    // Format payouts with child names
    const formattedPayouts = allPayouts?.map(p => ({
      id: p.id,
      payout_type: p.payout_type,
      payout_month: p.payout_month,
      gross_amount: p.gross_amount,
      tds_amount: p.tds_amount,
      net_amount: p.net_amount,
      scheduled_date: p.scheduled_date,
      status: p.status,
      paid_at: p.paid_at,
      payment_reference: p.payment_reference,
      child_name: (p.enrollment_revenue as any)?.enrollments?.children?.name || 'Student',
    })) || [];

    return NextResponse.json({
      success: true,
      summary: {
        total_earned: totalEarned,
        pending_amount: pendingAmount,
        this_month_earned: thisMonthEarned,
        coaching_earnings: coachingEarnings,
        referral_earnings: referralEarnings,
        successful_referrals: referralCount || 0,
      },
      payouts: formattedPayouts,
    });

  } catch (error: any) {
    console.error('Earnings fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}
