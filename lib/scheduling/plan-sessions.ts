// ============================================================================
// FILE: lib/scheduling/plan-sessions.ts
// PURPOSE: PURE placement planner for tuition session dates (RC-5 fix).
//   Decides WHICH dates/times sessions land on — nothing else. No Supabase, no
//   writes, no calendar, no Date.now() beyond reconstructing the caller-supplied
//   startDate anchor. The scheduler (enrollment-scheduler.ts) feeds it loaded
//   skip-sets + resolveTime + existing-session weekdays and then builds the SAME
//   INSERT rows it always has — only scheduled_date / scheduled_time / week_number
//   now come from here.
//
// MODEL — pool vs rate (the bug this fixes):
//   schedule_preference.days is a PREFERENCE POOL (acceptable weekdays), NOT an
//   exact schedule. sessions_per_week is the RATE. The old loop placed on EVERY
//   pool day every week, so a [Sat,Sun] pool at 1x/week produced 2 sessions/week.
//
// ANCHORED-FALLBACK:
//   - Pick `spw` ANCHOR day(s) used EVERY week for the routine.
//       · renewal (existingDays non-empty): the spw most-frequent existing
//         weekday(s) — never silently move an established class day.
//       · first schedule: max-spacing subset of the pool (spw==1 → FIRST pool
//         day in days-order; preserves the parent's stated priority).
//       · history with fewer distinct days than spw: fill the rest via max-spacing
//         from unused pool days.
//   - When an anchor day is BLOCKED in a given week: use the nearest OTHER pool
//     day in the SAME week; if none is free, the slot SLIPS to next week's anchor.
//     Never double-up a week to compensate. Never invent a day outside the pool.
//   - pool smaller than spw: place what the distinct pool days allow, push the
//     remainder to later weeks, emit a warning. Never invent a non-pool weekday.
//
// DATE MATH (mirrors enrollment-scheduler.ts:961-1064 EXACTLY):
//   - anchor = new Date(`${startDate}T12:00:00+05:30`)  (noon-IST, like 961-971)
//   - weekday via getUTCDay() on noon-IST dates (so 6 === Sat holds, like 1004)
//   - weekNumber = floor( floor((cand - anchor)/86400000) / 7 ) + 1  (like 1061-1064)
//   - every output date via formatDateISO (en-CA, Asia/Kolkata). No bare
//     new Date(dateStr) — that drifts at the IST/UTC boundary.
// ============================================================================

import { formatDateISO } from '@/lib/utils/date-format';

const DAY_MS = 86_400_000;

export interface PlanInput {
  /** The RATE — sessions to place per week. */
  sessionsPerWeek: number;
  /** Acceptable weekdays as JS getDay() ints 0-6, in schedule_preference.days
   *  ORDER (order is the spw==1 tiebreak — DO NOT pass a sorted array). */
  poolDays: number[];
  /** Total sessions to place. */
  count: number;
  /** formatDateISO "YYYY-MM-DD"; the planner anchors at T12:00:00+05:30. */
  startDate: string;
  /** SOLE time reader — returns "HH:MM:SS" for a given weekday (resolveSessionTime). */
  resolveTime: (dayOfWeek: number) => string;
  /** Day-of-week (0-6) of existing non-cancelled sessions — the renewal anchor source. */
  existingDays: number[];
  /** Two granularities of blocked dates (see plan-sessions header). */
  skip: {
    /** DATE keys "YYYY-MM-DD" — coach leave (whole day) ∪ this child's occupied dates. */
    dayUnavailable: Set<string>;
    /** "YYYY-MM-DD HH:MM:SS" keys — coach busy that exact slot ∪ slot capacity full. */
    slotTaken: Set<string>;
  };
  /** Safety bound on how many weeks forward to scan. Default 26. */
  maxWeeksLookahead?: number;
}

export interface Placement {
  scheduledDate: string;  // formatDateISO "YYYY-MM-DD"
  scheduledTime: string;  // "HH:MM:SS" from resolveTime
  weekNumber: number;
}

// ── pure helpers ────────────────────────────────────────────────────────────

/** Dedupe preserving first-seen order (pool order is load-bearing). */
function uniqueInOrder(days: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const d of days) {
    if (!seen.has(d)) { seen.add(d); out.push(d); }
  }
  return out;
}

/** Minimum circular gap (week wraps at 7) among a set of weekdays. <2 days → Infinity. */
function minCircGap(days: number[]): number {
  if (days.length < 2) return Infinity;
  const s = [...days].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 0; i < s.length; i++) {
    const next = i + 1 < s.length ? s[i + 1] : s[0] + 7;
    min = Math.min(min, next - s[i]);
  }
  return min;
}

/** All k-combinations of arr, enumerated in arr (pool) order — first wins ties. */
function combinations(arr: number[], k: number): number[][] {
  const res: number[][] = [];
  const rec = (start: number, combo: number[]) => {
    if (combo.length === k) { res.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1, combo);
      combo.pop();
    }
  };
  rec(0, []);
  return res;
}

/**
 * Choose k days from `pool` maximizing the min circular gap of (seed ∪ chosen),
 * tiebroken by pool order. pool.length <= k → all pool days. k==1 with empty seed
 * → pool[0] (every singleton scores Infinity; first combo wins) === "first day".
 */
function chooseSubset(pool: number[], k: number, seed: number[]): number[] {
  if (k <= 0) return [];
  if (pool.length <= k) return [...pool];
  const combos = combinations(pool, k);
  let best = combos[0];
  let bestScore = -Infinity;
  for (const c of combos) {
    const score = minCircGap([...seed, ...c]);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** Distinct weekdays ranked by frequency desc, tiebreak weekday asc. */
function rankByFrequency(days: number[]): number[] {
  const freq = new Map<number, number>();
  for (const d of days) freq.set(d, (freq.get(d) ?? 0) + 1);
  return Array.from(freq.keys()).sort((a, b) => {
    const fd = (freq.get(b) as number) - (freq.get(a) as number);
    return fd !== 0 ? fd : a - b;
  });
}

/** The spw anchor weekdays (renewal-history first, else first-schedule max-spacing). */
function selectAnchors(distinctPool: number[], k: number, existingDays: number[]): number[] {
  if (k <= 0) return [];
  if (existingDays.length > 0) {
    const fromHistory = rankByFrequency(existingDays).slice(0, k);
    if (fromHistory.length >= k) return fromHistory;
    // History has fewer distinct days than spw — fill from unused pool, max-spacing.
    const need = k - fromHistory.length;
    const unusedPool = distinctPool.filter((d) => !fromHistory.includes(d));
    return [...fromHistory, ...chooseSubset(unusedPool, need, fromHistory)];
  }
  return chooseSubset(distinctPool, k, []);
}

/** Clone + add UTC days (mirrors the loop's setUTCDate bump; never new Date(str)). */
function addUTCDays(d: Date, n: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

/** The unique date in week W's 7-day window whose getUTCDay() === day. */
function dateForWeekDay(anchorDate: Date, week: number, day: number): Date {
  const base = addUTCDays(anchorDate, 7 * (week - 1));
  for (let off = 0; off < 7; off++) {
    const cand = addUTCDays(base, off);
    if (cand.getUTCDay() === day) return cand;
  }
  return base; // unreachable — every 7-day window holds each weekday once
}

// ── planner ───────────────────────────────────────────────────────────────

export function planSessions(input: PlanInput): { placements: Placement[]; warnings: string[] } {
  const { sessionsPerWeek, poolDays, count, startDate, resolveTime, existingDays, skip } = input;
  const maxWeeks = input.maxWeeksLookahead ?? 26;
  const warnings: string[] = [];
  const placements: Placement[] = [];

  if (count <= 0) return { placements, warnings };

  const distinctPool = uniqueInOrder(poolDays);
  if (distinctPool.length === 0) {
    warnings.push('No pool days provided — cannot place sessions.');
    return { placements, warnings };
  }

  const effectiveSpw = Math.min(sessionsPerWeek, distinctPool.length);
  if (distinctPool.length < sessionsPerWeek) {
    warnings.push(
      `Pool has ${distinctPool.length} distinct day(s) but sessions_per_week is ${sessionsPerWeek}; ` +
      `placing ${effectiveSpw}/week and pushing the remainder to later weeks.`,
    );
  }

  const anchorDate = new Date(`${startDate}T12:00:00+05:30`);
  const startWeekday = anchorDate.getUTCDay();
  const offsetOf = (day: number) => ((day - startWeekday) + 7) % 7;

  const anchors = selectAnchors(distinctPool, effectiveSpw, existingDays);
  // Process anchors in chronological-within-week order (constant across weeks).
  const anchorOrder = [...anchors].sort((a, b) => offsetOf(a) - offsetOf(b));
  // Spare pool days available as same-week fallback (pool order preserved).
  const fallbackPool = distinctPool.filter((d) => !anchors.includes(d));

  const isBlocked = (dateStr: string, day: number): boolean =>
    skip.dayUnavailable.has(dateStr) ||
    skip.slotTaken.has(`${dateStr} ${resolveTime(day)}`);

  for (let week = 1; week <= maxWeeks && placements.length < count; week++) {
    const usedThisWeek = new Set<number>();

    for (const anchorDay of anchorOrder) {
      if (placements.length >= count) break;

      let useDay: number | null = null;
      let useDate: Date | null = null;

      // 1. The anchor day itself.
      const anchorD = dateForWeekDay(anchorDate, week, anchorDay);
      if (!usedThisWeek.has(anchorDay) && !isBlocked(formatDateISO(anchorD), anchorDay)) {
        useDay = anchorDay;
        useDate = anchorD;
      } else {
        // 2. Nearest OTHER pool day in the SAME week (pool-order tiebreak).
        let bestDist = Infinity;
        for (const fd of fallbackPool) {
          if (usedThisWeek.has(fd)) continue;
          const fdDate = dateForWeekDay(anchorDate, week, fd);
          if (isBlocked(formatDateISO(fdDate), fd)) continue;
          const dist = Math.abs(offsetOf(fd) - offsetOf(anchorDay));
          if (dist < bestDist) { bestDist = dist; useDay = fd; useDate = fdDate; }
        }
      }

      // 3. Else slip — no placement this slot this week (never double-up).
      if (useDay !== null && useDate !== null) {
        usedThisWeek.add(useDay);
        const weekNumber =
          Math.floor(Math.floor((useDate.getTime() - anchorDate.getTime()) / DAY_MS) / 7) + 1;
        placements.push({
          scheduledDate: formatDateISO(useDate),
          scheduledTime: resolveTime(useDay),
          weekNumber,
        });
      }
    }
  }

  if (placements.length < count) {
    warnings.push(
      `Placed ${placements.length}/${count} sessions within ${maxWeeks}-week lookahead; ` +
      `${count - placements.length} could not be placed.`,
    );
  }

  // Emit in chronological order (dates are unique, so this is unambiguous) — the
  // caller assigns session_number by iterating placements in order.
  placements.sort((a, b) =>
    a.scheduledDate < b.scheduledDate ? -1
    : a.scheduledDate > b.scheduledDate ? 1
    : a.scheduledTime < b.scheduledTime ? -1
    : a.scheduledTime > b.scheduledTime ? 1
    : 0,
  );

  return { placements, warnings };
}
