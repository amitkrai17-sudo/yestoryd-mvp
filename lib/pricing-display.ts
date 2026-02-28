// ============================================================================
// PRICING DISPLAY — shared data fetcher
// lib/pricing-display.ts
// ============================================================================
//
// Core logic for fetching age_band_config + pricing_plans.
// Used by:
//   - app/api/pricing-display/route.ts (public API)
//   - app/page.tsx (server component, direct call — no self-fetch)
//
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionsForTier, getBoosterCreditsForTier } from '@/types/v2-schema';

export interface PricingTier {
  slug: string;
  name: string;
  durationWeeks: number;
  originalPrice: number;
  discountedPrice: number;
  currency: string;
  sessionsCoaching: number;
  skillBoosterCredits: number;
  isFeatured: boolean;
  displayOrder: number | null;
  features: unknown;
}

export interface AgeBandDisplay {
  id: string;
  displayName: string;
  ageMin: number;
  ageMax: number;
  tagline: string | null;
  shortDescription: string | null;
  icon: string | null;
  differentiators: string[];
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
  progressPulseInterval: number | null;
  tiers: PricingTier[];
}

export interface PricingDisplayData {
  success: boolean;
  ageBands: AgeBandDisplay[];
  headline: string | null;
  subheadline: string | null;
  industryAvgClassCost: string | null;
  parentCallDurationMinutes: number;
}

/**
 * Fetch pricing display data directly from Supabase.
 * Returns null on failure (caller should fall back gracefully).
 */
export async function fetchPricingDisplayData(): Promise<PricingDisplayData | null> {
  try {
    const supabase = createAdminClient();

    const [bandsResult, plansResult, settingsResult] = await Promise.all([
      supabase
        .from('age_band_config')
        .select('*')
        .eq('is_active', true)
        .order('age_min', { ascending: true }),
      supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [
          'pricing_section_headline',
          'pricing_section_subheadline',
          'industry_avg_class_cost',
          'parent_call_duration_minutes',
        ]),
    ]);

    if (bandsResult.error) {
      console.error('[PricingDisplay] Failed to fetch age_band_config:', bandsResult.error);
      return null;
    }

    if (plansResult.error) {
      console.error('[PricingDisplay] Failed to fetch pricing_plans:', plansResult.error);
      return null;
    }

    const bands = bandsResult.data || [];
    const plans = plansResult.data || [];
    const settings = settingsResult.data || [];

    const settingsMap = new Map(settings.map(s => [s.key, String(s.value)]));

    const ageBands: AgeBandDisplay[] = bands.map(band => {
      const weeklyPattern = parseNumberArray(band.weekly_pattern) || [];
      const totalSeasonWeeks = band.season_duration_weeks || 12;
      const totalBoosterCredits = band.skill_booster_credits || 0;

      const tiers: PricingTier[] = plans.map(plan => {
        const durationWeeks = plan.duration_weeks || totalSeasonWeeks;
        const startWeek = plan.slug === 'continuation' ? 4 : 0;

        const sessionsCoaching = weeklyPattern.length > 0
          ? getSessionsForTier(weeklyPattern, durationWeeks, startWeek)
          : plan.sessions_coaching || 0;

        const skillBoosterCredits = totalBoosterCredits > 0
          ? getBoosterCreditsForTier(totalBoosterCredits, durationWeeks, totalSeasonWeeks)
          : plan.sessions_skill_building || 0;

        return {
          slug: plan.slug,
          name: plan.name,
          durationWeeks,
          originalPrice: plan.original_price,
          discountedPrice: plan.discounted_price,
          currency: plan.currency || 'INR',
          sessionsCoaching,
          skillBoosterCredits,
          isFeatured: plan.is_featured || false,
          displayOrder: plan.display_order,
          features: typeof plan.features === 'string'
            ? JSON.parse(plan.features)
            : plan.features || [],
        };
      });

      return {
        id: band.id,
        displayName: band.display_name,
        ageMin: band.age_min,
        ageMax: band.age_max,
        tagline: band.tagline || null,
        shortDescription: band.short_description || null,
        icon: band.icon || null,
        differentiators: parseStringArray(band.differentiators) || [],
        sessionDurationMinutes: band.session_duration_minutes,
        sessionsPerWeek: band.sessions_per_week,
        progressPulseInterval: band.progress_pulse_interval || null,
        tiers,
      };
    });

    return {
      success: true,
      ageBands,
      headline: settingsMap.get('pricing_section_headline') || null,
      subheadline: settingsMap.get('pricing_section_subheadline') || null,
      industryAvgClassCost: settingsMap.get('industry_avg_class_cost') || null,
      parentCallDurationMinutes: parseInt(settingsMap.get('parent_call_duration_minutes') || '15', 10),
    };
  } catch (error: any) {
    console.error('[PricingDisplay] Error:', error.message);
    return null;
  }
}

function parseNumberArray(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch { /* Not valid JSON */ }
  }
  return null;
}

function parseStringArray(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* Not valid JSON */ }
  }
  return null;
}
