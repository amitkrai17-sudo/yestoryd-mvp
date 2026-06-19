// ============================================================================
// FILE: lib/tuition/schedule-preference.ts
// PURPOSE: Single source of truth for the tuition structured-schedule contract.
//   - schedulePreferenceSchema: the zod object the client sends (serialized to
//     the tuition_onboarding.schedule_preference TEXT column). Previously
//     DUPLICATED in app/api/admin/tuition/create and app/api/coach/onboard-student
//     (the latter carried a "DEBT: dedup both into one exported zod" comment).
//   - assertSpwDays: the sessions-per-week <-> days-pool placement rule.
// ============================================================================

import { z } from 'zod';

export const SCHEDULE_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Structured schedule the client sends; serialized to schedule_preference (TEXT). */
export const schedulePreferenceSchema = z.object({
  days: z.array(z.enum(SCHEDULE_DAY_NAMES)),
  times: z.record(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).optional().default({}),
  defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timeSlot: z.string().max(50).optional(),
});

export type SchedulePreferenceInput = z.infer<typeof schedulePreferenceSchema>;

/**
 * sessions_per_week <-> days-pool placement rule.
 *
 * The implicit DEFAULT_DAY_SETS fallback in the scheduler only maps spw 1-5; for
 * spw 6/7 with no explicit days it would fall back to a 2-day pool (Tue/Thu) and
 * silently under-place. Same principle as the session_mode default: don't guess
 * when the default could be wrong (weekend availability varies by coach). So for
 * spw >= 6 we REQUIRE an explicit pool of at least `spw` DISTINCT days. spw 1-5
 * carry no constraint (byte-identical to prior behavior).
 *
 * @returns a user-facing error string, or null when valid.
 */
export function assertSpwDays(spw: number, days: string[] | undefined): string | null {
  if (spw >= 6) {
    const distinct = new Set(days ?? []).size;
    if (distinct < spw) {
      return `6+ sessions per week requires explicitly selecting at least ${spw} days.`;
    }
  }
  return null;
}
