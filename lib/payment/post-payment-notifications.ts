// ============================================================
// FILE: lib/payment/post-payment-notifications.ts
// PURPOSE: Revenue split calculation and payout scheduling
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { loadRevenueSplitConfig } from '@/lib/config/loader';
import type { CoachGroup, CoachWithGroup } from './coach-assigner';

const supabase = createAdminClient();

// --- Types ---

export interface RevenueResult {
  success: boolean;
  enrollment_revenue_id?: string;
  lead_cost?: number;
  coach_cost?: number;
  platform_fee?: number;
  tds_amount?: number;
  net_to_coach?: number;
  payouts_scheduled?: number;
  error?: string;
}

// --- Functions ---

/**
 * Calculate Revenue Split and Schedule Payouts
 */
export async function calculateRevenueSplit(
  enrollmentId: string,
  amount: number,
  coach: CoachWithGroup,
  leadSource: 'yestoryd' | 'coach',
  leadSourceCoachId: string | null,
  childId: string,
  childName: string,
  requestId: string,
  durationMonths: number = 3
): Promise<RevenueResult> {
  try {
    // Normalize Group Data
    let group: CoachGroup;
    if (Array.isArray(coach.coach_groups)) {
      group = coach.coach_groups[0];
    } else {
      group = coach.coach_groups as CoachGroup;
    }

    // Fallback if no group
    if (!group) {
      group = {
        id: 'default',
        name: 'rising',
        display_name: 'Rising Coach',
        lead_cost_percent: 20,
        coach_cost_percent: 50,
        platform_fee_percent: 30,
        is_internal: false,
      };
    }

    // Handle Internal Coach (100% Platform)
    if (group.is_internal) {
      const { data: revenue } = await supabase.from('enrollment_revenue').insert({
        enrollment_id: enrollmentId,
        lead_source: leadSource,
        lead_source_coach_id: leadSourceCoachId,
        coaching_coach_id: coach.id,
        total_amount: amount,
        platform_fee_amount: amount,
        net_retained_by_platform: amount,
        coach_cost_amount: 0,
        lead_cost_amount: 0,
        net_to_coach: 0,
        net_to_lead_source: 0,
        coach_group_id: group.id,
        coach_group_name: group.name,
        status: 'completed',
        config_snapshot: JSON.parse(JSON.stringify({ group, note: 'Internal coach - 100% to platform' })),
      }).select('id').single();

      return { success: true, enrollment_revenue_id: revenue?.id, platform_fee: amount, net_to_coach: 0, payouts_scheduled: 0 };
    }

    // Calculate Splits
    const leadCost = Math.round(amount * group.lead_cost_percent / 100);
    const coachCost = Math.round(amount * group.coach_cost_percent / 100);
    const platformFee = amount - leadCost - coachCost;

    // Get TDS Config
    const revConfig = await loadRevenueSplitConfig();
    const tdsRate = revConfig.tdsRatePercent;
    const tdsThreshold = revConfig.tdsThresholdAnnual;
    const payoutDay = revConfig.payoutDayOfMonth;

    // Calculate TDS
    const currentFY = coach.tds_cumulative_fy || 0;
    const tdsApplicable = (currentFY + coachCost) > tdsThreshold;
    const tdsOnCoach = tdsApplicable ? Math.round(coachCost * tdsRate / 100) : 0;

    let tdsOnLead = 0;
    if (leadSource === 'coach' && leadSourceCoachId && tdsApplicable) {
      tdsOnLead = Math.round(leadCost * tdsRate / 100);
    }

    const totalTds = tdsOnCoach + tdsOnLead;
    const netToCoach = coachCost - tdsOnCoach;
    const netToPlatform = platformFee + (leadSource === 'yestoryd' ? leadCost : 0) + totalTds;

    // Insert Revenue Record
    const { data: revenue, error: revError } = await supabase.from('enrollment_revenue').insert({
      enrollment_id: enrollmentId,
      coaching_coach_id: coach.id,
      lead_source: leadSource,
      lead_source_coach_id: leadSourceCoachId,
      total_amount: amount,
      lead_cost_amount: leadCost,
      coach_cost_amount: coachCost,
      platform_fee_amount: platformFee,
      tds_applicable: tdsApplicable,
      tds_rate_applied: tdsApplicable ? tdsRate : null,
      tds_amount: totalTds,
      net_to_coach: netToCoach,
      net_to_lead_source: leadSource === 'coach' ? leadCost : 0,
      net_retained_by_platform: netToPlatform,
      coach_group_id: group.id,
      coach_group_name: group.name,
      status: 'pending',
      config_snapshot: JSON.parse(JSON.stringify({ group, tds_rate: tdsRate, tds_threshold: tdsThreshold })),
    }).select('id').single();

    if (revError) throw revError;

    // Schedule Payouts (Batch Insert)
    const now = new Date();
    const payoutRecords = [];
    const monthlyCoachGross = Math.round(coachCost / durationMonths);
    const monthlyCoachTds = Math.round(tdsOnCoach / durationMonths);

    for (let i = 1; i <= durationMonths; i++) {
      const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
      payoutRecords.push({
        enrollment_revenue_id: revenue.id,
        coach_id: coach.id,
        child_id: childId,
        child_name: childName,
        payout_month: i,
        payout_type: 'coach_cost',
        gross_amount: monthlyCoachGross,
        tds_amount: monthlyCoachTds,
        net_amount: monthlyCoachGross - monthlyCoachTds,
        scheduled_date: payoutDate.toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // Lead bonus payouts if coach-sourced
    if (leadSource === 'coach' && leadSourceCoachId) {
      const monthlyLeadGross = Math.round(leadCost / durationMonths);
      const monthlyLeadTds = Math.round(tdsOnLead / durationMonths);

      for (let i = 1; i <= durationMonths; i++) {
        const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
        payoutRecords.push({
          enrollment_revenue_id: revenue.id,
          coach_id: leadSourceCoachId,
          child_id: childId,
          child_name: childName,
          payout_month: i,
          payout_type: 'lead_bonus',
          gross_amount: monthlyLeadGross,
          tds_amount: monthlyLeadTds,
          net_amount: monthlyLeadGross - monthlyLeadTds,
          scheduled_date: payoutDate.toISOString().split('T')[0],
          status: 'scheduled',
        });
      }
    }

    // Batch insert payouts
    const { error: payoutError } = await supabase.from('coach_payouts').insert(payoutRecords);
    if (payoutError) {
      console.error(JSON.stringify({ requestId, event: 'payout_insert_error', error: payoutError.message }));
    }

    // Update Coach Cumulative TDS
    await supabase.from('coaches').update({
      tds_cumulative_fy: currentFY + coachCost,
      updated_at: new Date().toISOString(),
    }).eq('id', coach.id);

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_calculated',
      coachCost,
      platformFee,
      tds: totalTds,
      payouts: payoutRecords.length,
    }));

    return {
      success: true,
      enrollment_revenue_id: revenue.id,
      lead_cost: leadCost,
      coach_cost: coachCost,
      platform_fee: platformFee,
      tds_amount: totalTds,
      net_to_coach: netToCoach,
      payouts_scheduled: payoutRecords.length,
    };

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'revenue_calc_error', error: error.message }));
    return { success: false, error: error.message };
  }
}
