// FILE: lib/observability/sentry-scrub.test.ts
//
// Pure unit tests for lib/observability/sentry-scrub.ts (2B).
//
// scrubEvent mutates the passed event IN PLACE and returns the same
// reference, so every assertion reads back from the original object/array/
// string-holder we passed in — no return-type casting needed.
//
// Two suites:
//   REDACT   — PII the scrubber MUST remove.
//   PRESERVE — non-PII the scrubber MUST leave byte-identical (the
//              over-match guard: UUIDs, SQLSTATEs, route/template names,
//              12-digit order ids).

import { describe, it, expect } from 'vitest';
import { scrubEvent, scrubText } from '@/lib/observability/sentry-scrub';

describe('scrubEvent — REDACT (must change)', () => {
  it('1. PostgrestError value: redacts phone in Key (col)=(val), preserves col + surrounding text', () => {
    const ev = {
      exception: {
        values: [
          {
            value:
              'duplicate key value violates unique constraint "communication_logs_recipient_phone_key" Key (recipient_phone)=(+919876543210) already exists.',
          },
        ],
      },
    };
    scrubEvent(ev);
    expect(ev.exception.values[0].value).toBe(
      'duplicate key value violates unique constraint "communication_logs_recipient_phone_key" Key (recipient_phone)=([REDACTED]) already exists.',
    );
  });

  it('2. message: redacts an interpolated email, keeps the trailing ": ..." intact', () => {
    const ev = { message: 'verifyOtp server-side failed for parent@example.com: no session returned' };
    scrubEvent(ev);
    expect(ev.message).toBe('verifyOtp server-side failed for [REDACTED]: no session returned');
  });

  it('3. tags: redacts actor_email value, preserves surface', () => {
    const tags: Record<string, string> = { surface: 'parent_login', actor_email: 'parent@example.com' };
    scrubEvent({ tags });
    expect(tags.actor_email).toBe('[REDACTED]');
    expect(tags.surface).toBe('parent_login');
  });

  it('4. extra: redacts adminEmail, leaves sessionId UUID byte-identical', () => {
    const extra: Record<string, string> = {
      sessionId: '86184c4f-3f32-4f58-9bdb-8776e8df27c0',
      adminEmail: 'admin@yestoryd.com',
    };
    scrubEvent({ extra });
    expect(extra.adminEmail).toBe('[REDACTED]');
    expect(extra.sessionId).toBe('86184c4f-3f32-4f58-9bdb-8776e8df27c0');
  });

  it('5. all 4 phone shapes in free text each become [REDACTED]', () => {
    const ev = { message: 'a +919876543210 b 919876543210 c 09876543210 d 9876543210 e' };
    scrubEvent(ev);
    expect(ev.message).toBe('a [REDACTED] b [REDACTED] c [REDACTED] d [REDACTED] e');
  });

  it('extra: recursive — redacts PII nested in objects/arrays', () => {
    const extra: Record<string, unknown> = {
      level1: { phones: ['9876543210'], note: 'ping parent@example.com please' },
    };
    scrubEvent({ extra });
    expect(extra).toEqual({
      level1: { phones: ['[REDACTED]'], note: 'ping [REDACTED] please' },
    });
  });

  it('breadcrumbs: scrubs .message and .data', () => {
    const breadcrumbs = [
      { message: 'sent to parent@example.com', data: { phone: '+919876543210' } },
    ];
    scrubEvent({ breadcrumbs });
    expect(breadcrumbs[0].message).toBe('sent to [REDACTED]');
    expect(breadcrumbs[0].data.phone).toBe('[REDACTED]');
  });
});

describe('scrubEvent — PRESERVE (over-match guard, must NOT change)', () => {
  it('6. UUID is untouched (dash + no 10-digit run guards)', () => {
    const ev = { message: 'trace 86184c4f-3f32-4f58-9bdb-8776e8df27c0 done' };
    scrubEvent(ev);
    expect(ev.message).toBe('trace 86184c4f-3f32-4f58-9bdb-8776e8df27c0 done');
  });

  it("7. SQLSTATE '23505' and 'pgCode: 22P02' are untouched", () => {
    const ev = { message: 'insert failed 23505 / pgCode: 22P02' };
    scrubEvent(ev);
    expect(ev.message).toBe('insert failed 23505 / pgCode: 22P02');
  });

  it("8. route 'payment/verify' and template 'parent_tuition_onboarding_v5' are untouched", () => {
    const tags: Record<string, string> = {
      route: 'payment/verify',
      template: 'parent_tuition_onboarding_v5',
    };
    scrubEvent({ tags });
    expect(tags.route).toBe('payment/verify');
    expect(tags.template).toBe('parent_tuition_onboarding_v5');
  });

  it("9. 12-digit order id '100123456789' is NOT treated as a phone", () => {
    const ev = { message: 'order 100123456789 placed' };
    scrubEvent(ev);
    expect(ev.message).toBe('order 100123456789 placed');
  });

  it('10. request.headers cookie/authorization deleted; non-sensitive header preserved', () => {
    const headers: Record<string, string> = {
      cookie: 'sb-access-token=secret; sb-refresh-token=secret2',
      Authorization: 'Bearer eyJ...',
      'x-request-id': 'req_abc123',
    };
    scrubEvent({ request: { headers } });
    expect(headers.cookie).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
    expect(headers['x-request-id']).toBe('req_abc123');
  });

  it('also deletes user.ip_address, keeps other user fields', () => {
    const user: Record<string, unknown> = { id: 'u-1', ip_address: '49.207.1.2' };
    scrubEvent({ user });
    expect(user.ip_address).toBeUndefined();
    expect(user.id).toBe('u-1');
  });
});

describe('scrubText — unit', () => {
  it('redacts email and Indian phone, preserves a 12-digit id and uuid in one pass', () => {
    expect(
      scrubText('mail x@y.com call 9876543210 id 100123456789 uuid 86184c4f-3f32-4f58-9bdb-8776e8df27c0'),
    ).toBe('mail [REDACTED] call [REDACTED] id 100123456789 uuid 86184c4f-3f32-4f58-9bdb-8776e8df27c0');
  });
});
