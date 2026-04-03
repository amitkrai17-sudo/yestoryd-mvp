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

import { Database } from '@/lib/supabase/database.types';
import {
  getPlanSchedule,
  getSessionTitle,
  TimePreference,
  SlotMatchType,
} from './config';
import { findAvailableSlot, findSlotsForSchedule, SlotSearchResult } from './smart-slot-finder';
import { createAdminClient } from '@/lib/supabase/admin';

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

  // Insert sessions
  const { error: insertError } = await supabase
    .from('scheduled_sessions')
    .insert(sessionsToCreate as Database['public']['Tables']['scheduled_sessions']['Insert'][]);

  if (insertError) {
    console.error(`[EnrollmentScheduler] [${requestId}] Insert error:`, insertError);
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`Failed to insert sessions: ${insertError.message}`],
    };
  }

  // Auto-assign session templates from season_learning_plans
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

      for (const session of sessionsToCreate) {
        if (session.session_type !== 'coaching') continue;
        const templateId = templateByWeek.get(session.week_number);
        if (templateId) {
          await supabase
            .from('scheduled_sessions')
            .update({ session_template_id: templateId })
            .eq('enrollment_id', enrollmentId)
            .eq('session_number', session.session_number);
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

  // Update enrollment record
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({
      schedule_confirmed: true,
      sessions_scheduled: sessionsToCreate.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  if (updateError) {
    console.error(`[EnrollmentScheduler] [${requestId}] Enrollment update error:`, updateError);
    errors.push(`Warning: Failed to update enrollment: ${updateError.message}`);
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

    // Insert
    const { error: insertError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToCreate as Database['public']['Tables']['scheduled_sessions']['Insert'][]);

    if (insertError) {
      return {
        success: false,
        sessionsCreated: 0,
        sessions: [],
        manualRequired: 0,
        errors: [`Insert failed: ${insertError.message}`],
      };
    }

    // Auto-assign templates
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
        for (const session of sessionsToCreate) {
          if (session.session_type !== 'coaching') continue;
          const templateId = templateByWeek.get(session.week_number);
          if (templateId) {
            await supabase
              .from('scheduled_sessions')
              .update({ session_template_id: templateId })
              .eq('enrollment_id', enrollmentId)
              .eq('session_number', session.session_number);
          }
        }
      }
    } catch {
      // Non-blocking
    }

    // Update enrollment
    await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        sessions_scheduled: sessionsToCreate.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

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

/** Convert timeSlot bucket or preferredTime string to a time string.
 *  Handles formats: "4:00 PM", "16:00", "4 to 6 pm", "7 to 8 pm",
 *  "5:30 to 7:00", "5:30 PM", "11 am", "4 pm" */
function timeSlotToTime(slot?: string, preferredTime?: string): string {
  if (preferredTime) {
    const cleaned = preferredTime.trim();

    // Exact 24h: "16:00"
    const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) return `${match24[1].padStart(2, '0')}:${match24[2]}:00`;

    // Exact 12h with minutes: "5:30 PM"
    const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1]);
      if (match12[3].toLowerCase() === 'pm' && h < 12) h += 12;
      if (match12[3].toLowerCase() === 'am' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:${match12[2]}:00`;
    }

    // Range with minutes: "5:30 to 7:00" or "5:30 to 7:00 PM"
    const matchRange = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(am|pm)?$/i);
    if (matchRange) {
      let h = parseInt(matchRange[1]);
      const mins = matchRange[2] || '00';
      const ampm = matchRange[3]?.toLowerCase();
      // Infer PM for afternoon/evening times: "4 to 6 pm" → 4 PM = 16
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      // If no am/pm and hour <= 8, likely PM (tuition is afternoon/evening)
      if (!ampm && h >= 1 && h <= 8) h += 12;
      return `${h.toString().padStart(2, '0')}:${mins}:00`;
    }

    // Simple hour: "11 am", "4 pm"
    const matchSimple = cleaned.match(/^(\d{1,2})\s*(am|pm)$/i);
    if (matchSimple) {
      let h = parseInt(matchSimple[1]);
      if (matchSimple[2].toLowerCase() === 'pm' && h < 12) h += 12;
      if (matchSimple[2].toLowerCase() === 'am' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:00:00`;
    }
  }

  // Fall back to bucket
  switch (slot?.toLowerCase()) {
    case 'morning': case 'morning (9-12)': return '10:00:00';
    case 'afternoon': case 'afternoon (12-3)': return '14:00:00';
    case 'evening': case 'evening (3-6)': return '17:00:00';
    case 'late evening': case 'late evening (6-9)': return '19:00:00';
    default: return '16:00:00';
  }
}

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
    let sessionTime = '16:00:00';

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

        // Extract time
        sessionTime = timeSlotToTime(pref.timeSlot, pref.preferredTime);
      } catch {
        console.warn(`[TuitionScheduler] Failed to parse schedule_preference for enrollment ${enrollmentId}`);
      }
    }

    // Fallback days if none set
    if (preferredDays.length === 0) {
      preferredDays = DEFAULT_DAY_SETS[sessionsPerWeek] || DEFAULT_DAY_SETS[2]!;
      errors.push('No schedule_preference days found — using defaults');
    }

    // Sort days for consistent ordering
    preferredDays.sort((a, b) => a - b);

    // 4. Determine start date
    let startDate: Date;
    if (startAfterDate) {
      startDate = new Date(startAfterDate + 'T00:00:00+05:30');
      startDate.setDate(startDate.getDate() + 1); // Day after last existing session
    } else if (enrollment.program_start) {
      startDate = new Date(enrollment.program_start);
    } else {
      startDate = new Date();
    }

    // 5. Get existing session count for numbering
    const { count: existingCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId);

    let sessionNumber = (existingCount || 0) + 1;

    // 6. Generate sessions — distribute across preferred days
    const sessionsToCreate: ScheduledSession[] = [];
    const cursor = new Date(startDate);
    let weekNumber = 1;

    while (sessionsToCreate.length < sessionsToSchedule) {
      // Find next occurrence of a preferred day
      let found = false;
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
        const candidate = new Date(cursor);
        candidate.setDate(candidate.getDate() + daysAhead);
        const candidateDay = candidate.getDay();

        if (preferredDays.includes(candidateDay)) {
          const dateStr = candidate.toISOString().split('T')[0];

          const sessionData: ScheduledSession & Record<string, unknown> = {
            enrollment_id: enrollmentId,
            child_id: enrollment.child_id!,
            coach_id: enrollment.coach_id!,
            session_number: sessionNumber,
            session_type: 'tuition',
            session_title: `Tuition Session #${sessionNumber}`,
            week_number: weekNumber,
            scheduled_date: dateStr,
            scheduled_time: sessionTime,
            status: 'pending_scheduling',
            duration_minutes: durationMinutes,
            session_mode: defaultMode,
          };
          // Set batch_id from tuition_onboarding
          if (batchId) sessionData.batch_id = batchId;
          // Copy persistent classroom link to session (tuition_onboarding.meet_link → scheduled_sessions.google_meet_link)
          if (batchMeetLink && defaultMode === 'online') sessionData.google_meet_link = batchMeetLink;

          sessionsToCreate.push(sessionData as ScheduledSession);

          sessionNumber++;

          // Move cursor to day after this one
          cursor.setTime(candidate.getTime());
          cursor.setDate(cursor.getDate() + 1);
          found = true;

          // Track week boundaries (every 7 days from start)
          const daysSinceStart = Math.floor(
            (candidate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          weekNumber = Math.floor(daysSinceStart / 7) + 1;

          break;
        }
      }

      if (!found) {
        // Safety: no preferred day found in 14 days — force next day
        cursor.setDate(cursor.getDate() + 1);
        errors.push(`Could not find preferred day near ${cursor.toISOString().split('T')[0]}`);
        // Prevent infinite loops
        if (errors.length > sessionsToSchedule + 10) break;
      }
    }

    if (sessionsToCreate.length === 0) {
      return { success: true, sessionsCreated: 0, errors: ['No sessions generated'] };
    }

    console.log(`[TuitionScheduler] Scheduling ${sessionsToCreate.length} sessions for enrollment ${enrollmentId}:`, {
      sessionsPerWeek,
      durationMinutes,
      defaultMode,
      preferredDays,
      sessionTime,
      firstDate: sessionsToCreate[0].scheduled_date,
      lastDate: sessionsToCreate[sessionsToCreate.length - 1].scheduled_date,
    });

    // 7. Insert sessions
    const { error: insertError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToCreate as Database['public']['Tables']['scheduled_sessions']['Insert'][]);

    if (insertError) {
      console.error(`[TuitionScheduler] Insert error:`, insertError);
      return { success: false, sessionsCreated: 0, errors: [`Insert failed: ${insertError.message}`] };
    }

    // 8. Update enrollment
    const totalScheduled = (existingCount || 0) + sessionsToCreate.length;
    await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        sessions_scheduled: totalScheduled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

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
