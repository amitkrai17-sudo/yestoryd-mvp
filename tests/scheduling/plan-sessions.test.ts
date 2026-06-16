// ============================================================================
// Tests for the pure placement planner (RC-5 fix). Asserts EXACT placements —
// the regression these guard is "pool treated as exact schedule" (every pool day
// placed every week), which over-placed sessions vs sessions_per_week.
//
// Calendar reference (all 2026): 06-18 Thu, 06-19 Fri, 06-20 Sat, 06-21 Sun,
//   06-22 Mon, 06-25 Thu, 06-26 Fri, 06-27 Sat, 06-28 Sun, 07-03 Fri, 07-04 Sat.
// Weekday ints (JS getDay): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { planSessions, type PlanInput } from '@/lib/scheduling/plan-sessions';

/** Constant time reader — every weekday resolves to 16:00:00 ("HH:MM:SS"). */
const resolveTime = (_day: number): string => '16:00:00';

/** Empty skip-sets (nothing blocked). */
const noSkip = () => ({ dayUnavailable: new Set<string>(), slotTaken: new Set<string>() });

/** Build a PlanInput with sane defaults, overridable per case. */
function makeInput(over: Partial<PlanInput>): PlanInput {
  return {
    sessionsPerWeek: 1,
    poolDays: [6, 0],
    count: 1,
    startDate: '2026-06-18', // Thursday
    resolveTime,
    existingDays: [],
    skip: noSkip(),
    ...over,
  };
}

/** Re-derive the JS weekday of a placement date the SAME way the planner does
 *  (noon-IST anchor + getUTCDay) — no bare new Date(dateStr). */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
}

describe('planSessions — anchored-fallback placement (RC-5)', () => {
  // T1 — THE BUG. spw=1 with a 2-day pool must place ONE/week on the anchor day,
  // not one per pool day per week. startDate pinned to a Thursday to also prove
  // start-weekday independence.
  it('T1 regression (Ira): spw=1, pool=[Sat,Sun] → 4 Saturdays, one per week', () => {
    const { placements, warnings } = planSessions(
      makeInput({ sessionsPerWeek: 1, poolDays: [6, 0], count: 4 }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual([
      '2026-06-20',
      '2026-06-27',
      '2026-07-04',
      '2026-07-11',
    ]);
    expect(placements.map((p) => p.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(placements.every((p) => weekdayOf(p.scheduledDate) === 6)).toBe(true); // all Saturdays
    expect(placements.every((p) => p.scheduledTime === '16:00:00')).toBe(true);
    expect(warnings).toEqual([]);
  });

  // T2 — the 10 real families: pool size == spw, place every pool day every week.
  it('T2 days==spw: spw=2, pool=[Mon,Fri] → Mon+Fri each week (no regression)', () => {
    const { placements, warnings } = planSessions(
      makeInput({ sessionsPerWeek: 2, poolDays: [1, 5], count: 6, startDate: '2026-06-22' }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual([
      '2026-06-22', // Mon wk1
      '2026-06-26', // Fri wk1
      '2026-06-29', // Mon wk2
      '2026-07-03', // Fri wk2
      '2026-07-06', // Mon wk3
      '2026-07-10', // Fri wk3
    ]);
    expect(placements.map((p) => p.weekNumber)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(placements.map((p) => weekdayOf(p.scheduledDate))).toEqual([1, 5, 1, 5, 1, 5]);
    expect(warnings).toEqual([]);
  });

  // T3 — first schedule, pool larger than spw: max-spacing picks Mon+Thu, never Mon+Tue.
  it('T3 first-schedule max-spacing: spw=2, pool=[Mon,Tue,Thu] → Mon+Thu', () => {
    const { placements } = planSessions(
      makeInput({ sessionsPerWeek: 2, poolDays: [1, 2, 4], count: 2, startDate: '2026-06-22' }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual([
      '2026-06-22', // Mon
      '2026-06-25', // Thu
    ]);
    const weekdays = placements.map((p) => weekdayOf(p.scheduledDate));
    expect(weekdays).toEqual([1, 4]); // Mon + Thu
    expect(weekdays).not.toContain(2); // never Tuesday
  });

  // T4 — renewal: anchor follows the most-frequent EXISTING weekday (established routine).
  it('T4 renewal anchor: existingDays=[Sat,Sat,Sat], pool=[Sat,Sun], spw=1 → anchors Sat', () => {
    const { placements } = planSessions(
      makeInput({ sessionsPerWeek: 1, poolDays: [6, 0], count: 2, existingDays: [6, 6, 6] }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual(['2026-06-20', '2026-06-27']);
    expect(placements.every((p) => weekdayOf(p.scheduledDate) === 6)).toBe(true);
  });

  // T5 — anchor blocked one week → nearest OTHER pool day SAME week (Sun), others stay Sat.
  it('T5 anchor blocked → same-week fallback to Sun, other weeks Sat', () => {
    const { placements } = planSessions(
      makeInput({
        sessionsPerWeek: 1,
        poolDays: [6, 0],
        count: 3,
        skip: { dayUnavailable: new Set(['2026-06-27']), slotTaken: new Set<string>() }, // wk2 Sat off
      }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual([
      '2026-06-20', // wk1 Sat
      '2026-06-28', // wk2 Sun (fallback)
      '2026-07-04', // wk3 Sat
    ]);
    expect(placements.map((p) => weekdayOf(p.scheduledDate))).toEqual([6, 0, 6]);
    expect(placements.map((p) => p.weekNumber)).toEqual([1, 2, 3]);
  });

  // T6 — whole week blocked (Sat+Sun) → slip to next week's anchor, NO double-up.
  it('T6 whole week blocked → slip forward, no double-up', () => {
    const { placements } = planSessions(
      makeInput({
        sessionsPerWeek: 1,
        poolDays: [6, 0],
        count: 2,
        skip: {
          dayUnavailable: new Set(['2026-06-20', '2026-06-21']), // wk1 Sat + Sun both off
          slotTaken: new Set<string>(),
        },
      }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual(['2026-06-27', '2026-07-04']);
    expect(placements.map((p) => p.weekNumber)).toEqual([2, 3]); // wk1 empty; one per later week
    expect(placements).toHaveLength(2);
  });

  // T7 — pool smaller than spw: place what distinct days allow + warn; never invent a 2nd day.
  it('T7 pool<spw: spw=2, pool=[Sat] → 1/week + warning, never invents a weekday', () => {
    const { placements, warnings } = planSessions(
      makeInput({ sessionsPerWeek: 2, poolDays: [6], count: 3 }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual([
      '2026-06-20',
      '2026-06-27',
      '2026-07-04',
    ]);
    expect(placements.every((p) => weekdayOf(p.scheduledDate) === 6)).toBe(true);
    expect(placements.map((p) => p.weekNumber)).toEqual([1, 2, 3]);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toContain('sessions_per_week is 2');
  });

  // T8 — slotTaken (slot-level collision) with no other pool day → fall forward a week,
  // never same-day double-book.
  it('T8 slotTaken: spw=1, pool=[Sat], wk1 Sat slot taken → falls forward to wk2 Sat', () => {
    const { placements } = planSessions(
      makeInput({
        sessionsPerWeek: 1,
        poolDays: [6],
        count: 2,
        skip: {
          dayUnavailable: new Set<string>(),
          slotTaken: new Set(['2026-06-20 16:00:00']), // wk1 Sat @ resolved time
        },
      }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual(['2026-06-27', '2026-07-04']);
    expect(placements[0].scheduledDate).not.toBe('2026-06-20'); // wk1 Sat skipped, not double-booked
    expect(placements.map((p) => p.weekNumber)).toEqual([2, 3]);
  });

  // T9 — Trace B (LOCKED): guards anchor identity = poolDays[0] against calendar-earliest
  // regression. startDate is a Sunday, so calendar-earliest of {Sat,Sun} would be Sun — but
  // days-order anchor is Sat, so BOTH placements must be Saturdays, not Sundays.
  it('T9 anchor identity is days-order, NOT calendar-earliest (Sunday start → Saturdays)', () => {
    const { placements } = planSessions(
      makeInput({
        sessionsPerWeek: 1,
        poolDays: [6, 0], // Sat first in days-order
        count: 2,
        startDate: '2026-06-21', // Sunday — Sun occurs before Sat in the week window
        existingDays: [],
      }),
    );
    expect(placements.map((p) => p.scheduledDate)).toEqual(['2026-06-27', '2026-07-04']);
    expect(placements.every((p) => weekdayOf(p.scheduledDate) === 6)).toBe(true); // Saturdays
    expect(placements.some((p) => weekdayOf(p.scheduledDate) === 0)).toBe(false); // never Sunday
  });
});
