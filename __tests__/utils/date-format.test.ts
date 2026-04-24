// ============================================================================
// DATE-FORMAT CONTRACT TESTS
// __tests__/utils/date-format.test.ts
// ============================================================================
//
// Pins the rendered output of formatters that are wired into WhatsApp template
// params. If Intl / ICU behavior drifts on a future Node or Vercel runtime
// upgrade, these tests fail loudly rather than silently shipping a different
// string into parent/coach messages.
//
// Scope: narrowly targets the format strings that currently flow into
// Meta-approved templates. Expand as other formatters gain send-side wiring.
// ============================================================================

import { formatDateShort } from '@/lib/utils/date-format';

describe('formatDateShort (session_date contract for WhatsApp templates)', () => {
  it('renders "EEE, d MMM" shape for the coach_session_reminder_1h_v3 template', () => {
    // Shape used by coach-reminders-1h and enrollment-lifecycle 24h fires.
    // Fixed date so the test is deterministic across runs.
    expect(formatDateShort('2026-04-23')).toBe('Thu, 23 Apr');
  });

  it('renders a weekday + day + short-month string for any ISO date', () => {
    // Defensive pattern assertion — if Intl output ever flips comma/spacing,
    // the exact-match test above catches it; this one covers structural drift.
    const result = formatDateShort('2026-07-04');
    expect(result).toMatch(/^[A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2}$/);
  });

  it('honors Asia/Kolkata timezone (date does not shift at IST midnight from a UTC runtime)', () => {
    // Sessions on 2026-05-01 must render as 1 May regardless of whether the
    // process runs in UTC (Vercel) or Asia/Kolkata (local dev).
    expect(formatDateShort('2026-05-01')).toBe('Fri, 1 May');
  });
});
