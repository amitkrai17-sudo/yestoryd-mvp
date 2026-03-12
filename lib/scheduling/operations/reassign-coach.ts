/**
 * Coach reassignment operations (single + bulk).
 */

import { updateEventAttendees } from '@/lib/googleCalendar';
import { notify } from '../notification-manager';
import { getSupabase, logAudit, getSessionWithRelations } from './helpers';
import type { SessionResult } from './types';

/**
 * Reassign a single session to a new coach.
 */
export async function reassignCoach(
  sessionId: string,
  newCoachId: string,
  reason: string,
  options: { isTemporary?: boolean; expectedEndDate?: string } = {}
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const { session, error: fetchError } = await getSessionWithRelations(supabase, sessionId);
    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const originalCoachId = session.coach_id;

    const { data: newCoach } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', newCoachId)
      .single();

    if (!newCoach) {
      return { success: false, error: 'New coach not found' };
    }

    const child = session.children;
    const oldCoach = session.coaches;

    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        coach_id: newCoachId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    if (session.google_event_id) {
      try {
        await updateEventAttendees(session.google_event_id, {
          addAttendees: newCoach.email ? [newCoach.email] : [],
          removeAttendees: oldCoach?.email ? [oldCoach.email] : [],
        });
      } catch (calError: any) {
        console.error('[SessionManager] Calendar attendee update failed:', calError.message);
      }
    }

    await supabase.from('coach_reassignment_log').insert({
      enrollment_id: session.enrollment_id,
      child_id: session.child_id,
      original_coach_id: originalCoachId,
      new_coach_id: newCoachId,
      reason,
      reassignment_type: options.isTemporary ? 'temporary' : 'permanent',
      is_temporary: options.isTemporary || false,
      start_date: new Date().toISOString().split('T')[0],
      expected_end_date: options.expectedEndDate || null,
      created_by: 'system',
    });

    await logAudit(supabase, 'coach_reassigned', {
      sessionId,
      originalCoachId,
      newCoachId,
      reason,
      isTemporary: options.isTemporary || false,
    });

    await notify('coach.reassigned', {
      sessionId,
      enrollmentId: session.enrollment_id,
      childId: session.child_id,
      childName: child?.child_name || child?.name || undefined,
      coachName: newCoach.name || undefined,
      oldCoachName: oldCoach?.name || undefined,
      newCoachName: newCoach.name || undefined,
      parentPhone: child?.parent_phone || undefined,
      parentEmail: child?.parent_email || undefined,
      parentName: child?.parent_name || undefined,
      reason,
      isTemporary: options.isTemporary,
      expectedReturnDate: options.expectedEndDate,
    });

    return { success: true, sessionId };
  } catch (error: any) {
    console.error('[SessionManager] reassignCoach error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reassign all upcoming sessions for an enrollment to a new coach.
 */
export async function bulkReassign(
  enrollmentId: string,
  newCoachId: string,
  reason: string,
  options: { isTemporary?: boolean; expectedEndDate?: string; updateEnrollment?: boolean } = {}
): Promise<{ success: boolean; sessionsReassigned: number; errors: string[] }> {
  const supabase = getSupabase();
  const errors: string[] = [];
  let reassigned = 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: sessions, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .gte('scheduled_date', today)
      .in('status', ['scheduled', 'pending', 'rescheduled'])
      .order('scheduled_date', { ascending: true });

    if (fetchError || !sessions) {
      return { success: false, sessionsReassigned: 0, errors: [fetchError?.message || 'Fetch failed'] };
    }

    for (const session of sessions) {
      const result = await reassignCoach(session.id, newCoachId, reason, {
        isTemporary: options.isTemporary,
        expectedEndDate: options.expectedEndDate,
      });

      if (result.success) {
        reassigned++;
      } else {
        errors.push(`Session ${session.id}: ${result.error}`);
      }
    }

    if (options.updateEnrollment !== false && !options.isTemporary) {
      await supabase
        .from('enrollments')
        .update({
          coach_id: newCoachId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);
    }

    await logAudit(supabase, 'bulk_coach_reassigned', {
      enrollmentId,
      newCoachId,
      reason,
      sessionsReassigned: reassigned,
      isTemporary: options.isTemporary || false,
      errors: errors.length,
    });

    return {
      success: errors.length === 0,
      sessionsReassigned: reassigned,
      errors,
    };
  } catch (error: any) {
    console.error('[SessionManager] bulkReassign error:', error);
    return { success: false, sessionsReassigned: reassigned, errors: [error.message] };
  }
}
