// ============================================================================
// FILE: lib/scheduling/transition-session-status.ts   ── SOLE status writer ──
//
// PURPOSE: The SOLE writer of `scheduled_sessions.status`. Every status flip
//   (UPDATE of an existing row) funnels here so the atomic core + the
//   context-driven side-effects are decided in ONE place and can never diverge.
//
//   NOT in scope (stay where they are — they are INSERTs / specialised UPDATEs):
//     • BIRTH inserts (pending / pending_scheduling / scheduled) — owned by
//       session-engine.ts `buildInsertRow` / createScheduledSession[sBatch].
//     • RESCHEDULE (→ scheduled + date/time + 6 reminder-flag reset + calendar
//       PATCH/create + recall recreate) — owned by the reschedule wrapper
//       (lib/scheduling/operations/reschedule-session.ts). See POLICY F.
//     • CALENDAR-ATTACH link writes — owned by attachCalendarLink.
//
// ── POLICIES (the divergences this service resolves; from the State-2 spec) ──
//
//   POLICY A — completed_at:
//     Stamp completed_at IFF `to` ∈ {completed, no_show, coach_no_show, partial}.
//     (Mirrors the recall updateSessionStatus rule. Fixes the exit-assessment /
//      diagnostic divergence where status='completed' was written WITHOUT
//      completed_at.) `opts.explicitCompletedAt` overrides the stamp value.
//
//   POLICY B — brain (learning_events) is NEVER written inline here:
//     A `completed` transition fires dispatch('session.completed', …) and the
//     brain/learning_events are produced downstream (capture-confirm / summary).
//
//   POLICY D — cancel teardown is ALWAYS run:
//     A `cancelled` transition ALWAYS runs cancelEvent + cancelRecallBot,
//     UNCONDITIONALLY (NOT gated by skipSideEffects). Every cancel entry point
//     therefore gets teardown automatically (fixes divergence #6 — the bare-flip
//     bypasses that skipped teardown).
//
//   POLICY E — missed/no-show is product-gated:
//     `missed`/`no_show` on a TUITION enrollment → deductTuitionBalance(1) +
//     insertPayout + disposition='parent_no_show'. COACHING → none. (PHASE 2-missed.)
//
//   POLICY F — reschedule is OUT of this fn's `to`-set:
//     `scheduled` is reachable here ONLY as a pending/pending_scheduling →
//     scheduled finalize WITHOUT moving date/time. Slot-moving flips go through
//     the reschedule wrapper (owns date/time + reminders + calendar).
//
//   POLICY G — transition guard + idempotent no-op:
//     `from` is read inside the call. from===to → no-op (ok, noop, no side-effects).
//     illegal (from→to) → ok:false, error:'illegal_transition' (no write). Terminal
//     states reject all outgoing except a same-state no-op. (LEGAL_TRANSITIONS below.)
//
//   CORE (one atomic .update().eq('id', sessionId)):
//     { status, [completed_at], [disposition], [recall_status mirror], updated_at }
//     + whitelisted opts.extraSessionFields (path columns; the 5 policy-owned fields
//     are REJECTED — see assertNoPolicyFields).
//
// ── ABSORBED MODELS → branch ──
//   • recall `updateSessionStatus` (webhooks/recall) → THE CORE (status +
//     recall_status mirror + POLICY-A completed_at + disposition).
//   • `closeTuitionSession` → completed+tuition / missed+tuition side-effects
//     (PHASE 2-completed / PHASE 2-missed; called with setStatus:false).
//   • `cancelSession` (operations/cancel-session.ts) → thin WRAPPER over this fn;
//     teardown + notify live HERE (the cancelled branch), not in the wrapper.
//
// ── FROM → TO VALIDITY (POLICY G) — see LEGAL_TRANSITIONS ──
//
// STATUS: CORE + guard + whitelist implemented for ALL `to`. Side-effects
//   implemented for `cancelled` (PHASE 2-cancel). `completed` / `missed` branches
//   are explicitly stubbed with PHASE 2-<x> markers and are NOT wired to callers.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvent } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { withCircuitBreaker } from './circuit-breaker';
import { notify } from './notification-manager';
import { logAudit } from './operations/helpers';
import { attachCalendarLink } from './calendar-link';
import { closeTuitionSession } from '@/lib/tuition/session-closure';
import { createLogger } from './logger';

const logger = createLogger('transition-session-status');

type AdminClient = ReturnType<typeof createAdminClient>;

/** Every value the `status` column may legally hold (lifecycle + recall axes). */
export type SessionStatusValue =
  | 'pending'
  | 'pending_scheduling'
  | 'scheduled'
  | 'in_progress'
  | 'bot_joining'
  | 'bot_error'
  | 'completed'
  | 'partial'
  | 'missed'
  | 'no_show'
  | 'coach_no_show'
  | 'cancelled'
  | 'paused'
  | 'pending_booking';

/** WHO initiated the transition (audit). */
export type TransitionActor = 'coach' | 'admin' | 'parent' | 'system' | 'recall' | 'cron';

/** Fault axis written to scheduled_sessions.disposition (records WHO, never a side-effect). */
export type SessionDisposition =
  | 'delivered'
  | 'parent_no_show'
  | 'coach_no_show'
  | 'coach_cancelled';

export interface TransitionOpts {
  /** Suppress the product side-effects (balance/payout/dispatch). Does NOT suppress
   *  POLICY-D cancel teardown, which is unconditional. CORE status write still runs. */
  skipSideEffects?: boolean;
  /** Sessions delivered in one sitting (tuition deduct amount). Default 1. */
  sessionsDelivered?: number;
  /** Override POLICY-A completed_at value (e.g. recall backfill of a past join). */
  explicitCompletedAt?: string;
  /** Pre-built client reused from the caller's scope; one is created if absent. */
  supabase?: AdminClient;
  /** Path-specific columns merged into the SAME atomic update. Permitted examples by
   *  branch: cancel/missed → coach_notes, no_show_reason; completion → focus_area,
   *  category_id, capture_id, intelligence_score, payout_processed, ai_summary,
   *  recording_url, transcript, skills_worked_on, progress_rating, engagement_level,
   *  confidence_level, breakthrough_moment, concerns_noted, homework_*, flagged_for_attention,
   *  flag_reason, audio_storage_path, duration_minutes, attendance_count. The 5 policy-owned
   *  fields (status/completed_at/disposition/recall_status/updated_at) are REJECTED with
   *  'policy_field_in_extra' — the escape hatch is NOT a bypass. */
  extraSessionFields?: Record<string, unknown>;
  /** Fire the to-specific notification. For `cancelled` → notify('session.cancelled').
   *  Default false (callers that send their own route-level template pass false). */
  notify?: boolean;
  /** Audit/actor label forwarded to deductTuitionBalance (e.g. the marking coach's
   *  email). Defaults to the `actor` enum when absent. */
  actorLabel?: string;
}

export interface TransitionInput {
  sessionId: string;
  to: SessionStatusValue;
  actor: TransitionActor;
  /** Human reason (audit / notification). */
  reason?: string;
  /** Explicit disposition; merged into the atomic update when provided. */
  disposition?: SessionDisposition;
  requestId: string;
  opts?: TransitionOpts;
}

/** What actually fired (for the caller's logging + assertions). */
export interface TransitionSideEffects {
  balanceDeducted?: boolean;   // deductTuitionBalance ran        (PHASE 2-completed/missed)
  payoutInserted?: boolean;    // coach_payouts insert ran        (PHASE 2-completed/missed)
  brainDispatched?: boolean;   // dispatch('session.completed')   (PHASE 2-completed)
  calendarTorndown?: boolean;  // cancelEvent succeeded           (POLICY D)
  recallTorndown?: boolean;    // cancelRecallBot succeeded        (POLICY D)
  notified?: string;           // notification status, or 'skipped'
}

export interface TransitionResult {
  ok: boolean;
  from: SessionStatusValue | null;
  to: SessionStatusValue;
  sideEffects: TransitionSideEffects;
  /** true when from === to (idempotent, no write, no side-effects). */
  noop?: boolean;
  /** 'session_not_found' | 'illegal_transition' | 'update_failed' */
  error?: string;
}

// ── POLICY G — from → set-of-legal-to. Empty set = terminal (only same-state noop). ──
const LEGAL_TRANSITIONS: Record<SessionStatusValue, ReadonlySet<SessionStatusValue>> = {
  pending: new Set<SessionStatusValue>(['scheduled', 'completed', 'missed', 'no_show', 'coach_no_show', 'cancelled', 'pending_scheduling', 'paused']),
  pending_scheduling: new Set<SessionStatusValue>(['scheduled', 'completed', 'missed', 'no_show', 'coach_no_show', 'cancelled', 'paused']),
  scheduled: new Set<SessionStatusValue>(['in_progress', 'bot_joining', 'bot_error', 'completed', 'missed', 'no_show', 'coach_no_show', 'cancelled', 'pending_scheduling', 'paused']),
  bot_joining: new Set<SessionStatusValue>(['in_progress', 'bot_error', 'completed', 'partial', 'no_show', 'coach_no_show', 'cancelled']),
  in_progress: new Set<SessionStatusValue>(['bot_error', 'completed', 'partial', 'no_show', 'coach_no_show', 'cancelled']),
  bot_error: new Set<SessionStatusValue>([]),
  partial: new Set<SessionStatusValue>([]),
  completed: new Set<SessionStatusValue>([]),
  missed: new Set<SessionStatusValue>([]),
  no_show: new Set<SessionStatusValue>([]),
  coach_no_show: new Set<SessionStatusValue>([]),
  cancelled: new Set<SessionStatusValue>([]),
  // Non-terminal holding states: a paused/awaiting-booking session must resume to
  // `scheduled` before it can be delivered. Neither may go straight to completed/
  // missed/no_show/in_progress — POLICY G rejects those as illegal.
  paused: new Set<SessionStatusValue>(['scheduled', 'cancelled']),
  pending_booking: new Set<SessionStatusValue>(['scheduled', 'cancelled']),
};

const COMPLETED_AT_STATES: ReadonlySet<SessionStatusValue> = new Set<SessionStatusValue>([
  'completed', 'no_show', 'coach_no_show', 'partial',
]);
const RECALL_AXIS_STATES: ReadonlySet<SessionStatusValue> = new Set<SessionStatusValue>([
  'in_progress', 'bot_joining', 'bot_error', 'no_show', 'coach_no_show', 'partial', 'completed',
]);
const POLICY_FIELDS = ['status', 'completed_at', 'disposition', 'recall_status', 'updated_at'] as const;

/** The escape hatch must NOT become a bypass for service-owned fields. */
function assertNoPolicyFields(extra: Record<string, unknown>): void {
  for (const key of Object.keys(extra)) {
    if ((POLICY_FIELDS as readonly string[]).includes(key)) {
      throw new Error('policy_field_in_extra');
    }
  }
}

/**
 * SOLE writer of scheduled_sessions.status. Loads `from`, applies POLICY G guard,
 * writes the CORE atomic update (POLICY A + disposition + recall_status mirror),
 * then runs the context side-effects, each independently try/caught so a side-effect
 * failure never throws past the committed core write.
 */
export async function transitionSessionStatus(
  input: TransitionInput,
): Promise<TransitionResult> {
  const { sessionId, to, requestId } = input;
  const opts = input.opts ?? {};
  const supabase = opts.supabase ?? createAdminClient();

  // ── Load current row (guard + teardown fields) ──
  const { data: session, error: sErr } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, enrollment_id, status, session_type, scheduled_date, scheduled_time, google_event_id, recall_bot_id')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    return { ok: false, from: null, to, sideEffects: {}, error: 'session_not_found' };
  }

  const from = session.status as SessionStatusValue;

  // ── POLICY G — idempotent no-op + transition guard ──
  if (from === to) {
    return { ok: true, from, to, sideEffects: {}, noop: true };
  }
  if (!LEGAL_TRANSITIONS[from] || !LEGAL_TRANSITIONS[from].has(to)) {
    return { ok: false, from, to, sideEffects: {}, error: 'illegal_transition' };
  }

  // ── Product + disposition resolution for the missed/no-show family (POLICY E) ──
  // Determined BEFORE the core write so the atomic update carries the right disposition.
  let isTuition = false;
  let effectiveDisposition: string | null = input.disposition ?? null;
  if (to === 'missed' || to === 'no_show' || to === 'coach_no_show') {
    if (session.enrollment_id) {
      const { data: enr } = await supabase
        .from('enrollments')
        .select('enrollment_type')
        .eq('id', session.enrollment_id)
        .single();
      isTuition = enr?.enrollment_type === 'tuition';
    }
    if (effectiveDisposition == null) {
      // tuition 'missed' → parent_no_show; coaching 'missed' → none. no_show / coach_no_show
      // mirror the absorbed recall updateSessionStatus defaults.
      if (to === 'missed') effectiveDisposition = isTuition ? 'parent_no_show' : null;
      else if (to === 'no_show') effectiveDisposition = 'parent_no_show';
      else if (to === 'coach_no_show') effectiveDisposition = 'coach_no_show';
    }
  }

  // ── CORE — one atomic update ──
  const update: Record<string, unknown> = {
    status: to,
    updated_at: new Date().toISOString(),
  };
  if (COMPLETED_AT_STATES.has(to)) {
    update.completed_at = opts.explicitCompletedAt ?? new Date().toISOString();
  }
  if (effectiveDisposition != null) {
    update.disposition = effectiveDisposition;
  }
  if (RECALL_AXIS_STATES.has(to)) {
    update.recall_status = to;
  }
  if (opts.extraSessionFields) {
    assertNoPolicyFields(opts.extraSessionFields); // throws 'policy_field_in_extra'
    Object.assign(update, opts.extraSessionFields);
  }

  const { error: uErr } = await supabase
    .from('scheduled_sessions')
    .update(update)
    .eq('id', sessionId);
  if (uErr) {
    return { ok: false, from, to, sideEffects: {}, error: 'update_failed' };
  }

  // ── Side-effects (never throw past the committed core write) ──
  const sideEffects: TransitionSideEffects = {};

  if (to === 'cancelled') {
    // POLICY D — teardown on cancel. C3 SHARED-EVENT GUARD: tuition recurring /
    // multi-child cohorts reuse ONE google_event_id across many rows. Deleting the
    // Google event while LIVE siblings still use it would tear it down for all of them.
    const eventId = session.google_event_id;
    if (eventId) {
      // Count OTHER live sessions sharing this event (exclude this row; exclude terminal).
      const { count: siblingCount } = await supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('google_event_id', eventId)
        .neq('id', sessionId)
        .not('status', 'in', '(cancelled,completed,missed)');
      const isShared = (siblingCount ?? 0) > 0;

      // Detach this row's link ONLY when it is safe to do so (see branches below) —
      // never strand a link that still points at an UNDELETED event.
      let shouldNullLink = false;

      if (!isShared) {
        // LAST/ONLY live member — delete the Google event (today's behavior).
        try {
          const r = await withCircuitBreaker('google-calendar', () => cancelEvent(eventId, true));
          sideEffects.calendarTorndown = r?.success ?? false;
          // Only detach the row if the event was actually deleted; on a delete FAILURE
          // leave google_event_id/meet_link intact so a retry/reconcile can still find it.
          shouldNullLink = sideEffects.calendarTorndown;
        } catch (e) {
          sideEffects.calendarTorndown = false;
          logger.error('calendar_cancel_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
        }
      } else {
        // SHARED — live siblings still need the event; do NOT delete it. Safe to detach
        // this row's link (the event is preserved for the siblings).
        sideEffects.calendarTorndown = false;
        logger.info('calendar_cancel_skipped_shared', { requestId, sessionId, eventId, siblingCount: siblingCount ?? 0 });
        shouldNullLink = true;
      }

      if (shouldNullLink) {
        // Calendar columns nulled ONLY via attachCalendarLink (sole writer) — never a
        // direct .update in this path.
        try {
          await attachCalendarLink(supabase, sessionId, null, null);
        } catch (e) {
          logger.error('calendar_link_null_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    const botId = session.recall_bot_id;
    if (botId) {
      try {
        const ok = await withCircuitBreaker('recall-ai', () => cancelRecallBot(botId));
        sideEffects.recallTorndown = ok === true;
      } catch (e) {
        sideEffects.recallTorndown = false;
        logger.error('recall_cancel_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Centralised audit (every cancel entry point now logs).
    try {
      await logAudit(supabase, 'session_cancelled', {
        sessionId, reason: input.reason, actor: input.actor, date: session.scheduled_date,
      });
    } catch { /* non-blocking */ }

    // Notification — only when the caller passes notify intent (route-level
    // templates stay with their routes; cancelSession passes true).
    if (opts.notify) {
      try {
        const { data: child } = session.child_id
          ? await supabase.from('children').select('name, child_name, parent_name, parent_email, parent_phone').eq('id', session.child_id).single()
          : { data: null };
        const { data: coach } = session.coach_id
          ? await supabase.from('coaches').select('name').eq('id', session.coach_id).single()
          : { data: null };
        const r = await notify('session.cancelled', {
          sessionId,
          childId: session.child_id,
          childName: child?.child_name || child?.name || undefined,
          coachName: coach?.name || undefined,
          parentPhone: child?.parent_phone || undefined,
          parentEmail: child?.parent_email || undefined,
          parentName: child?.parent_name || undefined,
          sessionDate: session.scheduled_date,
          sessionTime: session.scheduled_time,
          reason: input.reason,
        });
        sideEffects.notified = `sent:${r.sent}/failed:${r.failed}`;
      } catch (e) {
        sideEffects.notified = 'failed';
        logger.error('cancel_notify_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      sideEffects.notified = 'skipped';
    }
  } else if (to === 'completed') {
    // skipSideEffects → CORE only (status + completed_at). Used by force-complete and the
    // recall paths (process-session / recall-reconciliation), which defer balance, payout
    // and brain to a later capture-confirm / monthly cron.
    if (!opts.skipSideEffects) {
      // Tuition gates (the pre-existing discriminator split): deduct + summary gate on
      // enrollment_type; payout gates on session_type. closeTuitionSession(setStatus:false)
      // runs ONLY deduct → payout → summary (CORE already wrote status + completed_at).
      let enrollmentType: string | null = null;
      if (session.enrollment_id) {
        const { data: enr } = await supabase
          .from('enrollments')
          .select('enrollment_type')
          .eq('id', session.enrollment_id)
          .single();
        enrollmentType = enr?.enrollment_type ?? null;
      }
      const sessionType = session.session_type ?? null;

      // Suppress a HOLLOW parent summary: a delivered-but-unconfirmed session
      // (auto-complete cron) has no real coach observations, so a synthesized
      // summary would be dishonest — mirror force-complete's deliberate omission.
      // Deduct + payout + counter still fire. The normal coach-confirmed path has
      // a confirmed (manual_structured) capture and KEEPS its summary.
      let summaryAllowed = enrollmentType === 'tuition' && !!session.child_id;
      if (summaryAllowed) {
        const { data: cap } = await supabase
          .from('structured_capture_responses')
          .select('capture_method, coach_confirmed')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cap || cap.capture_method === 'auto_filled' || cap.coach_confirmed === false) {
          summaryAllowed = false;
        }
      }

      try {
        await closeTuitionSession({
          supabase,
          sessionId,
          session: { enrollment_id: session.enrollment_id, child_id: session.child_id, coach_id: session.coach_id, session_type: sessionType },
          requestId,
          setStatus: false, // CORE already wrote status + completed_at
          deductBalance: enrollmentType === 'tuition',
          insertPayout: sessionType === 'tuition' && !!session.coach_id,
          dispatchSummary: summaryAllowed,
          sessionsDelivered: opts.sessionsDelivered ?? 1,
          deductActor: opts.actorLabel ?? input.actor,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com',
        });
        sideEffects.balanceDeducted = enrollmentType === 'tuition';
        sideEffects.payoutInserted = sessionType === 'tuition' && !!session.coach_id;
      } catch (e) {
        logger.error('completed_close_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
      }
      // POLICY B — brain via dispatch (NO inline learning_events). Dynamic import breaks
      // the orchestrator → session-manager → cancelSession → service import cycle.
      try {
        const { dispatch } = await import('./orchestrator');
        await dispatch('session.completed', { sessionId, requestId });
        sideEffects.brainDispatched = true;
      } catch (e) {
        logger.error('completed_dispatch_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } else if (to === 'missed' || to === 'no_show' || to === 'coach_no_show') {
    // POLICY E — tuition 'missed' deducts 1 + pays the coach (parent_no_show). Coaching
    // 'missed' and the recall no_show/coach_no_show paths (1:1, not tuition) deduct nothing.
    // BRAIN-SILENT (POLICY B): the session_missed learning_event, the no-show counter
    // cascade (dispatch session.no_show), and the parent_session_noshow_v3 WhatsApp stay
    // with the marking route — the dispatch handler does NOT emit the LE (Phase 2-missed
    // confirm), so the route retains it as a documented exception. The service owns
    // status + disposition + tuition balance/payout only.
    if (to === 'missed' && isTuition && !opts.skipSideEffects) {
      try {
        const close = await closeTuitionSession({
          supabase,
          sessionId,
          session: {
            enrollment_id: session.enrollment_id,
            child_id: session.child_id,
            coach_id: session.coach_id,
            session_type: 'tuition',
          },
          requestId,
          setStatus: false, // service CORE already wrote status + disposition
          deductBalance: true,
          insertPayout: true,
          dispatchSummary: false,
          sessionsDelivered: opts.sessionsDelivered ?? 1,
          deductActor: opts.actorLabel ?? input.actor,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com',
        });
        sideEffects.balanceDeducted = !!close.deductResult;
        sideEffects.payoutInserted = true; // payout op ran (idempotent on session_id + product_type)
      } catch (e) {
        logger.error('missed_tuition_close_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  // Other `to` values (scheduled, in_progress, bot_joining, bot_error, partial,
  // pending_scheduling, paused, pending_booking) are CORE-only by design — no
  // side-effects. In particular `paused` runs NO teardown: calendar + recall are
  // deliberately kept alive so a paused→scheduled resume needs no recreation (POLICY F
  // keeps any recreate in the reschedule wrapper, which a pure status flip never enters).

  return { ok: true, from, to, sideEffects };
}
