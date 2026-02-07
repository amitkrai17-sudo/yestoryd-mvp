// ============================================================
// FILE: lib/whatsapp/signature.ts
// ============================================================
// Validate X-Hub-Signature-256 from Meta WhatsApp Cloud API
// Uses HMAC-SHA256 with timing-safe comparison
// ============================================================

import crypto from 'crypto';

/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 *
 * Meta signs webhook payloads with HMAC-SHA256 using the App Secret.
 * The signature header format is: sha256=<hex_digest>
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of X-Hub-Signature-256 header
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_WA_APP_SECRET;

  if (!appSecret) {
    console.warn('[WA-LeadBot] META_WA_APP_SECRET not set, skipping signature verification');
    return true;
  }

  if (!signature) {
    console.error('[WA-LeadBot] No X-Hub-Signature-256 header');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffer length mismatch means invalid signature
    return false;
  }
}
