// =============================================================================
// SHARED PRICING CONFIG LOADER
// lib/config/pricing-config.ts
//
// Single source of truth for pricing + session structure.
// Fetches from age_band_config + pricing_plans with 5-min cache.
// Provides computed helpers so consumers never hardcode counts.
//
// Usage:
//   import { getPricingConfig, getSessionCount, getSessionDuration } from '@/lib/config/pricing-config';
//   const config = await getPricingConfig();
//   const sessions = getSessionCount(config, 'foundation', 'starter');
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionsForTier, getBoosterCreditsForTier } from '@/types/v2-schema';

// Re-export for convenience
export { getSessionsForTier, getBoosterCreditsForTier };

// =============================================================================
// TYPES
// =============================================================================

export interface AgeBandConfig {
  id: string;                        // 'foundation' | 'building' | 'mastery'
  displayName: string;
  ageMin: number;
  ageMax: number;
  sessionDurationMinutes: number;    // 30 / 45 / 60
  sessionsPerWeek: number;
  weeklyPattern: number[];           // e.g. [2,1,2,1,2,1,2,1,2,1,2,1]
  sessionsPerSeason: number;
  skillBoosterCredits: number;
  seasonDurationWeeks: number;
}

export interface PricingTier {
  slug: string;                      // 'starter' | 'continuation' | 'full_season'
  name: string;
  durationWeeks: number;             // 4 / 8 / 12
  startWeek: number;                 // 0 for starter/full, 4 for continuation
  originalPrice: number;
  discountedPrice: number;
  currency: string;
  isFeatured: boolean;
  displayOrder: number | null;
}

export interface PricingConfig {
  ageBands: AgeBandConfig[];
  tiers: PricingTier[];
  fetchedAt: number;
}

// =============================================================================
// HARDCODED FALLBACKS (V3 values — used only if DB fetch fails)
// =============================================================================

const FALLBACK_AGE_BANDS: AgeBandConfig[] = [
  {
    id: 'foundation',
    displayName: 'Foundation',
    ageMin: 4,
    ageMax: 6,
    sessionDurationMinutes: 30,
    sessionsPerWeek: 2,
    weeklyPattern: [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
    sessionsPerSeason: 18,
    skillBoosterCredits: 6,
    seasonDurationWeeks: 12,
  },
  {
    id: 'building',
    displayName: 'Building',
    ageMin: 7,
    ageMax: 9,
    sessionDurationMinutes: 45,
    sessionsPerWeek: 1,
    weeklyPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    sessionsPerSeason: 12,
    skillBoosterCredits: 4,
    seasonDurationWeeks: 12,
  },
  {
    id: 'mastery',
    displayName: 'Mastery',
    ageMin: 10,
    ageMax: 12,
    sessionDurationMinutes: 60,
    sessionsPerWeek: 1,
    weeklyPattern: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
    sessionsPerSeason: 9,
    skillBoosterCredits: 3,
    seasonDurationWeeks: 12,
  },
];

const FALLBACK_TIERS: PricingTier[] = [
  {
    slug: 'starter',
    name: 'Starter',
    durationWeeks: 4,
    startWeek: 0,
    originalPrice: 4999,
    discountedPrice: 3999,
    currency: 'INR',
    isFeatured: false,
    displayOrder: 1,
  },
  {
    slug: 'continuation',
    name: 'Continuation',
    durationWeeks: 8,
    startWeek: 4,
    originalPrice: 8999,
    discountedPrice: 7499,
    currency: 'INR',
    isFeatured: true,
    displayOrder: 2,
  },
  {
    slug: 'full_season',
    name: 'Full Season',
    durationWeeks: 12,
    startWeek: 0,
    originalPrice: 11999,
    discountedPrice: 9999,
    currency: 'INR',
    isFeatured: false,
    displayOrder: 3,
  },
];

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry {
  data: PricingConfig;
  loadedAt: number;
}

let configCache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(entry: CacheEntry | null): entry is CacheEntry {
  return entry != null && Date.now() - entry.loadedAt < CACHE_TTL;
}

// =============================================================================
// PARSERS
// =============================================================================

function parseNumberArray(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch { /* ignore */ }
  }
  return null;
}

// =============================================================================
// TIER START WEEK MAP
// Continuation starts at week 5 (index 4); others start at 0.
// =============================================================================

const TIER_START_WEEKS: Record<string, number> = {
  starter: 0,
  continuation: 4,
  full_season: 0,
};

// =============================================================================
// MAIN LOADER
// =============================================================================

export async function getPricingConfig(): Promise<PricingConfig> {
  if (isCacheValid(configCache)) {
    return configCache.data;
  }

  try {
    const supabase = createAdminClient();

    const [bandsResult, plansResult] = await Promise.all([
      supabase
        .from('age_band_config')
        .select('*')
        .eq('is_active', true)
        .order('age_min', { ascending: true }),
      supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
    ]);

    if (bandsResult.error) {
      console.error('[PricingConfig] Failed to fetch age_band_config:', bandsResult.error);
      return buildFallback();
    }

    if (plansResult.error) {
      console.error('[PricingConfig] Failed to fetch pricing_plans:', plansResult.error);
      return buildFallback();
    }

    const bands = bandsResult.data || [];
    const plans = plansResult.data || [];

    if (bands.length === 0 || plans.length === 0) {
      console.warn('[PricingConfig] Empty result from DB, using fallbacks');
      return buildFallback();
    }

    const ageBands: AgeBandConfig[] = bands.map(band => ({
      id: band.id,
      displayName: band.display_name,
      ageMin: band.age_min,
      ageMax: band.age_max,
      sessionDurationMinutes: band.session_duration_minutes,
      sessionsPerWeek: band.sessions_per_week,
      weeklyPattern: parseNumberArray(band.weekly_pattern) || [],
      sessionsPerSeason: band.sessions_per_season,
      skillBoosterCredits: band.skill_booster_credits || 0,
      seasonDurationWeeks: band.season_duration_weeks || 12,
    }));

    const tiers: PricingTier[] = plans.map(plan => ({
      slug: plan.slug,
      name: plan.name,
      durationWeeks: plan.duration_weeks || 12,
      startWeek: TIER_START_WEEKS[plan.slug] ?? 0,
      originalPrice: plan.original_price,
      discountedPrice: plan.discounted_price,
      currency: plan.currency || 'INR',
      isFeatured: plan.is_featured || false,
      displayOrder: plan.display_order,
    }));

    const config: PricingConfig = { ageBands, tiers, fetchedAt: Date.now() };
    configCache = { data: config, loadedAt: Date.now() };
    return config;
  } catch (err) {
    console.error('[PricingConfig] Unexpected error, using fallbacks:', err);
    return buildFallback();
  }
}

function buildFallback(): PricingConfig {
  const config: PricingConfig = {
    ageBands: FALLBACK_AGE_BANDS,
    tiers: FALLBACK_TIERS,
    fetchedAt: Date.now(),
  };
  configCache = { data: config, loadedAt: Date.now() };
  return config;
}

// =============================================================================
// COMPUTED HELPERS
// =============================================================================

/**
 * Get coaching session count for a specific age band + tier.
 * Uses weeklyPattern × durationWeeks (V3 computation).
 */
export function getSessionCount(
  config: PricingConfig,
  ageBandId: string,
  tierSlug: string
): number {
  const band = config.ageBands.find(b => b.id === ageBandId);
  const tier = config.tiers.find(t => t.slug === tierSlug);
  if (!band || !tier) return 0;
  if (band.weeklyPattern.length === 0) return 0;
  return getSessionsForTier(band.weeklyPattern, tier.durationWeeks, tier.startWeek);
}

/**
 * Get session duration in minutes for an age band.
 */
export function getSessionDuration(
  config: PricingConfig,
  ageBandId: string
): number {
  const band = config.ageBands.find(b => b.id === ageBandId);
  return band?.sessionDurationMinutes ?? 45;
}

/**
 * Get skill booster credits for a specific age band + tier.
 */
export function getBoosterCredits(
  config: PricingConfig,
  ageBandId: string,
  tierSlug: string
): number {
  const band = config.ageBands.find(b => b.id === ageBandId);
  const tier = config.tiers.find(t => t.slug === tierSlug);
  if (!band || !tier) return 0;
  if (band.skillBoosterCredits === 0) return 0;
  return getBoosterCreditsForTier(band.skillBoosterCredits, tier.durationWeeks, band.seasonDurationWeeks);
}

/**
 * Get a generic "X–Y sessions" range string across all tiers for an age band.
 * Useful for marketing copy like "6–18 sessions".
 */
export function getGenericSessionRange(
  config: PricingConfig,
  ageBandId: string
): string {
  const counts = config.tiers.map(tier => getSessionCount(config, ageBandId, tier.slug)).filter(n => n > 0);
  if (counts.length === 0) return '0';
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * Format a pricing summary string like "₹3,999 for 4 weeks (6 sessions)".
 */
export function formatPricingSummary(
  config: PricingConfig,
  ageBandId: string,
  tierSlug: string
): string {
  const tier = config.tiers.find(t => t.slug === tierSlug);
  if (!tier) return '';
  const sessions = getSessionCount(config, ageBandId, tierSlug);
  const price = tier.discountedPrice.toLocaleString('en-IN');
  return `₹${price} for ${tier.durationWeeks} weeks (${sessions} sessions)`;
}

// =============================================================================
// GENERIC HELPERS — for messaging when age band is unknown
// =============================================================================

/**
 * Get session count range across all age bands for a specific tier.
 * Returns {min, max} — useful for generic messaging when child age is unknown.
 */
export function getSessionRangeForTier(
  config: PricingConfig,
  tierSlug: string
): { min: number; max: number } {
  const counts = config.ageBands
    .map(band => getSessionCount(config, band.id, tierSlug))
    .filter(n => n > 0);
  if (counts.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...counts), max: Math.max(...counts) };
}

/**
 * Get session duration range across all age bands.
 * Returns {min, max} in minutes — useful for generic messaging.
 */
export function getDurationRange(
  config: PricingConfig
): { min: number; max: number } {
  const durations = config.ageBands.map(b => b.sessionDurationMinutes);
  if (durations.length === 0) return { min: 45, max: 45 };
  return { min: Math.min(...durations), max: Math.max(...durations) };
}

/**
 * Get the per-week price for the cheapest tier (for "starting at ₹X/week" messaging).
 */
export function getPerWeekPrice(config: PricingConfig): number {
  if (config.tiers.length === 0) return 375;
  const perWeek = config.tiers.map(t => Math.round(t.discountedPrice / t.durationWeeks));
  return Math.min(...perWeek);
}

// =============================================================================
// QUICK HELPERS — resolve by child age instead of ageBandId
// =============================================================================

function ageBandIdFromAge(config: PricingConfig, age: number): string | null {
  const band = config.ageBands.find(b => age >= b.ageMin && age <= b.ageMax);
  return band?.id ?? null;
}

/**
 * Get discounted price for a child's age + tier.
 */
export function getPrice(
  config: PricingConfig,
  childAge: number,
  tierSlug: string
): number | null {
  const tier = config.tiers.find(t => t.slug === tierSlug);
  if (!tier) return null;
  // Verify the age band exists
  const bandId = ageBandIdFromAge(config, childAge);
  if (!bandId) return null;
  return tier.discountedPrice;
}

/**
 * Get session count for a child's age + tier.
 */
export function getSessionCountForChild(
  config: PricingConfig,
  childAge: number,
  tierSlug: string
): number {
  const bandId = ageBandIdFromAge(config, childAge);
  if (!bandId) return 0;
  return getSessionCount(config, bandId, tierSlug);
}

/**
 * Get session duration in minutes for a child's age.
 */
export function getSessionDurationForChild(
  config: PricingConfig,
  childAge: number
): number {
  const bandId = ageBandIdFromAge(config, childAge);
  if (!bandId) return 45;
  return getSessionDuration(config, bandId);
}
