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
  session_type: 'coaching' | 'parent_checkin';
  session_title: string;
  week_number: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  duration_minutes: number;
  slot_match_type?: SlotMatchType;
  is_diagnostic?: boolean;
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
    sessionDurationMinutes = 45,
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
    sessionDurationMinutes = 45,
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
