// file: app/api/enrollment/calculate-revenue/route.ts
// Calculate and store revenue breakdown when enrollment is confirmed
// Called after successful Razorpay payment

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RevenueRequest {
  enrollment_id: string;
  total_amount: number;
  lead_source: 'yestoryd' | 'coach' | 'referral';
  lead_source_coach_id?: string;
  coaching_coach_id: string;
  child_id: string;
  child_name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RevenueRequest = await request.json();

    const {
      enrollment_id,
      total_amount,
      lead_source,
      lead_source_coach_id,
      coaching_coach_id,
      child_id,
      child_name,
    } = body;

    // Validate required fields
    if (!enrollment_id || !total_amount || !lead_source || !coaching_coach_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Get active revenue config
    const { data: config, error: configError } = await supabase
      .from('revenue_split_config')
      .select('*')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.error('No active config found, using defaults');
    }

    const activeConfig = config || {
      lead_cost_percent: 20,
      coach_cost_percent: 50,
      platform_fee_percent: 30,
      tds_rate_percent: 10,
      tds_threshold_annual: 30000,
    };

    // 2. Calculate split amounts
    const leadCostAmount = Math.round(total_amount * activeConfig.lead_cost_percent / 100);
    const coachCostAmount = Math.round(total_amount * activeConfig.coach_cost_percent / 100);
    const platformFeeAmount = total_amount - leadCostAmount - coachCostAmount;

    // 3. Check TDS applicability for coaching coach
    const { data: coach } = await supabase
      .from('coaches')
      .select('tds_cumulative_fy, pan_number, name')
      .eq('id', coaching_coach_id)
      .single();

    const coachYTD = (coach?.tds_cumulative_fy || 0) + coachCostAmount;
    const tdsApplicable = coachYTD > activeConfig.tds_threshold_annual;
    const tdsAmount = tdsApplicable
      ? Math.round(coachCostAmount * activeConfig.tds_rate_percent / 100)
      : 0;

    // 4. Calculate net amounts
    const netToCoach = coachCostAmount - tdsAmount;
    const netToLeadSource = lead_source === 'coach' ? leadCostAmount : 0;
    const netRetainedByPlatform = platformFeeAmount + tdsAmount +
      (lead_source === 'yestoryd' ? leadCostAmount : 0);

    // 5. Check if enrollment revenue already exists
    const { data: existing } = await supabase
      .from('enrollment_revenue')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Revenue already calculated for this enrollment',
        enrollment_revenue_id: existing.id,
      }, { status: 400 });
    }

    // 6. Store enrollment revenue
    const { data: enrollmentRevenue, error: revenueError } = await supabase
      .from('enrollment_revenue')
      .insert({
        enrollment_id,
        lead_source,
        lead_source_coach_id: lead_source === 'coach' ? lead_source_coach_id : null,
        coaching_coach_id,
        total_amount,
        lead_cost_amount: leadCostAmount,
        coach_cost_amount: coachCostAmount,
        platform_fee_amount: platformFeeAmount,
        tds_applicable: tdsApplicable,
        tds_rate_applied: tdsApplicable ? activeConfig.tds_rate_percent : null,
        tds_amount: tdsAmount,
        net_to_coach: netToCoach,
        net_to_lead_source: netToLeadSource,
        net_retained_by_platform: netRetainedByPlatform,
        config_snapshot: activeConfig,
        status: 'pending',
      })
      .select()
      .single();

    if (revenueError) throw revenueError;

    // 7. Calculate payout schedule (monthly for 3 months)
    const payoutDayOfMonth = activeConfig.payout_day_of_month || 7;
    const today = new Date();
    const payoutSchedule: Date[] = [];

    for (let i = 1; i <= 3; i++) {
      const payoutDate = new Date(today.getFullYear(), today.getMonth() + i, payoutDayOfMonth);
      payoutSchedule.push(payoutDate);
    }

    // 8. Create staggered payout entries for coaching coach
    const monthlyCoachCost = Math.round(coachCostAmount / 3);
    const monthlyTds = Math.round(tdsAmount / 3);

    const coachPayouts: any[] = [];
    for (let month = 1; month <= 3; month++) {
      // Adjust last month to handle rounding
      const thisMonthCoachCost = month === 3
        ? coachCostAmount - (monthlyCoachCost * 2)
        : monthlyCoachCost;
      const thisMonthTds = month === 3
        ? tdsAmount - (monthlyTds * 2)
        : monthlyTds;

      coachPayouts.push({
        enrollment_revenue_id: enrollmentRevenue.id,
        coach_id: coaching_coach_id,
        child_id,
        child_name,
        payout_month: month,
        payout_type: 'coach_cost',
        gross_amount: thisMonthCoachCost,
        tds_amount: thisMonthTds,
        net_amount: thisMonthCoachCost - thisMonthTds,
        scheduled_date: payoutSchedule[month - 1].toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // 9. If coach-sourced, also schedule lead bonus payouts
    if (lead_source === 'coach' && lead_source_coach_id) {
      const monthlyLeadBonus = Math.round(leadCostAmount / 3);
      const leadBonusTds = tdsApplicable
        ? Math.round(monthlyLeadBonus * activeConfig.tds_rate_percent / 100)
        : 0;

      for (let month = 1; month <= 3; month++) {
        const thisMonthBonus = month === 3
          ? leadCostAmount - (monthlyLeadBonus * 2)
          : monthlyLeadBonus;
        const thisMonthTds = month === 3 && tdsApplicable
          ? Math.round(leadCostAmount * activeConfig.tds_rate_percent / 100) - (leadBonusTds * 2)
          : leadBonusTds;

        coachPayouts.push({
          enrollment_revenue_id: enrollmentRevenue.id,
          coach_id: lead_source_coach_id,
          child_id,
          child_name,
          payout_month: month,
          payout_type: 'lead_bonus',
          gross_amount: thisMonthBonus,
          tds_amount: thisMonthTds,
          net_amount: thisMonthBonus - thisMonthTds,
          scheduled_date: payoutSchedule[month - 1].toISOString().split('T')[0],
          status: 'scheduled',
        });
      }
    }

    // 10. Insert all payouts
    const { error: payoutsError } = await supabase
      .from('coach_payouts')
      .insert(coachPayouts);

    if (payoutsError) throw payoutsError;

    // 11. Update coach cumulative TDS tracker
    await supabase
      .from('coaches')
      .update({ tds_cumulative_fy: coachYTD })
      .eq('id', coaching_coach_id);

    // 12. Return success response with breakdown
    return NextResponse.json({
      success: true,
      enrollment_revenue_id: enrollmentRevenue.id,
      breakdown: {
        total_amount,
        lead_cost: {
          amount: leadCostAmount,
          percent: activeConfig.lead_cost_percent,
          recipient: lead_source === 'coach' ? 'Coach (Lead Bonus)' : 'Yestoryd',
        },
        coach_cost: {
          amount: coachCostAmount,
          percent: activeConfig.coach_cost_percent,
          gross: coachCostAmount,
          tds: tdsAmount,
          net: netToCoach,
          tds_applicable: tdsApplicable,
        },
        platform_fee: {
          amount: platformFeeAmount,
          percent: activeConfig.platform_fee_percent,
        },
        net_to_coach: netToCoach,
        net_to_lead_source: netToLeadSource,
        net_retained_by_platform: netRetainedByPlatform,
      },
      payouts_scheduled: payoutSchedule.map((date, i) => ({
        month: i + 1,
        date: date.toISOString().split('T')[0],
        coach_cost: coachPayouts.find(p => p.payout_month === i + 1 && p.payout_type === 'coach_cost')?.net_amount || 0,
        lead_bonus: coachPayouts.find(p => p.payout_month === i + 1 && p.payout_type === 'lead_bonus')?.net_amount || 0,
      })),
    });

  } catch (error: unknown) {
    console.error('Error calculating enrollment revenue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to calculate revenue' },
      { status: 500 }
    );
  }
}
