// ============================================================
// FILE: lib/tuition/session-closure.ts
// PURPOSE: Single source of truth (SSOT) for tuition session
//          closure. Performs the COMMON closure sequence shared by
//          the three balance-deducting completion paths:
//            - app/api/coach/sessions/[id]/complete
//            - app/api/coach/sessions/[id]/offline-report
//            - app/api/coach/sessions/[id]/activity-log
//
// PHASE 2A — BEHAVIOR-PRESERVING EXTRACTION ONLY.
//   This helper creates the seam; it fixes nothing functionally.
//   Gating (session_type vs enrollment_type), the missing
//   idempotency guard in deductTuitionBalance, and the missing
//   sessions_completed write are FLAGGED for 2B, NOT fixed here.
//
// Option A (V3 atomicity): this helper OWNS the single combined
//   scheduled_sessions.update(status + completed_at + caller path
//   fields). Callers pass their path-specific columns via
//   opts.extraSessionFields so the one atomic update is preserved.
//
// LOCK 3 op order (each a SEPARATE awaited op; NOT a transaction —
//   none exists today; do NOT reorder):
//     (1) single session .update(status + completed_at + extra)
//     (2) deductTuitionBalance        (when opts.deductBalance)
//     (3) coach_payouts insert        (when opts.insertPayout)
//     (4) parent-summary dispatch     (when opts.dispatchSummary)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { deductTuitionBalance } from '@/lib/tuition/balance-tracker';
import {
  loadPayoutConfig,
  loadCoachGroup,
  calculateEnrollmentBreakdown,
} from '@/lib/config/payout-config';
import { qstash } from '@/lib/qstash';

type ScheduledSessionUpdate = Database['public']['Tables']['scheduled_sessions']['Update'];
type DeductResult = Awaited<ReturnType<typeof deductTuitionBalance>>;

/** Minimal pre-fetched session fields the helper needs (caller already SELECTed these). */
export interface CloseTuitionSessionSession {
  enrollment_id: string | null;
  child_id: string | null;
  coach_id: string | null;
  /** Payout gate discriminator used by complete today (kept caller-side; helper does not re-derive). */
  session_type?: string | null;
}

export interface CloseTuitionSessionOptions {
  /** Admin client already in scope in the caller (createAdminClient / getServiceSupabase / supabaseAdmin). */
  supabase: SupabaseClient<Database>;
  sessionId: string;
  session: CloseTuitionSessionSession;
  /** Route-level requestId — used for helper logging and as the default deduct/summary requestId. */
  requestId: string;

  /**
   * Whether the helper performs op (1) — the combined status .update(). Default true
   * (offline-report + activity-log let the helper own status, Option A). complete passes
   * false in 2A: it KEEPS its inline status write at route :105 and uses the helper only
   * for deduct+payout+summary.
   * 2B: consolidate complete status write into helper at complete's :105.
   */
  setStatus?: boolean;

  /** Write completed_at alongside status. Default true (every path does this today). */
  setCompletedAt?: boolean;
  /**
   * Path-specific scheduled_sessions columns merged into the SINGLE status update
   * (Option A — preserves V3 atomicity). e.g. companion_panel_completed, coach_notes,
   * report_late, focus_area, capture_id, …
   */
  extraSessionFields?: ScheduledSessionUpdate;

  /** Tuition balance deduction. Caller decides the gate (LOCK 1); helper receives the boolean. */
  deductBalance?: boolean;
  /** sessions delivered in one sitting (1 or 2). Default 1. */
  sessionsDelivered?: number;
  /** 4th arg to deductTuitionBalance — preserves each caller's actor value. Default 'coach'. */
  deductActor?: string;
  /**
   * 5th arg to deductTuitionBalance — PRESERVED VERBATIM (logging requestId, NOT an
   * idempotency key). complete passes a fresh crypto.randomUUID() here today; do NOT
   * normalize to opts.requestId. Default = opts.requestId.
   */
  deductRequestId?: string;

  /** coach_payouts insert (complete only today). Caller decides the gate (LOCK 1). */
  insertPayout?: boolean;

  /** Parent-summary QStash dispatch. Caller decides the gate (LOCK 1). */
  dispatchSummary?: boolean;
  /**
   * Extra fields merged into the parent-summary publishJSON body. offline-report passes
   * { offlineContext: {...} }; complete passes { requestId: crypto.randomUUID() } to
   * preserve its fresh-UUID summary body requestId (overrides the base requestId).
   */
  summaryExtraBody?: Record<string, unknown>;

  /** Caller's APP_URL constant (kept identical per route). */
  appUrl: string;
}

export interface CloseTuitionSessionResult {
  /** true once the status update succeeded. */
  completed: boolean;
  /** Non-null when the single session update errored (caller decides short-circuit/500). */
  sessionUpdateError: string | null;
  /** Populated when deductBalance ran (caller may log newBalance/alertSent as it does today). */
  deductResult?: DeductResult;
}

/**
 * Common tuition session-closure sequence. Defaults reproduce each caller's current
 * behavior per the Phase 2A V2 matrix. Each side-effect (deduct / payout / summary) is
 * independently try/caught so a failure in one does NOT block the next — matching the
 * separate-try/catch structure of complete/offline-report/activity-log today.
 */
export async function closeTuitionSession(
  opts: CloseTuitionSessionOptions,
): Promise<CloseTuitionSessionResult> {
  const {
    supabase,
    sessionId,
    session,
    requestId,
    setStatus = true,
    setCompletedAt = true,
    extraSessionFields = {},
    deductBalance = false,
    sessionsDelivered = 1,
    deductActor = 'coach',
    insertPayout = false,
    dispatchSummary = false,
    summaryExtraBody = {},
    appUrl,
  } = opts;
  const deductRequestId = opts.deductRequestId ?? requestId;

  const result: CloseTuitionSessionResult = { completed: false, sessionUpdateError: null };

  // ── (1) Single combined session update (Option A: helper owns status + completed_at) ──
  // Skipped when setStatus=false (complete keeps its inline :105 status write in 2A);
  // sessionUpdateError stays null and completed stays false in that case — caller owns status.
  if (setStatus) {
    const sessionUpdate: ScheduledSessionUpdate = {
      status: 'completed',
      ...(setCompletedAt ? { completed_at: new Date().toISOString() } : {}),
      ...extraSessionFields,
    };
    const { error: sessionUpdateError } = await supabase
      .from('scheduled_sessions')
      .update(sessionUpdate)
      .eq('id', sessionId);
    if (sessionUpdateError) {
      result.sessionUpdateError = sessionUpdateError.message;
      // 2B: standardize error event name (pending Sentry dashboard confirm)
      // Pinned to 'session_update_error' — byte-identical to what offline-report/activity-log
      // emitted pre-2A, so no dashboard alert keyed on that string is disturbed.
      console.error(JSON.stringify({
        requestId,
        event: 'session_update_error',
        sessionId,
        error: sessionUpdateError.message,
      }));
    } else {
      result.completed = true;
    }
  }

  // ── (2) Tuition balance deduction ──
  if (deductBalance && session.enrollment_id) {
    try {
      result.deductResult = await deductTuitionBalance(
        session.enrollment_id,
        sessionId,
        sessionsDelivered,
        deductActor,
        deductRequestId,
      );
    } catch (err) {
      console.error(JSON.stringify({
        requestId,
        event: 'close_tuition_deduct_error',
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  // ── (3) coach_payouts insert (mirrors complete/route.ts exactly; idempotent on
  //        session_id + product_type via loadCoachGroup(session.coach_id)) ──
  if (insertPayout && session.coach_id) {
    try {
      const { data: tuitionRows } = await supabase
        .from('tuition_onboarding')
        .select('session_rate, session_duration_minutes, child_name')
        .eq('child_id', session.child_id!)
        .eq('status', 'parent_completed')
        .limit(1);

      const tuitionData = tuitionRows?.[0];
      if (!tuitionData || !tuitionData.session_rate) {
        console.warn(`[tuition-earnings] No tuition_onboarding for child ${session.child_id}`);
      } else {
        const coachGroup = await loadCoachGroup(session.coach_id);
        const config = await loadPayoutConfig();

        const sessionRateRupees = tuitionData.session_rate / 100;
        const breakdown = calculateEnrollmentBreakdown(
          sessionRateRupees,
          1, 0,
          'starter',
          'organic',
          coachGroup,
          0,
          config,
          undefined,
          'tuition',
        );

        const now = new Date();
        const payoutDay = config.payout_day_of_month || 7;
        const payoutDate = now.getDate() <= payoutDay
          ? new Date(now.getFullYear(), now.getMonth(), payoutDay)
          : new Date(now.getFullYear(), now.getMonth() + 1, payoutDay);
        const scheduledDate = payoutDate.toISOString().split('T')[0];

        const { data: existingPayout } = await supabase
          .from('coach_payouts')
          .select('id')
          .eq('session_id', sessionId)
          .eq('product_type', 'tuition')
          .limit(1);

        if (!existingPayout?.length) {
          const { error: payoutError } = await supabase
            .from('coach_payouts')
            .insert({
              coach_id: session.coach_id,
              child_id: session.child_id,
              child_name: tuitionData.child_name,
              session_type: 'tuition',
              payout_type: 'tuition_session',
              product_type: 'tuition',
              session_id: sessionId,
              payout_month: 0,
              gross_amount: breakdown.coach_cost_amount,
              tds_amount: breakdown.tds_amount,
              net_amount: breakdown.net_to_coaching_coach,
              scheduled_date: scheduledDate,
              status: 'scheduled',
              description: `Tuition: ${tuitionData.child_name} - ${now.toISOString().split('T')[0]}`,
              payout_period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            });

          if (payoutError) {
            console.error('[tuition-earnings] coach_payout insert failed:', payoutError);
          } else {
            console.log(`[tuition-earnings] Scheduled ${breakdown.coach_cost_amount} paise for ${tuitionData.child_name} (session ${sessionId})`);
          }
        }
      }
    } catch (err) {
      console.error('[tuition-earnings] Pipeline error (non-blocking):', err);
    }
  }

  // ── (4) Parent summary dispatch (QStash → parent-summary route) ──
  if (dispatchSummary) {
    try {
      if (qstash) {
        const queueResult = await qstash.publishJSON({
          url: `${appUrl}/api/coach/sessions/${sessionId}/parent-summary`,
          body: {
            sessionId,
            childId: session.child_id,
            requestId,
            ...summaryExtraBody,
          },
          retries: 3,
          delay: 5,
        });
        console.log(JSON.stringify({
          requestId,
          event: 'parent_summary_queued',
          messageId: queueResult.messageId,
        }));
      } else {
        console.log(JSON.stringify({
          requestId,
          event: 'parent_summary_skipped',
          reason: 'QStash not configured',
        }));
      }
    } catch (queueError) {
      console.error(JSON.stringify({
        requestId,
        event: 'parent_summary_queue_error',
        error: queueError instanceof Error ? queueError.message : String(queueError),
      }));
    }
  }

  return result;
}
