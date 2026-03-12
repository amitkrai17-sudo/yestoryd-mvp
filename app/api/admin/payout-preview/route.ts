// =============================================================================
// FILE: app/api/admin/payout-preview/route.ts
// PURPOSE: Admin-only payout scenario preview with 4 comparison views
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  loadPayoutConfig,
  calculateEnrollmentBreakdown,
  type ReferrerType,
  type EnrollmentType,
  type CoachGroupConfig,
} from '@/lib/config/payout-config';
import { getPricingConfig, getSessionCount, getBoosterCredits } from '@/lib/config/pricing-config';

export const dynamic = 'force-dynamic';

const REFERRER_TYPES: (ReferrerType | 'organic')[] = ['coach', 'parent', 'external', 'influencer', 'organic'];
const ENROLLMENT_TYPES: EnrollmentType[] = ['starter', 'continuation', 'reenrollment'];

// Map user-facing plan param to pricing_plans slug
const PLAN_SLUG_MAP: Record<string, string> = {
  starter: 'starter',
  continuation: 'continuation',
  full_program: 'full',
  full: 'full',
};

const VALID_AGE_BANDS = ['foundation', 'building', 'mastery'];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentType = (searchParams.get('enrollment_type') || 'starter') as EnrollmentType;
    const referrerType = (searchParams.get('referrer_type') || 'organic') as ReferrerType | 'organic';
    const coachGroupName = searchParams.get('coach_group') || 'rising';
    const coachCumulative = Number(searchParams.get('coach_cumulative')) || 0;

    // Resolve amount + sessions: plan+age_band take priority over manual params
    const planParam = searchParams.get('plan');
    const ageBandParam = searchParams.get('age_band');
    const manualAmount = searchParams.get('amount') ? Number(searchParams.get('amount')) : null;
    const manualSessions = searchParams.get('sessions') ? Number(searchParams.get('sessions')) : null;

    let amount: number;
    let coachingSessions: number;
    let skillBuildingSessions: number;
    let resolvedFrom: 'plan' | 'manual' = 'manual';

    if (planParam && ageBandParam) {
      const tierSlug = PLAN_SLUG_MAP[planParam];
      if (!tierSlug) {
        return NextResponse.json(
          { error: `Invalid plan: ${planParam}. Use: starter, continuation, full_program` },
          { status: 400 },
        );
      }
      if (!VALID_AGE_BANDS.includes(ageBandParam)) {
        return NextResponse.json(
          { error: `Invalid age_band: ${ageBandParam}. Use: foundation, building, mastery` },
          { status: 400 },
        );
      }

      const pricingConfig = await getPricingConfig();
      const tier = pricingConfig.tiers.find(t => t.slug === tierSlug);
      if (!tier) {
        return NextResponse.json({ error: `Pricing tier "${tierSlug}" not found` }, { status: 404 });
      }

      amount = tier.discountedPrice;
      coachingSessions = getSessionCount(pricingConfig, ageBandParam, tierSlug);
      skillBuildingSessions = getBoosterCredits(pricingConfig, ageBandParam, tierSlug);
      if (coachingSessions <= 0) coachingSessions = 12; // safety fallback
      resolvedFrom = 'plan';
    } else {
      if (!manualAmount) {
        const fallbackConfig = await getPricingConfig();
        const fallbackTier = fallbackConfig.tiers.find(t => t.slug === 'full') || fallbackConfig.tiers[fallbackConfig.tiers.length - 1];
        amount = fallbackTier?.discountedPrice || 0;
      } else {
        amount = manualAmount;
      }
      coachingSessions = manualSessions || 12;
      skillBuildingSessions = Number(searchParams.get('skill_building_sessions')) || 0;
    }

    const config = await loadPayoutConfig();

    // Load all active coach groups
    const { data: allGroups } = await supabaseAdmin
      .from('coach_groups')
      .select('id, name, display_name, coach_cost_percent, lead_cost_percent, platform_fee_percent, is_internal, per_session_rate_override, skill_building_rate_override')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const groups: CoachGroupConfig[] = (allGroups || []).map(g => ({
      id: g.id,
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: Number(g.coach_cost_percent) || 50,
      lead_cost_percent: Number(g.lead_cost_percent) || 20,
      platform_fee_percent: Number(g.platform_fee_percent) || 30,
      is_internal: !!g.is_internal,
      per_session_rate_override: g.per_session_rate_override != null ? Number(g.per_session_rate_override) : null,
      skill_building_rate_override: g.skill_building_rate_override != null ? Number(g.skill_building_rate_override) : null,
    }));

    const nonInternalGroups = groups.filter(g => !g.is_internal);
    const requestedGroup = groups.find(g => g.name === coachGroupName) || nonInternalGroups[0] || null;

    // ── View 1: Full breakdown for requested scenario ──
    const breakdown = calculateEnrollmentBreakdown(
      amount, coachingSessions, skillBuildingSessions, enrollmentType, referrerType, requestedGroup, coachCumulative, config,
    );

    // ── View 2: Referrer comparison (all types, same tier) ──
    const referrer_comparison = REFERRER_TYPES.map(rt => ({
      referrer_type: rt,
      ...calculateEnrollmentBreakdown(amount, coachingSessions, skillBuildingSessions, enrollmentType, rt, requestedGroup, coachCumulative, config),
    }));

    // ── View 3: Tier comparison (all groups, same referrer) ──
    const tier_comparison = nonInternalGroups.map(group => ({
      tier: group.name,
      display_name: group.display_name,
      ...calculateEnrollmentBreakdown(amount, coachingSessions, skillBuildingSessions, enrollmentType, referrerType, group, coachCumulative, config),
    }));

    // ── View 4: Decay comparison (starter/continuation/reenrollment) ──
    const decay_comparison = ENROLLMENT_TYPES.map(et =>
      calculateEnrollmentBreakdown(amount, coachingSessions, skillBuildingSessions, et, referrerType, requestedGroup, coachCumulative, config),
    );

    return NextResponse.json({
      success: true,
      params: {
        amount,
        coaching_sessions: coachingSessions,
        skill_building_sessions: skillBuildingSessions,
        total_sessions: coachingSessions + skillBuildingSessions,
        resolved_from: resolvedFrom,
        plan: planParam || null,
        age_band: ageBandParam || null,
        enrollment_type: enrollmentType,
        referrer_type: referrerType,
        coach_group: coachGroupName,
        coach_cumulative: coachCumulative,
      },
      breakdown,
      referrer_comparison,
      tier_comparison,
      decay_comparison,
      config_snapshot: config,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[payout-preview] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
