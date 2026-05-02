// ============================================================
// FILE: lib/communication/leadbot.ts
// ============================================================
// Meta Cloud direct outbound for the Lead Bot WABA (8591).
//
// Mirrors lib/communication/aisensy.ts on the input side
// (WaSendParams) and translates to Meta Cloud Graph API v21.0
// payload on the output side. Same lifecycle: env check → phone
// validation → build payload → conditional fetch → log → return.
//
// Phase A safety gate: isDryRun defaults to TRUE. A caller must
// pass {isDryRun: false} explicitly to fire a real send. Phase B
// will flip the default and add a site_settings kill-switch
// (see TODO inside sendLeadBotMessage).
//
// Logging contract is identical to aisensy.ts: every code path
// (success, four failure modes, dry-run) writes exactly one row
// to communication_logs via logCommunication(). The caller
// (notify.ts post-send annotate block at lines 471-505) reads
// that row by template_code + recipient_phone within a 10-second
// window and updates idempotency_key + cost_per_send + channel.
//
// Reference: BSP migration decision (commit 62f8bb2c) and
// docs/CURRENT-STATE.md "2026-04-29 — Spine principle audit findings"
// Architecture Decisions entry.
// ============================================================

import { getSiteSettingBool } from '@/lib/config/site-settings-loader';
import { formatForWhatsApp, isValidPhone } from '@/lib/utils/phone';
import { logCommunication, RecipientType, TriggeredBy } from './log';
import type {
  WaSendParams,
  WaSendResult,
  SendOptions,
  WhatsAppHeaderMedia,
} from './types';

const GRAPH_API_VERSION = 'v21.0';

// ────────────────────────────────────────────────────────────
// META CLOUD PAYLOAD SHAPES (internal — not exported via types.ts
// because they're transport-level and only leadbot.ts produces them)
// ────────────────────────────────────────────────────────────

interface MetaCloudComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters?: Array<Record<string, unknown>>;
}

interface MetaCloudTemplate {
  name: string;
  language: { code: string };
  components?: MetaCloudComponent[];
}

export interface MetaCloudPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: MetaCloudTemplate;
}

// ────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────

/**
 * Read META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN from env.
 * Throws if either is missing. Mirrors lib/whatsapp/cloud-api.ts:14-19
 * pattern so behavior is identical.
 */
function getConfig(): { phoneNumberId: string; accessToken: string } {
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error('[WA-LeadBot] Missing META_WA_PHONE_NUMBER_ID or META_WA_ACCESS_TOKEN');
  }
  return { phoneNumberId, accessToken };
}

export function isLeadBotConfigured(): boolean {
  return !!(process.env.META_WA_PHONE_NUMBER_ID && process.env.META_WA_ACCESS_TOKEN);
}

// ────────────────────────────────────────────────────────────
// PURE TRANSLATION — buildLeadBotPayload
// ────────────────────────────────────────────────────────────

/**
 * Pure function: WaSendParams → Meta Cloud Graph API payload.
 * No I/O, no env reads, no validation. Used directly by tests to
 * verify translation correctness.
 *
 * Component ordering (Meta requires): [header, body, button*]
 *   - header: emitted only if params.header is set OR legacy
 *             flat mediaUrl is set (defaults to type='document').
 *   - body: emitted only if params.variables.length > 0.
 *   - buttons: one component per button, with `index` as a
 *              STRING (Meta's quirk).
 *
 * If all three blocks are empty, components is omitted entirely
 * (Meta accepts a template send with no components for templates
 * that declare zero variables).
 *
 * languageCode defaults to 'en' (matching cloud-api.ts:188).
 */
export function buildLeadBotPayload(params: WaSendParams): MetaCloudPayload {
  const components: MetaCloudComponent[] = [];

  // 1. Header (must come first in components array)
  const headerSrc: WhatsAppHeaderMedia | null = params.header
    ?? (params.mediaUrl
      ? { type: 'document', url: params.mediaUrl, filename: params.mediaFilename }
      : null);

  if (headerSrc) {
    let mediaParam: Record<string, unknown>;
    if (headerSrc.type === 'image') {
      mediaParam = { type: 'image', image: { link: headerSrc.url } };
    } else if (headerSrc.type === 'video') {
      mediaParam = { type: 'video', video: { link: headerSrc.url } };
    } else {
      // 'document' (default for legacy flat mediaUrl)
      mediaParam = {
        type: 'document',
        document: {
          link: headerSrc.url,
          filename: headerSrc.filename ?? 'document',
        },
      };
    }
    components.push({
      type: 'header',
      parameters: [mediaParam],
    });
  }

  // 2. Body — positional variables map array[0]→{{1}}, array[1]→{{2}}, ...
  if (params.variables.length > 0) {
    components.push({
      type: 'body',
      parameters: params.variables.map((v) => ({
        type: 'text',
        text: String(v ?? ''),
      })),
    });
  }

  // 3. Buttons — one component per button, index is a STRING per Meta spec
  if (params.buttons?.length) {
    for (let i = 0; i < params.buttons.length; i++) {
      const btn = params.buttons[i];
      components.push({
        type: 'button',
        sub_type: btn.sub_type ?? 'quick_reply',
        index: String(btn.index ?? i),
        parameters: btn.parameters ?? [],
      });
    }
  }

  const template: MetaCloudTemplate = {
    name: params.templateName,
    language: { code: params.languageCode ?? 'en' },
  };
  if (components.length > 0) {
    template.components = components;
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(params.to),
    type: 'template',
    template,
  };
}

// ────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — sendLeadBotMessage
// ────────────────────────────────────────────────────────────

/**
 * Send a Meta Cloud template message via the Lead Bot WABA.
 *
 * Phase A behavior: isDryRun defaults to TRUE. Dry-run validates
 * env + phone, builds the payload, writes a communication_logs row
 * marked as dry-run, and returns success — but does NOT POST to Meta.
 *
 * Set options.isDryRun=false to fire a real send. Phase B will flip
 * the default and add a site_settings kill-switch.
 *
 * @param params  Template send parameters (provider-agnostic shape).
 * @param options Behavioral flags. isDryRun?: boolean (default true).
 */
export async function sendLeadBotMessage(
  params: WaSendParams,
  options: SendOptions = {},
): Promise<WaSendResult> {
  // Phase B kill-switch: site_settings.leadbot_live_sends is the runtime gate.
  // When false (default), this adapter forces dry-run regardless of caller's
  // isDryRun option. Cache TTL is 5 min — flipping the row takes up to 5 min
  // to propagate. For immediate effect, flip channel='aisensy' on affected
  // templates (DB-row rollback is the belt-and-suspenders fallback).
  const liveSendsEnabled = await getSiteSettingBool('leadbot_live_sends');
  const isDryRun = !liveSendsEnabled || (options.isDryRun ?? true);

  // Build the log row scaffold. Same shape as aisensy.ts logBase so the
  // notify.ts post-send annotate block (lines 471-505) treats both
  // adapters' rows identically.
  const logBase = {
    templateCode: params.meta?.templateCode ?? `direct:${params.templateName}`,
    recipientType: params.meta?.recipientType ?? ('system' as RecipientType),
    recipientId: params.meta?.recipientId ?? null,
    recipientPhone: params.to,
    recipientEmail: params.meta?.recipientEmail ?? null,
    triggeredBy: params.meta?.triggeredBy ?? ('system' as TriggeredBy),
    triggeredByUserId: params.meta?.triggeredByUserId ?? null,
    contextType: params.meta?.contextType ?? null,
    contextId: params.meta?.contextId ?? null,
  };

  const buildContextData = (extra: Record<string, unknown>) => ({
    variables: params.variables,
    ...(params.meta?.contextData ?? {}),
    ...extra,
  });

  // ── Path 1: Env check ──
  let phoneNumberId: string;
  let accessToken: string;
  try {
    ({ phoneNumberId, accessToken } = getConfig());
  } catch {
    console.error('[WA-LeadBot] Lead Bot not configured');
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: 'Lead Bot not configured',
      contextData: buildContextData({}),
    });
    return { success: false, error: 'Lead Bot not configured' };
  }

  // ── Path 2: Phone validation ──
  if (!isValidPhone(params.to)) {
    console.error('[WA-LeadBot] Invalid phone number:', params.to);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: `Invalid phone number: ${params.to}`,
      contextData: buildContextData({}),
    });
    return { success: false, error: 'Invalid phone number' };
  }

  const formattedPhone = formatForWhatsApp(params.to);
  logBase.recipientPhone = formattedPhone;

  // Build the Meta Cloud payload (pure translation).
  const payload = buildLeadBotPayload(params);

  // ── Path 6: Dry-run ──
  // Skip the fetch but write a log row that distinguishes dry-runs from
  // real sends. templateCode is preserved (not substituted) so logs are
  // searchable by template name. The DRY_RUN_<ts> marker in
  // contextData.provider_message_id is the canonical dry-run flag;
  // errorMessage='dry_run' is the secondary indicator.
  if (isDryRun) {
    const dryRunId = `DRY_RUN_${Date.now()}`;
    console.log('[WA-LeadBot] DRY-RUN:', params.templateName, '→', formattedPhone);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: 'dry_run',
      contextData: buildContextData({
        provider_message_id: dryRunId,
        payload,
      }),
    });
    return { success: true, messageId: dryRunId };
  }

  // ── Real-send path (Paths 3, 4, 5) ──
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    console.log('[WA-LeadBot] Sending:', params.templateName, '→', formattedPhone);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    const messageId = data.messages?.[0]?.id;

    // ── Path 3: Successful send ──
    if (response.ok && messageId) {
      console.log('[WA-LeadBot] SUCCESS:', params.templateName, messageId);
      await logCommunication({
        ...logBase,
        waSent: true,
        contextData: buildContextData({
          provider_message_id: messageId,
          http_status: response.status,
        }),
      });
      return { success: true, messageId };
    }

    // ── Path 4: Failed POST (non-200 or no message id) ──
    let errorMsg =
      data.error?.message ||
      data.error?.error_data?.details ||
      `HTTP ${response.status}`;

    // B1: prefix 'AUTH:' on 401/403 so auth failures are grep-distinct
    // from template rejections / param errors / quality blocks.
    if (response.status === 401 || response.status === 403) {
      errorMsg = `AUTH: ${errorMsg}`;
    }

    console.error('[WA-LeadBot] FAILED:', params.templateName, errorMsg);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: errorMsg,
      contextData: buildContextData({
        http_status: response.status,
        response_body: data,
      }),
    });
    return { success: false, error: errorMsg };
  } catch (error) {
    // ── Path 5: Network exception ──
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    console.error('[WA-LeadBot] EXCEPTION:', errorMsg);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: errorMsg,
      contextData: buildContextData({ exception: true }),
    });
    return { success: false, error: errorMsg };
  }
}
