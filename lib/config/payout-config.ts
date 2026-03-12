// =============================================================================
// PAYOUT & REFERRAL CONFIGURATION LOADER
// lib/config/payout-config.ts
//
// SINGLE SOURCE OF TRUTH for all payout + referral calculations.
// Loads 35 keys from site_settings (categories: 'revenue' + 'referral').
// Uses batch .in('key', keys) query with 5-min in-memory cache.
//
// Pattern follows lib/config/loader.ts (supabaseAdmin, TTL cache).
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';

// =============================================================================
// TYPES
// =============================================================================

export type ReferrerType = 'coach' | 'parent' | 'external' | 'influencer';
export type EnrollmentType = 'starter' | 'continuation' | 'reenrollment';
export type LeadSource = 'yestoryd' | 'coach' | 'parent' | 'external' | 'influencer';
export type RewardType = 'upi_transfer' | 'credit' | 'gift_voucher' | 'custom';
export type PayoutTiming = 'after_first_session' | 'on_enrollment';
export type SessionType = 'coaching' | 'skill_building';

export interface PayoutConfig {
  // Revenue
  payout_model: string;
  payout_day_of_month: number;
  skill_building_rate_multiplier: number;
  skill_building_counts_toward_tier: boolean;
  tds_rate_percent: number;
  tds_threshold_annual: number;
  coach_max_children: number;
  reenrollment_coach_bonus: number;
  reenrollment_coach_bonus_enabled: boolean;
  // Referral
  lead_cost_referrer_percent_coach: number;
  lead_cost_referrer_percent_parent: number;
  lead_cost_referrer_percent_external: number;
  lead_cost_referrer_percent_influencer: number;
  coaching_bonus_percent: number;
  coaching_bonus_on_organic: boolean;
  coaching_bonus_timing: PayoutTiming;
  lead_cost_decay_continuation: number;
  lead_cost_decay_reenrollment: number;
  lead_cost_timing: PayoutTiming;
  referral_code_applies_to_continuation: boolean;
  referral_code_applies_to_reenrollment: boolean;
  external_referral_enabled: boolean;
  external_referral_reward_amount: number;
  external_referral_reward_type: RewardType;
  external_referral_min_payout: number;
  external_referral_auto_approve: boolean;
  parent_referral_reward_type: RewardType;
  inactive_parent_referral_enabled: boolean;
  influencer_reward_type: RewardType;
  referral_qr_enabled: boolean;
  referral_landing_page: string;
}

export interface CoachGroupConfig {
  id: string;
  name: string;
  display_name: string;
  coach_cost_percent: number;
  lead_cost_percent: number;
  platform_fee_percent: number;
  is_internal: boolean;
  per_session_rate_override: number | null;
  skill_building_rate_override: number | null;
}

export interface PerSessionRate {
  coaching_rate: number;
  skill_building_rate: number;
  coaching_sessions: number;
  skill_building_sessions: number;
  total_sessions: number;
  source: 'override' | 'calculated';
}

export interface LeadCostBreakdown {
  total_lead_cost_percent: number;
  referrer_share_percent: number;
  referrer_share_amount: number;
  coaching_bonus_percent: number;
  coaching_bonus_amount: number;
  referrer_type: ReferrerType | 'organic';
  referrer_reward_type: RewardType | null;
  timing: PayoutTiming;
  decay_applied: number;
}

export interface EnrollmentBreakdown {
  enrollment_amount: number;
  // Lead cost (referrer + coaching bonus)
  lead_cost: LeadCostBreakdown;
  // Coach cost (coaching sessions only)
  coach_cost_percent: number;
  coach_cost_amount: number;
  per_session_rates: PerSessionRate;
  // Skill building cost (SB sessions × skill_building_rate, paid from platform fee)
  skill_building_cost: number;
  // Platform fee: gross = REMAINDER, actual = gross minus SB cost
  platform_fee_amount: number;       // gross (backwards compat)
  platform_fee_percent: number;      // gross %
  actual_platform_fee: number;       // after SB cost deducted
  actual_platform_fee_percent: number;
  // TDS
  tds_amount: number;
  tds_rate_applied: number;
  tds_applicable: boolean;
  // Net amounts
  net_to_coaching_coach: number;     // coach_cost + skill_building_cost - TDS
  net_to_referrer: number;
  net_to_platform: number;           // actual_platform_fee
  // Re-enrollment bonus
  reenrollment_bonus: number;
  // Totals for verification
  total_sessions: number;
  enrollment_type: EnrollmentType;
}

// =============================================================================
// FALLBACKS (safety net only — DB should always have values)
// =============================================================================

const FALLBACKS: Record<string, string | number | boolean> = {
  // Revenue
  payout_model: 'per_session',
  payout_day_of_month: 7,
  skill_building_rate_multiplier: 0.5,
  skill_building_counts_toward_tier: true,
  tds_rate_percent: 10,
  tds_threshold_annual: 30000,
  coach_max_children: 20,
  reenrollment_coach_bonus: 500,
  reenrollment_coach_bonus_enabled: true,
  // Referral
  lead_cost_referrer_percent_coach: 10,
  lead_cost_referrer_percent_parent: 10,
  lead_cost_referrer_percent_external: 5,
  lead_cost_referrer_percent_influencer: 10,
  coaching_bonus_percent: 0,
  coaching_bonus_on_organic: true,
  coaching_bonus_timing: 'after_first_session',
  lead_cost_decay_continuation: 0.50,
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
};

const ALL_KEYS = Object.keys(FALLBACKS);

// =============================================================================
// HELPERS
// =============================================================================

function tryParseJSON(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function asNumber(val: unknown, fallback: number): number {
  const parsed = tryParseJSON(val);
  const num = Number(parsed);
  return isNaN(num) ? fallback : num;
}

function asString(val: unknown, fallback: string): string {
  const parsed = tryParseJSON(val);
  return typeof parsed === 'string' ? parsed : fallback;
}

function asBoolean(val: unknown, fallback: boolean): boolean {
  const parsed = tryParseJSON(val);
  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'string') {
    if (parsed === 'true' || parsed === '1') return true;
    if (parsed === 'false' || parsed === '0') return false;
  }
  return fallback;
}

// =============================================================================
// CACHE
// =============================================================================

let configCache: { data: PayoutConfig; loadedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidatePayoutConfigCache(): void {
  configCache = null;
  console.log('[PayoutConfig] Cache invalidated');
}

// =============================================================================
// LOADERS
// =============================================================================

/**
 * Batch-fetch all 35 payout/referral keys from site_settings.
 * 5-min in-memory cache. DB values merged over fallbacks.
 */
export async function loadPayoutConfig(forceRefresh = false): Promise<PayoutConfig> {
  if (!forceRefresh && configCache && Date.now() - configCache.loadedAt < CACHE_TTL) {
    return configCache.data;
  }

  const { data: rows, error } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', ALL_KEYS);

  if (error) {
    console.error('[PayoutConfig] DB fetch failed, using fallbacks:', error.message);
  }

  // Build key→value map from DB
  const dbMap = new Map<string, unknown>();
  for (const row of rows || []) {
    dbMap.set(row.key, row.value);
  }

  const get = (key: string) => dbMap.has(key) ? dbMap.get(key) : undefined;
  const fb = FALLBACKS;

  const config: PayoutConfig = {
    // Revenue
    payout_model: asString(get('payout_model'), fb.payout_model as string),
    payout_day_of_month: asNumber(get('payout_day_of_month'), fb.payout_day_of_month as number),
    skill_building_rate_multiplier: asNumber(get('skill_building_rate_multiplier'), fb.skill_building_rate_multiplier as number),
    skill_building_counts_toward_tier: asBoolean(get('skill_building_counts_toward_tier'), fb.skill_building_counts_toward_tier as boolean),
    tds_rate_percent: asNumber(get('tds_rate_percent'), fb.tds_rate_percent as number),
    tds_threshold_annual: asNumber(get('tds_threshold_annual'), fb.tds_threshold_annual as number),
    coach_max_children: asNumber(get('coach_max_children'), fb.coach_max_children as number),
    reenrollment_coach_bonus: asNumber(get('reenrollment_coach_bonus'), fb.reenrollment_coach_bonus as number),
    reenrollment_coach_bonus_enabled: asBoolean(get('reenrollment_coach_bonus_enabled'), fb.reenrollment_coach_bonus_enabled as boolean),
    // Referral
    lead_cost_referrer_percent_coach: asNumber(get('lead_cost_referrer_percent_coach'), fb.lead_cost_referrer_percent_coach as number),
    lead_cost_referrer_percent_parent: asNumber(get('lead_cost_referrer_percent_parent'), fb.lead_cost_referrer_percent_parent as number),
    lead_cost_referrer_percent_external: asNumber(get('lead_cost_referrer_percent_external'), fb.lead_cost_referrer_percent_external as number),
    lead_cost_referrer_percent_influencer: asNumber(get('lead_cost_referrer_percent_influencer'), fb.lead_cost_referrer_percent_influencer as number),
    coaching_bonus_percent: asNumber(get('coaching_bonus_percent'), fb.coaching_bonus_percent as number),
    coaching_bonus_on_organic: asBoolean(get('coaching_bonus_on_organic'), fb.coaching_bonus_on_organic as boolean),
    coaching_bonus_timing: asString(get('coaching_bonus_timing'), fb.coaching_bonus_timing as string) as PayoutTiming,
    lead_cost_decay_continuation: asNumber(get('lead_cost_decay_continuation'), fb.lead_cost_decay_continuation as number),
    lead_cost_decay_reenrollment: asNumber(get('lead_cost_decay_reenrollment'), fb.lead_cost_decay_reenrollment as number),
    lead_cost_timing: asString(get('lead_cost_timing'), fb.lead_cost_timing as string) as PayoutTiming,
    referral_code_applies_to_continuation: asBoolean(get('referral_code_applies_to_continuation'), fb.referral_code_applies_to_continuation as boolean),
    referral_code_applies_to_reenrollment: asBoolean(get('referral_code_applies_to_reenrollment'), fb.referral_code_applies_to_reenrollment as boolean),
    external_referral_enabled: asBoolean(get('external_referral_enabled'), fb.external_referral_enabled as boolean),
    external_referral_reward_amount: asNumber(get('external_referral_reward_amount'), fb.external_referral_reward_amount as number),
    external_referral_reward_type: asString(get('external_referral_reward_type'), fb.external_referral_reward_type as string) as RewardType,
    external_referral_min_payout: asNumber(get('external_referral_min_payout'), fb.external_referral_min_payout as number),
    external_referral_auto_approve: asBoolean(get('external_referral_auto_approve'), fb.external_referral_auto_approve as boolean),
    parent_referral_reward_type: asString(get('parent_referral_reward_type'), fb.parent_referral_reward_type as string) as RewardType,
    inactive_parent_referral_enabled: asBoolean(get('inactive_parent_referral_enabled'), fb.inactive_parent_referral_enabled as boolean),
    influencer_reward_type: asString(get('influencer_reward_type'), fb.influencer_reward_type as string) as RewardType,
    referral_qr_enabled: asBoolean(get('referral_qr_enabled'), fb.referral_qr_enabled as boolean),
    referral_landing_page: asString(get('referral_landing_page'), fb.referral_landing_page as string),
  };

  configCache = { data: config, loadedAt: Date.now() };
  return config;
}

/**
 * Load coach's group config (coach → coach_group_id → coach_groups row).
 */
export async function loadCoachGroup(coachId: string): Promise<CoachGroupConfig | null> {
  const { data: coach } = await supabaseAdmin
    .from('coaches')
    .select('group_id')
    .eq('id', coachId)
    .single();

  if (!coach?.group_id) return null;

  const { data: group } = await supabaseAdmin
    .from('coach_groups')
    .select('id, name, display_name, coach_cost_percent, lead_cost_percent, platform_fee_percent, is_internal, per_session_rate_override, skill_building_rate_override')
    .eq('id', coach.group_id)
    .single();

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    display_name: group.display_name || group.name,
    coach_cost_percent: Number(group.coach_cost_percent) || 50,
    lead_cost_percent: Number(group.lead_cost_percent) || 20,
    platform_fee_percent: Number(group.platform_fee_percent) || 30,
    is_internal: !!group.is_internal,
    per_session_rate_override: group.per_session_rate_override != null ? Number(group.per_session_rate_override) : null,
    skill_building_rate_override: group.skill_building_rate_override != null ? Number(group.skill_building_rate_override) : null,
  };
}

// =============================================================================
// CALCULATORS
// =============================================================================

/**
 * Calculate per-session rates for coaching and skill building.
 * Divides coach cost by COACHING sessions only.
 * Skill building rate = coaching_rate × skill_building_rate_multiplier (0.5).
 * Override on coach_groups takes priority over formula.
 */
export function calculatePerSessionRate(
  enrollmentAmount: number,
  coachingSessions: number,
  skillBuildingSessions: number,
  coachGroup: CoachGroupConfig | null,
  config: PayoutConfig,
): PerSessionRate {
  const totalSessions = coachingSessions + skillBuildingSessions;

  if (coachingSessions <= 0) {
    return { coaching_rate: 0, skill_building_rate: 0, coaching_sessions: 0, skill_building_sessions: 0, total_sessions: 0, source: 'calculated' };
  }

  // Override from coach group
  if (coachGroup?.per_session_rate_override != null) {
    const sbRate = coachGroup.skill_building_rate_override
      ?? Math.round(coachGroup.per_session_rate_override * config.skill_building_rate_multiplier);
    return {
      coaching_rate: coachGroup.per_session_rate_override,
      skill_building_rate: sbRate,
      coaching_sessions: coachingSessions,
      skill_building_sessions: skillBuildingSessions,
      total_sessions: totalSessions,
      source: 'override',
    };
  }

  // Formula: coach_cost ÷ coaching_sessions (not total)
  const coachPercent = coachGroup?.coach_cost_percent ?? 50;
  const coachingRate = Math.round((enrollmentAmount * coachPercent / 100) / coachingSessions);
  const skillBuildingRate = Math.round(coachingRate * config.skill_building_rate_multiplier);

  return {
    coaching_rate: coachingRate,
    skill_building_rate: skillBuildingRate,
    coaching_sessions: coachingSessions,
    skill_building_sessions: skillBuildingSessions,
    total_sessions: totalSessions,
    source: 'calculated',
  };
}

/**
 * Calculate lead cost breakdown (referrer share + coaching bonus).
 */
export function calculateLeadCost(
  enrollmentAmount: number,
  enrollmentType: EnrollmentType,
  referrerType: ReferrerType | 'organic',
  config: PayoutConfig,
  influencerOverride?: number,
): LeadCostBreakdown {
  // Decay multiplier by enrollment type
  let decay = 1.0;
  if (enrollmentType === 'continuation') decay = config.lead_cost_decay_continuation;
  if (enrollmentType === 'reenrollment') decay = config.lead_cost_decay_reenrollment;

  // Referrer share %
  let baseReferrerPercent = 0;
  let rewardType: RewardType | null = null;

  if (referrerType !== 'organic') {
    const percentKey = `lead_cost_referrer_percent_${referrerType}` as keyof PayoutConfig;
    baseReferrerPercent = (config[percentKey] as number) || 0;

    // Influencer override
    if (referrerType === 'influencer' && influencerOverride != null) {
      baseReferrerPercent = influencerOverride;
    }

    // Reward type by referrer type
    if (referrerType === 'parent') rewardType = config.parent_referral_reward_type;
    else if (referrerType === 'influencer') rewardType = config.influencer_reward_type;
    else if (referrerType === 'external') rewardType = config.external_referral_reward_type;
    else if (referrerType === 'coach') rewardType = 'upi_transfer'; // coaches always paid as payout
  }

  const referrerSharePercent = baseReferrerPercent * decay;
  const referrerShareAmount = Math.round(enrollmentAmount * referrerSharePercent / 100);

  // Coaching bonus %
  let coachingBonusPercent = 0;
  if (referrerType !== 'organic' || config.coaching_bonus_on_organic) {
    coachingBonusPercent = config.coaching_bonus_percent * decay;
  }
  const coachingBonusAmount = Math.round(enrollmentAmount * coachingBonusPercent / 100);

  const totalPercent = referrerSharePercent + coachingBonusPercent;

  return {
    total_lead_cost_percent: totalPercent,
    referrer_share_percent: referrerSharePercent,
    referrer_share_amount: referrerShareAmount,
    coaching_bonus_percent: coachingBonusPercent,
    coaching_bonus_amount: coachingBonusAmount,
    referrer_type: referrerType,
    referrer_reward_type: rewardType,
    timing: config.lead_cost_timing,
    decay_applied: decay,
  };
}

/**
 * Calculate TDS (Section 194J).
 */
export function calculateTDS(
  grossAmount: number,
  coachCumulativeThisYear: number,
  config: PayoutConfig,
): { tds_amount: number; tds_rate: number; tds_applicable: boolean } {
  const willExceed = (coachCumulativeThisYear + grossAmount) > config.tds_threshold_annual;
  if (!willExceed) {
    return { tds_amount: 0, tds_rate: 0, tds_applicable: false };
  }
  const tdsAmount = Math.round(grossAmount * config.tds_rate_percent / 100);
  return { tds_amount: tdsAmount, tds_rate: config.tds_rate_percent, tds_applicable: true };
}

/**
 * Calculate re-enrollment bonus for coaching coach.
 */
export function calculateReenrollmentBonus(
  enrollmentType: EnrollmentType,
  config: PayoutConfig,
): number {
  if (enrollmentType !== 'reenrollment') return 0;
  if (!config.reenrollment_coach_bonus_enabled) return 0;
  return config.reenrollment_coach_bonus;
}

/**
 * Full enrollment breakdown combining all calculators.
 * Platform fee = REMAINDER (never hardcoded).
 */
export function calculateEnrollmentBreakdown(
  enrollmentAmount: number,
  coachingSessions: number,
  skillBuildingSessions: number,
  enrollmentType: EnrollmentType,
  referrerType: ReferrerType | 'organic',
  coachGroup: CoachGroupConfig | null,
  coachCumulativeThisYear: number,
  config: PayoutConfig,
  influencerOverride?: number,
): EnrollmentBreakdown {
  const totalSessions = coachingSessions + skillBuildingSessions;

  // Lead cost
  const leadCost = calculateLeadCost(enrollmentAmount, enrollmentType, referrerType, config, influencerOverride);

  // Coach cost
  const coachPercent = coachGroup?.coach_cost_percent ?? 50;
  const coachCostAmount = Math.round(enrollmentAmount * coachPercent / 100);

  // Per-session rates (coaching_rate from coach_cost ÷ coaching sessions; SB rate = coaching_rate × 0.5)
  const perSessionRates = calculatePerSessionRate(enrollmentAmount, coachingSessions, skillBuildingSessions, coachGroup, config);

  // Skill building cost = SB sessions × skill_building_rate (paid from platform fee)
  const skillBuildingCost = skillBuildingSessions * perSessionRates.skill_building_rate;

  // Platform fee = REMAINDER (gross), then deduct SB cost for actual
  const platformFeeAmount = enrollmentAmount - leadCost.referrer_share_amount - leadCost.coaching_bonus_amount - coachCostAmount;
  const platformFeePercent = enrollmentAmount > 0 ? Math.round(platformFeeAmount / enrollmentAmount * 10000) / 100 : 0;
  const actualPlatformFee = platformFeeAmount - skillBuildingCost;
  const actualPlatformFeePercent = enrollmentAmount > 0 ? Math.round(actualPlatformFee / enrollmentAmount * 10000) / 100 : 0;

  // TDS on coach cost (coaching pot only — SB cost is separate)
  const tds = calculateTDS(coachCostAmount, coachCumulativeThisYear, config);

  // Re-enrollment bonus
  const reenrollmentBonus = calculateReenrollmentBonus(enrollmentType, config);

  return {
    enrollment_amount: enrollmentAmount,
    lead_cost: leadCost,
    coach_cost_percent: coachPercent,
    coach_cost_amount: coachCostAmount,
    per_session_rates: perSessionRates,
    skill_building_cost: skillBuildingCost,
    platform_fee_amount: platformFeeAmount,
    platform_fee_percent: platformFeePercent,
    actual_platform_fee: actualPlatformFee,
    actual_platform_fee_percent: actualPlatformFeePercent,
    tds_amount: tds.tds_amount,
    tds_rate_applied: tds.tds_rate,
    tds_applicable: tds.tds_applicable,
    net_to_coaching_coach: coachCostAmount + skillBuildingCost - tds.tds_amount,
    net_to_referrer: leadCost.referrer_share_amount,
    net_to_platform: actualPlatformFee,
    reenrollment_bonus: reenrollmentBonus,
    total_sessions: totalSessions,
    enrollment_type: enrollmentType,
  };
}

// =============================================================================
// REFERRAL CODE GENERATION
// =============================================================================

/**
 * Generate referral code: REF-{NAME_UPPER_6}-{RANDOM_4}
 */
export function generateReferralCode(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'REF';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${clean}-${random}`;
}
