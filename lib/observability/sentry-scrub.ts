// ============================================================
// FILE: lib/observability/sentry-scrub.ts
// ============================================================
// Pure-JS PII scrubber for Sentry events. Wired as `beforeSend` in
// sentry.server.config.ts, sentry.edge.config.ts, and
// instrumentation-client.ts (2B). Runs in server AND edge runtimes,
// so this module has ZERO runtime imports — regex/string only, no
// Node APIs (no fs/crypto/Buffer), no env reads, no SDK imports.
//
// What it strips from free text (scrubText):
//   - Postgres "Key (col)=(value)" detail strings (col preserved,
//     value redacted) — the lib/communication/log.ts leak class.
//   - Email addresses.
//   - Indian phone numbers in all 4 shapes (+91 / 91 / 0 / bare),
//     guarded so UUID segments and 12+ digit IDs are never partially
//     matched.
//
// What it deletes outright (no value needed):
//   - request.headers.cookie / authorization (case-insensitive)
//   - user.ip_address
//
// Fail-safe: the whole walk is wrapped in try/catch and returns the
// original event on any throw — a scrubber bug must never crash Sentry
// reporting. Nothing is logged in the catch (no PII to console).
// ============================================================

/** Canonical replacement token (mirrors lib/communication/redact.ts). */
const REDACTED = '[REDACTED]';

/** Max recursion depth for extra / breadcrumb-data walks. */
const MAX_DEPTH = 5;

// --- Patterns (module-level, unanchored, global) ----------------------------

// Postgres constraint detail: `Key (recipient_phone)=(+919876543210) already
// exists.` Preserve the column name, redact the value (which is the PII).
const PG_KEY = /Key \(([^)]+)\)=\(([^)]*)\)/g;

// Email. The TLD class [A-Za-z]{2,} stops at sentence punctuation (": ", ". "),
// so trailing punctuation is not swallowed into the match.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Indian phone, 4 shapes: optional (+91 | 91 | 0) prefix + national [6-9]\d{9}.
// GUARD: (?<![\d-]) / (?![\d-]) require a non-digit, non-hyphen boundary on
// BOTH sides of the whole token — so the 10 national digits can never be a
// slice of a longer digit run (12-digit order ids) and a token can never start
// or end adjacent to a '-' (UUID segment boundaries).
const PHONE_IN = /(?<![\d-])(?:\+91|91|0)?[6-9]\d{9}(?![\d-])/g;

/**
 * Apply all value patterns to a single string. Order matters: PG_KEY first so
 * the parenthesised value is redacted wholesale (and the column name kept)
 * before the email/phone matchers would otherwise touch its contents.
 */
export function scrubText(s: string): string {
  if (typeof s !== 'string' || s.length === 0) return s;
  let out = s.replace(PG_KEY, (_m, col: string) => `Key (${col})=(${REDACTED})`);
  out = out.replace(EMAIL, REDACTED);
  out = out.replace(PHONE_IN, REDACTED);
  return out;
}

/**
 * Recursively scrub strings inside an arbitrary value (objects/arrays/strings).
 * Mutates objects/arrays in place; returns the (possibly replaced) value.
 * Depth-capped so a pathological/cyclic-ish payload can't spin.
 */
function scrubDeep(val: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return val;
  if (typeof val === 'string') return scrubText(val);
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      val[i] = scrubDeep(val[i], depth + 1);
    }
    return val;
  }
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      obj[k] = scrubDeep(obj[k], depth + 1);
    }
    return val;
  }
  return val;
}

/** Structural view of the Sentry event fields this scrubber touches. */
interface ScrubbableEvent {
  message?: unknown;
  exception?: { values?: Array<{ value?: unknown } | null | undefined> | null } | null;
  tags?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
  breadcrumbs?: Array<{ message?: unknown; data?: unknown } | null | undefined> | null;
  request?: { headers?: Record<string, unknown> | null } | null;
  user?: ({ ip_address?: unknown } & Record<string, unknown>) | null;
}

/**
 * Scrub PII from a Sentry event in place and return the same event reference.
 * Designed to be the `beforeSend` body. Never throws — on any internal error
 * it returns the event untouched (fail-open on the scrubber, never crash the
 * reporting path).
 */
export function scrubEvent(event: ScrubbableEvent): ScrubbableEvent {
  try {
    if (!event || typeof event !== 'object') return event;

    // event.message
    if (typeof event.message === 'string') {
      event.message = scrubText(event.message);
    }

    // event.exception.values[].value — the raw-error / PostgrestError leak class
    const exValues = event.exception?.values;
    if (Array.isArray(exValues)) {
      for (const v of exValues) {
        if (v && typeof v.value === 'string') {
          v.value = scrubText(v.value);
        }
      }
    }

    // event.tags (string values only)
    if (event.tags && typeof event.tags === 'object') {
      for (const k of Object.keys(event.tags)) {
        const tv = event.tags[k];
        if (typeof tv === 'string') {
          event.tags[k] = scrubText(tv);
        }
      }
    }

    // event.extra (recursive)
    if (event.extra && typeof event.extra === 'object') {
      scrubDeep(event.extra, 0);
    }

    // event.breadcrumbs[].message + .data (recursive)
    if (Array.isArray(event.breadcrumbs)) {
      for (const crumb of event.breadcrumbs) {
        if (!crumb) continue;
        if (typeof crumb.message === 'string') {
          crumb.message = scrubText(crumb.message);
        }
        if (crumb.data && typeof crumb.data === 'object') {
          scrubDeep(crumb.data, 0);
        }
      }
    }

    // Hard deletes — request headers cookie/authorization (case-insensitive)
    const headers = event.request?.headers;
    if (headers && typeof headers === 'object') {
      for (const k of Object.keys(headers)) {
        const lk = k.toLowerCase();
        if (lk === 'cookie' || lk === 'authorization') {
          delete headers[k];
        }
      }
    }

    // Hard delete — user.ip_address
    if (event.user && typeof event.user === 'object') {
      delete event.user.ip_address;
    }

    return event;
  } catch {
    // Fail-open: a scrubber bug must never break Sentry init / reporting.
    return event;
  }
}
