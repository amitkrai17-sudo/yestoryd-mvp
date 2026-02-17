// ============================================================================
// SMART SLOT FINDER
// lib/scheduling/smart-slot-finder.ts
// ============================================================================
//
// Intelligent slot finder that uses the existing /api/scheduling/slots endpoint
// which correctly checks coach_schedule_rules, coach_availability, etc.
//
// Priority Matching:
// 1. Exact match (preferred day + preferred time)
// 2. Preferred day, any time (DAY takes precedence over TIME)
// 3. Preferred time, any day in week
// 4. Any slot in target week
// 5. Next week (shifted)
// 6. Manual flag
//
// Features:
// - Maintains consistency (same day/time each week when possible)
// - Respects coach availability rules
// - Handles race conditions via session holds
//
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  TimePreference,
  SlotMatchType,
  getHoursForBucket,
  getTimeBucket,
} from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface AvailableSlot {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  datetime: string;   // ISO string
  endTime: string;    // HH:MM
  available: boolean;
  bucketName: string;
  coachIds?: string[];
}

export interface SlotSearchResult {
  found: boolean;
  slot: { date: string; time: string } | null;
  matchType: SlotMatchType;
  searchedDays: number;
  totalSlotsChecked: number;
}

export interface SlotFinderOptions {
  coachId: string;
  targetWeekStart: Date;
  preference: TimePreference;
  durationMinutes: number;
  sessionType: 'coaching' | 'discovery' | 'parent_checkin' | 'remedial';
  requestId?: string;
}

interface SlotsApiResponse {
  success: boolean;
  slots: AvailableSlot[];
  slotsByDate: Record<string, AvailableSlot[]>;
  error?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Find an available slot using the scheduling/slots API
 * Implements priority-based matching with fallback strategies
 */
export async function findAvailableSlot(
  options: SlotFinderOptions,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<SlotSearchResult> {
  const {
    coachId,
    targetWeekStart,
    preference,
    durationMinutes,
    sessionType,
    requestId = 'unknown',
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  let totalSlotsChecked = 0;

  try {
    // Fetch available slots from the API (14 days to allow for shifting)
    const params = new URLSearchParams({
      coachId,
      days: '14',
      sessionType,
    });

    const response = await fetch(`${baseUrl}/api/scheduling/slots?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[SmartSlotFinder] API error: ${response.status}`);
      return {
        found: false,
        slot: null,
        matchType: 'manual_required',
        searchedDays: 0,
        totalSlotsChecked: 0,
      };
    }

    const data: SlotsApiResponse = await response.json();

    if (!data.success || !data.slots || data.slots.length === 0) {
      console.log(`[SmartSlotFinder] No slots available from API`);
      return {
        found: false,
        slot: null,
        matchType: 'manual_required',
        searchedDays: 0,
        totalSlotsChecked: 0,
      };
    }

    // Filter to only available slots
    const availableSlots = data.slots.filter(s => s.available);
    totalSlotsChecked = availableSlots.length;

    if (availableSlots.length === 0) {
      return {
        found: false,
        slot: null,
        matchType: 'manual_required',
        searchedDays: 14,
        totalSlotsChecked,
      };
    }

    // Group slots by date for easier searching
    const slotsByDate = data.slotsByDate || groupSlotsByDate(availableSlots);

    // Calculate target week boundaries
    const weekStart = new Date(targetWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Resolve preferences — detect NULL/unset and apply sensible defaults
    const hasExplicitBucket = preference.bucket && preference.bucket !== 'any';
    const hasExplicitDays = preference.preferredDays && preference.preferredDays.length > 0;

    if (!hasExplicitBucket && !hasExplicitDays) {
      console.log(`[SmartSlotFinder] [${requestId}] No parent preferences set, using defaults: evening, any day`);
    }

    const effectiveBucket = hasExplicitBucket ? preference.bucket : 'evening';
    const preferredTimes = getHoursForBucket(effectiveBucket);
    // When no day preference is set, pass empty array so priority 1 & 2
    // (day-based matching) are skipped and we fall through to time-based or any-slot matching
    const preferredDays = hasExplicitDays ? preference.preferredDays! : [];

    // ========================================================================
    // PRIORITY 1: Exact match (preferred day + preferred time in target week)
    // ========================================================================
    const exactMatch = findExactMatch(
      slotsByDate,
      weekStart,
      weekEnd,
      preferredDays,
      preferredTimes
    );
    if (exactMatch) {
      console.log(`[SmartSlotFinder] [${requestId}] Found exact match: ${exactMatch.date} ${exactMatch.time}`);
      return {
        found: true,
        slot: exactMatch,
        matchType: 'exact_match',
        searchedDays: 7,
        totalSlotsChecked,
      };
    }

    // ========================================================================
    // PRIORITY 2: Preferred day, any time (DAY takes precedence over TIME)
    // ========================================================================
    const preferredDayMatch = findPreferredDayMatch(
      slotsByDate,
      weekStart,
      weekEnd,
      preferredDays
    );
    if (preferredDayMatch) {
      console.log(`[SmartSlotFinder] [${requestId}] Found preferred day match: ${preferredDayMatch.date} ${preferredDayMatch.time}`);
      return {
        found: true,
        slot: preferredDayMatch,
        matchType: 'preferred_day',
        searchedDays: 7,
        totalSlotsChecked,
      };
    }

    // ========================================================================
    // PRIORITY 3: Preferred time, any day in target week
    // ========================================================================
    const preferredTimeMatch = findPreferredTimeMatch(
      slotsByDate,
      weekStart,
      weekEnd,
      preferredTimes
    );
    if (preferredTimeMatch) {
      console.log(`[SmartSlotFinder] [${requestId}] Found preferred time match: ${preferredTimeMatch.date} ${preferredTimeMatch.time}`);
      return {
        found: true,
        slot: preferredTimeMatch,
        matchType: 'preferred_time',
        searchedDays: 7,
        totalSlotsChecked,
      };
    }

    // ========================================================================
    // PRIORITY 4: Any slot in target week
    // ========================================================================
    const anyWeekMatch = findAnyInWeek(slotsByDate, weekStart, weekEnd);
    if (anyWeekMatch) {
      console.log(`[SmartSlotFinder] [${requestId}] Found any-in-week match: ${anyWeekMatch.date} ${anyWeekMatch.time}`);
      return {
        found: true,
        slot: anyWeekMatch,
        matchType: 'any_in_week',
        searchedDays: 7,
        totalSlotsChecked,
      };
    }

    // ========================================================================
    // PRIORITY 5: Next week (shifted)
    // ========================================================================
    const nextWeekStart = new Date(weekEnd);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    const shiftedMatch = findAnyInWeek(slotsByDate, nextWeekStart, nextWeekEnd);
    if (shiftedMatch) {
      console.log(`[SmartSlotFinder] [${requestId}] Found shifted week match: ${shiftedMatch.date} ${shiftedMatch.time}`);
      return {
        found: true,
        slot: shiftedMatch,
        matchType: 'shifted_week',
        searchedDays: 14,
        totalSlotsChecked,
      };
    }

    // ========================================================================
    // PRIORITY 6: Manual required (no slots found)
    // ========================================================================
    console.log(`[SmartSlotFinder] [${requestId}] No slot found, manual scheduling required`);
    return {
      found: false,
      slot: null,
      matchType: 'manual_required',
      searchedDays: 14,
      totalSlotsChecked,
    };

  } catch (error) {
    console.error(`[SmartSlotFinder] [${requestId}] Error:`, error);
    return {
      found: false,
      slot: null,
      matchType: 'manual_required',
      searchedDays: 0,
      totalSlotsChecked,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupSlotsByDate(slots: AvailableSlot[]): Record<string, AvailableSlot[]> {
  const grouped: Record<string, AvailableSlot[]> = {};
  for (const slot of slots) {
    if (!grouped[slot.date]) {
      grouped[slot.date] = [];
    }
    grouped[slot.date].push(slot);
  }
  return grouped;
}

function isDateInRange(dateStr: string, start: Date, end: Date): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return date >= start && date <= end;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function findExactMatch(
  slotsByDate: Record<string, AvailableSlot[]>,
  weekStart: Date,
  weekEnd: Date,
  preferredDays: number[],
  preferredTimes: string[]
): { date: string; time: string } | null {
  for (const [dateStr, slots] of Object.entries(slotsByDate)) {
    if (!isDateInRange(dateStr, weekStart, weekEnd)) continue;

    const dayOfWeek = getDayOfWeek(dateStr);
    if (!preferredDays.includes(dayOfWeek)) continue;

    for (const slot of slots) {
      if (!slot.available) continue;
      const slotTime = slot.time.substring(0, 5); // HH:MM
      if (preferredTimes.some(pt => slotTime.startsWith(pt.substring(0, 5)))) {
        return { date: dateStr, time: slot.time };
      }
    }
  }
  return null;
}

function findPreferredTimeMatch(
  slotsByDate: Record<string, AvailableSlot[]>,
  weekStart: Date,
  weekEnd: Date,
  preferredTimes: string[]
): { date: string; time: string } | null {
  // Sort dates to get earliest first
  const sortedDates = Object.keys(slotsByDate).sort();

  for (const dateStr of sortedDates) {
    if (!isDateInRange(dateStr, weekStart, weekEnd)) continue;

    const slots = slotsByDate[dateStr];
    for (const slot of slots) {
      if (!slot.available) continue;
      const slotTime = slot.time.substring(0, 5);
      if (preferredTimes.some(pt => slotTime.startsWith(pt.substring(0, 5)))) {
        return { date: dateStr, time: slot.time };
      }
    }
  }
  return null;
}

function findPreferredDayMatch(
  slotsByDate: Record<string, AvailableSlot[]>,
  weekStart: Date,
  weekEnd: Date,
  preferredDays: number[]
): { date: string; time: string } | null {
  const sortedDates = Object.keys(slotsByDate).sort();

  for (const dateStr of sortedDates) {
    if (!isDateInRange(dateStr, weekStart, weekEnd)) continue;

    const dayOfWeek = getDayOfWeek(dateStr);
    if (!preferredDays.includes(dayOfWeek)) continue;

    const slots = slotsByDate[dateStr];
    for (const slot of slots) {
      if (slot.available) {
        return { date: dateStr, time: slot.time };
      }
    }
  }
  return null;
}

function findAnyInWeek(
  slotsByDate: Record<string, AvailableSlot[]>,
  weekStart: Date,
  weekEnd: Date
): { date: string; time: string } | null {
  const sortedDates = Object.keys(slotsByDate).sort();

  for (const dateStr of sortedDates) {
    if (!isDateInRange(dateStr, weekStart, weekEnd)) continue;

    const slots = slotsByDate[dateStr];
    for (const slot of slots) {
      if (slot.available) {
        return { date: dateStr, time: slot.time };
      }
    }
  }
  return null;
}

// ============================================================================
// CONSISTENCY FINDER
// ============================================================================

/**
 * Find a slot that maintains consistency with a previous slot
 * (same day of week and time if possible)
 */
export async function findConsistentSlot(
  options: SlotFinderOptions,
  previousSlot: { date: string; time: string },
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<SlotSearchResult> {
  // Extract day of week and time from previous slot
  const prevDayOfWeek = getDayOfWeek(previousSlot.date);
  const prevTime = previousSlot.time;

  // Create preference based on previous slot
  const consistentPreference: TimePreference = {
    bucket: getTimeBucket(prevTime),
    preferredDays: [prevDayOfWeek],
  };

  // First try with consistent preference
  const result = await findAvailableSlot({
    ...options,
    preference: consistentPreference,
  }, supabaseClient);

  // If exact or preferred match found, use it
  if (result.found && (result.matchType === 'exact_match' || result.matchType === 'preferred_time')) {
    return result;
  }

  // Fall back to original preference if consistency not possible
  return findAvailableSlot(options, supabaseClient);
}

// ============================================================================
// BATCH SLOT FINDER
// ============================================================================

/**
 * Find slots for multiple weeks at once, maintaining consistency
 */
export async function findSlotsForSchedule(
  coachId: string,
  programStart: Date,
  weekNumbers: number[],
  preference: TimePreference,
  durationMinutes: number,
  sessionType: 'coaching' | 'parent_checkin',
  requestId?: string,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<Array<SlotSearchResult & { weekNumber: number }>> {
  const results: Array<SlotSearchResult & { weekNumber: number }> = [];
  let previousSlot: { date: string; time: string } | null = null;

  for (const weekNumber of weekNumbers) {
    // Calculate target week start
    const targetWeekStart = new Date(programStart);
    targetWeekStart.setDate(targetWeekStart.getDate() + (weekNumber - 1) * 7);

    const options: SlotFinderOptions = {
      coachId,
      targetWeekStart,
      preference,
      durationMinutes,
      sessionType,
      requestId,
    };

    let result: SlotSearchResult;

    if (previousSlot) {
      // Try to maintain consistency with previous slot
      result = await findConsistentSlot(options, previousSlot, supabaseClient);
    } else {
      result = await findAvailableSlot(options, supabaseClient);
    }

    results.push({ ...result, weekNumber });

    if (result.found && result.slot) {
      previousSlot = result.slot;
    }
  }

  return results;
}
