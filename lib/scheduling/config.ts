// ============================================================================
// SCHEDULING CONFIGURATION
// lib/scheduling/config.ts
// ============================================================================
//
// Single source of truth for scheduling configuration.
// Fetches plan structure from pricing_plans table and site_settings.
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

import { Database } from '@/lib/supabase/database.types';
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

// ============================================================================
// DEFAULT CONFIGURATION (fallbacks if DB unavailable)
// ============================================================================

export const DEFAULT_DURATIONS: SchedulingDurations = {
  coaching: 45,
  checkin: 45,
  skillBooster: 45,
  discovery: 30,
};

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
// DATABASE FETCHERS
// ============================================================================

/**
 * Get session durations from site_settings
 * Falls back to defaults if not configured
 */
export async function getSchedulingDurations(
  supabaseClient?: ReturnType<typeof createClient<Database>>
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
    console.error('[SchedulingConfig] Error fetching durations:', error);
    return DEFAULT_DURATIONS;
  }
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
 * Get plan schedule from pricing_plans table
 * Uses actual database column names
 */
export async function getPlanSchedule(
  planSlug: string,
  supabaseClient?: ReturnType<typeof createClient<Database>>
): Promise<PlanSchedule> {
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
      console.warn(`[SchedulingConfig] Plan '${planSlug}' not found, using defaults`);
      return DEFAULT_PLAN_SCHEDULES[planSlug] || DEFAULT_PLAN_SCHEDULES.full;
    }

    // Parse JSONB week schedules
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

    console.log(`[SchedulingConfig] Loaded plan '${planSlug}':`, {
      coaching: schedule.coaching.count,
      checkin: schedule.checkin.count,
      skillBooster: schedule.skillBooster.credits,
      coachingWeeks: schedule.coaching.weekSchedule,
      checkinWeeks: schedule.checkin.weekSchedule,
    });

    return schedule;
  } catch (error) {
    console.error(`[SchedulingConfig] Error fetching plan '${planSlug}':`, error);
    return DEFAULT_PLAN_SCHEDULES[planSlug] || DEFAULT_PLAN_SCHEDULES.full;
  }
}

/**
 * Parse JSONB week schedule from database
 */
function parseWeekSchedule(value: unknown): number[] | null {
  if (!value) return null;

  // Already an array
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'number').map(Number);
  }

  // String that looks like JSON array
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
