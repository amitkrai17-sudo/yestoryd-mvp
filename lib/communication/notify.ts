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
import { logCommunication, type RecipientType } from './log';
import { formatForWhatsApp } from '@/lib/utils/phone';

// NOTE: module-level client is safe in lib/ server code.
// Do NOT copy this pattern into route handlers or components —
// use createClient() per-request there.
const supabase = createAdminClient();

const DEFAULT_DAILY_CAP = 3;
const DEFAULT_QUIET_START = 21; // 21:00 IST
const DEFAULT_QUIET_END = 8;    // 08:00 IST
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const POST_SEND_LOG_WINDOW_MS = 10_000;

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
  reason?: NotifyReason;
  deferred?: boolean;
}

export interface NotifyMeta {
  triggeredBy?: 'system' | 'coach' | 'admin' | 'cron';
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
}

interface TemplateRow {
  template_code: string;
  wa_template_name: string | null;
  recipient_type: string;
  use_whatsapp: boolean | null;
  is_active: boolean | null;
  channel: string;
  wa_variables: string[] | null;
  cost_per_send: number | null;
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

  // ── STEP 1. Template lookup ──
  const { data: templateRows, error: tmplErr } = await supabase
    .from('communication_templates')
    .select('template_code, wa_template_name, recipient_type, use_whatsapp, is_active, channel, wa_variables, cost_per_send')
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
      contextData: { named_params: namedParams, recipient_id: recipientId },
    });
    return { success: false, reason: 'template_not_found' };
  }

  const templateRecipientType = (template.recipient_type as RecipientType) ?? 'system';
  const logBase = {
    templateCode,
    recipientType: templateRecipientType,
    triggeredBy: meta?.triggeredBy ?? 'system' as const,
    triggeredByUserId: meta?.triggeredByUserId ?? null,
    contextData: { named_params: namedParams, recipient_id: recipientId },
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

  // ── STEP 2. Param validation + positional conversion ──
  const schema = template.wa_variables ?? [];
  const missing = schema.filter(key => namedParams[key] === undefined);
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
  const positionalParams = schema.map(key => namedParams[key]);

  // ── STEP 3. Resolve recipient phone ──
  const phone = await resolveRecipientPhone(recipientId);
  if (!phone) {
    await logCommunication({ ...logBase, waSent: false, errorMessage: 'phone_not_found' });
    return { success: false, reason: 'phone_not_found' };
  }

  // ── Load engine settings (daily cap + quiet window) in one query ──
  const settings = await loadEngineSettings();

  // ── STEP 4. Daily cap ──
  const { count: sentToday } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_phone', phone)
    .eq('wa_sent', true)
    .gte('created_at', startOfTodayIstUtc());

  if ((sentToday ?? 0) >= settings.dailyCap) {
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
  if (inQuiet) {
    const deferUntil = nextQuietEndUtc(settings.quietEnd);
    // Raw insert — logCommunication doesn't support deferred_until/channel yet.
    const { data: insertedRows } = await supabase
      .from('communication_logs')
      .insert({
        template_code: templateCode,
        recipient_type: template.recipient_type,
        recipient_phone: phone,
        triggered_by: meta?.triggeredBy ?? 'system',
        triggered_by_user_id: meta?.triggeredByUserId ?? null,
        wa_sent: false,
        email_sent: false,
        sms_sent: false,
        error_message: 'deferred_quiet_hours',
        channel: 'aisensy',
        deferred_until: deferUntil,
        context_data: {
          named_params: namedParams,
          recipient_id: recipientId,
          quiet_start: settings.quietStart,
          quiet_end: settings.quietEnd,
        },
      })
      .select('id');
    const logId = insertedRows?.[0]?.id as string | undefined;
    return { success: false, reason: 'deferred_quiet_hours', deferred: true, logId };
  }

  // ── STEP 6. Idempotency ──
  const firstParam = positionalParams[0] ?? '';
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${templateCode}:${phone}:${todayIST()}:${firstParam}`)
    .digest('hex');

  const { data: existingRows } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);
  if (existingRows && existingRows.length > 0) {
    return { success: false, reason: 'duplicate', logId: existingRows[0].id as string };
  }

  // ── STEP 7. Route by channel ──
  if (template.channel === 'aisensy') {
    if (!template.wa_template_name) {
      await logCommunication({
        ...logBase,
        recipientPhone: phone,
        waSent: false,
        errorMessage: 'wa_template_name is null',
      });
      return { success: false, reason: 'send_failed' };
    }

    const result = await sendWhatsAppMessage({
      to: phone,
      templateName: template.wa_template_name,
      variables: positionalParams,
      meta: {
        templateCode,
        recipientType: templateRecipientType,
        recipientId: isUuidRecipient ? recipientId : null,
        triggeredBy: meta?.triggeredBy ?? 'system',
        triggeredByUserId: meta?.triggeredByUserId ?? null,
        contextType: meta?.contextType ?? null,
        contextId: meta?.contextId ?? null,
        contextData: { named_params: namedParams, original_recipient_id: recipientId },
      },
    });

    // On success, annotate the log row that sendWhatsAppMessage just inserted
    // with idempotency_key, cost_per_send, channel. Failures stay unannotated
    // so they remain retryable.
    let logId: string | undefined;
    if (result.success) {
      const { data: recentRows } = await supabase
        .from('communication_logs')
        .select('id')
        .eq('template_code', templateCode)
        .eq('recipient_phone', phone)
        .is('idempotency_key', null)
        .gte('created_at', new Date(Date.now() - POST_SEND_LOG_WINDOW_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      const rowId = recentRows?.[0]?.id as string | undefined;
      if (rowId) {
        try {
          await supabase
            .from('communication_logs')
            .update({
              idempotency_key: idempotencyKey,
              cost_per_send: template.cost_per_send,
              channel: 'aisensy',
              triggered_by: meta?.triggeredBy ?? 'system',
              triggered_by_user_id: meta?.triggeredByUserId ?? null,
              context_type: meta?.contextType ?? null,
              context_id: meta?.contextId ?? null,
            })
            .eq('id', rowId);
          logId = rowId;
        } catch (err) {
          // UNIQUE violation on idempotency_key means a concurrent send won.
          console.warn('[notify] log annotate failed:', err instanceof Error ? err.message : err);
        }
      }
    }

    return {
      success: result.success,
      reason: result.success ? undefined : 'send_failed',
      logId,
    };
  }

  if (template.channel === 'leadbot') {
    console.warn('[notify] leadbot channel not routable from sendNotification — use webhook handler');
    await logCommunication({
      ...logBase,
      recipientPhone: phone,
      waSent: false,
      errorMessage: 'leadbot_not_routable_here',
    });
    return { success: false, reason: 'send_failed' };
  }

  console.error('[notify] unknown channel:', template.channel);
  await logCommunication({
    ...logBase,
    recipientPhone: phone,
    waSent: false,
    errorMessage: `unknown_channel: ${template.channel}`,
  });
  return { success: false, reason: 'send_failed' };
}
