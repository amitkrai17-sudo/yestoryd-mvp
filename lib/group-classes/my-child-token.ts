// ============================================================
// FILE: lib/group-classes/my-child-token.ts
// ============================================================
// HMAC-signed token for the "My Child" portal.
// Allows non-enrolled parents to view their child's learning
// journey without a full Supabase auth session.
//
// Payload: { c: child_id, p: parent_phone, e: expires_at }
// Format:  base64url(payload).base64url(hmac-sha256)
// Expiry:  30 days from generation
// ============================================================

import crypto from 'crypto';

export interface MyChildTokenPayload {
  child_id: string;
  parent_phone: string;
  expires_at: number; // Unix epoch seconds
}

interface CompactPayload {
  c: string; // child_id
  p: string; // parent_phone
  e: number; // expires_at (epoch seconds)
}

const TOKEN_TTL_DAYS = 30;

function getSecret(): string {
  const secret = process.env.ACTIVITY_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('ACTIVITY_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return secret;
}

function sign(data: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64url');
}

/**
 * Generate a My Child portal token.
 * Token is URL-safe: base64url(payload).base64url(hmac)
 */
export function generateMyChildToken(
  childId: string,
  parentPhone: string,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_DAYS * 24 * 60 * 60;

  const compact: CompactPayload = {
    c: childId,
    p: parentPhone,
    e: expiresAt,
  };

  const payloadB64 = Buffer.from(JSON.stringify(compact)).toString('base64url');
  const signature = sign(payloadB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Decode and verify a My Child portal token.
 * Returns null if invalid, tampered, or expired.
 */
export function decodeMyChildToken(token: string): MyChildTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, providedSig] = parts;
    const expectedSig = sign(payloadB64);

    // Timing-safe comparison
    if (providedSig.length !== expectedSig.length) return null;
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (!crypto.timingSafeEqual(a, b)) return null;

    const compact: CompactPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8'),
    );

    // Validate required fields
    if (!compact.c || !compact.p || !compact.e) return null;

    // Check expiry
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (compact.e < nowEpoch) return null;

    return {
      child_id: compact.c,
      parent_phone: compact.p,
      expires_at: compact.e,
    };
  } catch {
    return null;
  }
}

/**
 * Build the full My Child portal URL with token.
 */
export function buildMyChildUrl(
  baseUrl: string,
  childId: string,
  parentPhone: string,
): string {
  const token = generateMyChildToken(childId, parentPhone);
  return `${baseUrl}/my-child/${childId}?token=${token}`;
}
