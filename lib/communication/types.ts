// ============================================================
// FILE: lib/communication/types.ts
// ============================================================
// Provider-agnostic shared types for WhatsApp send adapters.
//
// Both lib/communication/aisensy.ts (current outbound) and
// lib/communication/leadbot.ts (Meta Cloud direct, Phase B) accept
// WaSendParams and return WaSendResult. The same shape, different
// transport.
//
// AiSensy ignores languageCode and header (their abstraction handles
// language server-side and exposes media via the flat mediaUrl field).
// Lead Bot consumes both — Meta Cloud requires explicit per-send
// language and a structured header component.
// ============================================================

import type { RecipientType, TriggeredBy } from './log';

// ────────────────────────────────────────────────────────────
// BUTTONS
// ────────────────────────────────────────────────────────────

/**
 * One quick-reply, URL, or phone-number button. Field names align with
 * Meta Cloud's button-component schema; AiSensy accepts the same shape.
 *
 * For Meta Cloud, each button is its own component in the components
 * array (one component per button, with `index` as a string).
 */
export interface WhatsAppButton {
  type: string;                                   // always 'button' for Meta Cloud
  sub_type?: string;                              // 'quick_reply' | 'url' | 'phone_number'
  index?: number;                                 // 0-based position within template
  url?: string;                                   // for sub_type='url'
  parameters?: Array<{ type: string; text: string }>;
}

// ────────────────────────────────────────────────────────────
// HEADER MEDIA
// ────────────────────────────────────────────────────────────

/**
 * Structured header media (image/document/video) for templates that
 * declare a header component. Lead Bot uses this to build the
 * components[0] header entry in the Meta Cloud payload.
 *
 * AiSensy ignores this field; legacy callers still use the flat
 * mediaUrl/mediaFilename fields on WaSendParams instead.
 */
export interface WhatsAppHeaderMedia {
  type: 'image' | 'document' | 'video';
  url: string;
  filename?: string;                              // documents only
}

// ────────────────────────────────────────────────────────────
// OBSERVABILITY ENVELOPE
// ────────────────────────────────────────────────────────────

/**
 * Optional metadata folded into the communication_logs row.
 * Absence is OK — adapters fall back to recipient_type='system' and
 * triggered_by='system' when meta is omitted entirely.
 */
export interface SendMeta {
  templateCode?: string;
  recipientType?: RecipientType;
  recipientId?: string | null;
  recipientEmail?: string | null;
  triggeredBy?: TriggeredBy;
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  contextData?: Record<string, unknown> | null;
}

// ────────────────────────────────────────────────────────────
// SEND PARAMS
// ────────────────────────────────────────────────────────────

/**
 * Provider-agnostic input shape for either AiSensy or Lead Bot adapter.
 *
 * languageCode is consumed by leadbot.ts (Meta Cloud requires explicit
 * per-send language) and ignored by aisensy.ts. Defaults to 'en' inside
 * leadbot.ts when absent (matching cloud-api.ts:sendTemplate's default).
 *
 * header is consumed by leadbot.ts. aisensy.ts uses the flat
 * mediaUrl/mediaFilename pair instead, so legacy callers continue to
 * work unchanged through the rename.
 */
export interface WaSendParams {
  to: string;
  templateName: string;
  variables: string[];
  /** BCP-47 short form: 'en', 'hi', 'en_US'. Lead Bot only. */
  languageCode?: string;
  /** Structured header media (Lead Bot only). */
  header?: WhatsAppHeaderMedia;
  /** Legacy flat field: AiSensy media URL. */
  mediaUrl?: string;
  /** Legacy flat field: AiSensy media filename. */
  mediaFilename?: string;
  buttons?: WhatsAppButton[];
  /** AiSensy-only attribution field. Lead Bot ignores. */
  source?: string;
  meta?: SendMeta;
}

// ────────────────────────────────────────────────────────────
// RESULT + OPTIONS
// ────────────────────────────────────────────────────────────

/**
 * Provider-agnostic return shape. Same fields as
 * lib/whatsapp/types.ts:SendResult.
 */
export interface WaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Adapter behavioral options. isDryRun is the Phase A safety gate for
 * leadbot.ts — when true, the adapter validates inputs, builds the
 * payload, writes a communication_logs row, but does NOT POST to Meta.
 *
 * Phase A (Lead Bot first ship): isDryRun defaults to true inside
 * leadbot.ts. Phase B will flip the default and add a site_settings
 * kill-switch (leadbot_live_sends).
 *
 * AiSensy ignores this options object entirely — it has no dry-run path.
 */
export interface SendOptions {
  isDryRun?: boolean;
}
