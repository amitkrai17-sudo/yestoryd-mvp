// =============================================================================
// PAUSE POLICY LOADER (config-driven, per-product)
// lib/config/pause-policy.ts
//
// Single source of truth for enrollment pause limits. Mirrors the
// pricing-config.ts shape: reads scale-tunable values from site_settings via
// getSiteSettingInt(), with hardcoded fallbacks living ONLY as the fallback
// arg (Golden Rule 1 — no hardcoded business values outside the config loader).
//
// site_settings keys read:
//   pause_max_count_coaching   (default 3)
//   pause_max_days_coaching    (default 30)
//   pause_max_count_tuition    (default 3)
//   pause_max_days_tuition     (default 30)
//   pause_max_days_single      (default 10)
//   pause_min_notice_hours     (default 48)
//
// Usage:
//   import { getPausePolicy } from '@/lib/config/pause-policy';
//   const policy = await getPausePolicy('tuition');
// =============================================================================

import { getSiteSettingInt } from './site-settings-loader';

export type ProductType = 'coaching' | 'tuition';

export interface PausePolicy {
  productType: ProductType;
  maxPauseCount: number;       // max number of pauses per enrollment
  maxPauseDaysTotal: number;   // max cumulative pause days per enrollment
  maxPauseDaysSingle: number;  // max days for one pause window
  minNoticeHours: number;      // min lead time before a pause may start
}

// Hardcoded fallbacks — used ONLY as the getSiteSettingInt fallback arg.
// Carries forward Scheme A's historical 3 pauses / 30 days as the defaults.
const FALLBACKS = {
  coaching: { count: 3, days: 30 },
  tuition: { count: 3, days: 30 },
  maxDaysSingle: 10,
  minNoticeHours: 48,
} as const;

/**
 * Resolve product-keyed pause limits from site_settings (5-min cached).
 * Falls back to FALLBACKS if a key is missing or unparseable.
 */
export async function getPausePolicy(productType: ProductType): Promise<PausePolicy> {
  const countKey = productType === 'tuition' ? 'pause_max_count_tuition' : 'pause_max_count_coaching';
  const daysKey = productType === 'tuition' ? 'pause_max_days_tuition' : 'pause_max_days_coaching';
  const countFallback = productType === 'tuition' ? FALLBACKS.tuition.count : FALLBACKS.coaching.count;
  const daysFallback = productType === 'tuition' ? FALLBACKS.tuition.days : FALLBACKS.coaching.days;

  const [maxPauseCount, maxPauseDaysTotal, maxPauseDaysSingle, minNoticeHours] = await Promise.all([
    getSiteSettingInt(countKey, countFallback),
    getSiteSettingInt(daysKey, daysFallback),
    getSiteSettingInt('pause_max_days_single', FALLBACKS.maxDaysSingle),
    getSiteSettingInt('pause_min_notice_hours', FALLBACKS.minNoticeHours),
  ]);

  return { productType, maxPauseCount, maxPauseDaysTotal, maxPauseDaysSingle, minNoticeHours };
}

/**
 * Map an enrollments.enrollment_type value onto the pause product axis.
 * 'tuition' → tuition; everything else (starter/continuation/full/coaching/null)
 * → coaching. Mirrors the switch-route currentType derivation.
 */
export function resolveProductType(enrollmentType: string | null | undefined): ProductType {
  return enrollmentType === 'tuition' ? 'tuition' : 'coaching';
}
