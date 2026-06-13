// ============================================================================
// lib/scheduling/schedule-time.ts
// ----------------------------------------------------------------------------
// SSOT for tuition schedule TIME handling (Block 2D).
//
// CONTRACT (binding for all of 2D):
//   - Canonical stored time = "HH:MM" 24-hour. No AM/PM, no ranges, no free
//     text ever lives in storage or logic.
//   - parseScheduleTime() runs ONLY at capture / one-time migration
//     (free-text input → canonical "HH:MM" or reject). No READER parses prose.
//   - resolveSessionTime() is the SOLE reader. Precedence:
//       times[day] → defaultTime → timeSlot bucket → '16:00'.
//     Returns "HH:MM:SS" for scheduled_sessions.scheduled_time.
//
// This module is pure: no DB calls, no imports from scheduler/routes/calendar.
// The scheduler (2D-b), calendar (2D-c), and capture form (2D-d) consume it.
// ============================================================================

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/** Index === JS getDay() number (Sun=0 … Sat=6). */
export const DAY_KEYS: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface SchedulePreference {
  /** Selected weekdays. */
  days: DayKey[];
  /** Per-day canonical "HH:MM" times. Sparse — only days that differ need an entry. */
  times: Partial<Record<DayKey, string>>;
  /** Canonical "HH:MM" fallback when a day has no explicit time. */
  defaultTime?: string;
  /** Display / legacy bucket label. NEVER parsed by readers — bucket fallback only. */
  timeSlot?: string;
  /** Original free text, retained for audit ONLY. NEVER parsed by readers. */
  raw?: string;
}

// ----------------------------------------------------------------------------
// DAY HELPERS
// ----------------------------------------------------------------------------

/** Map a JS getDay() number (0=Sun…6=Sat) to its DayKey. Wraps defensively. */
export function dayNumToKey(n: number): DayKey {
  const idx = ((Math.trunc(n) % 7) + 7) % 7;
  return DAY_KEYS[idx];
}

/** Map a DayKey to its JS getDay() number (Sun=0…Sat=6). */
export function dayKeyToNum(k: DayKey): number {
  return DAY_KEYS.indexOf(k);
}

// ----------------------------------------------------------------------------
// INTERNAL: validation
// ----------------------------------------------------------------------------

function isValidHM(h: number, m: number): boolean {
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toHM(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// normalizeTime — picker guard (NOT a prose parser)
// ----------------------------------------------------------------------------

/**
 * Accept ONLY canonical-ish 24h input from a time picker: "H:MM" or "HH:MM".
 * Pads and validates (00<=h<=23, 00<=m<=59). Returns canonical "HH:MM" or null.
 * NO am/pm inference, NO ranges — this is a guard, not a parser.
 */
export function normalizeTime(input: string): string | null {
  if (typeof input !== 'string') return null;
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (!isValidHM(h, m)) return null;
  return toHM(h, m);
}

// ----------------------------------------------------------------------------
// parseScheduleTime — CAPTURE / MIGRATION ONLY (best-effort legacy free text)
// ----------------------------------------------------------------------------

/** True when the trimmed string looks like per-day / multi-time free text. */
function looksMultiOrDayPrefixed(s: string): boolean {
  // Multiple time tokens are separated by commas; or a weekday-name token
  // appears (e.g. "Tues: 6:45 pm, Sat: 12:45 pm").
  if (s.includes(',')) return true;
  return /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i.test(s);
}

/**
 * Best-effort parse of LEGACY free-text time for the one-time 2D migration.
 * NEVER call from a runtime reader — readers use resolveSessionTime().
 *
 * Returns { time, ambiguous }:
 *   - clean "11 am","9:30 am","5:30 pm" / "16:00" → exact 24h, ambiguous:false
 *   - bare "11" → resolved via timeSlotHint period if given (ambiguous:false),
 *     else { time:null, ambiguous:true } (do NOT guess)
 *   - range "4 to 6 pm","5:30 to 7:00" → START time, ambiguous:true (window lost)
 *   - day-prefixed/multi "Tues: 6:45 pm, Sat: 12:45 pm" → time:null, ambiguous:true
 *   - empty/whitespace → time:null, ambiguous:false (nothing to confirm)
 *   - anything else → time:null, ambiguous:true
 *
 * ambiguous:true means a human should confirm. Never silently PM-guess to a
 * non-ambiguous result for migration.
 */
export function parseScheduleTime(
  raw: string,
  timeSlotHint?: string,
): { time: string | null; ambiguous: boolean } {
  if (typeof raw !== 'string') return { time: null, ambiguous: true };
  const s = raw.trim();
  if (s === '') return { time: null, ambiguous: false };

  // Per-day / multi free text — cannot collapse to one time.
  if (looksMultiOrDayPrefixed(s)) return { time: null, ambiguous: true };

  // Exact 24h: "16:00" / "9:30"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    return isValidHM(h, m) ? { time: toHM(h, m), ambiguous: false } : { time: null, ambiguous: true };
  }

  // 12h with minutes: "5:30 pm", "9:30 am"
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const ap = m12[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return isValidHM(h, m) ? { time: toHM(h, m), ambiguous: false } : { time: null, ambiguous: true };
  }

  // Simple hour with am/pm: "11 am", "4 pm"
  const mSimple = s.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (mSimple) {
    let h = parseInt(mSimple[1], 10);
    const ap = mSimple[2].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return isValidHM(h, 0) ? { time: toHM(h, 0), ambiguous: false } : { time: null, ambiguous: true };
  }

  // Range: "4 to 6 pm", "7 to 8 pm", "5:30 to 7:00" → START time, flagged.
  const mRange = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(am|pm)?$/i);
  if (mRange) {
    let h = parseInt(mRange[1], 10);
    const m = mRange[2] ? parseInt(mRange[2], 10) : 0;
    const ap = mRange[3]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    // No am/pm and small hour → tuition is afternoon/evening; infer PM.
    if (!ap && h >= 1 && h <= 8) h += 12;
    return isValidHM(h, m) ? { time: toHM(h, m), ambiguous: true } : { time: null, ambiguous: true };
  }

  // Bare hour: "11" — only resolvable with a timeSlot period hint.
  const mBare = s.match(/^(\d{1,2})$/);
  if (mBare) {
    if (!timeSlotHint) return { time: null, ambiguous: true };
    let h = parseInt(mBare[1], 10);
    const period = timeSlotPeriod(timeSlotHint);
    if (period === null) return { time: null, ambiguous: true };
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return isValidHM(h, 0) ? { time: toHM(h, 0), ambiguous: false } : { time: null, ambiguous: true };
  }

  return { time: null, ambiguous: true };
}

/** AM/PM period implied by a legacy timeSlot bucket label, or null if unknown. */
function timeSlotPeriod(slot?: string): 'am' | 'pm' | null {
  switch (slot?.toLowerCase()) {
    case 'morning':
    case 'morning (9-12)':
      return 'am';
    case 'afternoon':
    case 'afternoon (12-3)':
    case 'evening':
    case 'evening (3-6)':
    case 'late evening':
    case 'late evening (6-9)':
      return 'pm';
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// resolveSessionTime — SOLE READER
// ----------------------------------------------------------------------------

/** Legacy bucket → canonical "HH:MM". Default '16:00'. Display labels only. */
export function timeSlotBucket(slot?: string): string {
  switch (slot?.toLowerCase()) {
    case 'morning':
    case 'morning (9-12)':
      return '10:00';
    case 'afternoon':
    case 'afternoon (12-3)':
      return '14:00';
    case 'evening':
    case 'evening (3-6)':
      return '17:00';
    case 'late evening':
    case 'late evening (6-9)':
      return '19:00';
    default:
      return '16:00';
  }
}

/**
 * SOLE reader of schedule time. Pure — never parses prose.
 * Precedence: times[day] → defaultTime → timeSlot bucket → '16:00'.
 * Returns "HH:MM:SS" suitable for scheduled_sessions.scheduled_time.
 */
export function resolveSessionTime(pref: SchedulePreference, dayNum: number): string {
  const key = dayNumToKey(dayNum);
  const hm = pref.times?.[key] || pref.defaultTime || timeSlotBucket(pref.timeSlot);
  return `${hm}:00`;
}

// ----------------------------------------------------------------------------
// DB CHECK constraint text (applied by the 2D-e migration, NOT here)
// ----------------------------------------------------------------------------

/**
 * CHECK expression asserting scheduled_time is canonical "HH:MM:SS".
 * Definition only — the 2D-e migration wraps this in ALTER TABLE … ADD CONSTRAINT.
 */
export const timeCheckConstraintSql =
  "scheduled_time::text ~ '^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$'";
