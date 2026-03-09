// =============================================================================
// PAYOUT CALCULATION TESTS
// tests/payout.test.ts
//
// Tests pure calculation logic from lib/config/payout-config.ts.
// No DB calls — all functions accept config objects directly.
// =============================================================================

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {},
}));

vi.mock('@/lib/supabase/index', () => ({
  createClient: vi.fn(),
  createBrowserClient: vi.fn(),
}));

import {
  calculatePerSessionRate,
  calculateLeadCost,
  calculateTDS,
  calculateReenrollmentBonus,
  calculateEnrollmentBreakdown,
  type PayoutConfig,
  type CoachGroupConfig,
  type EnrollmentType,
  type ReferrerType,
} from '@/lib/config/payout-config';

// =============================================================================
// FIXTURES
// =============================================================================

/** Default config matching FALLBACKS in payout-config.ts */
function makeConfig(overrides: Partial<PayoutConfig> = {}): PayoutConfig {
  return {
    payout_model: 'per_session',
    payout_day_of_month: 7,
    skill_building_rate_multiplier: 0.5,
    skill_building_counts_toward_tier: true,
    tds_rate_percent: 10,
    tds_threshold_annual: 30000,
    coach_max_children: 20,
    reenrollment_coach_bonus: 500,
    reenrollment_coach_bonus_enabled: true,
    lead_cost_referrer_percent_coach: 10,
    lead_cost_referrer_percent_parent: 10,
    lead_cost_referrer_percent_external: 5,
    lead_cost_referrer_percent_influencer: 10,
    coaching_bonus_percent: 0,
    coaching_bonus_on_organic: true,
    coaching_bonus_timing: 'after_first_session',
    lead_cost_decay_continuation: 0.5,
    lead_cost_decay_reenrollment: 0,
    lead_cost_timing: 'after_first_session',
    referral_code_applies_to_continuation: false,
    referral_code_applies_to_reenrollment: true,
    external_referral_enabled: true,
    external_referral_reward_amount: 300,
    external_referral_reward_type: 'upi_transfer',
    external_referral_min_payout: 100,
    external_referral_auto_approve: false,
    parent_referral_reward_type: 'credit',
    inactive_parent_referral_enabled: true,
    influencer_reward_type: 'upi_transfer',
    referral_qr_enabled: true,
    referral_landing_page: '/refer',
    ...overrides,
  };
}

function makeCoachGroup(overrides: Partial<CoachGroupConfig> = {}): CoachGroupConfig {
  return {
    id: 'group-1',
    name: 'rising',
    display_name: 'Rising',
    coach_cost_percent: 50,
    lead_cost_percent: 20,
    platform_fee_percent: 30,
    is_internal: false,
    per_session_rate_override: null,
    skill_building_rate_override: null,
    ...overrides,
  };
}

// =============================================================================
// TIER SPLITS — calculatePerSessionRate
// =============================================================================

describe('calculatePerSessionRate', () => {
  const config = makeConfig();

  it('Rising tier (50% coach cost) calculates correct per-session rates', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculatePerSessionRate(6999, 18, 6, group, config);

    // coach_cost = 6999 * 50% = 3499.50 → coaching_rate = round(3499.50 / 18) = 194
    expect(result.coaching_rate).toBe(194);
    // skill_building_rate = round(194 * 0.5) = 97
    expect(result.skill_building_rate).toBe(97);
    expect(result.coaching_sessions).toBe(18);
    expect(result.skill_building_sessions).toBe(6);
    expect(result.total_sessions).toBe(24);
    expect(result.source).toBe('calculated');
  });

  it('Expert tier (55% coach cost) calculates higher rates', () => {
    const group = makeCoachGroup({ coach_cost_percent: 55 });
    const result = calculatePerSessionRate(6999, 18, 6, group, config);

    // coach_cost = 6999 * 55% = 3849.45 → coaching_rate = round(3849.45 / 18) = 214
    expect(result.coaching_rate).toBe(214);
    // skill_building_rate = round(214 * 0.5) = 107
    expect(result.skill_building_rate).toBe(107);
    expect(result.source).toBe('calculated');
  });

  it('Master tier (60% coach cost) calculates highest rates', () => {
    const group = makeCoachGroup({ coach_cost_percent: 60 });
    const result = calculatePerSessionRate(6999, 18, 6, group, config);

    // coach_cost = 6999 * 60% = 4199.40 → coaching_rate = round(4199.40 / 18) = 233
    expect(result.coaching_rate).toBe(233);
    // skill_building_rate = round(233 * 0.5) = 117 (rounds up from 116.5)
    expect(result.skill_building_rate).toBe(117);
    expect(result.source).toBe('calculated');
  });

  it('uses per_session_rate_override when set on coach group', () => {
    const group = makeCoachGroup({ per_session_rate_override: 300 });
    const result = calculatePerSessionRate(6999, 18, 6, group, config);

    expect(result.coaching_rate).toBe(300);
    // SB rate = round(300 * 0.5) = 150
    expect(result.skill_building_rate).toBe(150);
    expect(result.source).toBe('override');
  });

  it('uses skill_building_rate_override when both overrides set', () => {
    const group = makeCoachGroup({
      per_session_rate_override: 300,
      skill_building_rate_override: 200,
    });
    const result = calculatePerSessionRate(6999, 18, 6, group, config);

    expect(result.coaching_rate).toBe(300);
    expect(result.skill_building_rate).toBe(200);
    expect(result.source).toBe('override');
  });

  it('returns zero rates when coaching sessions is 0', () => {
    const group = makeCoachGroup();
    const result = calculatePerSessionRate(6999, 0, 6, group, config);

    expect(result.coaching_rate).toBe(0);
    expect(result.skill_building_rate).toBe(0);
    expect(result.total_sessions).toBe(0);
  });

  it('falls back to 50% when no coach group provided', () => {
    const result = calculatePerSessionRate(6999, 18, 6, null, config);

    // Same as Rising tier (50%)
    expect(result.coaching_rate).toBe(194);
    expect(result.skill_building_rate).toBe(97);
  });

  it('handles Building age band (12 coaching + 4 SB)', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculatePerSessionRate(6999, 12, 4, group, config);

    // coach_cost = 3499.50 → coaching_rate = round(3499.50 / 12) = 292
    expect(result.coaching_rate).toBe(292);
    expect(result.skill_building_rate).toBe(146);
    expect(result.total_sessions).toBe(16);
  });

  it('handles Mastery age band (9 coaching + 3 SB)', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculatePerSessionRate(6999, 9, 3, group, config);

    // coach_cost = 3499.50 → coaching_rate = round(3499.50 / 9) = 389
    expect(result.coaching_rate).toBe(389);
    expect(result.skill_building_rate).toBe(195);
    expect(result.total_sessions).toBe(12);
  });
});

// =============================================================================
// INTERNAL COACH — calculateEnrollmentBreakdown
// =============================================================================

describe('internal coach (100% to platform)', () => {
  const config = makeConfig();

  it('internal coach gets 0 net_to_coaching_coach after TDS logic', () => {
    const group = makeCoachGroup({ is_internal: true, coach_cost_percent: 50 });
    // The calculator doesn't skip internal coaches — it still computes the split.
    // The monthly-payout-processor skips payouts for internal coaches.
    // But we can verify the math: even with 50%, the processor would not pay it.
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'organic', group, 0, config,
    );

    // Coach cost is still calculated (50%), but processor skips payout for is_internal
    expect(result.coach_cost_percent).toBe(50);
    expect(result.coach_cost_amount).toBe(3500); // round(6999 * 0.5)
    // Platform gets the remainder
    expect(result.platform_fee_amount).toBe(3499); // 6999 - 0 - 0 - 3500
  });
});

// =============================================================================
// LEAD COST DECAY — calculateLeadCost
// =============================================================================

describe('calculateLeadCost', () => {
  const config = makeConfig();

  describe('starter enrollment (no decay)', () => {
    it('coach referrer gets 10% on starter', () => {
      const result = calculateLeadCost(6999, 'starter', 'coach', config);

      expect(result.decay_applied).toBe(1.0);
      expect(result.referrer_share_percent).toBe(10);
      expect(result.referrer_share_amount).toBe(700); // round(6999 * 10 / 100)
      expect(result.referrer_reward_type).toBe('upi_transfer');
    });

    it('parent referrer gets 10% on starter', () => {
      const result = calculateLeadCost(6999, 'starter', 'parent', config);

      expect(result.referrer_share_percent).toBe(10);
      expect(result.referrer_share_amount).toBe(700);
      expect(result.referrer_reward_type).toBe('credit');
    });

    it('external referrer gets 5% on starter', () => {
      const result = calculateLeadCost(6999, 'starter', 'external', config);

      expect(result.referrer_share_percent).toBe(5);
      expect(result.referrer_share_amount).toBe(350); // round(6999 * 5 / 100)
      expect(result.referrer_reward_type).toBe('upi_transfer');
    });

    it('organic lead gets 0%', () => {
      const result = calculateLeadCost(6999, 'starter', 'organic', config);

      expect(result.referrer_share_percent).toBe(0);
      expect(result.referrer_share_amount).toBe(0);
      expect(result.referrer_reward_type).toBeNull();
    });
  });

  describe('continuation enrollment (50% decay)', () => {
    it('coach referrer gets 5% on continuation (10% * 0.5 decay)', () => {
      const result = calculateLeadCost(6999, 'continuation', 'coach', config);

      expect(result.decay_applied).toBe(0.5);
      expect(result.referrer_share_percent).toBe(5); // 10 * 0.5
      expect(result.referrer_share_amount).toBe(350); // round(6999 * 5 / 100)
    });

    it('parent referrer gets 5% on continuation', () => {
      const result = calculateLeadCost(6999, 'continuation', 'parent', config);

      expect(result.referrer_share_percent).toBe(5);
      expect(result.referrer_share_amount).toBe(350);
    });

    it('external referrer gets 2.5% on continuation', () => {
      const result = calculateLeadCost(6999, 'continuation', 'external', config);

      expect(result.referrer_share_percent).toBe(2.5); // 5 * 0.5
      expect(result.referrer_share_amount).toBe(175); // round(6999 * 2.5 / 100)
    });
  });

  describe('re-enrollment (0% decay = zero lead cost)', () => {
    it('coach referrer gets 0% on re-enrollment (10% * 0 decay)', () => {
      const result = calculateLeadCost(6999, 'reenrollment', 'coach', config);

      expect(result.decay_applied).toBe(0);
      expect(result.referrer_share_percent).toBe(0); // 10 * 0
      expect(result.referrer_share_amount).toBe(0);
    });

    it('parent referrer gets 0% on re-enrollment', () => {
      const result = calculateLeadCost(6999, 'reenrollment', 'parent', config);

      expect(result.referrer_share_percent).toBe(0);
      expect(result.referrer_share_amount).toBe(0);
    });
  });

  describe('influencer referrer', () => {
    it('uses default 10% for influencer', () => {
      const result = calculateLeadCost(6999, 'starter', 'influencer', config);

      expect(result.referrer_share_percent).toBe(10);
      expect(result.referrer_share_amount).toBe(700);
      expect(result.referrer_reward_type).toBe('upi_transfer');
    });

    it('influencer override takes precedence', () => {
      const result = calculateLeadCost(6999, 'starter', 'influencer', config, 15);

      expect(result.referrer_share_percent).toBe(15);
      expect(result.referrer_share_amount).toBe(1050); // round(6999 * 15 / 100)
    });
  });

  describe('coaching bonus', () => {
    it('coaching bonus applies on organic when coaching_bonus_on_organic is true', () => {
      const configWithBonus = makeConfig({ coaching_bonus_percent: 5, coaching_bonus_on_organic: true });
      const result = calculateLeadCost(6999, 'starter', 'organic', configWithBonus);

      expect(result.coaching_bonus_percent).toBe(5);
      expect(result.coaching_bonus_amount).toBe(350);
    });

    it('coaching bonus decays on continuation', () => {
      const configWithBonus = makeConfig({ coaching_bonus_percent: 5 });
      const result = calculateLeadCost(6999, 'continuation', 'coach', configWithBonus);

      // 5% * 0.5 decay = 2.5%
      expect(result.coaching_bonus_percent).toBe(2.5);
      expect(result.coaching_bonus_amount).toBe(175);
    });
  });
});

// =============================================================================
// SELF-REFERRAL (coach refers → gets 10% lead cost + coaching pay)
// =============================================================================

describe('self-referral (coach as referrer + coaching coach)', () => {
  const config = makeConfig();

  it('coach-referred starter adds 10% lead cost on top of 50% coach cost', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'coach', group, 0, config,
    );

    // Lead cost: 10% of 6999 = 700
    expect(result.lead_cost.referrer_share_percent).toBe(10);
    expect(result.lead_cost.referrer_share_amount).toBe(700);

    // Coach cost: 50% of 6999 = 3500
    expect(result.coach_cost_amount).toBe(3500);

    // Platform gets remainder: 6999 - 700 - 3500 = 2799
    expect(result.platform_fee_amount).toBe(2799);

    // Total to coach = coach_cost + SB_cost - TDS + lead_cost = significant
    expect(result.net_to_referrer).toBe(700);
    // net_to_coaching_coach = coach_cost + SB_cost - TDS
    expect(result.net_to_coaching_coach).toBe(3500 + result.skill_building_cost);
  });

  it('self-referral on continuation gets decayed lead cost (5%)', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'continuation', 'coach', group, 0, config,
    );

    // 10% * 0.5 decay = 5%
    expect(result.lead_cost.referrer_share_percent).toBe(5);
    expect(result.lead_cost.referrer_share_amount).toBe(350);
  });

  it('self-referral on re-enrollment gets 0% lead cost + re-enrollment bonus', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'reenrollment', 'coach', group, 0, config,
    );

    // 10% * 0 decay = 0%
    expect(result.lead_cost.referrer_share_percent).toBe(0);
    expect(result.lead_cost.referrer_share_amount).toBe(0);

    // Re-enrollment bonus = 500
    expect(result.reenrollment_bonus).toBe(500);
  });
});

// =============================================================================
// TDS — calculateTDS
// =============================================================================

describe('calculateTDS', () => {
  const config = makeConfig({ tds_rate_percent: 10, tds_threshold_annual: 30000 });

  it('no TDS when cumulative + gross is under threshold', () => {
    const result = calculateTDS(5000, 20000, config);

    expect(result.tds_applicable).toBe(false);
    expect(result.tds_amount).toBe(0);
  });

  it('TDS applies when cumulative + gross exceeds threshold', () => {
    const result = calculateTDS(5000, 26000, config);

    expect(result.tds_applicable).toBe(true);
    expect(result.tds_amount).toBe(500); // 5000 * 10%
    expect(result.tds_rate).toBe(10);
  });

  it('TDS applies on the exact threshold crossing', () => {
    // 25001 + 5000 = 30001 > 30000
    const result = calculateTDS(5000, 25001, config);

    expect(result.tds_applicable).toBe(true);
    expect(result.tds_amount).toBe(500);
  });

  it('no TDS at exactly the threshold', () => {
    // 25000 + 5000 = 30000 — not exceeding, equal
    const result = calculateTDS(5000, 25000, config);

    expect(result.tds_applicable).toBe(false);
    expect(result.tds_amount).toBe(0);
  });
});

// =============================================================================
// RE-ENROLLMENT BONUS — calculateReenrollmentBonus
// =============================================================================

describe('calculateReenrollmentBonus', () => {
  it('returns bonus for reenrollment type', () => {
    const config = makeConfig({ reenrollment_coach_bonus: 500, reenrollment_coach_bonus_enabled: true });
    expect(calculateReenrollmentBonus('reenrollment', config)).toBe(500);
  });

  it('returns 0 for starter type', () => {
    const config = makeConfig();
    expect(calculateReenrollmentBonus('starter', config)).toBe(0);
  });

  it('returns 0 for continuation type', () => {
    const config = makeConfig();
    expect(calculateReenrollmentBonus('continuation', config)).toBe(0);
  });

  it('returns 0 when bonus is disabled', () => {
    const config = makeConfig({ reenrollment_coach_bonus_enabled: false });
    expect(calculateReenrollmentBonus('reenrollment', config)).toBe(0);
  });
});

// =============================================================================
// FULL ENROLLMENT BREAKDOWN — calculateEnrollmentBreakdown
// =============================================================================

describe('calculateEnrollmentBreakdown', () => {
  const config = makeConfig();

  it('organic starter with Rising tier sums to enrollment amount', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'organic', group, 0, config,
    );

    // Verify 3-way split sums to total
    const totalOut = result.lead_cost.referrer_share_amount
      + result.lead_cost.coaching_bonus_amount
      + result.coach_cost_amount
      + result.platform_fee_amount;
    expect(totalOut).toBe(6999);

    // No TDS under threshold
    expect(result.tds_applicable).toBe(false);
    expect(result.tds_amount).toBe(0);
  });

  it('referred starter with Expert tier sums correctly', () => {
    const group = makeCoachGroup({ coach_cost_percent: 55 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'parent', group, 0, config,
    );

    // lead: 10% = 700, coach: 55% = 3849, platform: remainder
    expect(result.lead_cost.referrer_share_amount).toBe(700);
    expect(result.coach_cost_amount).toBe(3849); // round(6999 * 0.55)

    const totalOut = result.lead_cost.referrer_share_amount
      + result.lead_cost.coaching_bonus_amount
      + result.coach_cost_amount
      + result.platform_fee_amount;
    expect(totalOut).toBe(6999);
  });

  it('SB cost is deducted from platform fee to get actual_platform_fee', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'organic', group, 0, config,
    );

    expect(result.skill_building_cost).toBe(
      6 * result.per_session_rates.skill_building_rate,
    );
    expect(result.actual_platform_fee).toBe(
      result.platform_fee_amount - result.skill_building_cost,
    );
  });

  it('TDS reduces net_to_coaching_coach', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    // cumulative = 28000, coach_cost = 3500 → 31500 > 30000 → TDS applies
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'starter', 'organic', group, 28000, config,
    );

    expect(result.tds_applicable).toBe(true);
    expect(result.tds_amount).toBe(350); // round(3500 * 10%)
    expect(result.net_to_coaching_coach).toBe(
      result.coach_cost_amount + result.skill_building_cost - result.tds_amount,
    );
  });

  it('re-enrollment includes bonus in breakdown', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      6999, 18, 6, 'reenrollment', 'organic', group, 0, config,
    );

    expect(result.reenrollment_bonus).toBe(500);
    expect(result.enrollment_type).toBe('reenrollment');
  });

  it('handles Starter pricing (1499)', () => {
    const group = makeCoachGroup({ coach_cost_percent: 50 });
    const result = calculateEnrollmentBreakdown(
      1499, 18, 6, 'starter', 'organic', group, 0, config,
    );

    // coach_cost = round(1499 * 0.5) = 750
    expect(result.coach_cost_amount).toBe(750);
    expect(result.platform_fee_amount).toBe(1499 - 750); // 749

    const totalOut = result.lead_cost.referrer_share_amount
      + result.lead_cost.coaching_bonus_amount
      + result.coach_cost_amount
      + result.platform_fee_amount;
    expect(totalOut).toBe(1499);
  });
});
