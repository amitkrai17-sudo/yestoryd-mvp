// app/api/coach/earnings-summary/route.ts
// Single Source of Truth for Coach Earnings
// Uses V2 revenue model: coach_groups + payout-config.ts + calculatePerSessionRate()

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadCoachGroup,
  loadPayoutConfig,
  calculatePerSessionRate,
} from '@/lib/config/payout-config';
import { getPricingConfig } from '@/lib/config/pricing-config';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export interface EarningsSummary {
  totalEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  totalStudents: number;
  yestorydLeads: number;
  coachLeads: number;
}

export interface EarningDetail {
  id: string;
  child_name: string;
  parent_name: string;
  enrollment_date: string;
  program_fee: number;
  coach_amount: number;
  yestoryd_amount: number;
  coach_percent: number;
  lead_referral_amount: number;
  split_type: string;
  lead_source: string;
  status: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const coachEmail = url.searchParams.get('email');

    if (!coachEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get coach data
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, group_id')
      .eq('email', coachEmail)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Load V2 split config + age band config in parallel
    const [coachGroup, payoutConfig, { data: ageBandRows }] = await Promise.all([
      loadCoachGroup(coach.id),
      loadPayoutConfig(),
      supabase
        .from('age_band_config')
        .select('id, sessions_per_season, skill_booster_credits'),
    ]);

    // Build age_band → session counts map
    const ageBandMap = new Map<string, { coaching: number; sb: number }>();
    for (const row of ageBandRows || []) {
      ageBandMap.set(row.id, {
        coaching: row.sessions_per_season || 18,
        sb: row.skill_booster_credits || 6,
      });
    }
    // Foundation fallback
    const FALLBACK_SESSIONS = { coaching: 18, sb: 6 };

    const coachCostPercent = coachGroup?.coach_cost_percent ?? 50;
    const leadReferralPercent = payoutConfig.lead_cost_referrer_percent_coach;

    // Get enrollments with age_band (single source of truth)
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        amount,
        age_band,
        lead_source,
        created_at,
        child:children (
          id,
          child_name,
          parent_name,
          custom_coach_split
        )
      `)
      .eq('coach_id', coach.id)
      .in('status', ['active', 'pending_start', 'completed'])
      .order('created_at', { ascending: false });

    // Calculate earnings per enrollment using V2 per-session model
    const earnings: EarningDetail[] = (enrollments || []).map((enrollment) => {
      const child = enrollment.child as any;
      if (!child) return null;

      const programFee = enrollment.amount || 0;
      const isCoachLead = enrollment.lead_source === 'coach';

      // Get session counts from enrollment's age_band
      const band = ageBandMap.get(enrollment.age_band || '') || FALLBACK_SESSIONS;

      let coachAmount: number;
      let effectivePercent: number;
      let leadReferralAmount = 0;
      let splitType: string;

      if (child.custom_coach_split) {
        // Custom split: flat percentage (legacy)
        coachAmount = Math.round(programFee * child.custom_coach_split / 100);
        effectivePercent = child.custom_coach_split;
        splitType = 'custom';
      } else {
        // V2 model: per-session rates (same math as CoachTierCard + payout-config.ts)
        const rates = calculatePerSessionRate(
          programFee,
          band.coaching,
          band.sb,
          coachGroup,
          payoutConfig,
        );

        const coachingTotal = rates.coaching_rate * rates.coaching_sessions;
        const skillBuildingTotal = rates.skill_building_rate * rates.skill_building_sessions;
        coachAmount = coachingTotal + skillBuildingTotal;
        effectivePercent = programFee > 0 ? Math.round(coachAmount / programFee * 100) : 0;

        if (isCoachLead) {
          leadReferralAmount = Math.round(programFee * leadReferralPercent / 100);
          coachAmount += leadReferralAmount;
          effectivePercent = programFee > 0 ? Math.round(coachAmount / programFee * 100) : 0;
          splitType = 'coach_lead';
        } else {
          splitType = 'default';
        }
      }

      const yestorydAmount = programFee - coachAmount;

      return {
        id: enrollment.id,
        child_name: child.child_name || 'Unknown',
        parent_name: child.parent_name || 'Unknown',
        enrollment_date: enrollment.created_at,
        program_fee: programFee,
        coach_amount: coachAmount,
        yestoryd_amount: yestorydAmount,
        coach_percent: effectivePercent,
        lead_referral_amount: leadReferralAmount,
        split_type: splitType,
        lead_source: enrollment.lead_source || 'yestoryd',
        status: enrollment.status === 'active' ? 'paid' : 'pending',
      };
    }).filter(Boolean) as EarningDetail[];

    // Calculate summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalEarnings = earnings.reduce((sum, e) => sum + e.coach_amount, 0);

    const thisMonthEarnings = earnings
      .filter((e) => new Date(e.enrollment_date) >= startOfMonth)
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const lastMonthEarnings = earnings
      .filter((e) => {
        const date = new Date(e.enrollment_date);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      })
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const pendingEarnings = earnings
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const paidEarnings = earnings
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const yestorydLeads = earnings.filter((e) => e.lead_source !== 'coach').length;
    const coachLeads = earnings.filter((e) => e.lead_source === 'coach').length;

    const summary: EarningsSummary = {
      totalEarnings,
      thisMonthEarnings,
      lastMonthEarnings,
      pendingEarnings,
      paidEarnings,
      totalStudents: earnings.length,
      yestorydLeads,
      coachLeads,
    };

    // Compute representative effective percentages (Foundation band, Full Program)
    // Same calculation as CoachTierCard for header display
    const pricingConfig = await getPricingConfig();
    const fullTier = pricingConfig.tiers.find((t) => t.slug === 'full');
    const representativeAmount = fullTier?.discountedPrice || pricingConfig.tiers[0]?.discountedPrice || 0;
    const foundationBand = ageBandMap.get('foundation') || FALLBACK_SESSIONS;
    const representativeRates = calculatePerSessionRate(
      representativeAmount,
      foundationBand.coaching,
      foundationBand.sb,
      coachGroup,
      payoutConfig,
    );
    const repCoachingTotal = representativeRates.coaching_rate * representativeRates.coaching_sessions;
    const repSbTotal = representativeRates.skill_building_rate * representativeRates.skill_building_sessions;
    const repCoachEarnings = repCoachingTotal + repSbTotal;
    const repLeadAmount = Math.round(representativeAmount * leadReferralPercent / 100);
    const effectivePercent = Math.round(repCoachEarnings / representativeAmount * 100);
    const effectivePercentWithLead = Math.round((repCoachEarnings + repLeadAmount) / representativeAmount * 100);

    return NextResponse.json({
      summary,
      earnings,
      splits: {
        coachCostPercent,
        leadReferralPercent,
        // Effective percentages (accounting for per-session rates + skill building)
        effectivePercent,
        effectivePercentWithLead,
        groupName: coachGroup?.display_name || 'Standard',
      },
    });
  } catch (error) {
    console.error('Earnings summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
