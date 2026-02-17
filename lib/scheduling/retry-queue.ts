// ============================================================================
// SCHEDULING RETRY QUEUE
// lib/scheduling/retry-queue.ts
// ============================================================================
//
// Handles transient scheduling failures with exponential backoff via QStash.
// Strategy from Config Provider: Attempt 1 immediate, +1hr, +6hr, +24hr,
// then escalate to Manual Queue.
//
// ============================================================================

import { qstash } from '@/lib/qstash';
import { getRetryConfig } from './config-provider';
import { escalate } from './manual-queue';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// TYPES
// ============================================================================

export interface RetryResult {
  success: boolean;
  action: 'retried' | 'escalated' | 'error';
  nextRetryAt?: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

function getSupabase() {
  return createAdminClient();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Enqueue a session for retry scheduling.
 * Reads attempt count from session, determines delay, queues via QStash.
 * If max attempts exceeded, escalates to manual queue.
 */
export async function enqueue(
  sessionId: string,
  reason: string
): Promise<RetryResult> {
  const supabase = getSupabase();

  try {
    // Get current attempt count
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('id, scheduling_attempts, enrollment_id, child_id, coach_id, session_type, week_number')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, action: 'error', error: 'Session not found' };
    }

    const retryConfig = await getRetryConfig();
    const currentAttempt = (session.scheduling_attempts || 0) + 1;

    // Check if we've exceeded max attempts
    if (currentAttempt > retryConfig.maxAttempts) {
      console.log(`[RetryQueue] Session ${sessionId}: max attempts (${retryConfig.maxAttempts}) exceeded, escalating`);

      await escalate(sessionId, `Auto-scheduling failed after ${retryConfig.maxAttempts} attempts: ${reason}`, {
        enrollmentId: session.enrollment_id,
        childId: session.child_id,
        coachId: session.coach_id,
        sessionType: session.session_type,
        weekNumber: session.week_number,
      });

      // Update session
      await supabase
        .from('scheduled_sessions')
        .update({
          scheduling_attempts: currentAttempt,
          last_attempt_at: new Date().toISOString(),
          next_retry_at: null,
          failure_reason: reason,
        })
        .eq('id', sessionId);

      return { success: true, action: 'escalated' };
    }

    // Calculate delay (hours from config, converted to seconds)
    const delayIndex = Math.min(currentAttempt - 1, retryConfig.delays.length - 1);
    const delayHours = retryConfig.delays[delayIndex];
    const delaySeconds = delayHours * 3600;

    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    // Update session with retry info
    await supabase
      .from('scheduled_sessions')
      .update({
        scheduling_attempts: currentAttempt,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetryAt.toISOString(),
        failure_reason: reason,
      })
      .eq('id', sessionId);

    // Queue retry job via QStash
    if (qstash) {
      await qstash.publishJSON({
        url: `${APP_URL}/api/jobs/retry-scheduling`,
        body: {
          sessionId,
          attempt: currentAttempt,
          reason,
          timestamp: new Date().toISOString(),
        },
        delay: delaySeconds,
        retries: 1,
      });

      console.log(`[RetryQueue] Session ${sessionId}: attempt ${currentAttempt}/${retryConfig.maxAttempts}, retry in ${delayHours}h`);
    } else {
      console.warn(`[RetryQueue] QStash not configured, cannot queue retry for session ${sessionId}`);
      return { success: false, action: 'error', error: 'QStash not configured' };
    }

    return {
      success: true,
      action: 'retried',
      nextRetryAt: nextRetryAt.toISOString(),
    };
  } catch (error: any) {
    console.error(`[RetryQueue] Error enqueueing session ${sessionId}:`, error);
    return { success: false, action: 'error', error: error.message };
  }
}

/**
 * Process a retry attempt for a session.
 * Called by the QStash job handler.
 * Returns true if scheduling succeeded, false if needs another retry.
 */
export async function processRetry(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  try {
    // Get session details
    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, enrollment_id, child_id, coach_id, session_type, week_number,
        scheduled_date, scheduled_time, duration_minutes, status,
        scheduling_attempts, failure_reason
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return { success: false, error: 'Session not found' };
    }

    // Skip if session is already scheduled/completed
    if (session.status && ['scheduled', 'completed', 'cancelled'].includes(session.status)) {
      console.log(`[RetryQueue] Session ${sessionId} already ${session.status}, skipping retry`);
      await supabase
        .from('scheduled_sessions')
        .update({ next_retry_at: null })
        .eq('id', sessionId);
      return { success: true };
    }

    // Attempt to find a slot and schedule
    if (!session.enrollment_id || !session.child_id || !session.coach_id) {
      return { success: false, error: 'Session missing required IDs for scheduling' };
    }

    // Import dynamically to avoid circular deps
    const { scheduleSession } = await import('./session-manager');

    const result = await scheduleSession(
      {
        enrollmentId: session.enrollment_id,
        childId: session.child_id,
        coachId: session.coach_id,
        sessionType: session.session_type || 'coaching',
        weekNumber: session.week_number,
        durationMinutes: session.duration_minutes || 45,
      },
      { isRetry: true, sessionId }
    );

    if (result.success) {
      // Clear retry tracking
      await supabase
        .from('scheduled_sessions')
        .update({
          next_retry_at: null,
          failure_reason: null,
        })
        .eq('id', sessionId);

      return { success: true };
    }

    // Failed again — re-enqueue
    await enqueue(sessionId, result.error || 'Retry failed');
    return { success: false, error: result.error };
  } catch (error: any) {
    console.error(`[RetryQueue] processRetry error for ${sessionId}:`, error);
    return { success: false, error: error.message };
  }
}
