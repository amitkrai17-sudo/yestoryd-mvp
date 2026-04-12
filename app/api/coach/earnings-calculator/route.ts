import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadPayoutConfig,
  calculatePerSessionRate,
  calculateEnrollmentBreakdown,
  getTuitionCoachPercent,
  type CoachGroupConfig,
  type PayoutConfig,
} from '@/lib/config/payout-config';

const supabase = createAdminClient();
export const dynamic = 'force-dynamic';

// ============================================================
// TYPES — V1 (legacy, kept for backward compat)
// ============================================================

interface RevenueConfig {
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
}

interface ProductEarnings {
  name: string;
  slug: string;
  price: number;
  sessions: number;
  coach_earnings_own_lead: number;
  coach_earnings_platform_lead: number;
  per_session_own_lead: number;
  per_session_platform_lead: number;
}

interface EarningsResponse {
  success: boolean;
  products: ProductEarnings[];
  split_config: {
    lead_cost_percent: number;
    coach_cost_percent: number;
    platform_fee_percent: number;
    own_lead_total_percent: number;
  };
  scenarios: {
    students_per_month: number[];
    earnings: number[];
  };
  cached_at: string;
}

// ============================================================
// TYPES — V2 (tier-based, uses payout-config.ts)
// ============================================================

interface TierRates {
  name: string;
  display_name: string;
  coach_cost_percent: number;
  min_children_threshold: number;
  badge_color: string;
  sort_order: number;
  coaching_rate: number;
  skill_building_rate: number;
  rate_source: 'override' | 'calculated';
}

interface TiersResponse {
  success: boolean;
  mode: 'tiers';
  tiers: TierRates[];
  pricing: {
    program_price: number;
    plan_name: string;
  };
  age_band: {
    id: string;
    coaching_sessions: number;
    skill_building_sessions: number;
    sessions_per_week: number;
  };
  referral: {
    coach_referral_percent: number;
    bonus_per_enrollment: number;
  };
  payout_day: number;
  skill_building_rate_multiplier: number;
  cached_at: string;
}

// ============================================================
// CONFIG
// ============================================================

const CACHE_TTL_SECONDS = 300;

// ============================================================
// HELPERS
// ============================================================

function generateRequestId(): string {
  return `earn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateEarnings(price: number, sessions: number, config: RevenueConfig) {
  const ownLeadPercent = config.lead_cost_percent + config.coach_cost_percent;
  const platformLeadPercent = config.coach_cost_percent;

  const own_lead = Math.round(price * ownLeadPercent / 100);
  const platform_lead = Math.round(price * platformLeadPercent / 100);

  return {
    own_lead,
    platform_lead,
    per_session_own: sessions > 0 ? Math.round(own_lead / sessions) : 0,
    per_session_platform: sessions > 0 ? Math.round(platform_lead / sessions) : 0,
  };
}

// ============================================================
// V2 HANDLER — ?mode=tiers
// Uses payout-config.ts calculatePerSessionRate() as single calculator.
// ============================================================

async function handleTiersMode(requestId: string, startTime: number, ageBand: string) {
  // Load payout config (single source of truth)
  const payoutConfig = await loadPayoutConfig();

  // Parallel DB fetches for coach groups, pricing, and age band
  const [groupsResult, pricingResult, bandResult] = await Promise.all([
    supabase
      .from('coach_groups')
      .select('id, name, display_name, coach_cost_percent, lead_cost_percent, platform_fee_percent, is_internal, per_session_rate_override, skill_building_rate_override, badge_color, sort_order, min_children_threshold')
      .eq('is_internal', false)
      .in('name', ['rising', 'expert', 'master'])
      .order('sort_order'),
    supabase
      .from('pricing_plans')
      .select('name, discounted_price')
      .eq('is_active', true)
      .eq('slug', 'full')
      .single(),
    supabase
      .from('age_band_config')
      .select('id, sessions_per_season, skill_booster_credits, sessions_per_week')
      .eq('id', ageBand)
      .single(),
  ]);

  if (groupsResult.error || !groupsResult.data?.length) {
    return NextResponse.json(
      { success: false, error: 'Coach groups unavailable' },
      { status: 503 },
    );
  }
  if (pricingResult.error || !pricingResult.data) {
    return NextResponse.json(
      { success: false, error: 'Pricing unavailable' },
      { status: 503 },
    );
  }
  if (bandResult.error || !bandResult.data) {
    return NextResponse.json(
      { success: false, error: `Age band '${ageBand}' not found` },
      { status: 404 },
    );
  }

  const price = Number(pricingResult.data.discounted_price) || 0;
  const coachingSessions = Number(bandResult.data.sessions_per_season) || 12;
  const sbSessions = Number(bandResult.data.skill_booster_credits) || 4;
  const sessionsPerWeek = parseFloat(String(bandResult.data.sessions_per_week ?? '1')) || 1;

  // Calculate per-session rates for each tier using payout-config.ts
  const tiers: TierRates[] = groupsResult.data.map((g: any) => {
    const groupConfig: CoachGroupConfig = {
      id: g.id,
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: Number(g.coach_cost_percent) || 50,
      lead_cost_percent: Number(g.lead_cost_percent) || 0,
      platform_fee_percent: Number(g.platform_fee_percent) || 30,
      is_internal: false,
      per_session_rate_override: g.per_session_rate_override != null ? Number(g.per_session_rate_override) : null,
      skill_building_rate_override: g.skill_building_rate_override != null ? Number(g.skill_building_rate_override) : null,
    };

    // Single source of truth: payout-config.ts calculatePerSessionRate()
    const rates = calculatePerSessionRate(
      price,
      coachingSessions,
      sbSessions,
      groupConfig,
      payoutConfig,
    );

    return {
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: groupConfig.coach_cost_percent,
      min_children_threshold: Number(g.min_children_threshold) || 0,
      badge_color: g.badge_color || '',
      sort_order: Number(g.sort_order) || 0,
      coaching_rate: rates.coaching_rate,
      skill_building_rate: rates.skill_building_rate,
      rate_source: rates.source,
    };
  });

  const response: TiersResponse = {
    success: true,
    mode: 'tiers',
    tiers,
    pricing: {
      program_price: price,
      plan_name: pricingResult.data.name,
    },
    age_band: {
      id: ageBand,
      coaching_sessions: coachingSessions,
      skill_building_sessions: sbSessions,
      sessions_per_week: sessionsPerWeek,
    },
    referral: {
      coach_referral_percent: payoutConfig.lead_cost_referrer_percent_coach,
      bonus_per_enrollment: Math.round(price * payoutConfig.lead_cost_referrer_percent_coach / 100),
    },
    payout_day: payoutConfig.payout_day_of_month,
    skill_building_rate_multiplier: payoutConfig.skill_building_rate_multiplier,
    cached_at: new Date().toISOString(),
  };

  console.log(JSON.stringify({
    requestId,
    event: 'earnings_calculator_tiers_complete',
    duration: `${Date.now() - startTime}ms`,
    tiersCount: tiers.length,
    ageBand,
  }));

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
    },
  });
}

// ============================================================
// V3 HANDLER — ?mode=all-products
// Returns coaching + tuition + workshop earnings in a single payload.
// All monetary math delegated to Calculator B (payout-config.ts).
// ============================================================

interface TuitionTierSample {
  name: string;
  display_name: string;
  coach_cost_percent: number;
  min_children_threshold: number;
  individual_per_session: number;   // midpoint hourly × 1hr × coach_percent
  batch_per_session: number;         // same but batch rate
}

interface AllProductsResponse {
  success: boolean;
  mode: 'all-products';
  coaching: TiersResponse;
  tuition: {
    lead_cost_percent: number;
    default_session_duration_minutes: number;
    guardrails: {
      individual: { min: number; max: number; warn_low: number; warn_high: number; midpoint: number };
      batch:      { min: number; max: number; warn_low: number; warn_high: number; midpoint: number };
    };
    tiers: TuitionTierSample[];
    payout_trigger: string;
  };
  workshop: {
    default_coach_percent: number;
    lead_cost_percent: number;
    example_class_size: number;
    example_per_child_fee: number;
    example_session_fee: number;
    example_coach_earnings: number;
  };
  payout_day: number;
  cached_at: string;
}

function tuitionSample(
  hourlyRate: number,
  coachPercent: number,
  config: PayoutConfig,
  tierName: string,
): number {
  // 1-hour session at the given hourly rate. Use Calculator B with productType='tuition'.
  const groupConfig: CoachGroupConfig = {
    id: tierName,
    name: tierName,
    display_name: tierName,
    coach_cost_percent: coachPercent,
    lead_cost_percent: config.tuition_lead_cost_percent,
    platform_fee_percent: 100 - coachPercent - config.tuition_lead_cost_percent,
    is_internal: false,
    per_session_rate_override: null,
    skill_building_rate_override: null,
  };
  const breakdown = calculateEnrollmentBreakdown(
    hourlyRate,
    1,
    0,
    'starter',
    'organic',
    groupConfig,
    0,
    config,
    undefined,
    'tuition',
  );
  return breakdown.coach_cost_amount;
}

async function handleAllProductsMode(requestId: string, startTime: number, ageBand: string) {
  // Reuse tiers handler's response payload for coaching by calling its logic inline.
  // We call the tiers helper via a direct invocation, but since it returns a NextResponse,
  // we reimplement the data fetch here once and build both coaching + other-product views.

  const payoutConfig = await loadPayoutConfig();

  const [groupsResult, pricingResult, bandResult] = await Promise.all([
    supabase
      .from('coach_groups')
      .select('id, name, display_name, coach_cost_percent, lead_cost_percent, platform_fee_percent, is_internal, per_session_rate_override, skill_building_rate_override, badge_color, sort_order, min_children_threshold')
      .eq('is_internal', false)
      .in('name', ['rising', 'expert', 'master'])
      .order('sort_order'),
    supabase
      .from('pricing_plans')
      .select('name, discounted_price')
      .eq('is_active', true)
      .eq('slug', 'full')
      .single(),
    supabase
      .from('age_band_config')
      .select('id, sessions_per_season, skill_booster_credits, sessions_per_week')
      .eq('id', ageBand)
      .single(),
  ]);

  if (groupsResult.error || !groupsResult.data?.length) {
    return NextResponse.json({ success: false, error: 'Coach groups unavailable' }, { status: 503 });
  }
  if (pricingResult.error || !pricingResult.data) {
    return NextResponse.json({ success: false, error: 'Pricing unavailable' }, { status: 503 });
  }
  if (bandResult.error || !bandResult.data) {
    return NextResponse.json({ success: false, error: `Age band '${ageBand}' not found` }, { status: 404 });
  }

  const price = Number(pricingResult.data.discounted_price) || 0;
  const coachingSessions = Number(bandResult.data.sessions_per_season) || 12;
  const sbSessions = Number(bandResult.data.skill_booster_credits) || 4;
  const sessionsPerWeek = parseFloat(String(bandResult.data.sessions_per_week ?? '1')) || 1;

  // ── COACHING (same shape as handleTiersMode) ─────────────────
  const coachingTiers: TierRates[] = groupsResult.data.map((g: any) => {
    const groupConfig: CoachGroupConfig = {
      id: g.id,
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: Number(g.coach_cost_percent) || 50,
      lead_cost_percent: Number(g.lead_cost_percent) || 0,
      platform_fee_percent: Number(g.platform_fee_percent) || 30,
      is_internal: false,
      per_session_rate_override: g.per_session_rate_override != null ? Number(g.per_session_rate_override) : null,
      skill_building_rate_override: g.skill_building_rate_override != null ? Number(g.skill_building_rate_override) : null,
    };
    const rates = calculatePerSessionRate(price, coachingSessions, sbSessions, groupConfig, payoutConfig);
    return {
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: groupConfig.coach_cost_percent,
      min_children_threshold: Number(g.min_children_threshold) || 0,
      badge_color: g.badge_color || '',
      sort_order: Number(g.sort_order) || 0,
      coaching_rate: rates.coaching_rate,
      skill_building_rate: rates.skill_building_rate,
      rate_source: rates.source,
    };
  });

  const coaching: TiersResponse = {
    success: true,
    mode: 'tiers',
    tiers: coachingTiers,
    pricing: { program_price: price, plan_name: pricingResult.data.name },
    age_band: {
      id: ageBand,
      coaching_sessions: coachingSessions,
      skill_building_sessions: sbSessions,
      sessions_per_week: sessionsPerWeek,
    },
    referral: {
      coach_referral_percent: payoutConfig.lead_cost_referrer_percent_coach,
      bonus_per_enrollment: Math.round(price * payoutConfig.lead_cost_referrer_percent_coach / 100),
    },
    payout_day: payoutConfig.payout_day_of_month,
    skill_building_rate_multiplier: payoutConfig.skill_building_rate_multiplier,
    cached_at: new Date().toISOString(),
  };

  // ── TUITION ──────────────────────────────────────────────────
  const indMid = Math.round((payoutConfig.tuition_rate_warn_low_individual + payoutConfig.tuition_rate_warn_high_individual) / 2);
  const batchMid = Math.round((payoutConfig.tuition_rate_warn_low_batch + payoutConfig.tuition_rate_warn_high_batch) / 2);

  const tuitionTiers: TuitionTierSample[] = groupsResult.data.map((g: any) => {
    const coachPct = getTuitionCoachPercent(g.name, payoutConfig);
    return {
      name: g.name,
      display_name: g.display_name || g.name,
      coach_cost_percent: coachPct,
      min_children_threshold: Number(g.min_children_threshold) || 0,
      individual_per_session: tuitionSample(indMid, coachPct, payoutConfig, g.name),
      batch_per_session: tuitionSample(batchMid, coachPct, payoutConfig, g.name),
    };
  });

  // ── WORKSHOP ─────────────────────────────────────────────────
  // Sample: 8 students × batch-midpoint per-child fee (per hour) for 1 hour
  const exampleClassSize = 8;
  const exampleSessionFee = batchMid * exampleClassSize;
  const workshopGroupConfig: CoachGroupConfig = {
    id: 'workshop',
    name: 'workshop',
    display_name: 'workshop',
    coach_cost_percent: payoutConfig.workshop_default_coach_percent,
    lead_cost_percent: payoutConfig.workshop_lead_cost_percent,
    platform_fee_percent: 100 - payoutConfig.workshop_default_coach_percent - payoutConfig.workshop_lead_cost_percent,
    is_internal: false,
    per_session_rate_override: null,
    skill_building_rate_override: null,
  };
  const workshopBreakdown = calculateEnrollmentBreakdown(
    exampleSessionFee, 1, 0, 'starter', 'organic', workshopGroupConfig, 0, payoutConfig, undefined, 'workshop',
  );

  const response: AllProductsResponse = {
    success: true,
    mode: 'all-products',
    coaching,
    tuition: {
      lead_cost_percent: payoutConfig.tuition_lead_cost_percent,
      default_session_duration_minutes: 60,
      guardrails: {
        individual: {
          min: payoutConfig.tuition_rate_min_individual_per_hour,
          max: payoutConfig.tuition_rate_max_individual_per_hour,
          warn_low: payoutConfig.tuition_rate_warn_low_individual,
          warn_high: payoutConfig.tuition_rate_warn_high_individual,
          midpoint: indMid,
        },
        batch: {
          min: payoutConfig.tuition_rate_min_batch_per_hour,
          max: payoutConfig.tuition_rate_max_batch_per_hour,
          warn_low: payoutConfig.tuition_rate_warn_low_batch,
          warn_high: payoutConfig.tuition_rate_warn_high_batch,
          midpoint: batchMid,
        },
      },
      tiers: tuitionTiers,
      payout_trigger: payoutConfig.tuition_payout_trigger,
    },
    workshop: {
      default_coach_percent: payoutConfig.workshop_default_coach_percent,
      lead_cost_percent: payoutConfig.workshop_lead_cost_percent,
      example_class_size: exampleClassSize,
      example_per_child_fee: batchMid,
      example_session_fee: exampleSessionFee,
      example_coach_earnings: workshopBreakdown.coach_cost_amount,
    },
    payout_day: payoutConfig.payout_day_of_month,
    cached_at: new Date().toISOString(),
  };

  console.log(JSON.stringify({
    requestId,
    event: 'earnings_calculator_all_products_complete',
    duration: `${Date.now() - startTime}ms`,
    ageBand,
    coachingTiers: coachingTiers.length,
    tuitionTiers: tuitionTiers.length,
  }));

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
    },
  });
}

// ============================================================
// V1 HANDLER — default (legacy flat-split)
// ============================================================

async function handleLegacyMode(requestId: string, startTime: number) {
  // Fetch active revenue split config
  const { data: splitConfig, error: splitError } = await supabase
    .from('revenue_split_config')
    .select('lead_cost_percent, coach_cost_percent, platform_fee_percent')
    .eq('is_active', true)
    .single();

  if (splitError || !splitConfig) {
    console.error(JSON.stringify({
      requestId,
      event: 'earnings_calculator_error',
      error: 'Revenue config not found',
      details: splitError?.message,
    }));

    return NextResponse.json(
      { success: false, error: 'Configuration unavailable' },
      { status: 503 }
    );
  }

  // Fetch active products
  const { data: products, error: productsError } = await supabase
    .from('pricing_plans')
    .select('name, slug, discounted_price, sessions_included')
    .eq('is_active', true)
    .order('display_order');

  if (productsError || !products || products.length === 0) {
    console.error(JSON.stringify({
      requestId,
      event: 'earnings_calculator_error',
      error: 'Products not found',
      details: productsError?.message,
    }));

    return NextResponse.json(
      { success: false, error: 'Products unavailable' },
      { status: 503 }
    );
  }

  // Calculate earnings for each product
  const productEarnings: ProductEarnings[] = products.map(product => {
    const earnings = calculateEarnings(
      product.discounted_price,
      product.sessions_included ?? 0,
      splitConfig as RevenueConfig
    );

    return {
      name: product.name,
      slug: product.slug,
      price: product.discounted_price,
      sessions: product.sessions_included ?? 0,
      coach_earnings_own_lead: earnings.own_lead,
      coach_earnings_platform_lead: earnings.platform_lead,
      per_session_own_lead: earnings.per_session_own,
      per_session_platform_lead: earnings.per_session_platform,
    };
  });

  // Monthly scenarios based on Full Program
  const fullProgram = productEarnings.find(p => p.slug === 'full');
  const avgEarning = fullProgram?.coach_earnings_own_lead || 0;

  const studentCounts = [3, 5, 10, 15, 20];
  const scenarios = {
    students_per_month: studentCounts,
    earnings: studentCounts.map(count => avgEarning * count),
  };

  const response: EarningsResponse = {
    success: true,
    products: productEarnings,
    split_config: {
      lead_cost_percent: Number(splitConfig.lead_cost_percent),
      coach_cost_percent: Number(splitConfig.coach_cost_percent),
      platform_fee_percent: Number(splitConfig.platform_fee_percent),
      own_lead_total_percent: Number(splitConfig.lead_cost_percent) + Number(splitConfig.coach_cost_percent),
    },
    scenarios,
    cached_at: new Date().toISOString(),
  };

  console.log(JSON.stringify({
    requestId,
    event: 'earnings_calculator_complete',
    duration: `${Date.now() - startTime}ms`,
    productsCount: productEarnings.length,
  }));

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
    },
  });
}

// ============================================================
// API HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const mode = request.nextUrl.searchParams.get('mode');
  const ageBand = request.nextUrl.searchParams.get('age_band') || 'building';

  console.log(JSON.stringify({
    requestId,
    event: 'earnings_calculator_start',
    mode: mode || 'legacy',
    ageBand: mode === 'tiers' ? ageBand : undefined,
    timestamp: new Date().toISOString(),
  }));

  try {
    if (mode === 'all-products') {
      return await handleAllProductsMode(requestId, startTime, ageBand);
    }
    if (mode === 'tiers') {
      return await handleTiersMode(requestId, startTime, ageBand);
    }
    return await handleLegacyMode(requestId, startTime);
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'earnings_calculator_fatal',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${Date.now() - startTime}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 500 }
    );
  }
}
