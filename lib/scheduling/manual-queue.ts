// ============================================================================
// SCHEDULING MANUAL QUEUE
// lib/scheduling/manual-queue.ts
// ============================================================================
//
// Human escalation when automation fails.
// Creates scheduling_queue entries and notifies admin + parent.
//
// ============================================================================

import { notify } from './notification-manager';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// TYPES
// ============================================================================

export interface QueueItem {
  id: string;
  session_id: string | null;
  enrollment_id: string | null;
  child_id: string | null;
  coach_id: string | null;
  session_type: string | null;
  week_number: number | null;
  reason: string;
  attempts_made: number;
  assigned_to: string | null;
  status: 'pending' | 'in_progress' | 'resolved';
  resolution_notes: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface QueueFilters {
  status?: 'pending' | 'in_progress' | 'resolved';
  enrollmentId?: string;
  coachId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface EscalateContext {
  enrollmentId?: string;
  childId?: string;
  coachId?: string;
  sessionType?: string;
  weekNumber?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createAdminClient();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Escalate a session to the manual scheduling queue.
 * Creates a queue entry and sends admin + parent notifications.
 */
export async function escalate(
  sessionId: string,
  reason: string,
  context?: EscalateContext
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const supabase = getSupabase();

  try {
    // Get session details for context if not provided
    let enrollmentId = context?.enrollmentId;
    let childId = context?.childId;
    let coachId = context?.coachId;
    let sessionType = context?.sessionType;
    let weekNumber = context?.weekNumber;

    if (sessionId && (!enrollmentId || !childId)) {
      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select('enrollment_id, child_id, coach_id, session_type, week_number, scheduling_attempts')
        .eq('id', sessionId)
        .single();

      if (session) {
        enrollmentId = enrollmentId || session.enrollment_id;
        childId = childId || session.child_id;
        coachId = coachId || session.coach_id;
        sessionType = sessionType || session.session_type;
        weekNumber = weekNumber ?? session.week_number;
      }
    }

    // Check for existing open queue entry for this session
    if (sessionId) {
      const { data: existing } = await supabase
        .from('scheduling_queue')
        .select('id')
        .eq('session_id', sessionId)
        .in('status', ['pending', 'in_progress'])
        .single();

      if (existing) {
        console.log(`[ManualQueue] Session ${sessionId} already in queue (${existing.id})`);
        return { success: true, queueId: existing.id };
      }
    }

    // Create queue entry
    const { data: entry, error: insertError } = await supabase
      .from('scheduling_queue')
      .insert({
        session_id: sessionId || null,
        enrollment_id: enrollmentId || null,
        child_id: childId || null,
        coach_id: coachId || null,
        session_type: sessionType || null,
        week_number: weekNumber ?? null,
        reason,
        attempts_made: 0,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !entry) {
      console.error('[ManualQueue] Insert error:', insertError);
      return { success: false, error: insertError?.message || 'Insert failed' };
    }

    console.log(`[ManualQueue] Escalated session ${sessionId} to queue (${entry.id}): ${reason}`);

    // Notify admin
    try {
      // Get child name for notification
      let childName = 'Unknown';
      if (childId) {
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name')
          .eq('id', childId)
          .single();
        childName = child?.child_name || child?.name || 'Unknown';
      }

      await notify('session.manual_needed', {
        sessionId,
        enrollmentId,
        childId,
        childName,
        sessionType,
        failureReason: reason,
      });
    } catch (notifyError) {
      console.error('[ManualQueue] Notification error:', notifyError);
    }

    return { success: true, queueId: entry.id };
  } catch (error: any) {
    console.error('[ManualQueue] Escalate error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve a queue item.
 */
export async function resolve(
  queueId: string,
  resolution: {
    notes: string;
    resolvedBy: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  try {
    const { error } = await supabase
      .from('scheduling_queue')
      .update({
        status: 'resolved',
        resolution_notes: resolution.notes,
        resolved_by: resolution.resolvedBy,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    if (error) {
      return { success: false, error: error.message };
    }

    console.log(`[ManualQueue] Queue item ${queueId} resolved by ${resolution.resolvedBy}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get queue items with filters.
 */
export async function getQueue(
  filters?: QueueFilters
): Promise<{ items: QueueItem[]; total: number; error?: string }> {
  const supabase = getSupabase();

  try {
    let query = supabase
      .from('scheduling_queue')
      .select('*', { count: 'exact' });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.enrollmentId) {
      query = query.eq('enrollment_id', filters.enrollmentId);
    }
    if (filters?.coachId) {
      query = query.eq('coach_id', filters.coachId);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(
        filters?.offset || 0,
        (filters?.offset || 0) + (filters?.limit || 50) - 1
      );

    const { data, count, error } = await query;

    if (error) {
      return { items: [], total: 0, error: error.message };
    }

    return {
      items: (data || []) as QueueItem[],
      total: count || 0,
    };
  } catch (error: any) {
    return { items: [], total: 0, error: error.message };
  }
}
