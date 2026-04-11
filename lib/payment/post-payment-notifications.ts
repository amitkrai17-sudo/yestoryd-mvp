// ============================================================
// FILE: lib/payment/post-payment-notifications.ts
// PURPOSE: Revenue split DB writer — delegates ALL math to Calculator B
//          (lib/config/payout-config.ts), then writes to enrollment_revenue
//          + coach_payouts.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/database.types';
import {
  calculateEnrollmentBreakdown,
  loadPayoutConfig,
  loadCoachGroup,
  type EnrollmentBreakdown,
  type EnrollmentType,
  type ReferrerType,
  type CoachGroupConfig,
} from '@/lib/config/payout-config';
import type { CoachGroup, CoachWithGroup } from './coach-assigner';

type CoachPayoutInsert = Database['public']['Tables']['coach_payouts']['Insert'];

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

// --- Helpers ---

/**
 * Convert CoachGroup (from coach-assigner) to CoachGroupConfig (for Calculator B).
 * Falls back to loadCoachGroup() from payout-config if possible.
 */
function toCoachGroupConfig(group: CoachGroup): CoachGroupConfig {
  return {
    id: group.id,
    name: group.name,
    display_name: group.display_name,
    coach_cost_percent: group.coach_cost_percent,
    lead_cost_percent: group.lead_cost_percent,
    platform_fee_percent: group.platform_fee_percent,
    is_internal: group.is_internal,
    per_session_rate_override: group.per_session_rate_override ?? null,
    skill_building_rate_override: group.skill_building_rate_override ?? null,
  };
}

/**
 * Normalize coach_groups from CoachWithGroup (may be array or single object).
 */
function normalizeGroup(coach: CoachWithGroup): CoachGroup {
  let group: CoachGroup;
  if (Array.isArray(coach.coach_groups)) {
    group = coach.coach_groups[0];
  } else {
    group = coach.coach_groups as CoachGroup;
  }

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

  return group;
}

/**
 * Map leadSource string to Calculator B's ReferrerType.
 * Calculator B supports: 'coach' | 'parent' | 'external' | 'influencer' | 'organic'
 * Calculator A (verify route) passes: 'yestoryd' | 'coach'
 */
function mapLeadSourceToReferrerType(
  leadSource: string,
  leadSourceCoachId: string | null
): ReferrerType | 'organic' {
  if (leadSource === 'coach' && leadSourceCoachId) return 'coach';
  if (leadSource === 'parent') return 'parent';
  if (leadSource === 'external') return 'external';
  if (leadSource === 'influencer') return 'influencer';
  // 'yestoryd' or anything else = organic (no referrer)
  return 'organic';
}

/**
 * Determine enrollment sequence by checking prior enrollments for this child.
 */
async function determineEnrollmentSequence(
  childId: string,
  currentEnrollmentId: string,
  productCode: string,
): Promise<EnrollmentType> {
  if (productCode === 'starter') return 'starter';
  if (productCode === 'continuation') return 'continuation';

  // For 'full' — check if child has any prior completed enrollments
  const { data: priorEnrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('child_id', childId)
    .neq('id', currentEnrollmentId)
    .in('status', ['completed', 'active'])
    .limit(1);

  return (priorEnrollments && priorEnrollments.length > 0) ? 'reenrollment' : 'starter';
}

/**
 * Get coaching sessions, skill building sessions, and enrollment_type
 * from the enrollment record that was just created.
 */
async function getEnrollmentContext(
  enrollmentId: string,
  requestId: string,
): Promise<{ coaching: number; skillBuilding: number; enrollmentType: string }> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('sessions_purchased, remedial_sessions_max, enrollment_type')
    .eq('id', enrollmentId)
    .single();

  if (!enrollment) {
    console.warn(JSON.stringify({ requestId, event: 'enrollment_not_found_for_sessions', enrollmentId }));
    return { coaching: 0, skillBuilding: 0, enrollmentType: 'full' };
  }

  const coaching = enrollment.sessions_purchased || 0;
  const skillBuilding = enrollment.remedial_sessions_max || 0;
  const enrollmentType = enrollment.enrollment_type || 'full';

  return { coaching, skillBuilding, enrollmentType };
}

// --- Main Function ---

/**
 * Calculate Revenue Split and Schedule Payouts
 *
 * Delegates ALL math to calculateEnrollmentBreakdown() (Calculator B)
 * from lib/config/payout-config.ts. This function handles:
 * 1. Loading config + coach group
 * 2. Determining enrollment sequence
 * 3. Writing to enrollment_revenue
 * 4. Scheduling coach_payouts (coaching + skill_building + lead_bonus)
 * 5. Updating coach TDS cumulative
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
    const group = normalizeGroup(coach);

    // Handle Internal Coach (100% Platform) — no Calculator B needed
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
        skill_building_cost: 0,
        coaching_rate_per_session: 0,
        skill_building_rate_per_session: 0,
        enrollment_sequence: 'starter',
        re_enrollment_bonus: 0,
        lead_cost_decay_applied: 1.0,
        coach_group_id: group.id,
        coach_group_name: group.name,
        status: 'completed',
        config_snapshot: JSON.parse(JSON.stringify({ group, note: 'Internal coach - 100% to platform' })),
      }).select('id').single();

      console.log(JSON.stringify({ requestId, event: 'revenue_calculated', internal: true, platformFee: amount }));

      return { success: true, enrollment_revenue_id: revenue?.id, platform_fee: amount, net_to_coach: 0, payouts_scheduled: 0 };
    }

    // --- Load Calculator B inputs ---

    // 1. PayoutConfig from site_settings
    const config = await loadPayoutConfig();

    // 2. CoachGroupConfig — try DB lookup for per_session_rate_override fields,
    //    fall back to the group from coach-assigner
    let coachGroupConfig: CoachGroupConfig | null = await loadCoachGroup(coach.id);
    if (!coachGroupConfig) {
      coachGroupConfig = toCoachGroupConfig(group);
    }

    // 3. Session counts + product code from the enrollment
    const enrollmentContext = await getEnrollmentContext(enrollmentId, requestId);
    const sessions = { coaching: enrollmentContext.coaching, skillBuilding: enrollmentContext.skillBuilding };

    // 4. Enrollment sequence
    const enrollmentSequence = await determineEnrollmentSequence(
      childId, enrollmentId, enrollmentContext.enrollmentType,
    );

    // 5. Referrer type
    const referrerType = mapLeadSourceToReferrerType(leadSource, leadSourceCoachId);

    // 6. Coach TDS cumulative
    const coachCumulativeThisYear = coach.tds_cumulative_fy || 0;

    // --- Call Calculator B ---
    const breakdown: EnrollmentBreakdown = calculateEnrollmentBreakdown(
      amount,
      sessions.coaching,
      sessions.skillBuilding,
      enrollmentSequence,
      referrerType,
      coachGroupConfig,
      coachCumulativeThisYear,
      config,
    );

    console.log(JSON.stringify({
      requestId,
      event: 'v2_breakdown_calculated',
      coachCost: breakdown.coach_cost_amount,
      skillBuildingCost: breakdown.skill_building_cost,
      platformFee: breakdown.actual_platform_fee,
      leadCost: breakdown.lead_cost.referrer_share_amount + breakdown.lead_cost.coaching_bonus_amount,
      tds: breakdown.tds_amount,
      enrollmentSequence,
      referrerType,
      coachingSessions: sessions.coaching,
      skillBuildingSessions: sessions.skillBuilding,
    }));

    // --- Write to enrollment_revenue ---
    const totalLeadCost = breakdown.lead_cost.referrer_share_amount + breakdown.lead_cost.coaching_bonus_amount;

    const { data: revenue, error: revError } = await supabase.from('enrollment_revenue').insert({
      enrollment_id: enrollmentId,
      coaching_coach_id: coach.id,
      lead_source: leadSource,
      lead_source_coach_id: leadSourceCoachId,
      referrer_id: leadSourceCoachId || null,
      total_amount: amount,
      lead_cost_amount: totalLeadCost,
      coach_cost_amount: breakdown.coach_cost_amount,
      platform_fee_amount: breakdown.actual_platform_fee,
      skill_building_cost: breakdown.skill_building_cost,
      coaching_rate_per_session: breakdown.per_session_rates.coaching_rate,
      skill_building_rate_per_session: breakdown.per_session_rates.skill_building_rate,
      enrollment_sequence: enrollmentSequence,
      re_enrollment_bonus: breakdown.reenrollment_bonus,
      lead_cost_decay_applied: breakdown.lead_cost.decay_applied,
      coaching_bonus_amount: breakdown.lead_cost.coaching_bonus_amount,
      tds_applicable: breakdown.tds_applicable,
      tds_rate_applied: breakdown.tds_applicable ? breakdown.tds_rate_applied : null,
      tds_amount: breakdown.tds_amount,
      net_to_coach: breakdown.net_to_coaching_coach,
      net_to_lead_source: breakdown.net_to_referrer,
      net_retained_by_platform: breakdown.net_to_platform,
      coach_group_id: coachGroupConfig.id,
      coach_group_name: coachGroupConfig.name,
      status: 'pending',
      config_snapshot: JSON.parse(JSON.stringify({
        group: coachGroupConfig,
        payout_config: {
          tds_rate_percent: config.tds_rate_percent,
          tds_threshold_annual: config.tds_threshold_annual,
          skill_building_rate_multiplier: config.skill_building_rate_multiplier,
          payout_day_of_month: config.payout_day_of_month,
        },
        sessions: { coaching: sessions.coaching, skill_building: sessions.skillBuilding },
        enrollment_sequence: enrollmentSequence,
        referrer_type: referrerType,
      })),
    }).select('id').single();

    if (revError) throw revError;

    // --- Schedule Payouts ---
    const now = new Date();
    const payoutDay = config.payout_day_of_month;
    const payoutRecords: CoachPayoutInsert[] = [];

    // Coaching payouts (monthly from coach_cost_amount, last month gets remainder)
    const monthlyCoachGross = Math.floor(breakdown.coach_cost_amount / durationMonths);
    const monthlyCoachTds = Math.floor(breakdown.tds_amount / durationMonths);

    for (let i = 1; i <= durationMonths; i++) {
      const isLast = i === durationMonths;
      const gross = isLast ? breakdown.coach_cost_amount - monthlyCoachGross * (durationMonths - 1) : monthlyCoachGross;
      const tds = isLast ? breakdown.tds_amount - monthlyCoachTds * (durationMonths - 1) : monthlyCoachTds;
      const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
      payoutRecords.push({
        enrollment_revenue_id: revenue.id,
        coach_id: coach.id,
        child_id: childId,
        child_name: childName,
        payout_month: i,
        payout_type: 'coach_cost',
        gross_amount: gross,
        tds_amount: tds,
        net_amount: gross - tds,
        scheduled_date: payoutDate.toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // Skill building payouts (monthly from skill_building_cost, last month gets remainder)
    if (breakdown.skill_building_cost > 0) {
      const monthlySBGross = Math.floor(breakdown.skill_building_cost / durationMonths);

      for (let i = 1; i <= durationMonths; i++) {
        const isLast = i === durationMonths;
        const gross = isLast ? breakdown.skill_building_cost - monthlySBGross * (durationMonths - 1) : monthlySBGross;
        const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
        payoutRecords.push({
          enrollment_revenue_id: revenue.id,
          coach_id: coach.id,
          child_id: childId,
          child_name: childName,
          payout_month: i,
          payout_type: 'skill_building',
          session_type: 'skill_building',
          gross_amount: gross,
          tds_amount: 0,
          net_amount: gross,
          scheduled_date: payoutDate.toISOString().split('T')[0],
          status: 'scheduled',
        });
      }
    }

    // Lead bonus payouts if referrer is a coach (last month gets remainder)
    if (breakdown.net_to_referrer > 0 && leadSourceCoachId) {
      const monthlyLeadGross = Math.floor(breakdown.net_to_referrer / durationMonths);

      for (let i = 1; i <= durationMonths; i++) {
        const isLast = i === durationMonths;
        const gross = isLast ? breakdown.net_to_referrer - monthlyLeadGross * (durationMonths - 1) : monthlyLeadGross;
        const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
        payoutRecords.push({
          enrollment_revenue_id: revenue.id,
          coach_id: leadSourceCoachId,
          child_id: childId,
          child_name: childName,
          payout_month: i,
          payout_type: 'lead_bonus',
          gross_amount: gross,
          tds_amount: 0,
          net_amount: gross,
          scheduled_date: payoutDate.toISOString().split('T')[0],
          status: 'scheduled',
        });
      }
    }

    // Re-enrollment bonus (one-time payout in month 1)
    if (breakdown.reenrollment_bonus > 0) {
      const payoutDate = new Date(now.getFullYear(), now.getMonth() + 1, payoutDay);
      payoutRecords.push({
        enrollment_revenue_id: revenue.id,
        coach_id: coach.id,
        child_id: childId,
        child_name: childName,
        payout_month: 1,
        payout_type: 'reenrollment_bonus',
        gross_amount: breakdown.reenrollment_bonus,
        tds_amount: 0,
        net_amount: breakdown.reenrollment_bonus,
        scheduled_date: payoutDate.toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // Batch insert payouts
    if (payoutRecords.length > 0) {
      const { error: payoutError } = await supabase.from('coach_payouts').insert(payoutRecords);
      if (payoutError) {
        console.error(JSON.stringify({ requestId, event: 'payout_insert_error', error: payoutError.message }));
      }
    }

    // Update Coach Cumulative TDS
    await supabase.from('coaches').update({
      tds_cumulative_fy: coachCumulativeThisYear + breakdown.coach_cost_amount,
      updated_at: new Date().toISOString(),
    }).eq('id', coach.id);

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_calculated',
      coachCost: breakdown.coach_cost_amount,
      skillBuildingCost: breakdown.skill_building_cost,
      platformFee: breakdown.actual_platform_fee,
      tds: breakdown.tds_amount,
      payouts: payoutRecords.length,
    }));

    return {
      success: true,
      enrollment_revenue_id: revenue.id,
      lead_cost: totalLeadCost,
      coach_cost: breakdown.coach_cost_amount,
      platform_fee: breakdown.actual_platform_fee,
      tds_amount: breakdown.tds_amount,
      net_to_coach: breakdown.net_to_coaching_coach,
      payouts_scheduled: payoutRecords.length,
    };

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'revenue_calc_error', error: error.message }));
    return { success: false, error: error.message };
  }
}
