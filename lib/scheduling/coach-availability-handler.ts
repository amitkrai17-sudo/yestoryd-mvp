// ============================================================================
// COACH AVAILABILITY HANDLER
// lib/scheduling/coach-availability-handler.ts
// ============================================================================
//
// Reacts to coach availability changes:
// - ≤7 days: reschedule sessions to after end_date
// - 8-21 days: assign backup coach temporarily
// - >21 days or EXIT: permanent reassignment
//
// All actions logged to coach_reassignment_log.
//
// ============================================================================

import { getUnavailabilityThresholds } from './config-provider';
import { rescheduleSession, cancelSession, bulkReassign } from './session-manager';
import { notify, NotificationData } from './notification-manager';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// TYPES
// ============================================================================

export interface UnavailabilityResult {
  success: boolean;
  action: 'rescheduled' | 'backup_assigned' | 'permanently_reassigned' | 'error';
  sessionsAffected: number;
  errors: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createAdminClient();
}

interface AffectedSession {
  id: string;
  enrollment_id: string;
  child_id: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  week_number: number;
}

async function getNotificationContext(
  supabase: any,
  childId: string,
  coachId: string
): Promise<NotificationData> {
  const { data: child } = await supabase
    .from('children')
    .select('child_name, name, parent_phone, parent_id')
    .eq('id', childId)
    .single();

  const { data: parent } = child?.parent_id
    ? await supabase.from('parents').select('name, email, phone').eq('id', child.parent_id).single()
    : { data: null };

  const { data: coach } = await supabase
    .from('coaches')
    .select('name')
    .eq('id', coachId)
    .single();

  return {
    childId,
    childName: child?.child_name || child?.name || undefined,
    parentPhone: parent?.phone || child?.parent_phone || undefined,
    parentEmail: parent?.email || undefined,
    parentName: parent?.name || undefined,
    coachName: coach?.name || undefined,
  };
}

async function getAffectedSessions(
  supabase: any,
  coachId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: AffectedSession[]; error: any }> {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select('id, enrollment_id, child_id, scheduled_date, scheduled_time, session_type, week_number')
    .eq('coach_id', coachId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .in('status', ['scheduled', 'pending', 'rescheduled'])
    .order('scheduled_date', { ascending: true });

  return { sessions: (data || []) as AffectedSession[], error };
}

async function findBackupCoach(
  supabase: any,
  excludeCoachId: string
): Promise<string | null> {
  // Find an active coach with the fewest active enrollments (excluding the unavailable coach)
  const { data: coaches } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('is_active', true)
    .neq('id', excludeCoachId)
    .order('name', { ascending: true })
    .limit(10);

  if (!coaches || coaches.length === 0) return null;

  // Get enrollment counts for each candidate
  let bestCoach: string | null = null;
  let minEnrollments = Infinity;

  for (const coach of coaches) {
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coach.id)
      .eq('status', 'active');

    const enrollmentCount = count || 0;
    if (enrollmentCount < minEnrollments) {
      minEnrollments = enrollmentCount;
      bestCoach = coach.id;
    }
  }

  return bestCoach;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Process a coach becoming unavailable.
 * Determines action based on duration vs thresholds from Config Provider.
 */
export async function processUnavailability(
  coachId: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<UnavailabilityResult> {
  const supabase = getSupabase();
  const errors: string[] = [];

  try {
    const thresholds = await getUnavailabilityThresholds();

    // Calculate duration in days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`[CoachAvailability] Coach ${coachId} unavailable for ${durationDays} days (${startDate} to ${endDate}). Thresholds: backup=${thresholds.backup}, reassign=${thresholds.reassign}`);

    // Get affected sessions
    const { sessions } = await getAffectedSessions(supabase, coachId, startDate, endDate);

    if (sessions.length === 0) {
      console.log(`[CoachAvailability] No sessions affected for coach ${coachId}`);
      return { success: true, action: 'rescheduled', sessionsAffected: 0, errors: [] };
    }

    // ========================================
    // SHORT: ≤ backup threshold (default 7 days)
    // Action: Reschedule sessions to after return date
    // ========================================
    if (durationDays <= thresholds.backup) {
      console.log(`[CoachAvailability] Short absence (${durationDays}d ≤ ${thresholds.backup}d): rescheduling ${sessions.length} sessions`);

      let rescheduled = 0;
      const returnDate = new Date(endDate);
      returnDate.setDate(returnDate.getDate() + 1);

      for (const session of sessions) {
        // Simple reschedule: push to the first available day after return
        const newDate = new Date(returnDate);
        newDate.setDate(newDate.getDate() + rescheduled); // Spread out across days

        const result = await rescheduleSession(
          session.id,
          {
            date: newDate.toISOString().split('T')[0],
            time: session.scheduled_time,
          },
          `Coach unavailable: ${reason}`
        );

        if (result.success) {
          rescheduled++;
          // Notify parent about rescheduled session
          try {
            const ctx = await getNotificationContext(supabase, session.child_id, coachId);
            await notify('session.rescheduled', {
              ...ctx,
              sessionId: session.id,
              oldDate: session.scheduled_date,
              oldTime: session.scheduled_time,
              newDate: newDate.toISOString().split('T')[0],
              newTime: session.scheduled_time,
              reason: `Coach unavailable: ${reason}`,
            });
          } catch (notifyErr: any) {
            console.warn(`[CoachAvailability] Notification failed for session ${session.id}:`, notifyErr.message);
          }
        } else {
          errors.push(`Session ${session.id}: ${result.error}`);
        }
      }

      // Log to reassignment log
      const enrollmentIds = Array.from(new Set(sessions.map(s => s.enrollment_id).filter(Boolean)));
      for (const eid of enrollmentIds) {
        await supabase.from('coach_reassignment_log').insert({
          enrollment_id: eid,
          original_coach_id: coachId,
          new_coach_id: coachId, // Same coach, just rescheduled
          reason: `Short absence (${durationDays}d): ${reason}`,
          reassignment_type: 'temporary',
          is_temporary: true,
          start_date: startDate,
          expected_end_date: endDate,
          created_by: 'system',
        });
      }

      return { success: errors.length === 0, action: 'rescheduled', sessionsAffected: rescheduled, errors };
    }

    // ========================================
    // MEDIUM: > backup and ≤ reassign threshold (default 8-21 days)
    // Action: Assign temporary backup coach
    // ========================================
    if (durationDays <= thresholds.reassign) {
      console.log(`[CoachAvailability] Medium absence (${durationDays}d ≤ ${thresholds.reassign}d): finding backup coach`);

      const backupCoachId = await findBackupCoach(supabase, coachId);

      if (!backupCoachId) {
        // No backup available — escalate to admin
        console.warn('[CoachAvailability] No backup coach available, escalating');
        const { escalate } = await import('./manual-queue');
        for (const session of sessions) {
          await escalate(session.id, `No backup coach available. Original coach unavailable: ${reason}`);
          // Notify admin about manual queue escalation
          try {
            await notify('session.manual_needed', {
              sessionId: session.id,
              failureReason: `No backup coach available. Original coach unavailable: ${reason}`,
            });
          } catch {}
        }
        return { success: false, action: 'error', sessionsAffected: 0, errors: ['No backup coach available'] };
      }

      // Get coach names for notification
      const { data: originalCoach } = await supabase.from('coaches').select('name').eq('id', coachId).single();
      const { data: backupCoach } = await supabase.from('coaches').select('name').eq('id', backupCoachId).single();

      // Get all unique enrollments
      const enrollmentIds = Array.from(new Set(sessions.map(s => s.enrollment_id).filter(Boolean)));
      let totalReassigned = 0;

      for (const eid of enrollmentIds) {
        if (!eid) continue;
        const result = await bulkReassign(eid, backupCoachId, `Temp backup: ${reason}`, {
          isTemporary: true,
          expectedEndDate: endDate,
          updateEnrollment: false, // Don't change enrollment.coach_id for temp
        });
        totalReassigned += result.sessionsReassigned;
        errors.push(...result.errors);
      }

      // Notify parents about temporary coach reassignment
      const notifiedChildren = new Set<string>();
      for (const session of sessions) {
        if (notifiedChildren.has(session.child_id)) continue;
        notifiedChildren.add(session.child_id);
        try {
          const ctx = await getNotificationContext(supabase, session.child_id, coachId);
          await notify('coach.reassigned', {
            ...ctx,
            oldCoachName: originalCoach?.name || 'your coach',
            newCoachName: backupCoach?.name || 'a backup coach',
            isTemporary: true,
            expectedReturnDate: endDate,
            reason,
          });
        } catch (notifyErr: any) {
          console.warn(`[CoachAvailability] Reassignment notification failed for child ${session.child_id}:`, notifyErr.message);
        }
      }

      return { success: errors.length === 0, action: 'backup_assigned', sessionsAffected: totalReassigned, errors };
    }

    // ========================================
    // LONG: > reassign threshold (default >21 days)
    // Action: Permanent reassignment
    // ========================================
    console.log(`[CoachAvailability] Long absence (${durationDays}d > ${thresholds.reassign}d): permanent reassignment`);

    const newCoachId = await findBackupCoach(supabase, coachId);

    if (!newCoachId) {
      console.warn('[CoachAvailability] No replacement coach available, escalating');
      const { escalate } = await import('./manual-queue');
      for (const session of sessions) {
        await escalate(session.id, `No replacement coach available. Original coach out >21 days: ${reason}`);
        try {
          await notify('session.manual_needed', {
            sessionId: session.id,
            failureReason: `No replacement coach available. Original coach out >21 days: ${reason}`,
          });
        } catch {}
      }
      return { success: false, action: 'error', sessionsAffected: 0, errors: ['No replacement coach available'] };
    }

    // Get coach names for notification
    const { data: origCoach } = await supabase.from('coaches').select('name').eq('id', coachId).single();
    const { data: replacementCoach } = await supabase.from('coaches').select('name').eq('id', newCoachId).single();

    const enrollmentIds = Array.from(new Set(sessions.map(s => s.enrollment_id).filter(Boolean)));
    let totalReassigned = 0;

    for (const eid of enrollmentIds) {
      if (!eid) continue;
      const result = await bulkReassign(eid, newCoachId, `Permanent reassignment: ${reason}`, {
        isTemporary: false,
        updateEnrollment: true,
      });
      totalReassigned += result.sessionsReassigned;
      errors.push(...result.errors);
    }

    // Notify parents about permanent coach reassignment
    const notifiedChildIds = new Set<string>();
    for (const session of sessions) {
      if (notifiedChildIds.has(session.child_id)) continue;
      notifiedChildIds.add(session.child_id);
      try {
        const ctx = await getNotificationContext(supabase, session.child_id, coachId);
        await notify('coach.reassigned', {
          ...ctx,
          oldCoachName: origCoach?.name || 'your previous coach',
          newCoachName: replacementCoach?.name || 'a new coach',
          isTemporary: false,
          reason,
        });
      } catch (notifyErr: any) {
        console.warn(`[CoachAvailability] Reassignment notification failed for child ${session.child_id}:`, notifyErr.message);
      }
    }

    return { success: errors.length === 0, action: 'permanently_reassigned', sessionsAffected: totalReassigned, errors };
  } catch (error: any) {
    console.error('[CoachAvailability] processUnavailability error:', error);
    return { success: false, action: 'error', sessionsAffected: 0, errors: [error.message] };
  }
}

/**
 * Process a coach returning from unavailability.
 * Transfers temporary sessions back to the original coach.
 */
export async function processCoachReturn(coachId: string): Promise<{
  success: boolean;
  sessionsTransferredBack: number;
  errors: string[];
}> {
  const supabase = getSupabase();
  const errors: string[] = [];
  let transferred = 0;

  try {
    // Find active temporary reassignments for this coach
    const { data: tempReassignments } = await supabase
      .from('coach_reassignment_log')
      .select('id, enrollment_id, new_coach_id')
      .eq('original_coach_id', coachId)
      .eq('is_temporary', true)
      .is('actual_end_date', null);

    if (!tempReassignments || tempReassignments.length === 0) {
      console.log(`[CoachAvailability] No temporary reassignments to reverse for coach ${coachId}`);
      return { success: true, sessionsTransferredBack: 0, errors: [] };
    }

    for (const reassignment of tempReassignments) {
      if (!reassignment.enrollment_id) continue;

      // Transfer sessions back
      const result = await bulkReassign(
        reassignment.enrollment_id,
        coachId,
        'Coach returned from leave',
        { isTemporary: false, updateEnrollment: false }
      );

      transferred += result.sessionsReassigned;
      errors.push(...result.errors);

      // Mark reassignment as ended
      await supabase
        .from('coach_reassignment_log')
        .update({ actual_end_date: new Date().toISOString().split('T')[0] })
        .eq('id', reassignment.id);
    }

    console.log(`[CoachAvailability] Coach ${coachId} returned: ${transferred} sessions transferred back`);
    return { success: errors.length === 0, sessionsTransferredBack: transferred, errors };
  } catch (error: any) {
    console.error('[CoachAvailability] processCoachReturn error:', error);
    return { success: false, sessionsTransferredBack: 0, errors: [error.message] };
  }
}

/**
 * Process a coach permanently exiting the platform.
 * Permanent reassignment of all active enrollments.
 */
export async function processCoachExit(coachId: string): Promise<{
  success: boolean;
  enrollmentsReassigned: number;
  errors: string[];
}> {
  const supabase = getSupabase();
  const errors: string[] = [];
  let enrollmentsReassigned = 0;

  try {
    // Get all active enrollments for this coach
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) {
      console.log(`[CoachAvailability] No active enrollments for exiting coach ${coachId}`);
      return { success: true, enrollmentsReassigned: 0, errors: [] };
    }

    const newCoachId = await findBackupCoach(supabase, coachId);

    if (!newCoachId) {
      console.error('[CoachAvailability] No replacement coach for exit, escalating all enrollments');
      const { escalate } = await import('./manual-queue');
      for (const enrollment of enrollments) {
        await escalate('', `Coach exited, no replacement available for enrollment ${enrollment.id}`, {
          enrollmentId: enrollment.id,
          coachId,
        });
        try {
          await notify('session.manual_needed', {
            enrollmentId: enrollment.id,
            failureReason: `Coach exited, no replacement available`,
          });
        } catch {}
      }
      return { success: false, enrollmentsReassigned: 0, errors: ['No replacement coach available'] };
    }

    // Get coach names for notification
    const { data: exitingCoach } = await supabase.from('coaches').select('name').eq('id', coachId).single();
    const { data: newCoach } = await supabase.from('coaches').select('name').eq('id', newCoachId).single();

    for (const enrollment of enrollments) {
      const result = await bulkReassign(enrollment.id, newCoachId, 'Coach exited platform', {
        isTemporary: false,
        updateEnrollment: true,
      });

      if (result.sessionsReassigned > 0 || result.errors.length === 0) {
        enrollmentsReassigned++;
      }
      errors.push(...result.errors);

      // Notify parent about permanent reassignment
      try {
        // Get child for this enrollment
        const { data: enr } = await supabase
          .from('enrollments')
          .select('child_id')
          .eq('id', enrollment.id)
          .single();
        if (enr?.child_id) {
          const ctx = await getNotificationContext(supabase, enr.child_id, coachId);
          await notify('coach.reassigned', {
            ...ctx,
            oldCoachName: exitingCoach?.name || 'your previous coach',
            newCoachName: newCoach?.name || 'a new coach',
            isTemporary: false,
            reason: 'Coach is no longer available',
          });
        }
      } catch (notifyErr: any) {
        console.warn(`[CoachAvailability] Exit notification failed for enrollment ${enrollment.id}:`, notifyErr.message);
      }
    }

    // Mark coach as inactive
    await supabase
      .from('coaches')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    console.log(`[CoachAvailability] Coach ${coachId} exit processed: ${enrollmentsReassigned} enrollments reassigned`);
    return { success: errors.length === 0, enrollmentsReassigned, errors };
  } catch (error: any) {
    console.error('[CoachAvailability] processCoachExit error:', error);
    return { success: false, enrollmentsReassigned: 0, errors: [error.message] };
  }
}
