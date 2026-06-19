// ============================================================================
// ENROLLMENT SCHEDULER
// lib/scheduling/enrollment-scheduler.ts
// ============================================================================
//
// V3: Weekly-pattern-based scheduling engine.
//
// When weeklyPattern is provided (from age_band_config):
//   - Iterates over sliced weekly_pattern
//   - Creates ONLY coaching sessions (no parent_checkin auto-scheduling)
//   - Handles 0 (rest week), 1 (one session), 2 (two sessions on different days)
//   - Duration from age_band_config.session_duration_minutes
//
// Legacy fallback (no weeklyPattern):
//   - Uses getPlanSchedule() from pricing_plans (coaching + checkin week schedules)
//
// ============================================================================

import {
  getPlanSchedule,
  getSessionTitle,
  TimePreference,
  SlotMatchType,
} from './config';
import { findAvailableSlot, findSlotsForSchedule, SlotSearchResult } from './smart-slot-finder';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createScheduledSessionsBatch,
  type CreateSessionParams,
} from './session-engine';
import { resolveOnlineLink } from './session-mode-service';
import { resolveSessionTime, dayNumToKey, type SchedulePreference } from './schedule-time';
import { planSessions } from './plan-sessions';
import { formatDateISO } from '@/lib/utils/date-format';

// ============================================================================
// TYPES
// ============================================================================

export interface ScheduledSession {
  enrollment_id: string;
  child_id: string;
  coach_id: string;
  session_number: number;
  session_type: 'coaching' | 'parent_checkin' | 'tuition';
  session_title: string;
  week_number: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  duration_minutes: number;
  slot_match_type?: SlotMatchType;
  is_diagnostic?: boolean;
  session_mode?: string;
}

export interface TuitionSchedulerResult {
  success: boolean;
  sessionsCreated: number;
  errors: string[];
}

export interface EnrollmentSchedulerOptions {
  enrollmentId: string;
  childId: string;
  coachId: string;
  planSlug: string;
  programStart: Date;
  preference?: TimePreference;
  requestId?: string;
  // V3: weekly-pattern-based scheduling
  weeklyPattern?: number[];
  sessionDurationMinutes?: number;
  startWeek?: number;      // 0-indexed offset for continuation (4 = start at week 5)
  durationWeeks?: number;  // from pricing_plans (starter=4, continuation=8, full=12)
}

export interface EnrollmentSchedulerResult {
  success: boolean;
  sessionsCreated: number;
  sessions: ScheduledSession[];
  manualRequired: number;
  errors: string[];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Schedule all sessions for an enrollment.
 * V3: When weeklyPattern is provided, uses pattern-based scheduling (coaching only).
 * Legacy: Falls back to plan-based scheduling from pricing_plans.
 */
export async function scheduleEnrollmentSessions(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<EnrollmentSchedulerResult> {
  // V3 path: weekly_pattern-based scheduling
  if (options.weeklyPattern && options.weeklyPattern.length > 0) {
    return scheduleWithWeeklyPattern(options, supabaseClient);
  }

  // Legacy path: plan-based scheduling from pricing_plans
  return scheduleLegacy(options, supabaseClient);
}

// ============================================================================
// V3: WEEKLY PATTERN SCHEDULING (coaching only)
// ============================================================================

async function scheduleWithWeeklyPattern(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<EnrollmentSchedulerResult> {
  const {
    enrollmentId,
    childId,
    coachId,
    programStart,
    preference = { bucket: 'any' },
    requestId = 'unknown',
    weeklyPattern = [],
    sessionDurationMinutes = 45, // Building-band default; actual value from age_band_config via caller
    startWeek = 0,
    durationWeeks = 12,
  } = options;

  const supabase = supabaseClient || createAdminClient();
  const errors: string[] = [];
  const sessionsToCreate: ScheduledSession[] = [];

  try {
    // Slice the pattern for this pricing tier
    const pattern = weeklyPattern.slice(startWeek, startWeek + durationWeeks);

    console.log(`[EnrollmentScheduler] [${requestId}] V3 pattern scheduling:`, {
      enrollmentId,
      weeklyPattern,
      startWeek,
      durationWeeks,
      slicedPattern: pattern,
      sessionDurationMinutes,
    });

    // ========================================================================
    // STEP 1: Build session list from weekly pattern
    // ========================================================================
    let sessionNumber = 1;

    for (let weekIdx = 0; weekIdx < pattern.length; weekIdx++) {
      const sessionsThisWeek = pattern[weekIdx];
      if (sessionsThisWeek === 0) continue; // Rest week (e.g., Mastery weeks 4, 8, 12)

      const weekNumber = weekIdx + 1; // 1-indexed for DB/display
      const targetWeekStart = new Date(programStart);
      targetWeekStart.setDate(targetWeekStart.getDate() + weekIdx * 7);

      // Track slots found in this week to avoid same-day for 2-session weeks
      let firstSlotDay: string | null = null;

      for (let sessionIdx = 0; sessionIdx < sessionsThisWeek; sessionIdx++) {
        // Build preference — for 2nd session in week, prefer a different day
        let slotPreference = { ...preference };
        if (sessionIdx > 0 && firstSlotDay) {
          // Exclude the day of the first slot by preferring other weekdays
          const firstDayOfWeek = new Date(firstSlotDay + 'T00:00:00').getDay();
          const otherDays = [1, 2, 3, 4, 5, 6].filter(d => d !== firstDayOfWeek); // Mon-Sat excluding first
          slotPreference = {
            ...preference,
            preferredDays: otherDays,
          };
        }

        let slotResult: SlotSearchResult;
        try {
          slotResult = await findAvailableSlot({
            coachId,
            targetWeekStart,
            preference: slotPreference,
            durationMinutes: sessionDurationMinutes,
            sessionType: 'coaching',
            requestId,
          }, supabase);
        } catch {
          // Slot finder failed — use fallback
          slotResult = { found: false, slot: null, matchType: 'manual_required', searchedDays: 0, totalSlotsChecked: 0 };
        }

        if (slotResult.found && slotResult.slot) {
          // Check for same-day conflict in 2-session weeks
          if (sessionIdx > 0 && firstSlotDay && slotResult.slot.date === firstSlotDay) {
            // Same day as first — mark for manual scheduling
            const fallbackDate = new Date(targetWeekStart);
            fallbackDate.setDate(fallbackDate.getDate() + (sessionIdx * 2) + 1);
            sessionsToCreate.push({
              enrollment_id: enrollmentId,
              child_id: childId,
              coach_id: coachId,
              session_number: sessionNumber,
              session_type: 'coaching',
              session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', sessionNumber - 1)}`,
              week_number: weekNumber,
              scheduled_date: fallbackDate.toISOString().split('T')[0],
              scheduled_time: '10:00:00',
              status: 'pending_scheduling',
              duration_minutes: sessionDurationMinutes,
              slot_match_type: 'manual_required',
            });
            errors.push(`Coaching ${sessionNumber} (week ${weekNumber}): Same-day conflict, needs manual scheduling`);
          } else {
            sessionsToCreate.push({
              enrollment_id: enrollmentId,
              child_id: childId,
              coach_id: coachId,
              session_number: sessionNumber,
              session_type: 'coaching',
              session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', sessionNumber - 1)}`,
              week_number: weekNumber,
              scheduled_date: slotResult.slot.date,
              scheduled_time: slotResult.slot.time,
              status: 'pending',
              duration_minutes: sessionDurationMinutes,
              slot_match_type: slotResult.matchType,
            });
            if (sessionIdx === 0) firstSlotDay = slotResult.slot.date;
          }
        } else {
          // No slot found — create with fallback date
          const fallbackDate = new Date(targetWeekStart);
          fallbackDate.setDate(fallbackDate.getDate() + (sessionIdx * 2));

          sessionsToCreate.push({
            enrollment_id: enrollmentId,
            child_id: childId,
            coach_id: coachId,
            session_number: sessionNumber,
            session_type: 'coaching',
            session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', sessionNumber - 1)}`,
            week_number: weekNumber,
            scheduled_date: fallbackDate.toISOString().split('T')[0],
            scheduled_time: '10:00:00',
            status: 'pending_scheduling',
            duration_minutes: sessionDurationMinutes,
            slot_match_type: 'manual_required',
          });
          errors.push(`Coaching ${sessionNumber} (week ${weekNumber}): No slot found, needs manual scheduling`);
        }

        sessionNumber++;
      }
    }

    // Mark first coaching session as diagnostic
    if (sessionsToCreate.length > 0) {
      sessionsToCreate[0].is_diagnostic = true;
    }

    console.log(`[EnrollmentScheduler] [${requestId}] V3 sessions built:`, {
      total: sessionsToCreate.length,
      manualRequired: sessionsToCreate.filter(s => s.slot_match_type === 'manual_required').length,
      durationMinutes: sessionDurationMinutes,
    });

    // ========================================================================
    // STEP 2: Insert sessions into database
    // ========================================================================
    return await insertAndFinalize(enrollmentId, childId, sessionsToCreate, errors, requestId, supabase);

  } catch (error: any) {
    console.error(`[EnrollmentScheduler] [${requestId}] V3 error:`, error);
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`V3 scheduling failed: ${error.message}`],
    };
  }
}

// ============================================================================
// LEGACY: Plan-based scheduling (coaching + checkin from pricing_plans)
// ============================================================================

async function scheduleLegacy(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<EnrollmentSchedulerResult> {
  const {
    enrollmentId,
    childId,
    coachId,
    planSlug,
    programStart,
    preference = { bucket: 'any' },
    requestId = 'unknown',
  } = options;

  const supabase = supabaseClient || createAdminClient();
  const errors: string[] = [];
  const sessionsToCreate: ScheduledSession[] = [];

  try {
    console.log(`[EnrollmentScheduler] [${requestId}] Legacy scheduling for enrollment ${enrollmentId}`);

    const planSchedule = await getPlanSchedule(planSlug, supabase);

    console.log(`[EnrollmentScheduler] [${requestId}] Plan loaded:`, {
      slug: planSlug,
      coaching: planSchedule.coaching.count,
      checkin: planSchedule.checkin.count,
      coachingWeeks: planSchedule.coaching.weekSchedule,
      checkinWeeks: planSchedule.checkin.weekSchedule,
    });

    // Find coaching slots
    const coachingSlots = await findSlotsForSchedule(
      coachId,
      programStart,
      planSchedule.coaching.weekSchedule,
      preference,
      planSchedule.coaching.durationMinutes,
      'coaching',
      requestId,
      supabase
    );

    let sessionNumber = 1;
    for (let i = 0; i < coachingSlots.length; i++) {
      const slotResult = coachingSlots[i];
      const weekNumber = slotResult.weekNumber;

      if (slotResult.found && slotResult.slot) {
        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: sessionNumber,
          session_type: 'coaching',
          session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', i)}`,
          week_number: weekNumber,
          scheduled_date: slotResult.slot.date,
          scheduled_time: slotResult.slot.time,
          status: 'pending',
          duration_minutes: planSchedule.coaching.durationMinutes,
          slot_match_type: slotResult.matchType,
        });
      } else {
        const fallbackDate = new Date(programStart);
        fallbackDate.setDate(fallbackDate.getDate() + (weekNumber - 1) * 7);

        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: sessionNumber,
          session_type: 'coaching',
          session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', i)}`,
          week_number: weekNumber,
          scheduled_date: fallbackDate.toISOString().split('T')[0],
          scheduled_time: '10:00:00',
          status: 'pending_scheduling',
          duration_minutes: planSchedule.coaching.durationMinutes,
          slot_match_type: 'manual_required',
        });
        errors.push(`Coaching session ${sessionNumber} (week ${weekNumber}): No slot found`);
      }
      sessionNumber++;
    }

    // Find check-in slots (legacy only)
    const checkinSlots = await findSlotsForSchedule(
      coachId,
      programStart,
      planSchedule.checkin.weekSchedule,
      preference,
      planSchedule.checkin.durationMinutes,
      'parent_checkin',
      requestId,
      supabase
    );

    for (let i = 0; i < checkinSlots.length; i++) {
      const slotResult = checkinSlots[i];
      const weekNumber = slotResult.weekNumber;

      if (slotResult.found && slotResult.slot) {
        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: sessionNumber,
          session_type: 'parent_checkin',
          session_title: `Parent Check-in ${i + 1}: ${getSessionTitle('parent_checkin', i)}`,
          week_number: weekNumber,
          scheduled_date: slotResult.slot.date,
          scheduled_time: slotResult.slot.time,
          status: 'pending',
          duration_minutes: planSchedule.checkin.durationMinutes,
          slot_match_type: slotResult.matchType,
        });
      } else {
        const fallbackDate = new Date(programStart);
        fallbackDate.setDate(fallbackDate.getDate() + (weekNumber - 1) * 7);

        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: sessionNumber,
          session_type: 'parent_checkin',
          session_title: `Parent Check-in ${i + 1}: ${getSessionTitle('parent_checkin', i)}`,
          week_number: weekNumber,
          scheduled_date: fallbackDate.toISOString().split('T')[0],
          scheduled_time: '10:00:00',
          status: 'pending_scheduling',
          duration_minutes: planSchedule.checkin.durationMinutes,
          slot_match_type: 'manual_required',
        });
        errors.push(`Check-in ${i + 1} (week ${weekNumber}): No slot found`);
      }
      sessionNumber++;
    }

    // Sort by week number, coaching before check-in
    sessionsToCreate.sort((a, b) => {
      if (a.week_number !== b.week_number) return a.week_number - b.week_number;
      if (a.session_type !== b.session_type) return a.session_type === 'coaching' ? -1 : 1;
      return 0;
    });

    sessionsToCreate.forEach((session, idx) => {
      session.session_number = idx + 1;
      if (idx === 0 && session.session_type === 'coaching') {
        session.is_diagnostic = true;
      }
    });

    console.log(`[EnrollmentScheduler] [${requestId}] Legacy sessions built:`, {
      total: sessionsToCreate.length,
      coaching: sessionsToCreate.filter(s => s.session_type === 'coaching').length,
      checkin: sessionsToCreate.filter(s => s.session_type === 'parent_checkin').length,
      manualRequired: sessionsToCreate.filter(s => s.slot_match_type === 'manual_required').length,
    });

    return await insertAndFinalize(enrollmentId, childId, sessionsToCreate, errors, requestId, supabase);

  } catch (error: any) {
    console.error(`[EnrollmentScheduler] [${requestId}] Legacy error:`, error);
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`Legacy scheduling failed: ${error.message}`],
    };
  }
}

// ============================================================================
// SHARED: Insert sessions + update enrollment + assign templates
// ============================================================================

async function insertAndFinalize(
  enrollmentId: string,
  childId: string,
  sessionsToCreate: ScheduledSession[],
  errors: string[],
  requestId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<EnrollmentSchedulerResult> {
  if (sessionsToCreate.length === 0) {
    return {
      success: true,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: ['No sessions to create (pattern may be all zeros)'],
    };
  }

  const paramsArray: CreateSessionParams[] = sessionsToCreate.map(toCreateParams);

  const results = await createScheduledSessionsBatch(paramsArray, {
    skipCalendar: true,
    skipRecall: true,
    skipNotifications: true,
    requestId,
    onInsertComplete: async (sessionIds) => {
      await assignTemplatesAndUpdateEnrollment(
        supabase,
        enrollmentId,
        childId,
        sessionsToCreate,
        sessionIds,
        errors,
        requestId,
      );
    },
  });

  const insertFailure = !results.some((r) => r.success);
  if (insertFailure) {
    const msg = results[0]?.error ?? 'insert failed';
    console.error(`[EnrollmentScheduler] [${requestId}] Insert error:`, msg);
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`Failed to insert sessions: ${msg}`],
    };
  }

  const manualRequired = sessionsToCreate.filter(s => s.slot_match_type === 'manual_required').length;

  console.log(`[EnrollmentScheduler] [${requestId}] Scheduling complete:`, {
    success: true,
    sessionsCreated: sessionsToCreate.length,
    manualRequired,
    errors: errors.length,
  });

  return {
    success: true,
    sessionsCreated: sessionsToCreate.length,
    sessions: sessionsToCreate,
    manualRequired,
    errors,
  };
}

// ----------------------------------------------------------------------------
// Shape translator: ScheduledSession (internal, pre-insert) → CreateSessionParams
// ----------------------------------------------------------------------------
function toCreateParams(s: ScheduledSession): CreateSessionParams {
  const p: CreateSessionParams = {
    enrollmentId: s.enrollment_id,
    childId: s.child_id,
    coachId: s.coach_id,
    sessionType: s.session_type,
    sessionNumber: s.session_number,
    sessionTitle: s.session_title,
    weekNumber: s.week_number,
    scheduledDate: s.scheduled_date,
    scheduledTime: s.scheduled_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    // 3C-a: state mode explicitly. Tuition arrives with session_mode set (defaultMode);
    // coaching + parent_checkin arrive without one and are ONLINE by nature (Recall).
    sessionMode: s.session_mode ?? 'online',
  };
  if (s.is_diagnostic) p.isDiagnostic = true;
  if (s.slot_match_type) p.slotMatchType = s.slot_match_type;
  const extra = s as ScheduledSession & { batch_id?: string | null; google_meet_link?: string | null };
  if (extra.batch_id !== undefined) p.batchId = extra.batch_id;
  if (extra.google_meet_link) p.googleMeetLink = extra.google_meet_link;
  return p;
}

// ----------------------------------------------------------------------------
// Shared hook body: template autoassign + enrollment update.
// Runs inside createScheduledSessionsBatch's onInsertComplete, so it fires
// AFTER rows are inserted. Preserves the original sequence:
//   1. Map child_id → week → session_template_id
//   2. Per inserted coaching row, write session_template_id (keyed by week)
//   3. Update enrollments: schedule_confirmed=true, sessions_scheduled=N
// ----------------------------------------------------------------------------
async function assignTemplatesAndUpdateEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  childId: string,
  sessionsToCreate: ScheduledSession[],
  sessionIds: string[],
  errors: string[],
  requestId: string,
): Promise<void> {
  try {
    const { data: learningPlans } = await supabase
      .from('season_learning_plans')
      .select('week_number, session_template_id')
      .eq('child_id', childId) as { data: { week_number: number; session_template_id: string | null }[] | null };

    if (learningPlans && learningPlans.length > 0) {
      const templateByWeek = new Map<number, string>();
      for (const plan of learningPlans) {
        if (plan.session_template_id) {
          templateByWeek.set(plan.week_number, plan.session_template_id);
        }
      }

      for (let i = 0; i < sessionsToCreate.length; i++) {
        const session = sessionsToCreate[i];
        if (session.session_type !== 'coaching') continue;
        const templateId = templateByWeek.get(session.week_number);
        const sessionId = sessionIds[i];
        if (templateId && sessionId) {
          await supabase
            .from('scheduled_sessions')
            .update({ session_template_id: templateId })
            .eq('id', sessionId);
        }
      }

      console.log(`[EnrollmentScheduler] [${requestId}] Templates assigned:`, {
        plansFound: learningPlans.length,
        sessionsMatched: sessionsToCreate.filter(
          s => s.session_type === 'coaching' && templateByWeek.has(s.week_number)
        ).length,
      });
    }
  } catch (templateErr) {
    console.warn(`[EnrollmentScheduler] [${requestId}] Template assignment skipped:`, templateErr);
  }

  const { error: updateError } = await supabase
    .from('enrollments')
    .update({
      schedule_confirmed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  if (updateError) {
    console.error(`[EnrollmentScheduler] [${requestId}] Enrollment update error:`, updateError);
    errors.push(`Warning: Failed to update enrollment: ${updateError.message}`);
  }
}

// ============================================================================
// SIMPLE FALLBACK (no smart slot finding)
// ============================================================================

/**
 * Simple session creation without slot finding.
 * V3: When weeklyPattern is provided, creates coaching-only sessions from pattern.
 * Legacy: Uses plan schedules for coaching + checkin.
 */
export async function createSessionsSimple(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<EnrollmentSchedulerResult> {
  const {
    enrollmentId,
    childId,
    coachId,
    planSlug,
    programStart,
    requestId = 'unknown',
    weeklyPattern,
    sessionDurationMinutes = 45, // Building-band default; actual value from age_band_config via caller
    startWeek = 0,
    durationWeeks = 12,
  } = options;

  const supabase = supabaseClient || createAdminClient();

  try {
    const sessionsToCreate: ScheduledSession[] = [];
    const defaultTimes = ['10:00:00', '11:00:00', '14:00:00', '15:00:00', '16:00:00', '17:00:00'];
    let timeIndex = 0;

    if (weeklyPattern && weeklyPattern.length > 0) {
      // ====================================================================
      // V3 SIMPLE: Pattern-based, coaching only
      // ====================================================================
      const pattern = weeklyPattern.slice(startWeek, startWeek + durationWeeks);
      let sessionNumber = 1;

      for (let weekIdx = 0; weekIdx < pattern.length; weekIdx++) {
        const sessionsThisWeek = pattern[weekIdx];
        if (sessionsThisWeek === 0) continue; // Rest week

        const weekNumber = weekIdx + 1;

        for (let sessionIdx = 0; sessionIdx < sessionsThisWeek; sessionIdx++) {
          const sessionDate = new Date(programStart);
          sessionDate.setDate(sessionDate.getDate() + weekIdx * 7);
          // For 2-session weeks, offset the 2nd session by 2 days (e.g., Mon + Wed)
          if (sessionIdx > 0) {
            sessionDate.setDate(sessionDate.getDate() + 2);
          }

          sessionsToCreate.push({
            enrollment_id: enrollmentId,
            child_id: childId,
            coach_id: coachId,
            session_number: sessionNumber,
            session_type: 'coaching',
            session_title: `Coaching ${sessionNumber}: ${getSessionTitle('coaching', sessionNumber - 1)}`,
            week_number: weekNumber,
            scheduled_date: sessionDate.toISOString().split('T')[0],
            scheduled_time: defaultTimes[timeIndex % defaultTimes.length],
            status: 'pending',
            duration_minutes: sessionDurationMinutes,
          });
          sessionNumber++;
          timeIndex++;
        }
      }

      // Mark first as diagnostic
      if (sessionsToCreate.length > 0) {
        sessionsToCreate[0].is_diagnostic = true;
      }

      console.log(`[EnrollmentScheduler] [${requestId}] V3 simple:`, {
        total: sessionsToCreate.length,
        durationMinutes: sessionDurationMinutes,
        pattern: pattern,
      });
    } else {
      // ====================================================================
      // LEGACY SIMPLE: Plan-based coaching + checkin
      // ====================================================================
      const planSchedule = await getPlanSchedule(planSlug, supabase);

      for (let i = 0; i < planSchedule.coaching.weekSchedule.length; i++) {
        const weekNumber = planSchedule.coaching.weekSchedule[i];
        const sessionDate = new Date(programStart);
        sessionDate.setDate(sessionDate.getDate() + (weekNumber - 1) * 7);

        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: i + 1,
          session_type: 'coaching',
          session_title: `Coaching ${i + 1}: ${getSessionTitle('coaching', i)}`,
          week_number: weekNumber,
          scheduled_date: sessionDate.toISOString().split('T')[0],
          scheduled_time: defaultTimes[timeIndex % defaultTimes.length],
          status: 'pending',
          duration_minutes: planSchedule.coaching.durationMinutes,
        });
        timeIndex++;
      }

      const coachingCount = planSchedule.coaching.weekSchedule.length;
      for (let i = 0; i < planSchedule.checkin.weekSchedule.length; i++) {
        const weekNumber = planSchedule.checkin.weekSchedule[i];
        const sessionDate = new Date(programStart);
        sessionDate.setDate(sessionDate.getDate() + (weekNumber - 1) * 7);

        sessionsToCreate.push({
          enrollment_id: enrollmentId,
          child_id: childId,
          coach_id: coachId,
          session_number: coachingCount + i + 1,
          session_type: 'parent_checkin',
          session_title: `Parent Check-in ${i + 1}: ${getSessionTitle('parent_checkin', i)}`,
          week_number: weekNumber,
          scheduled_date: sessionDate.toISOString().split('T')[0],
          scheduled_time: defaultTimes[timeIndex % defaultTimes.length],
          status: 'pending',
          duration_minutes: planSchedule.checkin.durationMinutes,
        });
        timeIndex++;
      }

      // Sort and renumber
      sessionsToCreate.sort((a, b) => a.week_number - b.week_number);
      sessionsToCreate.forEach((session, idx) => {
        session.session_number = idx + 1;
        if (idx === 0 && session.session_type === 'coaching') {
          session.is_diagnostic = true;
        }
      });
    }

    // Engine-backed insert. skipCalendar because createSessionsSimple is the
    // simple-fallback path and has never synced calendar — preserving that.
    // Site #2 currently returns errors: [] on success regardless of enrollment-
    // update outcome, so the hook's warnings drain into a throwaway array.
    const paramsArray: CreateSessionParams[] = sessionsToCreate.map(toCreateParams);
    const ignoredErrors: string[] = [];

    const results = await createScheduledSessionsBatch(paramsArray, {
      skipCalendar: true,
      skipRecall: true,
      skipNotifications: true,
      requestId,
      onInsertComplete: async (sessionIds) => {
        await assignTemplatesAndUpdateEnrollment(
          supabase,
          enrollmentId,
          childId,
          sessionsToCreate,
          sessionIds,
          ignoredErrors,
          requestId,
        );
      },
    });

    const insertFailure = !results.some((r) => r.success);
    if (insertFailure) {
      const msg = results[0]?.error ?? 'insert failed';
      return {
        success: false,
        sessionsCreated: 0,
        sessions: [],
        manualRequired: 0,
        errors: [`Insert failed: ${msg}`],
      };
    }

    return {
      success: true,
      sessionsCreated: sessionsToCreate.length,
      sessions: sessionsToCreate,
      manualRequired: 0,
      errors: [],
    };

  } catch (error: any) {
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`Error: ${error.message}`],
    };
  }
}

// ============================================================================
// TUITION: Auto-schedule all sessions at payment time
// ============================================================================

/** Default day distribution when no schedule_preference is set */
const DEFAULT_DAY_SETS: Record<number, number[]> = {
  1: [2],            // 1x/week → Tuesday
  2: [2, 4],         // 2x/week → Tuesday + Thursday
  3: [1, 3, 5],      // 3x/week → Monday + Wednesday + Friday
  4: [1, 2, 4, 5],   // 4x/week → Mon + Tue + Thu + Fri
  5: [1, 2, 3, 4, 5], // 5x/week → weekdays
};

/** Convert day name to JS getDay() number (0=Sun) */
function dayNameToNumber(name: string): number | null {
  const map: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };
  return map[name.toLowerCase()] ?? null;
}

// timeSlotToTime() REMOVED in 2D-b — the inline prose parser had zero callers
// after wiring resolveSessionTime() from ./schedule-time (the SSOT reader).
// No prose is parsed at schedule time; readers resolve canonical "HH:MM" only.

/**
 * Auto-schedule all tuition sessions for an enrollment.
 *
 * Reads tuition_onboarding for: schedule_preference, sessions_per_week,
 * session_duration_minutes, default_session_mode.
 *
 * @param enrollmentId  The tuition enrollment to schedule for
 * @param startAfterDate  Optional — schedule sessions starting after this date
 *                        (used for top-ups to avoid overlapping existing sessions)
 */
export async function scheduleTuitionSessions(
  enrollmentId: string,
  startAfterDate?: string,
  supabaseClient?: ReturnType<typeof createAdminClient>
): Promise<TuitionSchedulerResult> {
  const supabase = supabaseClient || createAdminClient();
  const errors: string[] = [];

  try {
    // 1. Fetch enrollment
    const { data: enrollment, error: enrErr } = await supabase
      .from('enrollments')
      .select('id, child_id, coach_id, sessions_remaining, program_start')
      .eq('id', enrollmentId)
      .single();

    if (enrErr || !enrollment) {
      return { success: false, sessionsCreated: 0, errors: [`Enrollment not found: ${enrErr?.message}`] };
    }

    // Count existing non-completed/non-cancelled sessions to avoid double-scheduling
    const { count: existingScheduledCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .not('status', 'in', '("completed","cancelled","missed")');

    const alreadyScheduled = existingScheduledCount || 0;
    const totalRemaining = enrollment.sessions_remaining || 0;
    const sessionsToSchedule = Math.max(0, totalRemaining - alreadyScheduled);

    if (sessionsToSchedule <= 0) {
      return { success: true, sessionsCreated: 0, errors: ['All remaining sessions are already scheduled'] };
    }

    // 2. Fetch tuition_onboarding config (including batch fields)
    // Note: batch_id, meet_link added via migration — not in generated types yet, use select('*')
    const { data: onboarding } = await supabase
      .from('tuition_onboarding')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .single();

    const sessionsPerWeek = onboarding?.sessions_per_week || 2;
    const durationMinutes = onboarding?.session_duration_minutes || 60;
    const defaultMode = onboarding?.default_session_mode || 'offline';
    const batchId = (onboarding as any)?.batch_id as string | null;
    // Persistent classroom link from tuition_onboarding (may be null for new/offline batches)
    const batchMeetLink = (onboarding as any)?.meet_link as string | null;

    // 3. Parse schedule_preference
    let preferredDays: number[] = [];
    // SSOT: resolveSessionTime() (./schedule-time) is the sole time reader. Build a
    // SchedulePreference here; never parse prose at read. Legacy rows that carry only
    // preferredTime (no times/defaultTime) fall to the timeSlot bucket inside
    // resolveSessionTime until 2D-e migrates them to structured per-day times.
    let schedulePref: SchedulePreference = { days: [], times: {} };

    if (onboarding?.schedule_preference) {
      try {
        const pref = typeof onboarding.schedule_preference === 'string'
          ? JSON.parse(onboarding.schedule_preference)
          : onboarding.schedule_preference;

        // Extract days
        if (Array.isArray(pref.days) && pref.days.length > 0) {
          for (const day of pref.days) {
            const num = typeof day === 'number' ? day : dayNameToNumber(String(day));
            if (num !== null) preferredDays.push(num);
          }
        }

        // Build the SchedulePreference for resolveSessionTime (no prose parsing).
        schedulePref = {
          days: preferredDays.map(dayNumToKey),
          times: (pref.times && typeof pref.times === 'object') ? pref.times : {},
          defaultTime: typeof pref.defaultTime === 'string' ? pref.defaultTime : undefined,
          timeSlot: typeof pref.timeSlot === 'string' ? pref.timeSlot : undefined,
        };
      } catch {
        console.warn(`[TuitionScheduler] Failed to parse schedule_preference for enrollment ${enrollmentId}`);
      }
    }

    // Fallback days if none set
    if (preferredDays.length === 0) {
      if (sessionsPerWeek >= 6) {
        // DEFENSE-IN-DEPTH (spw 6/7): the door-level guard (assertSpwDays) requires an
        // explicit >= spw-day pool for spw>=6. Reaching here means it was bypassed.
        // DEFAULT_DAY_SETS has no 6/7 entry, so the old fallback used DEFAULT_DAY_SETS[2]
        // (Tue/Thu) and SILENTLY under-placed. Refuse that: leave the pool empty so
        // planSessions emits its own "no pool days" warning (0 placements, surfaced)
        // rather than placing a 6/7x enrollment on a wrong 2-day pool.
        errors.push(
          `sessions_per_week=${sessionsPerWeek} reached the scheduler with no schedule_preference days; ` +
          `refusing the 2-day default (would under-place). Needs an explicit ${sessionsPerWeek}-day pool.`,
        );
        console.error(JSON.stringify({
          event: 'tuition_spw_high_no_days_pool',
          enrollmentId,
          sessionsPerWeek,
        }));
      } else {
        preferredDays = DEFAULT_DAY_SETS[sessionsPerWeek] || DEFAULT_DAY_SETS[2]!;
        errors.push('No schedule_preference days found — using defaults');
      }
    }

    // RC-5 (2C): capture pool in days-order BEFORE the sort — the planner's spw==1
    // anchor tiebreak is days-order (poolDays[0]). Captured after the fallback so it
    // is never empty.
    const poolDaysOrdered = [...preferredDays];

    // Sort days for consistent ordering
    preferredDays.sort((a, b) => a - b);

    // 4. Determine start date — single noon-IST calendar-date anchor for ALL branches
    // (2B-2a), matching the codebase convention (lib/whatsapp/agent/slots.ts): anchor
    // `${dateStr}T12:00:00+05:30` and use getUTC* accessors so adding a day / deriving the
    // weekday never crosses a date boundary. The previous IST-offset parse mixed with
    // local getDate/setDate skewed the day-after bump, so a renewal re-landed on the last
    // session's date. YYYY-MM-DD output uses formatDateISO (IST), never toISOString.
    let startDate: Date;
    if (startAfterDate) {
      // startAfterDate is a YYYY-MM-DD date-column value; anchor at noon IST, then +1 day.
      startDate = new Date(`${startAfterDate}T12:00:00+05:30`);
      startDate.setUTCDate(startDate.getUTCDate() + 1); // Day after last existing session
    } else if (enrollment.program_start) {
      // Anchor on program_start's IST calendar date (not its raw UTC instant), noon IST.
      startDate = new Date(`${formatDateISO(enrollment.program_start)}T12:00:00+05:30`);
    } else {
      startDate = new Date(`${formatDateISO(new Date())}T12:00:00+05:30`);
    }

    // 5. Get existing session count for numbering
    const { count: existingCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId);

    let sessionNumber = (existingCount || 0) + 1;

    // Occupancy guard (2B-2a): dates already held by non-cancelled sessions for this
    // enrollment. Never place on an occupied date, and never let two NEW sessions share
    // a date. Because the last session's own date is occupied, strictly-after is implied.
    const { data: occupiedRows } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date')
      .eq('enrollment_id', enrollmentId)
      .neq('status', 'cancelled');
    const occupiedDates = new Set<string>(
      ((occupiedRows || []).map((r) => r.scheduled_date).filter(Boolean)) as string[],
    );

    // ── RC-5 (2B): read-only skip-set loaders for the placement planner (consumed
    // in 2C). SELECTs ONLY — zero writes. Builds { existingDays, dayUnavailable,
    // slotTaken } at the SAME conventions the planner uses (formatDateISO en-CA
    // Asia/Kolkata, resolveSessionTime "HH:MM:SS", noon-IST day stepping — never
    // bare new Date(dateStr)).
    const lookaheadWeeks = 26; // == planSessions default maxWeeksLookahead
    const windowFrom = formatDateISO(startDate);
    const windowToDate = new Date(startDate.getTime());
    windowToDate.setUTCDate(windowToDate.getUTCDate() + lookaheadWeeks * 7);
    const windowTo = formatDateISO(windowToDate);
    const coachId = enrollment.coach_id!;

    // 1. existingDays — weekday (getUTCDay) of every existing non-cancelled session
    //    of THIS enrollment. Frequency matters (renewal anchor) so NOT deduped.
    const existingDays: number[] = (
      (occupiedRows || []).map((r) => r.scheduled_date).filter(Boolean) as string[]
    ).map((d) => new Date(`${d}T12:00:00+05:30`).getUTCDay());

    // 2. dayUnavailable — whole-day blocks (DATE keys "YYYY-MM-DD"):
    //    (a) this enrollment's own occupied dates (reuse occupiedDates), plus
    //    (b) coach LEAVE rows (type unavailable|vacation; 'reduced_capacity' excluded
    //        — no quantity column to enforce, documented gap), expanded day-by-day,
    //        clamped to the window.
    const dayUnavailable = new Set<string>(occupiedDates);
    const { data: leaveRows } = await supabase
      .from('coach_availability')
      .select('start_date, end_date')
      .eq('coach_id', coachId)
      .in('type', ['unavailable', 'vacation'])
      .or('status.neq.cancelled,status.is.null') // COALESCE(status,'') <> 'cancelled'
      .lte('start_date', windowTo)
      .gte('end_date', windowFrom);
    for (const lv of leaveRows || []) {
      if (!lv.start_date || !lv.end_date) continue;
      const lvStart = lv.start_date < windowFrom ? windowFrom : lv.start_date;
      const lvEnd = lv.end_date > windowTo ? windowTo : lv.end_date;
      const dayCursor = new Date(`${lvStart}T12:00:00+05:30`);
      const lvEndMs = new Date(`${lvEnd}T12:00:00+05:30`).getTime();
      while (dayCursor.getTime() <= lvEndMs) {
        dayUnavailable.add(formatDateISO(dayCursor));
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
      }
    }

    // 3. slotTaken — slot-level blocks ("YYYY-MM-DD HH:MM:SS" keys):
    //    (a) coach's cross-enrollment bookings at their exact slot, plus
    //    (b) is_available=false break windows folded onto the candidate time of each
    //        pool-day date in the window (recurring day_of_week OR specific_date).
    //        max_bookings_per_slot / positive availability NOT consumed (no live
    //        capacity data) — only breaks honored. Documented Step-1 scope.
    const slotTaken = new Set<string>();
    const { data: coachBookings } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date, scheduled_time')
      .eq('coach_id', coachId)
      .neq('status', 'cancelled')
      .gte('scheduled_date', windowFrom)
      .lte('scheduled_date', windowTo);
    for (const b of coachBookings || []) {
      if (b.scheduled_date && b.scheduled_time) {
        slotTaken.add(`${b.scheduled_date} ${b.scheduled_time}`);
      }
    }

    const { data: breakRows } = await supabase
      .from('coach_availability_slots')
      .select('day_of_week, specific_date, start_time, end_time')
      .eq('coach_id', coachId)
      .eq('is_available', false);
    if (breakRows && breakRows.length > 0) {
      const poolSet = new Set<number>(preferredDays); // a session can only land on a pool weekday
      const dateCursor = new Date(startDate.getTime());
      const windowEndMs = windowToDate.getTime();
      while (dateCursor.getTime() <= windowEndMs) {
        const wd = dateCursor.getUTCDay();
        if (poolSet.has(wd)) {
          const dateStr = formatDateISO(dateCursor);
          const candTime = resolveSessionTime(schedulePref, wd); // "HH:MM:SS"
          for (const br of breakRows) {
            const matchesDate = br.specific_date
              ? br.specific_date === dateStr
              : br.day_of_week === wd;
            if (
              matchesDate &&
              br.start_time && br.end_time &&
              candTime >= br.start_time && candTime < br.end_time
            ) {
              slotTaken.add(`${dateStr} ${candTime}`);
              break; // one matching break suffices for this slot
            }
          }
        }
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
      }
    }
    // NOTE (2C): { existingDays, dayUnavailable, slotTaken } feed planSessions next.

    // 6. Generate sessions — PLACEMENT is decided by the pure planner (RC-5). The
    //    planner owns date/time/week selection + all skip-set avoidance (pool-vs-rate,
    //    anchored-fallback, occupancy/coach-leave/slot collisions). This loop only
    //    builds the INSERT rows — every column/value identical to before EXCEPT
    //    scheduled_date / scheduled_time / week_number, which come from the placement.
    const sessionsToCreate: ScheduledSession[] = [];

    const { placements, warnings } = planSessions({
      sessionsPerWeek,
      poolDays: poolDaysOrdered,
      count: sessionsToSchedule,
      startDate: formatDateISO(startDate),
      resolveTime: (wd: number) => resolveSessionTime(schedulePref, wd),
      existingDays,
      skip: { dayUnavailable, slotTaken },
      // maxWeeksLookahead omitted → planner default 26
    });

    // Planner warnings surface through the existing errors[] channel (replaces the
    // old spw log + the "could not find preferred day" pushes).
    for (const w of warnings) errors.push(w);
    if (placements.length < sessionsToSchedule) {
      errors.push(`planner placed ${placements.length} of ${sessionsToSchedule} sessions (window/pool constraints)`);
    }

    for (const placement of placements) {
      const sessionData: ScheduledSession & Record<string, unknown> = {
        enrollment_id: enrollmentId,
        child_id: enrollment.child_id!,
        coach_id: enrollment.coach_id!,
        session_number: sessionNumber,
        session_type: 'tuition',
        session_title: `English Classes Session #${sessionNumber}`,
        week_number: placement.weekNumber,
        scheduled_date: placement.scheduledDate,
        scheduled_time: placement.scheduledTime,
        status: 'scheduled',
        duration_minutes: durationMinutes,
        session_mode: defaultMode,
      };
      // Set batch_id from tuition_onboarding
      if (batchId) sessionData.batch_id = batchId;
      // Born-online link parity via the sole resolver — room/explicit/existing ONLY
      // (noGenerate: never create a calendar event per session in this loop). An
      // online pack with no room link is born link-less (online-pending); a later
      // switch/reminder resolves it lazily. Offline packs get no link.
      if (defaultMode === 'online') {
        const resolved = await resolveOnlineLink(
          {
            id: '',
            session_type: 'tuition',
            session_number: sessionNumber,
            google_meet_link: null,
            google_event_id: null,
            scheduled_date: placement.scheduledDate,
            scheduled_time: placement.scheduledTime,
            duration_minutes: durationMinutes,
          },
          { roomLink: batchMeetLink, noGenerate: true },
        );
        if (resolved.link) sessionData.google_meet_link = resolved.link;
      }

      sessionsToCreate.push(sessionData as ScheduledSession);
      sessionNumber++;
    }

    if (sessionsToCreate.length === 0) {
      return { success: true, sessionsCreated: 0, errors: ['No sessions generated'] };
    }

    console.log(`[TuitionScheduler] Scheduling ${sessionsToCreate.length} sessions for enrollment ${enrollmentId}:`, {
      sessionsPerWeek,
      durationMinutes,
      defaultMode,
      preferredDays,
      schedulePref: { times: schedulePref.times, defaultTime: schedulePref.defaultTime, timeSlot: schedulePref.timeSlot },
      firstDate: sessionsToCreate[0].scheduled_date,
      lastDate: sessionsToCreate[sessionsToCreate.length - 1].scheduled_date,
    });

    // 7. Engine-backed insert. skipCalendar: per-session calendar events are NOT
    // created at row-insert time for tuition — a batch-level Calendar event is
    // created separately by admin tooling when the batch is formed. Per-row
    // batch_id + persistent google_meet_link (for online batches) are carried
    // through via toCreateParams().
    const paramsArray: CreateSessionParams[] = sessionsToCreate.map(toCreateParams);

    const results = await createScheduledSessionsBatch(paramsArray, {
      skipCalendar: true,
      skipRecall: true,
      skipNotifications: true,
      onInsertComplete: async () => {
        // 8. Mark schedule confirmed. (sessions_scheduled removed — derived on read
        // from scheduled_sessions; see coach/students count.)
        await supabase
          .from('enrollments')
          .update({
            schedule_confirmed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollmentId);
      },
    });

    const insertFailure = !results.some((r) => r.success);
    if (insertFailure) {
      const msg = results[0]?.error ?? 'insert failed';
      console.error(`[TuitionScheduler] Insert error:`, msg);
      return { success: false, sessionsCreated: 0, errors: [`Insert failed: ${msg}`] };
    }

    return {
      success: true,
      sessionsCreated: sessionsToCreate.length,
      errors,
    };

  } catch (error: any) {
    console.error(`[TuitionScheduler] Error:`, error);
    return {
      success: false,
      sessionsCreated: 0,
      errors: [`Tuition scheduling failed: ${error.message}`],
    };
  }
}
