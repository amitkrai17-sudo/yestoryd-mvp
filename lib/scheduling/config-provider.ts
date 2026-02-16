// ============================================================================
// SCHEDULING CONFIG PROVIDER
// lib/scheduling/config-provider.ts
// ============================================================================
//
// Single source of truth for ALL scheduling configuration.
// Reads from site_settings, pricing_plans, coach_schedule_rules tables.
// Cached with 5-minute TTL to minimize database reads.
//
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPlanSchedule as getConfigPlanSchedule,
  getSchedulingDurations,
  type PlanSchedule,
  type SchedulingDurations,
} from './config';

// ============================================================================
// TYPES
// ============================================================================

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
// CACHE
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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

    const value = data?.value ?? null;
    setCache(cacheKey, value);
    return value;
  } catch {
    return null;
  }
}

async function getSettingValues(keys: string[]): Promise<Record<string, string>> {
  // Check cache for all keys
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
        result[row.key] = row.value;
        setCache(`setting:${row.key}`, row.value);
      }
    }
  } catch (error) {
    console.error('[ConfigProvider] Error fetching settings:', error);
  }

  return result;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get session duration for a given session type.
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
 * Get plan schedule (delegates to existing config.ts).
 */
export async function getPlanSchedule(planSlug: string): Promise<PlanSchedule> {
  const cacheKey = `planSchedule:${planSlug}`;
  const cached = getCached<PlanSchedule>(cacheKey);
  if (cached) return cached;

  const schedule = await getConfigPlanSchedule(planSlug);
  setCache(cacheKey, schedule);
  return schedule;
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

    // preferred_day is a single number (0=Sun..6=Sat), preferred_time is a bucket string
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
