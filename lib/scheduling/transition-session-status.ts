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
  | 'cancelled';

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
  /** Path-specific columns merged into the SAME atomic update (coach_notes,
   *  no_show_reason, capture_id, focus_area, coach_cancellation_reason, …). The 5
   *  policy-owned fields (status/completed_at/disposition/recall_status/updated_at)
   *  are REJECTED with 'policy_field_in_extra' — the escape hatch is NOT a bypass. */
  extraSessionFields?: Record<string, unknown>;
  /** Fire the to-specific notification. For `cancelled` → notify('session.cancelled').
   *  Default false (callers that send their own route-level template pass false). */
  notify?: boolean;
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
  pending: new Set<SessionStatusValue>(['scheduled', 'missed', 'no_show', 'coach_no_show', 'cancelled', 'pending_scheduling']),
  pending_scheduling: new Set<SessionStatusValue>(['scheduled', 'missed', 'no_show', 'coach_no_show', 'cancelled']),
  scheduled: new Set<SessionStatusValue>(['in_progress', 'bot_joining', 'bot_error', 'completed', 'missed', 'no_show', 'coach_no_show', 'cancelled', 'pending_scheduling']),
  bot_joining: new Set<SessionStatusValue>(['in_progress', 'bot_error', 'completed', 'partial', 'no_show', 'coach_no_show', 'cancelled']),
  in_progress: new Set<SessionStatusValue>(['bot_error', 'completed', 'partial', 'no_show', 'coach_no_show', 'cancelled']),
  bot_error: new Set<SessionStatusValue>([]),
  partial: new Set<SessionStatusValue>([]),
  completed: new Set<SessionStatusValue>([]),
  missed: new Set<SessionStatusValue>([]),
  no_show: new Set<SessionStatusValue>([]),
  coach_no_show: new Set<SessionStatusValue>([]),
  cancelled: new Set<SessionStatusValue>([]),
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
    .select('id, child_id, coach_id, enrollment_id, status, scheduled_date, scheduled_time, google_event_id, recall_bot_id')
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

  // ── CORE — one atomic update ──
  const update: Record<string, unknown> = {
    status: to,
    updated_at: new Date().toISOString(),
  };
  if (COMPLETED_AT_STATES.has(to)) {
    update.completed_at = opts.explicitCompletedAt ?? new Date().toISOString();
  }
  if (input.disposition != null) {
    update.disposition = input.disposition;
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
    // POLICY D — teardown ALWAYS (unconditional; NOT gated by skipSideEffects).
    const eventId = session.google_event_id;
    if (eventId) {
      try {
        const r = await withCircuitBreaker('google-calendar', () => cancelEvent(eventId, true));
        sideEffects.calendarTorndown = r?.success ?? false;
      } catch (e) {
        sideEffects.calendarTorndown = false;
        logger.error('calendar_cancel_failed', { requestId, sessionId, error: e instanceof Error ? e.message : String(e) });
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
    // PHASE 2-completed: completed+tuition side-effects (deductTuitionBalance +
    // insertPayout via closeTuitionSession, setStatus:false) and POLICY-B
    // dispatch('session.completed') for brain are NOT wired here yet. Completion
    // callers are migrated in their own cluster — do not route them here yet.
    void opts.skipSideEffects;
  } else if (to === 'missed' || to === 'no_show' || to === 'coach_no_show') {
    // PHASE 2-missed: POLICY-E product-gated deduct(1) + insertPayout + disposition
    // (tuition) vs none (coaching) are NOT wired here yet. Missed/no-show callers
    // are migrated in their own cluster — do not route them here yet.
    void opts.sessionsDelivered;
  }
  // Other `to` values (scheduled, in_progress, bot_joining, bot_error, partial,
  // pending_scheduling) are CORE-only by design — no side-effects.

  return { ok: true, from, to, sideEffects };
}
