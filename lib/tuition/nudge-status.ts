// ============================================================
// FILE: lib/tuition/nudge-status.ts
// PURPOSE: Shared nudge-ladder status for tuition onboarding visibility.
//   Mirrors the cron ladder in app/api/cron/tuition-onboarding-nudge so the
//   admin + coach chips never drift from what the cron actually does.
//   Ladder thresholds are supplied by the caller (sourced from the BackOps
//   policy `tuition_onboarding_nudge`) — there is NO hardcoded ladder copy here.
//   - Server (admin list route, coach route): import computeNudgeStatus.
//   - UIs (admin page, coach dashboard): import NUDGE_STATUS_META + NUDGE_TONE_CLASS.
// ============================================================

export type NudgeStatus =
  | 'waiting'
  | 'nudge_1_due'
  | 'nudge_2_due'
  | 'capped'
  | 'expiring';

export type NudgeTone = 'neutral' | 'info' | 'warn' | 'danger' | 'success';

/** Ladder thresholds — fetched from the BackOps policy, never hardcoded here. */
export interface NudgeLadderPolicy {
  first_nudge_hours: number;
  second_nudge_hours: number;
  max_nudges: number;
  expire_hours: number;
  expiring_window_hours: number;
}

export interface NudgeStatusInput {
  createdAtMs: number;
  nudgeCount: number;
  nowMs: number;
  policy: NudgeLadderPolicy;
}

/**
 * Pure ladder evaluation. Precedence (most urgent first):
 *   expiring -> capped -> nudge_2_due -> nudge_1_due -> waiting
 *
 * Mirrors the cron's gates exactly: nudgeCount is the count of
 * parent_tuition_onboarding_v5 sends keyed on context_id = onboarding.id
 * (the same key the cron's cap uses post-fix), and the hour thresholds come
 * from the shared policy.
 */
export function computeNudgeStatus(input: NudgeStatusInput): NudgeStatus {
  const { createdAtMs, nudgeCount, nowMs, policy } = input;
  const ageHours = (nowMs - createdAtMs) / 3_600_000;

  if (ageHours >= policy.expire_hours - policy.expiring_window_hours) return 'expiring';
  if (nudgeCount >= policy.max_nudges) return 'capped';
  if (nudgeCount === 1 && ageHours >= policy.second_nudge_hours) return 'nudge_2_due';
  if (nudgeCount === 0 && ageHours >= policy.first_nudge_hours) return 'nudge_1_due';
  return 'waiting';
}

/** Render metadata — label + semantic tone. UIs map tone -> theme classes. */
export const NUDGE_STATUS_META: Record<NudgeStatus, { label: string; tone: NudgeTone }> = {
  waiting:     { label: 'Waiting',       tone: 'neutral' },
  nudge_1_due: { label: 'Nudge 1 due',   tone: 'info' },
  nudge_2_due: { label: 'Nudge 2 due',   tone: 'warn' },
  capped:      { label: 'Nudges done',   tone: 'success' },
  expiring:    { label: 'Expiring soon', tone: 'danger' },
};

/** Dark-portal chip classes by tone (admin + coach are both dark themes). */
export const NUDGE_TONE_CLASS: Record<NudgeTone, string> = {
  neutral: 'bg-surface-2 text-text-tertiary',
  info:    'bg-blue-500/10 text-blue-300',
  warn:    'bg-amber-500/10 text-amber-300',
  danger:  'bg-red-500/10 text-red-400',
  success: 'bg-emerald-500/10 text-emerald-300',
};
