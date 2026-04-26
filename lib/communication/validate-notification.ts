// ============================================================
// FILE: lib/communication/validate-notification.ts
// ============================================================
// Pillar 2B Validator — pre-send sanity checks for sendNotification().
//
// Runs between quiet-hours (step 5) and idempotency (step 6) inside
// sendNotification(). Catches the 8 failure modes that historically
// produced silent send failures:
//   1. variableArityMatches    — every wa_variables key in providedParams
//   2. campaignIsLive          — AiSensy campaign exists + status='Live' (STUB this commit)
//   3. phoneIsNormalized       — resolved phone matches /^91[6-9]\d{9}$/
//   4. allRequiredParamsTruthy — every required_variables key has a non-empty value
//   5. recipientTypeMatches    — template.recipient_type === resolved.type
//   6. variableNamesConsistent — every wa_variables name resolves via direct match
//                                 OR via wa_variable_derivations[name].source
//   7. aisensyDidNotSilentFail — wraps the AiSensy POST (NOT in this module —
//                                 enforced inline in notify.ts at the POST site)
//   8. recipientNotPaused      — parent/coach status NOT in pause-list,
//                                 child.is_active === true, admin always allowed
//
// MODE
// ----
// Hardcoded 'warn' for this commit.
// TODO(b2.2-followup): replace with site_settings.notify_validator_mode reader
//   once getSiteSetting() string-coercion bug is fixed (see audit P1).
//
// In 'warn' mode: failed rules are logged to activity_log; caller proceeds.
// In 'enforce' mode: failed rules are logged; caller aborts.
// Rules 3 and 7 ALWAYS enforce regardless of mode (phone shape and
// AiSensy silent-fail are unsafe to ship past).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

const supabase = createAdminClient();

// ============================================================
// TYPES
// ============================================================

export type DerivationTransform = 'first_word' | 'last_word' | 'capitalize' | 'identity';

export interface DerivationEntry {
  source: string;
  transform: DerivationTransform;
}

export type DerivationsMap = Record<string, DerivationEntry>;

export interface ValidatorTemplate {
  template_code: string;
  recipient_type: string;
  wa_template_name: string | null;
  use_whatsapp: boolean | null;
  wa_variables: string[] | null;
  required_variables: string[];
  wa_variable_derivations: DerivationsMap | null;
}

export type ParentEnrollmentStatus = 'active' | 'paused' | 'lead' | 'unknown';

export type ResolvedRecipient =
  | { type: 'admin'; id: string }
  | { type: 'parent'; id: string; status: ParentEnrollmentStatus }
  | { type: 'coach'; id: string; status: string | null }
  | { type: 'phone'; phone: string }
  | { type: 'unknown'; rawId: string };

export type RuleNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ValidatorMode = 'warn' | 'enforce';

export type ValidatorResult =
  | { ok: true }
  | {
      ok: false;
      failedRule: RuleNumber;
      reason: string;
      mode: ValidatorMode; // The effective enforcement mode for THIS failure.
      detail?: Record<string, unknown>;
    };

const RULE_NAMES: Record<RuleNumber, string> = {
  1: 'variableArityMatches',
  2: 'campaignIsLive',
  3: 'phoneIsNormalized',
  4: 'allRequiredParamsTruthy',
  5: 'recipientTypeMatches',
  6: 'variableNamesConsistent',
  7: 'aisensyDidNotSilentFail',
  8: 'recipientNotPaused',
};

// Pause-list defaults (per B2.2 spec, Rule 8).
// Parent pause is now derived from enrollments.status + is_paused (see resolveRecipient).
// TODO(b2.2-followup): replace with site_settings reader for coach pause-list.
const ACTIVE_STATUS_COACH: ReadonlySet<string> = new Set(['active', 'onboarding']);

const PHONE_REGEX = /^91[6-9]\d{9}$/;

// ============================================================
// DERIVATION RESOLVER
// ============================================================

function applyTransform(value: unknown, transform: DerivationTransform): unknown {
  if (typeof value !== 'string') return value;
  switch (transform) {
    case 'first_word':
      return value.split(' ')[0] ?? value;
    case 'last_word': {
      const parts = value.split(' ');
      return parts[parts.length - 1] ?? value;
    }
    case 'capitalize':
      if (value.length === 0) return value;
      return value.charAt(0).toUpperCase() + value.slice(1);
    case 'identity':
      return value;
  }
}

/**
 * Apply wa_variable_derivations to fill in any aliased wa_variables keys
 * that the caller did not pass explicitly.
 *
 * - If the caller already provided the alias key, it is preserved (no override).
 * - If the source key is missing, the derivation is skipped silently;
 *   downstream Rule 1 will catch the missing arity.
 * - Returned object is a new merged copy (does not mutate the input).
 */
export function resolveDerivations(
  template: ValidatorTemplate,
  namedParams: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...namedParams };
  const derivations = template.wa_variable_derivations;
  if (!derivations) return merged;

  for (const [alias, entry] of Object.entries(derivations)) {
    if (merged[alias] !== undefined) continue;
    const sourceVal = merged[entry.source];
    if (sourceVal === undefined) continue;
    merged[alias] = applyTransform(sourceVal, entry.transform);
  }
  return merged;
}

// ============================================================
// RECIPIENT RESOLVER (for Rules 5 + 8)
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a recipientId to its row + type so Rules 5 and 8 can evaluate.
 * Mirrors resolveRecipientPhone() in notify.ts but returns the TYPE instead
 * of the phone — both should be called together by the caller.
 */
export async function resolveRecipient(recipientId: string): Promise<ResolvedRecipient> {
  if (!recipientId) return { type: 'unknown', rawId: recipientId };

  if (recipientId === 'admin') return { type: 'admin', id: 'admin' };

  // Raw phone (10–15 digits with optional +)
  const cleaned = recipientId.replace(/[\s\-()\.]/g, '');
  if (/^\+?\d{10,15}$/.test(cleaned)) {
    return { type: 'phone', phone: cleaned };
  }

  if (UUID_RE.test(recipientId)) {
    // Parent path: confirm UUID is in parents, then derive status from enrollments.
    // parents.status column does not exist; Rule 8 source-of-truth is now
    // enrollments.status='active' AND is_paused=false (any active+unpaused enrollment
    // means the parent is reachable). Lead parents (no enrollments) are allowed
    // through so the discovery flow keeps working.
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('id', recipientId)
      .limit(1)
      .maybeSingle();
    if (parent) {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('status, is_paused, child:children!inner(parent_id)')
        .eq('child.parent_id', recipientId);

      let status: ParentEnrollmentStatus;
      if (error) {
        status = 'unknown'; // fail-open: don't block on debounce/check errors
      } else if (!enrollments || enrollments.length === 0) {
        status = 'lead';
      } else {
        const hasActive = enrollments.some(
          (e) => e.status === 'active' && e.is_paused === false,
        );
        status = hasActive ? 'active' : 'paused';
      }
      return { type: 'parent', id: parent.id, status };
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('id, status')
      .eq('id', recipientId)
      .limit(1)
      .maybeSingle();
    if (coach) return { type: 'coach', id: coach.id, status: coach.status ?? null };

    // Children path removed: zero templates target child recipients. Any UUID
    // that isn't a parent or coach falls through to 'unknown' and the validator
    // skips Rules 5 and 8 for that send.
  }

  return { type: 'unknown', rawId: recipientId };
}

// ============================================================
// INDIVIDUAL RULE EVALUATORS
// ============================================================

function evalRule1(
  template: ValidatorTemplate,
  finalParams: Record<string, unknown>,
): ValidatorResult {
  const wa = template.wa_variables ?? [];
  const missing = wa.filter((k) => finalParams[k] === undefined);
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    failedRule: 1,
    reason: `arity_mismatch: missing keys [${missing.join(',')}]`,
    mode: 'warn',
    detail: { missing, expected: wa, providedKeys: Object.keys(finalParams) },
  };
}

function evalRule3(phone: string): ValidatorResult {
  if (PHONE_REGEX.test(phone)) return { ok: true };
  return {
    ok: false,
    failedRule: 3,
    reason: `phone_invalid: ${phone}`,
    mode: 'enforce', // Rule 3 always enforces.
    detail: { phone, regex: PHONE_REGEX.source },
  };
}

function evalRule4(
  template: ValidatorTemplate,
  finalParams: Record<string, unknown>,
): ValidatorResult {
  const empty: string[] = [];
  for (const key of template.required_variables) {
    const v = finalParams[key];
    if (v === undefined || v === null || v === '' || v === 'undefined' || v === 'null') {
      empty.push(key);
    }
  }
  if (empty.length === 0) return { ok: true };
  return {
    ok: false,
    failedRule: 4,
    reason: `missing_or_empty_params: [${empty.join(',')}]`,
    mode: 'warn',
    detail: { empty, required: template.required_variables },
  };
}

function evalRule5(
  template: ValidatorTemplate,
  recipient: ResolvedRecipient,
): ValidatorResult {
  const tType = template.recipient_type;
  const rType = recipient.type;
  const matches =
    (tType === 'parent' && rType === 'parent') ||
    (tType === 'coach' && rType === 'coach') ||
    (tType === 'admin' && rType === 'admin');

  if (matches) return { ok: true };
  return {
    ok: false,
    failedRule: 5,
    reason: `recipient_type_mismatch: template=${tType} actual=${rType}`,
    mode: 'warn',
    detail: { templateRecipientType: tType, actualRecipientType: rType },
  };
}

/**
 * Rule 6 — variableNamesConsistent (derivation-aware).
 * Eval order per B2.2 clarification:
 *   (a) name appears directly in required_variables → PASS for that name
 *   (b) name has a derivation entry AND derivations[name].source appears
 *       in required_variables → PASS for that name
 *   (c) FAIL
 * A missing derivations entry is treated as "no aliasing for this name",
 * not as a validator error.
 */
function evalRule6(template: ValidatorTemplate): ValidatorResult {
  const wa = template.wa_variables ?? [];
  if (wa.length === 0) return { ok: true };

  const reqSet = new Set(template.required_variables);
  const derivations = template.wa_variable_derivations ?? {};
  const unrecognized: string[] = [];

  for (const name of wa) {
    if (reqSet.has(name)) continue; // path (a)
    const entry = derivations[name];
    if (entry && reqSet.has(entry.source)) continue; // path (b)
    unrecognized.push(name); // path (c)
  }

  if (unrecognized.length === 0) return { ok: true };
  return {
    ok: false,
    failedRule: 6,
    reason: `wa_var_unrecognized: [${unrecognized.join(',')}]`,
    mode: 'warn',
    detail: { unrecognized, wa, required: template.required_variables },
  };
}

function evalRule8(recipient: ResolvedRecipient): ValidatorResult {
  switch (recipient.type) {
    case 'admin':
    case 'phone':
    case 'unknown':
      return { ok: true };
    case 'parent': {
      // Rule 8 source-of-truth: enrollments.status='active' AND is_paused=false.
      // 'lead' (no enrollments) and 'unknown' (DB error) fall through to OK so
      // the discovery flow and infra hiccups don't block sends.
      if (recipient.status === 'paused') {
        return {
          ok: false,
          failedRule: 8,
          reason: 'recipient_paused: type=parent status=paused',
          mode: 'warn',
          detail: {
            recipientType: 'parent',
            status: recipient.status,
            source: 'enrollments.status+is_paused',
          },
        };
      }
      return { ok: true };
    }
    case 'coach': {
      const status = recipient.status;
      if (!status || ACTIVE_STATUS_COACH.has(status)) return { ok: true };
      return {
        ok: false,
        failedRule: 8,
        reason: `recipient_paused: type=coach status=${status}`,
        mode: 'warn',
        detail: { recipientType: 'coach', status, allowed: Array.from(ACTIVE_STATUS_COACH) },
      };
    }
  }
}

// ============================================================
// RULE 2 STUB
// ============================================================

/**
 * Rule 2 — campaignIsLive
 * STUB: requires AiSensy campaign-status fetcher + Upstash Redis cache.
 * Returns ok:true unconditionally for this commit.
 * TODO(b2.2-followup): implement using @upstash/redis with 5-min TTL on
 *   key 'aisensy:campaign:{wa_template_name}'. If Redis unavailable,
 *   skip with warn-log (don't block sends on cache infra failure).
 */
async function evalRule2(_template: ValidatorTemplate): Promise<ValidatorResult> {
  return { ok: true };
}

// ============================================================
// AUDIT LOG WRITER
// ============================================================

async function logValidatorFailure(args: {
  result: Extract<ValidatorResult, { ok: false }>;
  templateCode: string;
  recipientIdInput: string;
  recipientType: string;
  effectiveMode: ValidatorMode;
}) {
  const { result, templateCode, recipientIdInput, recipientType, effectiveMode } = args;
  try {
    await supabase.from('activity_log').insert({
      action: 'notify_validator_failed',
      user_email: 'system',
      user_type: 'system',
      metadata: {
        template_code: templateCode,
        failed_rule: result.failedRule,
        rule_name: RULE_NAMES[result.failedRule],
        reason: result.reason,
        recipient_id_input: recipientIdInput,
        recipient_type_template: recipientType,
        mode: effectiveMode,
        detail: (result.detail ?? null) as Json,
      },
    });
  } catch (err) {
    // Logging failure should NEVER block a send. Surface to console only.
    console.error('[validator] activity_log insert failed:', err);
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Run the 7 validator rules (Rule 7 is enforced separately at the AiSensy
 * POST site in notify.ts). Returns the FIRST failure encountered, or ok:true
 * if every rule passes.
 *
 * Side effect: each failure writes one row to activity_log.action='notify_validator_failed'.
 *
 * Mode:
 * - 'warn'    — failures are logged; caller should proceed with the send.
 * - 'enforce' — failures are logged; caller should abort.
 * Rules 3 (phone) and 7 (AiSensy silent-fail) always enforce regardless of mode;
 * the returned ValidatorResult.mode reflects the per-rule effective enforcement.
 *
 * @param template       Row from communication_templates (with derivations).
 * @param recipient      Pre-resolved recipient (id + type + status/is_active row).
 * @param phone          The resolved + normalized recipient phone (for Rule 3).
 * @param finalParams    Caller params after resolveDerivations() has filled in aliases.
 * @param mode           Default 'warn'. Pass 'enforce' to abort on any failure.
 */
export async function validateNotification(
  template: ValidatorTemplate,
  recipient: ResolvedRecipient,
  phone: string,
  finalParams: Record<string, unknown>,
  mode: ValidatorMode = 'warn',
): Promise<ValidatorResult> {
  const recipientIdInput =
    recipient.type === 'admin'
      ? 'admin'
      : recipient.type === 'phone'
        ? recipient.phone
        : recipient.type === 'unknown'
          ? recipient.rawId
          : recipient.id;

  // Rules ordered cheap → expensive. First failure wins.
  const checks: Array<() => ValidatorResult | Promise<ValidatorResult>> = [
    () => evalRule5(template, recipient),
    () => evalRule1(template, finalParams),
    () => evalRule4(template, finalParams),
    () => evalRule6(template),
    () => evalRule3(phone),
    () => evalRule8(recipient),
    () => evalRule2(template),
  ];

  for (const check of checks) {
    const result = await check();
    if (result.ok) continue;

    // Effective mode: rules 3 and 7 always enforce; others follow input mode.
    const effectiveMode: ValidatorMode =
      result.failedRule === 3 || result.failedRule === 7 ? 'enforce' : mode;

    const annotated: ValidatorResult = { ...result, mode: effectiveMode };

    await logValidatorFailure({
      result: annotated as Extract<ValidatorResult, { ok: false }>,
      templateCode: template.template_code,
      recipientIdInput,
      recipientType: template.recipient_type,
      effectiveMode,
    });

    return annotated;
  }

  return { ok: true };
}

// ============================================================
// EXPORT — for notify.ts to enforce Rule 7 inline
// ============================================================

/**
 * Rule 7 — aisensyDidNotSilentFail
 * Called by notify.ts AFTER the AiSensy POST. Always enforces.
 * Throws if the response shape indicates failure; caller's try/catch records
 * communication_logs error_message='aisensy_send_failed: {detail}'.
 */
export function assertAiSensyResponseOk(
  response: { success: boolean; messageId?: string; error?: string },
  templateCode: string,
): void {
  if (response.success === true) return;
  const reason = response.error || 'unknown_failure';
  // Caller is responsible for logging; we throw so the failure can never be
  // silently swallowed by a try/catch that only checks status codes.
  const err = new Error(`aisensy_send_failed: ${reason}`);
  (err as Error & { rule?: number; templateCode?: string }).rule = 7;
  (err as Error & { rule?: number; templateCode?: string }).templateCode = templateCode;
  throw err;
}
