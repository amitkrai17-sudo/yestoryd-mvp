// ============================================================================
// SCHEDULING ORCHESTRATOR
// lib/scheduling/orchestrator.ts
// ============================================================================
//
// Main entry point that routes scheduling events to appropriate handlers.
// All scheduling operations should go through dispatch().
//
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleSession, rescheduleSession, cancelSession, bulkReassign } from './session-manager';
import { processUnavailability, processCoachReturn, processCoachExit } from './coach-availability-handler';
import { scheduleEnrollmentSessions } from './enrollment-scheduler';
import { getSetting } from '@/lib/settings/getSettings';
import { createLogger } from './logger';
import { checkIdempotency, setIdempotency } from './redis-store';
import { pause as pauseEnrollment, freezeEnrollmentSessions } from '@/lib/enrollment/pause-service';

const logger = createLogger('orchestrator');

// ============================================================================
// IDEMPOTENCY CACHE (in-memory fallback when Redis is unavailable)
// ============================================================================

const recentEvents = new Map<string, { result: DispatchResult; timestamp: number }>();
const IDEMPOTENCY_WINDOW_MS = 10000; // 10 seconds

function cleanupIdempotencyCache(): void {
  if (recentEvents.size > 100) {
    const now = Date.now();
    const keys = Array.from(recentEvents.keys());
    for (const key of keys) {
      const value = recentEvents.get(key);
      if (value && now - value.timestamp > IDEMPOTENCY_WINDOW_MS) {
        recentEvents.delete(key);
      }
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type SchedulingEventType =
  | 'enrollment.created'
  | 'enrollment.resumed'
  | 'enrollment.paused'
  | 'enrollment.delayed_start_activated'
  | 'coach.unavailable'
  | 'coach.available'
  | 'coach.exit'
  | 'session.reschedule'
  | 'session.cancel'
  | 'session.completed'
  | 'session.no_show';

export interface DispatchPayload {
  // Common
  enrollmentId?: string;
  sessionId?: string;
  coachId?: string;
  childId?: string;

  // enrollment.created / delayed_start_activated
  planSlug?: string;
  programStart?: string;

  // enrollment.paused
  pauseStartDate?: string;
  pauseEndDate?: string;

  // coach.unavailable
  startDate?: string;
  endDate?: string;
  reason?: string;

  // session.reschedule
  newDate?: string;
  newTime?: string;

  // session.cancel / no_show
  cancelledBy?: string;
  // 2B.3 fault axis written atomically with status='cancelled' (cancel-session.ts)
  disposition?: string;

  // Generic
  requestId?: string;
}

export interface DispatchResult {
  success: boolean;
  event: SchedulingEventType;
  data?: any;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createAdminClient();
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Route a scheduling event to the appropriate handler.
 * This is the main entry point for the scheduling orchestrator.
 * Includes idempotency protection (10s window) and structured logging.
 */
export async function dispatch(
  event: SchedulingEventType,
  payload: DispatchPayload
): Promise<DispatchResult> {
  const requestId = payload.requestId || crypto.randomUUID();
  logger.info('dispatch_start', { requestId, event, data: payload });

  // Idempotency check — Redis first, in-memory fallback
  const idempotencyKey = `${event}:${JSON.stringify(payload)}`;

  // Try Redis
  const redisCheck = await checkIdempotency(idempotencyKey, IDEMPOTENCY_WINDOW_MS / 1000);
  if (redisCheck.isDuplicate) {
    logger.info('duplicate_event_skipped', { requestId, event, source: 'redis' });
    return redisCheck.cachedResult;
  }

  // Fallback: in-memory
  const memCached = recentEvents.get(idempotencyKey);
  if (memCached && Date.now() - memCached.timestamp < IDEMPOTENCY_WINDOW_MS) {
    logger.info('duplicate_event_skipped', { requestId, event, source: 'memory' });
    return memCached.result;
  }

  const startTime = Date.now();
  const result = await dispatchInternal(event, payload, requestId);

  // Cache result — both Redis and in-memory
  await setIdempotency(idempotencyKey, result, IDEMPOTENCY_WINDOW_MS / 1000);
  recentEvents.set(idempotencyKey, { result, timestamp: Date.now() });
  cleanupIdempotencyCache();

  logger.info('dispatch_complete', {
    requestId,
    event,
    data: { success: result.success, duration: Date.now() - startTime },
  });

  return result;
}

async function dispatchInternal(
  event: SchedulingEventType,
  payload: DispatchPayload,
  requestId: string
): Promise<DispatchResult> {
  try {
    switch (event) {
      // ====================================================================
      // ENROLLMENT EVENTS
      // ====================================================================

      case 'enrollment.created':
      case 'enrollment.delayed_start_activated': {
        if (!payload.enrollmentId) {
          return { success: false, event, error: 'enrollmentId required' };
        }

        // Fetch enrollment details
        const supabase = getSupabase();
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('id, child_id, coach_id, product_id, program_start, preferred_day, preferred_time, pricing_plans!product_id (slug)')
          .eq('id', payload.enrollmentId)
          .single();

        if (enrollmentError || !enrollment) {
          console.error(`[Orchestrator] ${event}: Failed to fetch enrollment ${payload.enrollmentId}`, {
            requestId,
            error: enrollmentError?.message,
            code: enrollmentError?.code,
            details: enrollmentError?.details,
            hint: enrollmentError?.hint,
          });
          return { success: false, event, error: `Enrollment not found: ${enrollmentError?.message || 'no data returned'}` };
        }

        const pricingPlan = (enrollment as any).pricing_plans as { slug: string } | null;
        const planSlug = payload.planSlug || pricingPlan?.slug || 'full';
        const programStart = payload.programStart
          || enrollment.program_start
          || new Date().toISOString().split('T')[0];

        // Build preference from actual columns: preferred_day (number), preferred_time (string bucket)
        const preferredTimeBucket = enrollment.preferred_time as string | null;
        const preferredDay = enrollment.preferred_day as number | null;

        if (!enrollment.child_id || !enrollment.coach_id) {
          return { success: false, event, error: 'Enrollment missing child_id or coach_id' };
        }

        console.log(`[Orchestrator] ${event}: scheduling sessions for enrollment ${enrollment.id}`, {
          requestId,
          childId: enrollment.child_id,
          coachId: enrollment.coach_id,
          planSlug,
          programStart,
          preferredDay,
          preferredTimeBucket,
        });

        const result = await scheduleEnrollmentSessions({
          enrollmentId: enrollment.id,
          childId: enrollment.child_id,
          coachId: enrollment.coach_id,
          planSlug,
          programStart: new Date(programStart),
          preference: {
            bucket: (preferredTimeBucket as 'morning' | 'afternoon' | 'evening' | 'any') || 'any',
            preferredDays: preferredDay != null ? [preferredDay] : undefined,
          },
          requestId,
        });

        if (!result.success) {
          console.error(`[Orchestrator] ${event}: scheduleEnrollmentSessions failed for enrollment ${enrollment.id}`, {
            requestId,
            sessionsCreated: result.sessionsCreated,
            manualRequired: result.manualRequired,
            errors: result.errors,
          });
        }

        return {
          success: result.success,
          event,
          data: {
            sessionsCreated: result.sessionsCreated,
            manualRequired: result.manualRequired,
            errors: result.errors,
          },
          error: result.success ? undefined : result.errors.join('; '),
        };
      }

      case 'enrollment.paused': {
        if (!payload.enrollmentId || !payload.pauseStartDate || !payload.pauseEndDate) {
          return { success: false, event, error: 'enrollmentId, pauseStartDate, pauseEndDate required' };
        }

        // F1: SUSPEND, do not cancel. The single owner freezes each window session
        // -> 'paused' (capturing pre_pause_status), KEEPING calendar + Recall.
        // Resume restores the exact prior status. This is the sole session-pausing
        // action; pause/route dispatches here rather than touching sessions itself.
        const { frozen, skipped } = await freezeEnrollmentSessions(
          getSupabase(),
          {
            enrollmentId: payload.enrollmentId,
            startDate: payload.pauseStartDate,
            endDate: payload.pauseEndDate,
          },
          `enrollment-paused-${payload.enrollmentId}`,
        );

        return {
          success: true,
          event,
          data: { sessionsFrozen: frozen, sessionsSkipped: skipped },
        };
      }

      case 'enrollment.resumed': {
        if (!payload.enrollmentId) {
          return { success: false, event, error: 'enrollmentId required' };
        }

        // Re-dispatch as enrollment.created to reschedule remaining sessions
        // The enrollment-scheduler handles idempotency (skips already-scheduled sessions)
        return dispatch('enrollment.created', payload);
      }

      // ====================================================================
      // COACH EVENTS
      // ====================================================================

      case 'coach.unavailable': {
        if (!payload.coachId || !payload.startDate || !payload.endDate) {
          return { success: false, event, error: 'coachId, startDate, endDate required' };
        }

        const result = await processUnavailability(
          payload.coachId,
          payload.startDate,
          payload.endDate,
          payload.reason || 'Unavailable'
        );

        return {
          success: result.success,
          event,
          data: {
            action: result.action,
            sessionsAffected: result.sessionsAffected,
            errors: result.errors,
          },
          error: result.success ? undefined : result.errors.join('; '),
        };
      }

      case 'coach.available': {
        if (!payload.coachId) {
          return { success: false, event, error: 'coachId required' };
        }

        const result = await processCoachReturn(payload.coachId);

        return {
          success: result.success,
          event,
          data: { sessionsTransferredBack: result.sessionsTransferredBack },
          error: result.success ? undefined : result.errors.join('; '),
        };
      }

      case 'coach.exit': {
        if (!payload.coachId) {
          return { success: false, event, error: 'coachId required' };
        }

        const result = await processCoachExit(payload.coachId);

        return {
          success: result.success,
          event,
          data: { enrollmentsReassigned: result.enrollmentsReassigned },
          error: result.success ? undefined : result.errors.join('; '),
        };
      }

      // ====================================================================
      // SESSION EVENTS
      // ====================================================================

      case 'session.reschedule': {
        const missing = [
          !payload.sessionId && 'sessionId',
          !payload.newDate && 'newDate',
          !payload.newTime && 'newTime',
        ].filter(Boolean);

        if (missing.length > 0) {
          console.error(`[Orchestrator] session.reschedule: missing fields: ${missing.join(', ')}`, {
            requestId,
            sessionId: payload.sessionId || null,
            newDate: payload.newDate || null,
            newTime: payload.newTime || null,
          });
          return { success: false, event, error: `Missing required fields: ${missing.join(', ')}` };
        }

        const result = await rescheduleSession(
          payload.sessionId!,
          { date: payload.newDate!, time: payload.newTime! },
          payload.reason || 'Rescheduled'
        );

        if (!result.success) {
          console.error(`[Orchestrator] session.reschedule failed for ${payload.sessionId}`, {
            requestId,
            error: result.error,
          });
        }

        return {
          success: result.success,
          event,
          data: { sessionId: result.sessionId, meetLink: result.meetLink },
          error: result.error,
        };
      }

      case 'session.cancel': {
        if (!payload.sessionId) {
          return { success: false, event, error: 'sessionId required' };
        }

        const result = await cancelSession(
          payload.sessionId,
          payload.reason || 'Cancelled',
          payload.cancelledBy || 'system',
          payload.disposition
        );

        return {
          success: result.success,
          event,
          data: { sessionId: result.sessionId },
          error: result.error,
        };
      }

      case 'session.completed': {
        if (!payload.sessionId) {
          return { success: false, event, error: 'sessionId required' };
        }

        const supabase = getSupabase();

        // Reset consecutive no-shows
        const { data: session } = await supabase
          .from('scheduled_sessions')
          .select('child_id, enrollment_id')
          .eq('id', payload.sessionId)
          .single();

        if (session && session.child_id && session.enrollment_id) {
          await supabase
            .from('enrollments')
            .update({
              consecutive_no_shows: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('child_id', session.child_id)
            .eq('status', 'active');

          // Check if program complete (all sessions completed)
          const { count: totalSessions } = await supabase
            .from('scheduled_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('enrollment_id', session.enrollment_id);

          const { count: completedSessions } = await supabase
            .from('scheduled_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('enrollment_id', session.enrollment_id)
            .eq('status', 'completed');

          if (totalSessions && completedSessions && completedSessions >= totalSessions) {
            console.log(`[Orchestrator] All sessions completed for enrollment ${session.enrollment_id}`);
            // Program completion is handled by existing completion flow
          }
        }

        return { success: true, event, data: { sessionId: payload.sessionId } };
      }

      case 'session.no_show': {
        if (!payload.sessionId) {
          return { success: false, event, error: 'sessionId required' };
        }

        const supabase = getSupabase();

        const { data: session } = await supabase
          .from('scheduled_sessions')
          .select('child_id, enrollment_id')
          .eq('id', payload.sessionId)
          .single();

        if (!session || !session.child_id) {
          return { success: false, event, error: 'Session not found or missing child_id' };
        }

        // Get enrollment
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id, consecutive_no_shows, total_no_shows, status')
          .eq('child_id', session.child_id)
          .eq('status', 'active')
          .single();

        if (!enrollment) {
          return { success: true, event, data: { message: 'No active enrollment found' } };
        }

        const newConsecutive = (enrollment.consecutive_no_shows || 0) + 1;
        const newTotal = (enrollment.total_no_shows || 0) + 1;

        const atRiskThreshold = parseInt(await getSetting('consecutive_no_show_at_risk_threshold') || '3', 10);
        const autoPauseThreshold = parseInt(await getSetting('total_no_show_auto_pause_threshold') || '5', 10);

        const updateData: Record<string, any> = {
          consecutive_no_shows: newConsecutive,
          total_no_shows: newTotal,
          updated_at: new Date().toISOString(),
        };

        if (newConsecutive >= atRiskThreshold) {
          updateData.at_risk = true;
          updateData.at_risk_reason = `${newConsecutive} consecutive no-shows`;
        }

        let autoPaused = false;
        if (newTotal >= autoPauseThreshold) {
          // Pause-signal fields are written by the shared service below; here we
          // only set the at-risk annotation that the service does not own.
          updateData.at_risk = true;
          updateData.at_risk_reason = `Auto-paused: ${newTotal} total no-shows`;
          autoPaused = true;
        }

        await supabase
          .from('enrollments')
          .update(updateData)
          .eq('id', enrollment.id);

        if (autoPaused) {
          // Canonical pause via shared service (BREAK2.1b). System source bypasses
          // the parent quota; skipSideEffects → orchestrator keeps its own logging.
          await pauseEnrollment(enrollment.id, {
            source: 'noshow_auto',
            reason: 'auto_noshow',
            startDate: new Date().toISOString().split('T')[0],
            skipSideEffects: true,
            actor: { type: 'system' },
          });
          // F2: auto-pause must also FREEZE sessions (the prior orphan: enrollment
          // flipped to paused but sessions stayed scheduled). Open-ended — all future
          // in-scope sessions -> 'paused', calendar kept.
          await freezeEnrollmentSessions(supabase, { enrollmentId: enrollment.id }, `noshow-auto-${enrollment.id}`);
          console.warn(`[Orchestrator] Enrollment auto-paused: ${enrollment.id}, total no-shows: ${newTotal}`);
        }

        return {
          success: true,
          event,
          data: {
            consecutiveNoShows: newConsecutive,
            totalNoShows: newTotal,
            atRisk: newConsecutive >= atRiskThreshold,
            autoPaused,
          },
        };
      }

      default:
        return { success: false, event, error: `Unknown event: ${event}` };
    }
  } catch (error: any) {
    logger.error('dispatch_error', { requestId, event, error: error.message });
    return { success: false, event, error: error.message };
  }
}
