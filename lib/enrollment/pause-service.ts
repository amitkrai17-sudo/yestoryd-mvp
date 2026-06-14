// =============================================================================
// PAUSE SERVICE — canonical pause / resume / getPauseState
// lib/enrollment/pause-service.ts
//
// SSOT for the enrollment paused signal (BREAK2.1). All pause/resume writes
// route through here so there is ONE canonical write and ONE policy
// enforcement point. status='paused'/'active' is the SOLE paused signal
// (BREAK2.1d stopped the is_paused dual-write; the column is dropped in BREAK2.2).
//
// 2.1a CONSTRAINT: this file is ADDITIVE. It is defined, exported, and
// unit-callable, but NO existing writer is wired to it yet (that is 2.1b).
// It reuses existing helpers (cancelEvent, cancelRecallBot) — does not
// reimplement them.
//
// Product-parameterized side-effects keyed on enrollment_type:
//   - calendar teardown  (cancelEvent)      — BOTH products
//   - Recall teardown     (cancelRecallBot)  — coaching ONLY (tuition = no Recall)
//   - season extension    (program_end += d) — coaching ONLY
//   - sessions-freeze      (status-based)     — tuition (no extra write)
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvent } from '@/lib/calendar/events';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import {
  getPausePolicy as defaultGetPausePolicy,
  resolveProductType,
  type ProductType,
  type PausePolicy,
} from '@/lib/config/pause-policy';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export type PauseSource =
  | 'parent_self_service'
  | 'balance_auto'
  | 'admin_switch'
  | 'admin_manual'
  | 'noshow_auto';

export interface PauseActor {
  email?: string;
  type: 'parent' | 'admin' | 'system';
}

export interface PauseOptions {
  reason: string;               // exams|travel|illness|other|switched_to_*|auto_noshow|balance_zero
  startDate?: string;           // YYYY-MM-DD — window math (coaching); omit → tuition freeze
  endDate?: string;             // YYYY-MM-DD
  source: PauseSource;
  resumeEligibleDays?: number;  // e.g. switch = 90; else policy/none
  allowFromStatuses?: string[]; // statuses eligible to pause from (default ['active'])
  // When true, write ONLY the canonical enrollment row fields and SKIP
  // calendar/Recall teardown + enrollment_events logging. Callers that own
  // their own teardown/logging pass true to avoid duplication (BREAK2.1b).
  skipSideEffects?: boolean;
  actor?: PauseActor;
}

export interface ResumeOptions {
  source: PauseSource;
  skipSideEffects?: boolean;    // see PauseOptions.skipSideEffects
  actor?: PauseActor;
}

export type PauseRejection =
  | 'not_found'
  | 'already_paused'
  | 'not_eligible_status'
  | 'policy_count'
  | 'policy_days_single'
  | 'policy_days_total'
  | 'write_failed';

export type ResumeRejection =
  | 'not_found'
  | 'not_paused'
  | 'no_sessions'
  | 'window_expired'
  | 'write_failed';

export interface PauseResult {
  success: boolean;
  rejected?: PauseRejection;
  error?: string;
  newStatus?: string;
  pauseDays?: number;
  newProgramEnd?: string | null;
  seasonExtended?: boolean;
  sessionsAffected?: number;
  recallCancelled?: number;
}

export interface ResumeResult {
  success: boolean;
  rejected?: ResumeRejection;
  error?: string;
  newStatus?: string;
  actualPauseDays?: number;
  newProgramEnd?: string | null;
}

export interface PauseState {
  enrollmentId: string;
  enrollmentType: string | null;
  productType: ProductType;
  status: string | null;
  isPaused: boolean;
  pauseStartDate: string | null;
  pauseEndDate: string | null;
  pauseReason: string | null;
  pauseCount: number;
  totalPauseDays: number;
  resumeEligibleUntil: string | null;
  programEnd: string | null;
}

// =============================================================================
// INJECTABLE DEPS (default to real implementations — overridden in unit tests)
// =============================================================================

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PauseDeps {
  supabase?: AdminClient;
  cancelEvent?: typeof cancelEvent;
  cancelRecallBot?: typeof cancelRecallBot;
  getPausePolicy?: typeof defaultGetPausePolicy;
  now?: () => Date;
}

interface ResolvedDeps {
  supabase: AdminClient;
  cancelEvent: typeof cancelEvent;
  cancelRecallBot: typeof cancelRecallBot;
  getPausePolicy: typeof defaultGetPausePolicy;
  now: () => Date;
}

function resolveDeps(deps?: PauseDeps): ResolvedDeps {
  return {
    supabase: deps?.supabase ?? createAdminClient(),
    cancelEvent: deps?.cancelEvent ?? cancelEvent,
    cancelRecallBot: deps?.cancelRecallBot ?? cancelRecallBot,
    getPausePolicy: deps?.getPausePolicy ?? defaultGetPausePolicy,
    now: deps?.now ?? (() => new Date()),
  };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(startISO: string, endISO: string): number {
  return Math.ceil((new Date(endISO).getTime() - new Date(startISO).getTime()) / MS_PER_DAY);
}

// Columns the service needs from enrollments.
const ENROLLMENT_COLS =
  'id, child_id, enrollment_type, status, pause_count, total_pause_days, ' +
  'pause_start_date, pause_end_date, pause_reason, program_end, original_end_date, ' +
  'resume_eligible_until, paused_at, sessions_remaining';

interface EnrollmentRow {
  id: string;
  child_id: string | null;
  enrollment_type: string | null;
  status: string | null;
  pause_count: number | null;
  total_pause_days: number | null;
  pause_start_date: string | null;
  pause_end_date: string | null;
  pause_reason: string | null;
  program_end: string | null;
  original_end_date: string | null;
  resume_eligible_until: string | null;
  paused_at: string | null;
  sessions_remaining: number | null;
}

async function loadEnrollment(
  supabase: AdminClient,
  enrollmentId: string,
): Promise<EnrollmentRow | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(ENROLLMENT_COLS)
    .eq('id', enrollmentId)
    .single();
  if (error || !data) return null;
  return data as unknown as EnrollmentRow;
}

function isPausedRow(e: EnrollmentRow): boolean {
  // BREAK2.1d: status is the sole canonical paused signal.
  return e.status === 'paused';
}

// =============================================================================
// LOG (best-effort enrollment_events — never fails the operation)
// =============================================================================

async function logEvent(
  supabase: AdminClient,
  enrollmentId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  actor?: PauseActor,
): Promise<void> {
  try {
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: eventType,
      event_data: eventData as never,
      triggered_by: actor?.type ?? 'system',
      created_at: new Date().toISOString(),
    } as never);
  } catch {
    // best-effort — logging must not break the pause/resume write
  }
}

// =============================================================================
// PAUSE
// =============================================================================

export async function pause(
  enrollmentId: string,
  opts: PauseOptions,
  deps?: PauseDeps,
): Promise<PauseResult> {
  const { supabase, cancelEvent: doCancelEvent, cancelRecallBot: doCancelRecall, getPausePolicy, now } =
    resolveDeps(deps);

  const enrollment = await loadEnrollment(supabase, enrollmentId);
  if (!enrollment) return { success: false, rejected: 'not_found', error: 'Enrollment not found' };

  // Guard: eligible source status. Default ['active'] — which also rejects an
  // already-paused enrollment (status='paused' ∉ ['active']) so no separate
  // already-paused guard is needed. Callers that legitimately re-pause from
  // another status (e.g. admin switch on a balance-paused enrollment) pass an
  // explicit allowFromStatuses list to opt in.
  const allowFrom = opts.allowFromStatuses ?? ['active'];
  if (!enrollment.status || !allowFrom.includes(enrollment.status)) {
    const alreadyPaused = isPausedRow(enrollment);
    return {
      success: false,
      rejected: alreadyPaused ? 'already_paused' : 'not_eligible_status',
      error: alreadyPaused
        ? 'Enrollment is already paused'
        : `Status "${enrollment.status}" is not eligible to pause`,
    };
  }

  const productType = resolveProductType(enrollment.enrollment_type);
  const pauseCount = enrollment.pause_count ?? 0;

  // Window days only when both dates supplied (tuition may freeze open-ended).
  const hasWindow = Boolean(opts.startDate && opts.endDate);
  const pauseDays = hasWindow ? daysBetween(opts.startDate as string, opts.endDate as string) : 0;

  // --- Policy enforcement (S1): parent self-service quota ONLY. System/admin
  // sources (balance_auto, admin_switch, admin_manual, noshow_auto) BYPASS
  // policy — a system pause must never be blocked by a parent quota. ---
  const quotaManaged = opts.source === 'parent_self_service';
  if (quotaManaged) {
    const policy: PausePolicy = await getPausePolicy(productType);
    if (pauseCount >= policy.maxPauseCount) {
      return {
        success: false,
        rejected: 'policy_count',
        error: `Maximum ${policy.maxPauseCount} pauses allowed per enrollment`,
      };
    }
    if (hasWindow) {
      if (pauseDays > policy.maxPauseDaysSingle) {
        return {
          success: false,
          rejected: 'policy_days_single',
          error: `Maximum ${policy.maxPauseDaysSingle} days per pause`,
        };
      }
      const totalUsed = enrollment.total_pause_days ?? 0;
      if (totalUsed + pauseDays > policy.maxPauseDaysTotal) {
        return {
          success: false,
          rejected: 'policy_days_total',
          error: `Only ${policy.maxPauseDaysTotal - totalUsed} pause days remaining`,
        };
      }
    }
  }

  // --- Build canonical write (status is the sole paused signal) ---
  const nowDate = now();
  const updateData: Record<string, unknown> = {
    status: 'paused',          // canonical signal
    pause_reason: opts.reason,
    // S3a: pause_count is the PARENT quota counter — increment only for
    // parent self-service. System/admin pauses do not consume the quota.
    pause_count: quotaManaged ? pauseCount + 1 : pauseCount,
    total_pause_days: (enrollment.total_pause_days ?? 0) + pauseDays,
    paused_at: nowDate.toISOString(), // S3b: universal timestamp, set for all sources
    updated_at: nowDate.toISOString(),
  };
  if (opts.startDate) updateData.pause_start_date = opts.startDate;
  if (opts.endDate) updateData.pause_end_date = opts.endDate;
  if (opts.resumeEligibleDays && opts.resumeEligibleDays > 0) {
    const eligible = new Date(nowDate);
    eligible.setDate(eligible.getDate() + opts.resumeEligibleDays);
    updateData.resume_eligible_until = eligible.toISOString();
  }

  // Season extension — coaching ONLY (tuition has no season end to extend).
  let newProgramEnd: string | null = enrollment.program_end;
  let seasonExtended = false;
  if (productType === 'coaching' && enrollment.program_end && pauseDays > 0) {
    const extended = new Date(enrollment.program_end);
    extended.setDate(extended.getDate() + pauseDays);
    newProgramEnd = extended.toISOString();
    updateData.program_end = newProgramEnd;
    updateData.original_end_date = enrollment.original_end_date ?? enrollment.program_end;
    seasonExtended = true;
  }

  const { error: writeError } = await supabase
    .from('enrollments')
    .update(updateData as never)
    .eq('id', enrollmentId);

  if (writeError) {
    return { success: false, rejected: 'write_failed', error: writeError.message };
  }

  // --- Product-parameterized side-effects (best-effort) ---
  let sessionsAffected = 0;
  let recallCancelled = 0;

  if (!opts.skipSideEffects && hasWindow && enrollment.child_id) {
    const { data: windowSessions } = await supabase
      .from('scheduled_sessions')
      .select('id, google_event_id, recall_bot_id')
      .eq('child_id', enrollment.child_id)
      .gte('scheduled_date', opts.startDate as string)
      .lte('scheduled_date', opts.endDate as string)
      .in('status', ['scheduled', 'rescheduled']);

    const sessions = (windowSessions ?? []) as Array<{
      id: string;
      google_event_id: string | null;
      recall_bot_id: string | null;
    }>;

    if (sessions.length > 0) {
      const ids = sessions.map((s) => s.id);
      // SSOT-ALLOWLIST: bulk pause writer — pause SSOT
      await supabase
        .from('scheduled_sessions')
        .update({ status: 'paused', updated_at: nowDate.toISOString() } as never)
        .in('id', ids);
      sessionsAffected = ids.length;

      for (const s of sessions) {
        // Calendar teardown — BOTH products.
        if (s.google_event_id) {
          try {
            await doCancelEvent(s.google_event_id, true);
          } catch {
            /* best-effort */
          }
        }
        // Recall teardown — coaching ONLY (tuition never records).
        if (productType === 'coaching' && s.recall_bot_id) {
          try {
            await doCancelRecall(s.recall_bot_id);
            recallCancelled += 1;
          } catch {
            /* best-effort */
          }
        }
      }
    }
  }

  if (!opts.skipSideEffects) {
    await logEvent(
      supabase,
      enrollmentId,
      'pause_started',
      {
        source: opts.source,
        reason: opts.reason,
        product_type: productType,
        pause_days: pauseDays,
        sessions_affected: sessionsAffected,
        recall_cancelled: recallCancelled,
        new_program_end: seasonExtended ? newProgramEnd : null,
        pause_number: pauseCount + 1,
      },
      opts.actor,
    );
  }

  return {
    success: true,
    newStatus: 'paused',
    pauseDays,
    newProgramEnd,
    seasonExtended,
    sessionsAffected,
    recallCancelled,
  };
}

// =============================================================================
// RESUME
// =============================================================================

export async function resume(
  enrollmentId: string,
  opts: ResumeOptions,
  deps?: PauseDeps,
): Promise<ResumeResult> {
  const { supabase, now } = resolveDeps(deps);

  const enrollment = await loadEnrollment(supabase, enrollmentId);
  if (!enrollment) return { success: false, rejected: 'not_found', error: 'Enrollment not found' };

  if (!isPausedRow(enrollment)) {
    return { success: false, rejected: 'not_paused', error: 'Enrollment is not paused' };
  }

  const productType = resolveProductType(enrollment.enrollment_type);
  const nowDate = now();

  // Tuition gate: must have sessions to resume into.
  if (productType === 'tuition' && (enrollment.sessions_remaining ?? 0) <= 0) {
    return { success: false, rejected: 'no_sessions', error: 'No sessions remaining. Renew first.' };
  }

  // Resume window (set by admin switch / 90-day) must not have expired.
  if (enrollment.resume_eligible_until && new Date(enrollment.resume_eligible_until) < nowDate) {
    return {
      success: false,
      rejected: 'window_expired',
      error: 'Resume window expired. Create a new enrollment instead.',
    };
  }

  // Season recalc — coaching ONLY: extend program_end by ACTUAL days paused.
  let newProgramEnd: string | null = enrollment.program_end;
  let actualPauseDays = 0;
  const updateData: Record<string, unknown> = {
    status: 'active',           // canonical (sole paused signal)
    paused_at: null,
    pause_reason: null,
    pause_start_date: null,
    pause_end_date: null,
    resume_eligible_until: null,
    updated_at: nowDate.toISOString(),
  };

  if (productType === 'coaching' && enrollment.pause_start_date) {
    actualPauseDays = Math.max(0, daysBetween(enrollment.pause_start_date, nowDate.toISOString()));
    const base = new Date(enrollment.original_end_date ?? enrollment.program_end ?? nowDate.toISOString());
    base.setDate(base.getDate() + actualPauseDays);
    newProgramEnd = base.toISOString();
    updateData.program_end = newProgramEnd;
    updateData.total_pause_days = (enrollment.total_pause_days ?? 0); // already counted at pause-start
  }

  const { error: writeError } = await supabase
    .from('enrollments')
    .update(updateData as never)
    .eq('id', enrollmentId);

  if (writeError) {
    return { success: false, rejected: 'write_failed', error: writeError.message };
  }

  if (!opts.skipSideEffects) {
    await logEvent(
      supabase,
      enrollmentId,
      'pause_ended',
      {
        source: opts.source,
        product_type: productType,
        actual_pause_days: actualPauseDays,
        new_program_end: productType === 'coaching' ? newProgramEnd : null,
      },
      opts.actor,
    );
  }

  return { success: true, newStatus: 'active', actualPauseDays, newProgramEnd };
}

// =============================================================================
// GET STATE
// =============================================================================

export async function getPauseState(
  enrollmentId: string,
  deps?: PauseDeps,
): Promise<PauseState | null> {
  const { supabase } = resolveDeps(deps);
  const enrollment = await loadEnrollment(supabase, enrollmentId);
  if (!enrollment) return null;

  return {
    enrollmentId: enrollment.id,
    enrollmentType: enrollment.enrollment_type,
    productType: resolveProductType(enrollment.enrollment_type),
    status: enrollment.status,
    isPaused: isPausedRow(enrollment),
    pauseStartDate: enrollment.pause_start_date,
    pauseEndDate: enrollment.pause_end_date,
    pauseReason: enrollment.pause_reason,
    pauseCount: enrollment.pause_count ?? 0,
    totalPauseDays: enrollment.total_pause_days ?? 0,
    resumeEligibleUntil: enrollment.resume_eligible_until,
    programEnd: enrollment.program_end,
  };
}
