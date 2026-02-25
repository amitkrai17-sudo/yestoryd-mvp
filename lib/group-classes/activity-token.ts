// ============================================================
// FILE: lib/group-classes/activity-token.ts
// ============================================================
// Activity Token — generate/decode signed tokens for parent
// activity pages. Base64-encoded JSON with HMAC-SHA256 signature.
//
// Token payload: { s: session_id, p: participant_id, c: child_id, n: child_name }
// Format: base64(payload).base64(signature)
// ============================================================

import crypto from 'crypto';

interface ActivityTokenPayload {
  session_id: string;
  participant_id: string;
  child_id: string;
  child_name: string;
}

// Compact payload keys to keep tokens short (mobile URLs)
interface CompactPayload {
  s: string; // session_id
  p: string; // participant_id
  c: string; // child_id
  n: string; // child_name
}

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
 * Generate an activity token for a participant.
 * Token is URL-safe: base64url(payload).base64url(hmac)
 */
export function generateActivityToken(
  sessionId: string,
  participantId: string,
  childId: string,
  childName: string,
): string {
  const compact: CompactPayload = {
    s: sessionId,
    p: participantId,
    c: childId,
    n: childName,
  };

  const payloadB64 = Buffer.from(JSON.stringify(compact)).toString('base64url');
  const signature = sign(payloadB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Decode and verify an activity token.
 * Returns null if invalid or tampered.
 */
export function decodeActivityToken(token: string): ActivityTokenPayload | null {
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
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // Validate required fields
    if (!compact.s || !compact.p || !compact.c || !compact.n) return null;

    return {
      session_id: compact.s,
      participant_id: compact.p,
      child_id: compact.c,
      child_name: compact.n,
    };
  } catch {
    return null;
  }
}

/**
 * Build the full activity URL for a participant.
 */
export function buildActivityUrl(
  baseUrl: string,
  sessionId: string,
  participantId: string,
  childId: string,
  childName: string,
): string {
  const token = generateActivityToken(sessionId, participantId, childId, childName);
  return `${baseUrl}/classes/activity/${sessionId}?token=${token}`;
}
