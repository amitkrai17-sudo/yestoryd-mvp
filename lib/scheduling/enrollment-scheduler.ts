// ============================================================================
// ENROLLMENT SCHEDULER
// lib/scheduling/enrollment-scheduler.ts
// ============================================================================
//
// Handles auto-scheduling of sessions for new enrollments.
// Reads plan from pricing_plans table and uses smart-slot-finder.
//
// FEATURES:
// - Reads week schedules from coaching_week_schedule and checkin_week_schedule
// - Uses smart-slot-finder for each session
// - Creates scheduled_sessions records
// - Tracks slot_match_type for each session
// - Handles preference-based scheduling
//
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import {
  getPlanSchedule,
  getSchedulingDurations,
  getSessionTitle,
  TimePreference,
  SlotMatchType,
  DEFAULT_DURATIONS,
} from './config';
import { findSlotsForSchedule, SlotSearchResult } from './smart-slot-finder';

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
 * Schedule all sessions for an enrollment
 * Reads plan configuration and creates sessions in scheduled_sessions table
 */
export async function scheduleEnrollmentSessions(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createClient>
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

  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const errors: string[] = [];
  const sessionsToCreate: ScheduledSession[] = [];

  try {
    console.log(`[EnrollmentScheduler] [${requestId}] Starting scheduling for enrollment ${enrollmentId}`);

    // ========================================================================
    // STEP 1: Get plan configuration from database
    // ========================================================================
    const planSchedule = await getPlanSchedule(planSlug, supabase);
    const durations = await getSchedulingDurations(supabase);

    console.log(`[EnrollmentScheduler] [${requestId}] Plan loaded:`, {
      slug: planSlug,
      coaching: planSchedule.coaching.count,
      checkin: planSchedule.checkin.count,
      coachingWeeks: planSchedule.coaching.weekSchedule,
      checkinWeeks: planSchedule.checkin.weekSchedule,
    });

    // ========================================================================
    // STEP 2: Find slots for coaching sessions
    // ========================================================================
    console.log(`[EnrollmentScheduler] [${requestId}] Finding coaching slots...`);

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

    // Create coaching session records
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
        // Create with placeholder date (needs manual scheduling)
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
          scheduled_time: '10:00:00', // Default time
          status: 'pending_scheduling', // Needs manual intervention
          duration_minutes: planSchedule.coaching.durationMinutes,
          slot_match_type: 'manual_required',
        });
        errors.push(`Coaching session ${sessionNumber} (week ${weekNumber}): No slot found, needs manual scheduling`);
      }
      sessionNumber++;
    }

    // ========================================================================
    // STEP 3: Find slots for check-in sessions
    // ========================================================================
    console.log(`[EnrollmentScheduler] [${requestId}] Finding check-in slots...`);

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

    // Create check-in session records
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
        // Create with placeholder date (needs manual scheduling)
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
          scheduled_time: '10:00:00', // Default time
          status: 'pending_scheduling', // Needs manual intervention
          duration_minutes: planSchedule.checkin.durationMinutes,
          slot_match_type: 'manual_required',
        });
        errors.push(`Check-in session ${i + 1} (week ${weekNumber}): No slot found, needs manual scheduling`);
      }
      sessionNumber++;
    }

    // ========================================================================
    // STEP 4: Sort sessions by week number and renumber
    // ========================================================================
    sessionsToCreate.sort((a, b) => {
      if (a.week_number !== b.week_number) {
        return a.week_number - b.week_number;
      }
      // Same week: coaching before check-in
      if (a.session_type !== b.session_type) {
        return a.session_type === 'coaching' ? -1 : 1;
      }
      return 0;
    });

    // Renumber sessions and mark first coaching session as diagnostic
    sessionsToCreate.forEach((session, idx) => {
      session.session_number = idx + 1;
      // V2: First coaching session is the diagnostic session
      if (idx === 0 && session.session_type === 'coaching') {
        session.is_diagnostic = true;
      }
    });

    console.log(`[EnrollmentScheduler] [${requestId}] Sessions built:`, {
      total: sessionsToCreate.length,
      coaching: sessionsToCreate.filter(s => s.session_type === 'coaching').length,
      checkin: sessionsToCreate.filter(s => s.session_type === 'parent_checkin').length,
      manualRequired: sessionsToCreate.filter(s => s.slot_match_type === 'manual_required').length,
    });

    // ========================================================================
    // STEP 5: Insert sessions into database
    // ========================================================================
    const { error: insertError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToCreate as any);

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

    // ========================================================================
    // STEP 5.5: Auto-assign session templates from season_learning_plans
    // ========================================================================
    try {
      const { data: learningPlans } = await supabase
        .from('season_learning_plans')
        .select('week_number, session_template_id')
        .eq('child_id', childId) as { data: { week_number: number; session_template_id: string | null }[] | null };

      if (learningPlans && learningPlans.length > 0) {
        // Build a map: week_number → session_template_id
        const templateByWeek = new Map<number, string>();
        for (const plan of learningPlans) {
          if (plan.session_template_id) {
            templateByWeek.set(plan.week_number, plan.session_template_id);
          }
        }

        // Update each coaching session with its template
        for (const session of sessionsToCreate) {
          if (session.session_type !== 'coaching') continue;
          const templateId = templateByWeek.get(session.week_number);
          if (templateId) {
            await (supabase as any)
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
      // Non-blocking — sessions still created without templates
    }

    // ========================================================================
    // STEP 6: Update enrollment record
    // ========================================================================
    const updateResult = await (supabase as any)
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        sessions_scheduled: sessionsToCreate.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);
    const updateError = updateResult?.error;

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

  } catch (error: any) {
    console.error(`[EnrollmentScheduler] [${requestId}] Error:`, error);
    return {
      success: false,
      sessionsCreated: 0,
      sessions: [],
      manualRequired: 0,
      errors: [`Scheduling failed: ${error.message}`],
    };
  }
}

// ============================================================================
// HELPER: Create sessions without smart slot finding (fallback)
// ============================================================================

/**
 * Simple session creation without slot finding
 * Used as fallback when API is unavailable
 */
export async function createSessionsSimple(
  options: EnrollmentSchedulerOptions,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<EnrollmentSchedulerResult> {
  const {
    enrollmentId,
    childId,
    coachId,
    planSlug,
    programStart,
    requestId = 'unknown',
  } = options;

  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const planSchedule = await getPlanSchedule(planSlug, supabase);
    const sessionsToCreate: ScheduledSession[] = [];

    // Default times for sessions
    const defaultTimes = ['10:00:00', '11:00:00', '14:00:00', '15:00:00', '16:00:00', '17:00:00'];
    let timeIndex = 0;

    // Create coaching sessions
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

    // Create check-in sessions
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
      // V2: First coaching session is the diagnostic session
      if (idx === 0 && session.session_type === 'coaching') {
        session.is_diagnostic = true;
      }
    });

    // Insert
    const { error: insertError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToCreate as any);

    if (insertError) {
      return {
        success: false,
        sessionsCreated: 0,
        sessions: [],
        manualRequired: 0,
        errors: [`Insert failed: ${insertError.message}`],
      };
    }

    // Auto-assign templates from season_learning_plans
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
            await (supabase as any)
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
    await (supabase as any)
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
