// ============================================================================
// SCHEDULING CONFIG PROVIDER
// lib/scheduling/config-provider.ts
// ============================================================================
//
// Single source of truth for ALL scheduling configuration.
// Reads from site_settings, pricing_plans, coach_schedule_rules tables.
// Cached with 5-minute TTL to minimize database reads.
//
// Previously split across config.ts + config-provider.ts — merged March 2026.
//
// CONFIRMED PLAN STRUCTURE:
// | Plan         | Weeks | Coaching | Check-in | Skill Booster | Coaching Weeks      | Check-in Weeks |
// |--------------|-------|----------|----------|---------------|---------------------|----------------|
// | starter      | 4     | 2        | 1        | 1             | [1, 2]              | [4]            |
// | continuation | 8     | 4        | 2        | 2             | [1, 2, 5, 6]        | [4, 8]         |
// | full         | 12    | 6        | 3        | 3             | [1, 2, 5, 6, 9, 10] | [4, 8, 12]     |
//
// SESSION DURATIONS:
// - ALL sessions: 45 minutes (coaching, check-in, skill booster)
// - ONLY Discovery: 30 minutes
//
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// TYPES
// ============================================================================

export interface PlanSchedule {
  slug: string;
  name: string;
  durationWeeks: number;
  durationMonths: number;
  coaching: {
    count: number;
    weekSchedule: number[];
    durationMinutes: number;
  };
  checkin: {
    count: number;
    weekSchedule: number[];
    durationMinutes: number;
  };
  skillBooster: {
    credits: number;
    durationMinutes: number;
  };
  totalAutoScheduled: number;
}

export interface SchedulingDurations {
  coaching: number;
  checkin: number;
  skillBooster: number;
  discovery: number;
}

export interface TimePreference {
  bucket: 'morning' | 'afternoon' | 'evening' | 'any';
  preferredDays?: number[]; // 0=Sun, 1=Mon... 6=Sat
}

export type SlotMatchType =
  | 'exact_match'           // Preferred day + preferred time
  | 'preferred_time'        // Any day, preferred time
  | 'preferred_day'         // Preferred day, any time
  | 'any_in_week'           // Any slot in the target week
  | 'shifted_week'          // Next week (couldn't fit in target week)
  | 'manual_required';      // No slot found, needs manual scheduling

export interface WorkingHours {
  start: string; // "09:00"
  end: string;   // "20:00"
  days: number[]; // 0=Sun, 1=Mon... 6=Sat
}

export interface UnavailabilityThresholds {
  backup: number;   // days — ≤ this: reschedule after return
  reassign: number;  // days — > backup and ≤ this: temp backup coach
  // > reassign: permanent reassignment
}

export interface RetryConfig {
  maxAttempts: number;
  delays: number[]; // hours — [0, 1, 6, 24]
}

export interface ParentPreferences {
  preferredDays: number[];
  preferredTimes: string[]; // "morning" | "afternoon" | "evening"
}

// ============================================================================
// DEFAULT CONFIGURATION (fallbacks if DB unavailable)
// ============================================================================

// Building-band defaults. Actual values come from age_band_config.session_duration_minutes
// via the enrollment's age_band. These are used only if DB lookup fails.
export const DEFAULT_DURATIONS: SchedulingDurations = {
  coaching: 45,
  checkin: 45,
  skillBooster: 45,
  discovery: 30,
};

// Building-band defaults for plan schedules. Actual session durations come from
// age_band_config via the caller (payment/verify passes sessionDurationMinutes).
export const DEFAULT_PLAN_SCHEDULES: Record<string, PlanSchedule> = {
  starter: {
    slug: 'starter',
    name: 'Starter Pack',
    durationWeeks: 4,
    durationMonths: 1,
    coaching: {
      count: 2,
      weekSchedule: [1, 2],
      durationMinutes: 45,
    },
    checkin: {
      count: 1,
      weekSchedule: [4],
      durationMinutes: 45,
    },
    skillBooster: {
      credits: 1,
      durationMinutes: 45,
    },
    totalAutoScheduled: 3,
  },
  continuation: {
    slug: 'continuation',
    name: 'Continuation',
    durationWeeks: 8,
    durationMonths: 2,
    coaching: {
      count: 4,
      weekSchedule: [1, 2, 5, 6],
      durationMinutes: 45,
    },
    checkin: {
      count: 2,
      weekSchedule: [4, 8],
      durationMinutes: 45,
    },
    skillBooster: {
      credits: 2,
      durationMinutes: 45,
    },
    totalAutoScheduled: 6,
  },
  full: {
    slug: 'full',
    name: 'Full Program',
    durationWeeks: 12,
    durationMonths: 3,
    coaching: {
      count: 6,
      weekSchedule: [1, 2, 5, 6, 9, 10],
      durationMinutes: 45,
    },
    checkin: {
      count: 3,
      weekSchedule: [4, 8, 12],
      durationMinutes: 45,
    },
    skillBooster: {
      credits: 3,
      durationMinutes: 45,
    },
    totalAutoScheduled: 9,
  },
};

// Time buckets for preference matching
export const TIME_BUCKETS: Record<'morning' | 'afternoon' | 'evening', { startHour: number; endHour: number; times: string[] }> = {
  morning: { startHour: 6, endHour: 12, times: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'] },
  afternoon: { startHour: 12, endHour: 17, times: ['12:00', '13:00', '14:00', '15:00', '16:00'] },
  evening: { startHour: 17, endHour: 21, times: ['17:00', '18:00', '19:00', '20:00'] },
};

// Session titles by type
export const SESSION_TITLES = {
  coaching: [
    'Initial Assessment & Goals',
    'Foundation Building',
    'Skill Development',
    'Practice & Reinforcement',
    'Advanced Techniques',
    'Confidence Building',
    'Mastery Building',
    'Final Skills Assessment',
    'Review & Consolidation',
    'Program Completion',
  ],
  checkin: [
    'Progress Review',
    'Mid-Program Review',
    'Progress Assessment',
    'Final Review & Next Steps',
  ],
  skillBooster: [
    'Targeted Practice Session',
    'Skill Reinforcement',
    'Extra Support Session',
  ],
};

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear all cached config (useful after admin updates) */
export function clearConfigCache(): void {
  cache.clear();
}

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createAdminClient();
}

async function getSettingValue(key: string): Promise<string | null> {
  const cacheKey = `setting:${key}`;
  const cached = getCached<string | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single();

    const raw = data?.value ?? null;
    const value = raw !== null ? String(raw) : null;
    setCache(cacheKey, value);
    return value;
  } catch {
    return null;
  }
}

async function getSettingValues(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const uncached: string[] = [];

  for (const key of keys) {
    const cached = getCached<string | null>(`setting:${key}`);
    if (cached !== null) {
      result[key] = cached;
    } else {
      uncached.push(key);
    }
  }

  if (uncached.length === 0) return result;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', uncached);

    if (data) {
      for (const row of data) {
        const val = row.value !== null ? String(row.value) : '';
        result[row.key] = val;
        setCache(`setting:${row.key}`, val);
      }
    }
  } catch (error) {
    console.error('[ConfigProvider] Error fetching settings:', error);
  }

  return result;
}

// Type for pricing_plans query result
interface PricingPlanRow {
  slug: string;
  name: string;
  duration_weeks: number | null;
  duration_months: number | null;
  sessions_coaching: number | null;
  sessions_checkin: number | null;
  sessions_skill_building: number | null;
  duration_coaching_mins: number | null;
  duration_checkin_mins: number | null;
  duration_skill_mins: number | null;
  coaching_week_schedule: unknown;
  checkin_week_schedule: unknown;
}

/**
 * Parse JSONB week schedule from database
 */
function parseWeekSchedule(value: unknown): number[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'number').map(Number);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(v => typeof v === 'number').map(Number);
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  return null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get session durations from site_settings.
 * Falls back to defaults if not configured.
 */
export async function getSchedulingDurations(
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<SchedulingDurations> {
  try {
    const supabase = supabaseClient || createAdminClient();

    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'scheduling_duration_coaching',
        'scheduling_duration_checkin',
        'scheduling_duration_skill_booster',
        'scheduling_duration_discovery',
      ]) as { data: Array<{ key: string; value: string }> | null };

    if (!settings || settings.length === 0) {
      return DEFAULT_DURATIONS;
    }

    const settingsMap = new Map(settings.map(s => [s.key, parseInt(s.value) || 0]));

    return {
      coaching: settingsMap.get('scheduling_duration_coaching') || DEFAULT_DURATIONS.coaching,
      checkin: settingsMap.get('scheduling_duration_checkin') || DEFAULT_DURATIONS.checkin,
      skillBooster: settingsMap.get('scheduling_duration_skill_booster') || DEFAULT_DURATIONS.skillBooster,
      discovery: settingsMap.get('scheduling_duration_discovery') || DEFAULT_DURATIONS.discovery,
    };
  } catch (error) {
    console.error('[ConfigProvider] Error fetching durations:', error);
    return DEFAULT_DURATIONS;
  }
}

/**
 * Get session duration for a given session type (cached).
 */
export async function getSessionDuration(
  sessionType: 'coaching' | 'checkin' | 'skillBooster' | 'discovery'
): Promise<number> {
  const cacheKey = 'durations';
  let durations = getCached<SchedulingDurations>(cacheKey);

  if (!durations) {
    durations = await getSchedulingDurations();
    setCache(cacheKey, durations);
  }

  return durations[sessionType];
}

/**
 * Get plan schedule from pricing_plans table (cached).
 * Uses actual database column names.
 */
export async function getPlanSchedule(
  planSlug: string,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<PlanSchedule> {
  const cacheKey = `planSchedule:${planSlug}`;
  const cached = getCached<PlanSchedule>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = supabaseClient || createAdminClient();

    const { data: plan, error } = await supabase
      .from('pricing_plans')
      .select(`
        slug,
        name,
        duration_weeks,
        duration_months,
        sessions_coaching,
        sessions_checkin,
        sessions_skill_building,
        duration_coaching_mins,
        duration_checkin_mins,
        duration_skill_mins,
        coaching_week_schedule,
        checkin_week_schedule
      `)
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single() as { data: PricingPlanRow | null; error: Error | null };

    if (error || !plan) {
      console.warn(`[ConfigProvider] Plan '${planSlug}' not found, using defaults`);
      return DEFAULT_PLAN_SCHEDULES[planSlug] || DEFAULT_PLAN_SCHEDULES.full;
    }

    const coachingWeekSchedule = parseWeekSchedule(plan.coaching_week_schedule) ||
      DEFAULT_PLAN_SCHEDULES[planSlug]?.coaching.weekSchedule ||
      [1, 2, 5, 6, 9, 10];

    const checkinWeekSchedule = parseWeekSchedule(plan.checkin_week_schedule) ||
      DEFAULT_PLAN_SCHEDULES[planSlug]?.checkin.weekSchedule ||
      [4, 8, 12];

    const schedule: PlanSchedule = {
      slug: plan.slug,
      name: plan.name,
      durationWeeks: plan.duration_weeks || ((plan.duration_months || 3) * 4),
      durationMonths: plan.duration_months || 3,
      coaching: {
        count: plan.sessions_coaching || 6,
        weekSchedule: coachingWeekSchedule,
        durationMinutes: plan.duration_coaching_mins || DEFAULT_DURATIONS.coaching,
      },
      checkin: {
        count: plan.sessions_checkin || 3,
        weekSchedule: checkinWeekSchedule,
        durationMinutes: plan.duration_checkin_mins || DEFAULT_DURATIONS.checkin,
      },
      skillBooster: {
        credits: plan.sessions_skill_building || 3,
        durationMinutes: plan.duration_skill_mins || DEFAULT_DURATIONS.skillBooster,
      },
      totalAutoScheduled: (plan.sessions_coaching || 6) + (plan.sessions_checkin || 3),
    };

    setCache(cacheKey, schedule);
    return schedule;
  } catch (error) {
    console.error(`[ConfigProvider] Error fetching plan '${planSlug}':`, error);
    return DEFAULT_PLAN_SCHEDULES[planSlug] || DEFAULT_PLAN_SCHEDULES.full;
  }
}

/**
 * Get working hours. If coachId provided, reads coach-specific rules.
 * Falls back to global site_settings defaults.
 */
export async function getWorkingHours(coachId?: string): Promise<WorkingHours> {
  const cacheKey = `workingHours:${coachId || 'global'}`;
  const cached = getCached<WorkingHours>(cacheKey);
  if (cached) return cached;

  const defaults: WorkingHours = {
    start: '09:00',
    end: '20:00',
    days: [1, 2, 3, 4, 5, 6], // Mon-Sat
  };

  try {
    if (coachId) {
      const supabase = getSupabase();
      const { data: rules } = await supabase
        .from('coach_schedule_rules')
        .select('day_of_week, start_time, end_time')
        .eq('coach_id', coachId)
        .eq('rule_type', 'available')
        .eq('scope', 'recurring')
        .eq('is_active', true);

      if (rules && rules.length > 0) {
        const days = Array.from(new Set(rules.map(r => r.day_of_week).filter((d): d is number => d !== null)));
        const earliest = rules.reduce(
          (min, r) => (r.start_time && r.start_time < min ? r.start_time : min),
          '23:59'
        );
        const latest = rules.reduce(
          (max, r) => (r.end_time && r.end_time > max ? r.end_time : max),
          '00:00'
        );

        const result: WorkingHours = {
          start: earliest.slice(0, 5),
          end: latest.slice(0, 5),
          days: days.sort(),
        };
        setCache(cacheKey, result);
        return result;
      }
    }

    // Global fallback from site_settings
    const settings = await getSettingValues([
      'scheduling_working_hours_start',
      'scheduling_working_hours_end',
      'scheduling_working_days',
    ]);

    const result: WorkingHours = {
      start: settings['scheduling_working_hours_start'] || defaults.start,
      end: settings['scheduling_working_hours_end'] || defaults.end,
      days: settings['scheduling_working_days']
        ? JSON.parse(settings['scheduling_working_days'])
        : defaults.days,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[ConfigProvider] Error fetching working hours:', error);
    return defaults;
  }
}

/**
 * Get unavailability thresholds for coach absence handling.
 */
export async function getUnavailabilityThresholds(): Promise<UnavailabilityThresholds> {
  const cacheKey = 'unavailabilityThresholds';
  const cached = getCached<UnavailabilityThresholds>(cacheKey);
  if (cached) return cached;

  const settings = await getSettingValues([
    'coach_unavailability_backup_days',
    'coach_unavailability_reassign_days',
  ]);

  const result: UnavailabilityThresholds = {
    backup: parseInt(settings['coach_unavailability_backup_days'] || '7', 10),
    reassign: parseInt(settings['coach_unavailability_reassign_days'] || '21', 10),
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get retry configuration for scheduling failures.
 */
export async function getRetryConfig(): Promise<RetryConfig> {
  const cacheKey = 'retryConfig';
  const cached = getCached<RetryConfig>(cacheKey);
  if (cached) return cached;

  const settings = await getSettingValues([
    'scheduling_retry_max_attempts',
    'scheduling_retry_delays',
  ]);

  const result: RetryConfig = {
    maxAttempts: parseInt(settings['scheduling_retry_max_attempts'] || '4', 10),
    delays: settings['scheduling_retry_delays']
      ? JSON.parse(settings['scheduling_retry_delays'])
      : [0, 1, 6, 24],
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get parent scheduling preferences for an enrollment.
 */
export async function getParentPreferences(enrollmentId: string): Promise<ParentPreferences> {
  const cacheKey = `parentPrefs:${enrollmentId}`;
  const cached = getCached<ParentPreferences>(cacheKey);
  if (cached) return cached;

  const defaults: ParentPreferences = {
    preferredDays: [],
    preferredTimes: [],
  };

  try {
    const supabase = getSupabase();
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('preferred_day, preferred_time')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) return defaults;

    const result: ParentPreferences = {
      preferredDays: enrollment.preferred_day != null
        ? [enrollment.preferred_day as number]
        : defaults.preferredDays,
      preferredTimes: enrollment.preferred_time
        ? [enrollment.preferred_time as string]
        : defaults.preferredTimes,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[ConfigProvider] Error fetching parent preferences:', error);
    return defaults;
  }
}

/**
 * Check if a feature flag is enabled.
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const cacheKey = `feature:${flag}`;
  const cached = getCached<boolean>(cacheKey);
  if (cached !== null) return cached;

  const value = await getSettingValue(`feature_${flag}`);
  const enabled = value === 'true' || value === '1';
  setCache(cacheKey, enabled);
  return enabled;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get hours for a time bucket
 */
export function getHoursForBucket(bucket: 'morning' | 'afternoon' | 'evening' | 'any'): string[] {
  if (bucket === 'any') {
    return [
      ...TIME_BUCKETS.morning.times,
      ...TIME_BUCKETS.afternoon.times,
      ...TIME_BUCKETS.evening.times,
    ];
  }
  return TIME_BUCKETS[bucket].times;
}

/**
 * Determine which bucket a time falls into
 */
export function getTimeBucket(timeStr: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(timeStr.split(':')[0]);
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Get session title based on type and index
 */
export function getSessionTitle(
  sessionType: 'coaching' | 'parent_checkin' | 'remedial',
  index: number
): string {
  const titles = sessionType === 'coaching'
    ? SESSION_TITLES.coaching
    : sessionType === 'parent_checkin'
    ? SESSION_TITLES.checkin
    : SESSION_TITLES.skillBooster;

  return titles[index % titles.length] || `Session ${index + 1}`;
}
