// ============================================================
// FILE: lib/communication/notify.ts
// ============================================================
// Single entry point for outbound WhatsApp sends.
//
// Handles: template lookup, named → positional param conversion,
// recipient phone resolution, daily cap, quiet-hours deferral,
// idempotency (sha256), channel routing, and unified logging.
//
// All outbound WA sends should flow through this function; the
// legacy sendWhatsAppMessage() export is deprecated.
// ============================================================

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from './aisensy';
import { sendLeadBotMessage } from './leadbot';
import { logCommunication, type RecipientType } from './log';
import type { TemplateButtons, WaSendResult } from './types';
import { composeIdempotencyKey, claimIdempotencyRow, releaseIdempotencyRow } from './idempotency';
import { redactNamedParams, redactVariables } from './redact';
import { formatForWhatsApp } from '@/lib/utils/phone';
import {
  resolveDerivations,
  resolveRecipient,
  validateNotification,
  type ValidatorTemplate,
  type DerivationsMap,
} from './validate-notification';

// NOTE: module-level client is safe in lib/ server code.
// Do NOT copy this pattern into route handlers or components —
// use createClient() per-request there.
const supabase = createAdminClient();

const DEFAULT_DAILY_CAP = 3;
const DEFAULT_QUIET_START = 21; // 21:00 IST
const DEFAULT_QUIET_END = 8;    // 08:00 IST
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type NotifyReason =
  | 'template_not_found'
  | 'template_disabled'
  | 'channel_disabled'
  | 'missing_params'
  | 'phone_not_found'
  | 'daily_cap_hit'
  | 'deferred_quiet_hours'
  | 'duplicate'
  | 'send_failed'
  | 'openclaw_invalid';

export interface NotifyResult {
  success: boolean;
  logId?: string;
  /** communication_queue.id — set on deferred result; logId stays unset on that branch */
  queueId?: string;
  reason?: NotifyReason;
  deferred?: boolean;
}

export interface NotifyMeta {
  triggeredBy?: 'system' | 'coach' | 'admin' | 'cron';
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  /**
   * Arbitrary observability payload merged into communication_logs.context_data
   * alongside named_params + recipient_id. Used by the batched-reminder dedupe
   * (2.4) to record batch_id + sibling_session_ids + child_count when one
   * send stands in for N scheduled_sessions rows.
   */
  contextData?: Record<string, unknown>;
  /**
   * Structured button data for templates that require category-specific
   * button shapes (e.g. Meta Authentication templates with Copy Code).
   * Plumbed through notify.ts → WaSendParams.templateButtons → adapter,
   * where each adapter synthesizes the correct on-wire payload.
   *
   * See TemplateButtons union (lib/communication/types.ts) for variants.
   *
   * Block 2.6a addition. Required for parent_otp_v3 when calling via
   * sendNotification (vs the bypass route which hand-rolls the payload).
   */
  templateButtons?: TemplateButtons;
  /**
   * Keys in namedParams whose values should be redacted as '[REDACTED]' before
   * being written to communication_logs.context_data.named_params.
   *
   * Use case: sensitive credentials (OTPs, password reset tokens, payment
   * confirmation codes) that must reach the message provider but must NOT
   * persist in queryable log rows.
   *
   * The values are still passed verbatim to the adapter for delivery; only
   * the log row is redacted.
   *
   * Block 2.6b addition. Required for parent_otp_v3 to prevent OTP values
   * from landing in communication_logs. See lib/communication/redact.ts for
   * the redaction helper.
   */
  redactInLog?: string[];
  /**
   * Optional AiSensy attribution string passed through to the AiSensy adapter's
   * payload.source field for analytics. Lead Bot adapter ignores it.
   *
   * Block 2.6b addition. Preserves the 'new-landing-page form' attribution
   * from the legacy bypass at app/api/auth/send-otp/route.ts.
   */
  source?: string;
  /**
   * Optional dedup disambiguator folded into the STEP 6 idempotency hash ONLY.
   * NEVER written to the uuid-typed communication_logs.context_id column.
   *
   * Use case: callers whose contextId is a stable entity uuid (so the same
   * entity's repeated sends would otherwise collide on phone+day+firstParam+
   * contextId), but where a deliberate re-send MUST NOT be deduped — e.g.
   * tuition onboarding resend, where contextId is the onboarding row uuid and
   * a per-click token is the uniqueness source. Pass that token here.
   *
   * Invariant: when absent/null, the idempotency hash is byte-identical to the
   * pre-salt output (the salt segment is appended only when truthy), so every
   * existing caller is unaffected.
   */
  idempotencySalt?: string;
  /**
   * When true, bypass the STEP 5 quiet-hours deferral so the send goes out
   * immediately regardless of IST hour. Daily-cap (STEP 4), idempotency
   * (STEP 6), and the validator (STEP 5.5) are unaffected.
   *
   * Use case: interactive admin/coach actions (e.g. tuition onboarding
   * link generation + resend) where the operator is waiting on the result
   * and a silent overnight defer is the wrong behavior. The nudge cron does
   * NOT set this — it relies on its 11:00 IST schedule to stay out of quiet
   * hours naturally.
   */
  forceImmediate?: boolean;
  /**
   * Per-template dedup-scope axis (Phase 2B). Threaded by callers of templates
   * whose communication_templates.dedup_scope names these fields, so STEP-6 keys
   * on the entity instead of the legacy phone:day:firstParam formula.
   *   - scheduledDate: raw 'YYYY-MM-DD' (DB scheduled_date) for session reminders
   *     → key (template, contextId=sessionId, scheduledDate); survives reschedule.
   *   - nudgeSeq: low_balance_nudges_sent counter for parent_tuition_low_balance_v4
   *     → key (template, contextId=enrollmentId, nudgeSeq); allows the (capped) re-nudges.
   * Absent → templates with NULL dedup_scope are unaffected (legacy formula).
   */
  scheduledDate?: string;
  nudgeSeq?: number;
  /**
   * Reminder window discriminator (Phase 2B, Option 3). coach_session_reminder_1h_v3
   * is sent by BOTH the 24h cron (enrollment-lifecycle) and the 1h cron
   * (coach-reminders-1h) for the SAME session+date; its dedup_scope is
   * [contextId, scheduledDate, reminderWindow] so the two windows key distinctly
   * and the coach keeps both reminders. Parent reminders use distinct template
   * codes per window and do NOT need this.
   */
  reminderWindow?: '24h' | '1h';
}

interface TemplateRow {
  template_code: string;
  wa_template_name: string | null;
  language_code: string;
  wa_template_category: string | null;
  recipient_type: string;
  use_whatsapp: boolean | null;
  is_active: boolean | null;
  channel: string;
  wa_variables: string[] | null;
  required_variables: string[];
  wa_variable_derivations: DerivationsMap | null;
  cost_per_send: number | null;
  /** Phase 2B: when set, names the meta fields that compose the dedup key for
   *  this template (e.g. {"fields":["contextId","scheduledDate"]}). NULL → legacy
   *  phone:day:firstParam[:ctx] key (unchanged). */
  dedup_scope: { fields?: string[] } | null;
  /** When explicitly false, the template bypasses STEP-5 quiet-hours deferral
   *  (sends immediately). NULL/true → respects quiet hours (unchanged). */
  respect_window: boolean | null;
}

interface EngineSettings {
  dailyCap: number;
  quietStart: number;
  quietEnd: number;
}

// ============================================================
// IST time helpers
// ============================================================

/** Current hour (0–23) in Asia/Kolkata. */
function istHour(): number {
  return new Date(Date.now() + IST_OFFSET_MS).getUTCHours();
}

/** YYYY-MM-DD string for today in Asia/Kolkata. Used as idempotency-key day bucket. */
function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO UTC timestamp for midnight Asia/Kolkata of the current IST day. */
function startOfTodayIstUtc(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS).toISOString();
}

/** ISO UTC timestamp for the next occurrence of `endHour`:00 IST. */
function nextQuietEndUtc(endHour: number): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  if (ist.getUTCHours() >= endHour) {
    ist.setUTCDate(ist.getUTCDate() + 1);
  }
  ist.setUTCHours(endHour, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS).toISOString();
}

// ============================================================
// Site settings — batched read
// ============================================================

/**
 * Batch-read the three engine settings (daily cap + quiet window) in one
 * site_settings query. Falls back to hardcoded defaults on any error or
 * missing key so the engine never blocks on config issues.
 */
async function loadEngineSettings(): Promise<EngineSettings> {
  const fallback: EngineSettings = {
    dailyCap: DEFAULT_DAILY_CAP,
    quietStart: DEFAULT_QUIET_START,
    quietEnd: DEFAULT_QUIET_END,
  };
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['wa_daily_cap', 'wa_quiet_start', 'wa_quiet_end']);
    const rows = (data as Array<{ key: string; value: unknown }> | null) ?? [];
    const map = new Map<string, unknown>(rows.map(r => [r.key, r.value]));
    const parse = (key: string, fb: number): number => {
      const raw = map.get(key);
      const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
      return Number.isFinite(num) ? num : fb;
    };
    return {
      dailyCap: parse('wa_daily_cap', DEFAULT_DAILY_CAP),
      quietStart: parse('wa_quiet_start', DEFAULT_QUIET_START),
      quietEnd: parse('wa_quiet_end', DEFAULT_QUIET_END),
    };
  } catch {
    return fallback;
  }
}

// ============================================================
// Recipient resolution
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a recipient identifier to a canonical WhatsApp phone string
 * (AiSensy format, no `+` prefix). Returns null if nothing found.
 *
 * Accepts:
 *   - 'admin' → env ADMIN_WHATSAPP_NUMBER or fallback '918591287997'.
 *   - Raw phone (+919687…, 919687…, 9687606177) → normalized directly.
 *   - UUID → look up in parents, then coaches, then children tables.
 */
async function resolveRecipientPhone(recipientId: string): Promise<string | null> {
  if (!recipientId) return null;

  if (recipientId === 'admin') {
    return formatForWhatsApp(process.env.ADMIN_WHATSAPP_NUMBER || '918591287997');
  }

  // Raw phone — 10–15 digits with optional leading +.
  const cleaned = recipientId.replace(/[\s\-\(\)\.]/g, '');
  if (/^\+?\d{10,15}$/.test(cleaned)) {
    return formatForWhatsApp(recipientId);
  }

  if (UUID_RE.test(recipientId)) {
    const { data: parent } = await supabase
      .from('parents')
      .select('phone')
      .eq('id', recipientId)
      .limit(1);
    const parentPhone = parent?.[0]?.phone;
    if (parentPhone) return formatForWhatsApp(parentPhone);

    const { data: coach } = await supabase
      .from('coaches')
      .select('phone')
      .eq('id', recipientId)
      .limit(1);
    const coachPhone = coach?.[0]?.phone;
    if (coachPhone) return formatForWhatsApp(coachPhone);

    const { data: child } = await supabase
      .from('children')
      .select('parent_phone')
      .eq('id', recipientId)
      .limit(1);
    const childPhone = child?.[0]?.parent_phone;
    if (childPhone) return formatForWhatsApp(childPhone);
  }

  return null;
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Send a WhatsApp notification via the unified engine.
 *
 * IMPORTANT: first arg must be template_code which now matches
 * wa_template_name exactly. Both are the AiSensy campaign name.
 *
 * Flow: template lookup → param validation → phone resolution →
 *       daily cap → quiet hours → idempotency → channel-routed send → log annotation.
 *
 * @param templateCode  Row key in communication_templates.
 * @param recipientId   'admin' | raw phone | UUID (parent/coach/child).
 * @param namedParams   Keys must match every entry in template.wa_variables.
 */
export async function sendNotification(
  templateCode: string,
  recipientId: string,
  namedParams: Record<string, string>,
  meta?: NotifyMeta,
): Promise<NotifyResult> {
  const isUuidRecipient = UUID_RE.test(recipientId);

  // Block 2.6b: redact sensitive namedParams values in log writes only.
  // The original namedParams continues to flow to the adapter for on-wire
  // delivery. safeNamedParams replaces namedParams in 5 context_data writes
  // (template_not_found early reject, logBase, deferred_quiet_hours raw
  // insert, AiSensy adapter envelope, Lead Bot adapter envelope).
  // See lib/communication/redact.ts for the redaction helper.
  const safeNamedParams = redactNamedParams(namedParams, meta?.redactInLog);

  // ── STEP 1. Template lookup ──
  const { data: templateRows, error: tmplErr } = await supabase
    .from('communication_templates')
    .select('template_code, wa_template_name, language_code, wa_template_category, recipient_type, use_whatsapp, is_active, channel, wa_variables, required_variables, wa_variable_derivations, cost_per_send, dedup_scope, respect_window')
    .eq('template_code', templateCode)
    .limit(1);

  if (tmplErr) {
    console.error('[notify] template lookup error:', tmplErr.message);
  }

  const template = templateRows?.[0] as TemplateRow | undefined;

  if (!template) {
    await logCommunication({
      templateCode,
      recipientType: 'system',
      waSent: false,
      errorMessage: 'template_not_found',
      contextData: { named_params: safeNamedParams, recipient_id: recipientId },
    });
    return { success: false, reason: 'template_not_found' };
  }

  const templateRecipientType = (template.recipient_type as RecipientType) ?? 'system';
  const logBase = {
    templateCode,
    recipientType: templateRecipientType,
    triggeredBy: meta?.triggeredBy ?? 'system' as const,
    triggeredByUserId: meta?.triggeredByUserId ?? null,
    contextData: {
      named_params: safeNamedParams,
      recipient_id: recipientId,
      ...(meta?.contextData ?? {}),
    },
  };

  if (!template.is_active) {
    await logCommunication({ ...logBase, waSent: false, errorMessage: 'template_disabled' });
    return { success: false, reason: 'template_disabled' };
  }

  if (!template.use_whatsapp) {
    await logCommunication({ ...logBase, waSent: false, errorMessage: 'channel_disabled' });
    return { success: false, reason: 'channel_disabled' };
  }

  if (template.channel === 'openclaw') {
    console.warn('[notify] openclaw channel is not routed through sendNotification');
    await logCommunication({ ...logBase, waSent: false, errorMessage: 'openclaw_invalid' });
    return { success: false, reason: 'openclaw_invalid' };
  }

  // ── STEP 1.5 (B3-VALIDATOR-FIX). Derivation resolution ──
  // resolveDerivations() runs BEFORE STEP 2 so Pattern B callers — who pass
  // canonical names (e.g. parent_name) — have their *_first_name aliases
  // filled in before the wa_variables presence check. Without this move,
  // STEP 2 sees alias keys as missing and returns 'missing_params' even
  // though the canonical source key was provided. Pillar 2B validator
  // (STEP 5.5 below) reuses the same finalParams — no double-compute.
  const validatorTemplate: ValidatorTemplate = {
    template_code: template.template_code,
    recipient_type: template.recipient_type,
    wa_template_name: template.wa_template_name,
    use_whatsapp: template.use_whatsapp,
    wa_variables: template.wa_variables,
    required_variables: template.required_variables ?? [],
    wa_variable_derivations: template.wa_variable_derivations,
  };
  const finalParams = resolveDerivations(validatorTemplate, namedParams);

  // ── STEP 2. Param validation + positional conversion ──
  // Checks against finalParams (post-derivation) so Pattern B callers pass.
  const schema = template.wa_variables ?? [];
  const missing = schema.filter(key => finalParams[key] === undefined);
  if (missing.length > 0) {
    console.warn('[notify] missing params for', templateCode, missing);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: `missing_params: ${missing.join(', ')}`,
      contextData: { ...logBase.contextData, missing },
    });
    return { success: false, reason: 'missing_params' };
  }
  const finalPositionalParams = schema.map(key => finalParams[key]);

  // ── STEP 3. Resolve recipient phone ──
  const phone = await resolveRecipientPhone(recipientId);
  if (!phone) {
    await logCommunication({ ...logBase, waSent: false, errorMessage: 'phone_not_found' });
    return { success: false, reason: 'phone_not_found' };
  }

  // ── Load engine settings (daily cap + quiet window) in one query ──
  const settings = await loadEngineSettings();

  // Auth (OTP) and admin templates bypass BOTH the daily cap (STEP 4) and quiet
  // hours (STEP 5). Hoisted here so STEP 4 can reference them; STEP 5 reuses them.
  const isAdmin = template.recipient_type === 'admin';
  const isAuthCategory = template.wa_template_category === 'authentication';
  // Transactional/utility templates (WhatsApp's own utility/authentication line)
  // bypass the per-recipient daily cap. Case-insensitive — DB holds both 'utility'
  // and 'UTILITY'. 'marketing' (and NULL) still respect the cap.
  const isTransactional =
    template.wa_template_category != null &&
    ['utility', 'authentication'].includes(template.wa_template_category.toLowerCase());

  // ── STEP 4. Daily cap ──
  const { count: sentToday } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_phone', phone)
    .eq('wa_sent', true)
    .gte('created_at', startOfTodayIstUtc());

  if (!isAdmin && !isAuthCategory && !isTransactional && (sentToday ?? 0) >= settings.dailyCap) {
    await logCommunication({
      ...logBase,
      recipientPhone: phone,
      waSent: false,
      errorMessage: 'daily_cap_hit',
      contextData: { ...logBase.contextData, cap: settings.dailyCap, count: sentToday },
    });
    return { success: false, reason: 'daily_cap_hit' };
  }

  // ── STEP 5. Quiet hours ──
  const hour = istHour();
  const inQuiet = hour >= settings.quietStart || hour < settings.quietEnd;
  if (!isAdmin && !isAuthCategory && !meta?.forceImmediate && template.respect_window !== false && inQuiet) {
    const deferUntil = nextQuietEndUtc(settings.quietEnd);
    // Raw insert into communication_queue (different table from
    // communication_logs which logCommunication targets). Drain-2C cron
    // at app/api/cron/process-deferred-comms/route.ts processes pending
    // rows daily at 08:05 IST. See docs/CURRENT-STATE.md Architecture
    // Decisions 2026-05-04 for the deferred-message contract.
    const { data: insertedRows } = await supabase
      .from('communication_queue')
      .insert({
        template_code: templateCode,
        recipient_type: template.recipient_type,
        recipient_id: isUuidRecipient ? recipientId : null,
        recipient_phone: phone,
        scheduled_for: deferUntil,
        variables: {
          template_vars: safeNamedParams,
          _meta: {
            triggered_by_user_id: meta?.triggeredByUserId ?? null,
            // DRAIN-2C-FIX A+: carry the original caller's intent through the
            // queue so the drained re-send preserves the parent two-way loop
            // (templateButtons, including button TITLES for inbound title-match)
            // AND keeps log attribution + cross-day idempotency aligned with
            // the original incident (contextType, contextId).
            // All optional — when absent the envelope is byte-identical to the
            // pre-A+ shape, so non-button/no-context callers and historical
            // queue rows remain unaffected.
            templateButtons: meta?.templateButtons ?? null,
            contextType: meta?.contextType ?? null,
            contextId: meta?.contextId ?? null,
          },
        },
        status: 'pending',
        created_by: meta?.triggeredBy ?? 'system',
      })
      .select('id');
    const queueId = insertedRows?.[0]?.id as string | undefined;
    return { success: false, reason: 'deferred_quiet_hours', deferred: true, queueId };
  }

  // ── STEP 5.5 (B2.2 + B3-VALIDATOR-FIX). Pillar 2B validator ──
  // validatorTemplate + finalParams + finalPositionalParams were constructed
  // before STEP 2 (B3-VALIDATOR-FIX) so resolveDerivations runs before the
  // wa_variables presence check. Pattern B callers pass canonical names;
  // derivations fill in the *_first_name aliases ahead of STEP 2's filter.
  //
  // validateNotification() runs Rules 1, 3, 4, 5, 6, 8 (Rule 2 is stubbed,
  // Rule 7 enforced inline at the AiSensy POST result handling below).
  // Mode is hardcoded 'warn' for this commit. Failures are logged to
  // activity_log; send proceeds. Rules 3 and 7 always enforce regardless.
  // TODO(b2.2-followup): replace with site_settings.notify_validator_mode
  //   reader once getSiteSetting() string-coercion bug is fixed.

  // Block 2.6c: pre-redact variables array for adapter-side log writes.
  // The adapters' buildContextData() helper writes params.variables to
  // communication_logs.context_data.variables — leaking sensitive values
  // (e.g. OTP) for templates that opted into redactInLog. Compute once
  // here using template.wa_variables (schema) + meta?.redactInLog (key
  // list); plumb via meta.safeVariables to both adapters.
  // See lib/communication/redact.ts for the redaction helper.
  const safeVariables = redactVariables(
    finalPositionalParams as string[],
    (template.wa_variables as string[] | null) ?? [],
    meta?.redactInLog,
  );

  const resolvedRecipient = await resolveRecipient(recipientId);
  const validatorMode: 'warn' | 'enforce' = 'warn'; // hardcoded — see TODO above
  const validation = await validateNotification(
    validatorTemplate,
    resolvedRecipient,
    phone,
    finalParams,
    validatorMode,
  );
  if (!validation.ok && validation.mode === 'enforce') {
    // ENFORCE: rules 3, 7, or future enforce-mode rules — abort the send.
    await logCommunication({
      ...logBase,
      recipientPhone: phone,
      waSent: false,
      errorMessage: `validator_rule_${validation.failedRule}: ${validation.reason}`,
      contextData: { ...logBase.contextData, validator: { failedRule: validation.failedRule, reason: validation.reason } },
    });
    return { success: false, reason: 'send_failed' };
  }
  // WARN-mode failures already logged to activity_log inside validateNotification.

  // ── STEP 6. Idempotency ──
  // Key composition is the SHARED implementation (lib/communication/idempotency.ts)
  // reused by sendCommunication's 2C opt-in claim — single source, no fork. Legacy
  // phone:day:firstParam[:ctx][:salt] OR the dedup_scope tuple (2B). Byte-identical
  // to the pre-2C inline formula (regression-asserted).
  const firstParam = (finalPositionalParams[0] as string | undefined) ?? '';
  const { key: idempotencyKey } = composeIdempotencyKey({
    templateCode,
    phone,
    firstParam,
    dedupScope: template.dedup_scope?.fields ?? null,
    meta: (meta ?? null) as Record<string, unknown> | null,
    salt: meta?.idempotencySalt ?? null,
  });

  // ── STEP 6. ATOMIC CLAIM (Phase 2A — claim-then-act) ──
  // Replaces the racy SELECT-then-act. INSERT the keyed claim row up front with
  // ON CONFLICT (idempotency_key) DO NOTHING (the FULL UNIQUE(idempotency_key)
  // constraint, migration 20260416120000): if a concurrent/earlier send already
  // claimed this key, no row is returned → this call is the duplicate and MUST
  // NOT send. The send happens next (STEP 7); the row is SETTLEd on success or
  // RELEASEd (key→NULL, kept as audit) on failure/dry-run so a retry can re-claim
  // — never a silently-suppressed message. The adapter is told ownsLog:true so it
  // does NOT write its own row (no double-log).
  const resolvedChannel = template.channel; // 'aisensy' | 'leadbot' (openclaw rejected above)
  const claimContextData = {
    variables: safeVariables ?? finalPositionalParams,
    named_params: safeNamedParams,
    original_recipient_id: recipientId,
  };

  // Shared atomic claim (lib/communication/idempotency.ts) — same primitive
  // sendCommunication's 2C opt-in uses.
  const claim = await claimIdempotencyRow(supabase, {
    idempotency_key: idempotencyKey,
    template_code: templateCode,
    recipient_type: templateRecipientType,
    recipient_id: isUuidRecipient ? recipientId : null,
    recipient_phone: phone,
    wa_sent: false,
    email_sent: false,
    sms_sent: false,
    sent_at: null,
    channel: resolvedChannel,
    triggered_by: meta?.triggeredBy ?? 'system',
    triggered_by_user_id: meta?.triggeredByUserId ?? null,
    context_type: meta?.contextType ?? null,
    context_id: meta?.contextId ?? null,
    context_data: claimContextData,
    created_at: new Date().toISOString(),
  });

  if (claim.error) {
    // Claim infra failed (not a duplicate). Do NOT send (avoids an unlogged,
    // un-deduped message); caller may retry. Mirrors a transient send_failed.
    console.error('[notify] claim insert failed:', claim.error);
    return { success: false, reason: 'send_failed' };
  }
  if (claim.duplicate) {
    // Key already claimed → this call is the duplicate. No send.
    return { success: false, reason: 'duplicate' };
  }
  const claimId = claim.claimId as string;

  // SETTLE (success) / RELEASE (failure/dry-run) by claimId — sole post-send writes.
  const settleClaim = async (result: WaSendResult): Promise<void> => {
    await supabase
      .from('communication_logs')
      .update({
        wa_sent: true,
        sent_at: new Date().toISOString(),
        cost_per_send: template.cost_per_send,
        channel: resolvedChannel,
        context_data: {
          ...claimContextData,
          provider_message_id: result.messageId ?? null,
          http_status: result.httpStatus ?? null,
        } as never,
      })
      .eq('id', claimId);
  };
  const releaseClaim = (errorMessage: string | null): Promise<void> =>
    releaseIdempotencyRow(supabase, claimId, errorMessage);

  // ── STEP 7. SEND-ONLY adapters (notify owns the log via ownsLog) ──
  if (resolvedChannel !== 'aisensy' && resolvedChannel !== 'leadbot') {
    console.error('[notify] unknown channel:', resolvedChannel);
    await releaseClaim(`unknown_channel: ${resolvedChannel}`);
    return { success: false, reason: 'send_failed' };
  }
  if (!template.wa_template_name) {
    await releaseClaim('wa_template_name is null');
    return { success: false, reason: 'send_failed' };
  }

  // Shared send meta. ownsLog:true → adapter is send-only (skips its own insert).
  // contextData/safeVariables preserve the pre-2A sent-row shape.
  const sendMeta = {
    templateCode,
    recipientType: templateRecipientType,
    recipientId: isUuidRecipient ? recipientId : null,
    triggeredBy: meta?.triggeredBy ?? 'system',
    triggeredByUserId: meta?.triggeredByUserId ?? null,
    contextType: meta?.contextType ?? null,
    contextId: meta?.contextId ?? null,
    contextData: { named_params: safeNamedParams, original_recipient_id: recipientId },
    safeVariables,
    ownsLog: true,
  };

  let result: WaSendResult;
  try {
    if (resolvedChannel === 'aisensy') {
      result = await sendWhatsAppMessage({
        to: phone,
        templateName: template.wa_template_name,
        templateCategory: template.wa_template_category ?? undefined,
        templateButtons: meta?.templateButtons,
        source: meta?.source,
        // Derivation-resolved positional params (e.g. child_first_name when the
        // caller passed only child_name); identical to positionalParams otherwise.
        variables: finalPositionalParams as string[],
        meta: sendMeta,
      });
    } else {
      result = await sendLeadBotMessage(
        {
          to: phone,
          templateName: template.wa_template_name,
          languageCode: template.language_code || 'en',
          templateCategory: template.wa_template_category ?? undefined,
          templateButtons: meta?.templateButtons,
          source: meta?.source,
          variables: finalPositionalParams as string[],
          meta: sendMeta,
        },
        { isDryRun: false }, // TASK 4 will replace with site_settings reader (leadbot_live_sends)
      );
    }
  } catch (err) {
    // Adapter threw (e.g. auth-template variable contract). RELEASE the claim then
    // re-throw to preserve the prior propagation behavior to callers.
    await releaseClaim(err instanceof Error ? err.message : String(err));
    throw err;
  }

  if (result.success && !result.dryRun) {
    await settleClaim(result);
    return { success: true, logId: claimId };
  }

  // Dry-run OR failure → RELEASE (key→NULL) so a real retry can re-claim. The row
  // stays as audit: 'dry_run' for dry-runs, the provider error for failures.
  await releaseClaim(result.dryRun ? 'dry_run' : (result.error ?? 'send_failed'));
  return {
    success: result.success,
    reason: result.success ? undefined : 'send_failed',
    logId: claimId,
  };
}
