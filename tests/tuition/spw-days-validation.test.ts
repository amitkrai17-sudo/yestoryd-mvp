// ============================================================================
// SPW <-> DAYS GUARD — lib/tuition/schedule-preference.ts assertSpwDays
// tests/tuition/spw-days-validation.test.ts
//
// The implicit DEFAULT_DAY_SETS fallback only serves spw 1-5; spw 6/7 with no
// explicit pool silently under-places. The door-level guard requires an explicit
// pool of >= spw DISTINCT days for spw>=6; spw 1-5 are unconstrained. Plus a
// confirmation that planSessions itself places 6/week on a valid 6-day pool.
//
// Calendar (2026): 06-22 Mon, 06-23 Tue, 06-24 Wed, 06-25 Thu, 06-26 Fri, 06-27 Sat.
// Weekday ints (JS getDay): Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { assertSpwDays } from '@/lib/tuition/schedule-preference';
import { planSessions, type PlanInput } from '@/lib/scheduling/plan-sessions';

describe('assertSpwDays — spw<->days placement guard', () => {
  it('spw=6 with 6 days → passes (null)', () => {
    expect(assertSpwDays(6, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])).toBeNull();
  });

  it('spw=6 with 3 days → rejected (Branch 1: explicit days < spw)', () => {
    const err = assertSpwDays(6, ['Mon', 'Wed', 'Fri']);
    expect(err).toBe("6 sessions per week needs at least 6 days selected — you've selected 3. Add more days or reduce sessions per week.");
  });

  it('spw=7 with 7 days → passes (null)', () => {
    expect(assertSpwDays(7, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])).toBeNull();
  });

  it('spw=2 with no days → passes (unchanged, byte-identical)', () => {
    expect(assertSpwDays(2, undefined)).toBeNull();
  });

  it('spw=5 with no days → passes (unchanged — DEFAULT_DAY_SETS serves 1-5)', () => {
    expect(assertSpwDays(5, undefined)).toBeNull();
  });

  it('spw=6 with 6 names but only 4 DISTINCT → rejected (distinct count, not raw length)', () => {
    expect(assertSpwDays(6, ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Thu'])).toBe(
      "6 sessions per week needs at least 6 days selected — you've selected 4. Add more days or reduce sessions per week.",
    );
  });

  it('spw=6 with empty array → rejected (Branch 2: no days at spw>=6)', () => {
    expect(assertSpwDays(6, [])).not.toBeNull();
  });

  // 2C generalization — Branch 1 now rejects explicit days < spw at ANY spw (not just >=6).
  it('spw=3 with 2 days → rejected (Branch 1 at spw<6)', () => {
    expect(assertSpwDays(3, ['Mon', 'Wed'])).toBe(
      "3 sessions per week needs at least 3 days selected — you've selected 2. Add more days or reduce sessions per week.",
    );
  });

  it('spw=4 with 1 day → rejected (Branch 1 at spw<6)', () => {
    expect(assertSpwDays(4, ['Wed'])).toBe(
      "4 sessions per week needs at least 4 days selected — you've selected 1. Add more days or reduce sessions per week.",
    );
  });

  it('spw=3 with 3 days → passes (distinct == spw)', () => {
    expect(assertSpwDays(3, ['Mon', 'Tue', 'Wed'])).toBeNull();
  });

  it('spw=5 with 2 days → rejected (Branch 1 at spw<6)', () => {
    expect(assertSpwDays(5, ['Mon', 'Tue'])).toBe(
      "5 sessions per week needs at least 5 days selected — you've selected 2. Add more days or reduce sessions per week.",
    );
  });
});

describe('planSessions — spw=6 on a 6-day pool (planner half, already audited correct)', () => {
  const resolveTime = (_day: number): string => '16:00:00';
  const noSkip = () => ({ dayUnavailable: new Set<string>(), slotTaken: new Set<string>() });

  function makeInput(over: Partial<PlanInput>): PlanInput {
    return {
      sessionsPerWeek: 6,
      poolDays: [1, 2, 3, 4, 5, 6], // Mon..Sat
      count: 6,
      startDate: '2026-06-22', // Monday
      resolveTime,
      existingDays: [],
      skip: noSkip(),
      ...over,
    };
  }

  it('places 6 sessions in week 1, one per distinct day, no double-book', () => {
    const { placements, warnings } = planSessions(makeInput({}));
    expect(placements).toHaveLength(6);
    // All 6 in the same (first) week.
    expect(placements.every((p) => p.weekNumber === 1)).toBe(true);
    // 6 distinct dates (no day double-booked).
    const dates = placements.map((p) => p.scheduledDate);
    expect(new Set(dates).size).toBe(6);
    // No under-placement warning (pool == spw).
    expect(warnings).toEqual([]);
  });
});
