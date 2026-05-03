// FILE: tests/communication/redact.test.ts
//
// Pure unit tests for lib/communication/redact.ts (Block 2.6b).
//
// Strategy: redactNamedParams is a pure function with no I/O dependencies,
// so no mocks are needed. Tests cover happy path + 4 edge cases that
// matter for production correctness.
//
// Integration coverage (the helper actually being wired into 5 context_data
// sites in notify.ts) is NOT tested here — that's covered implicitly by
// the post-deploy smoke test of parent_otp_v3 → assert OTP value does not
// appear in communication_logs.context_data.named_params.

import { describe, it, expect } from 'vitest';
import { redactNamedParams, REDACTION_SENTINEL } from '@/lib/communication/redact';

describe('redactNamedParams', () => {
  it('redacts the specified key with REDACTION_SENTINEL', () => {
    const input = { otp: '123456', name: 'Amit' };
    const result = redactNamedParams(input, ['otp']);
    expect(result).toEqual({ otp: REDACTION_SENTINEL, name: 'Amit' });
  });

  it('leaves all keys unchanged when redactKeys is empty array', () => {
    const input = { otp: '123456', name: 'Amit' };
    const result = redactNamedParams(input, []);
    expect(result).toBe(input); // same reference, no copy
    expect(result).toEqual({ otp: '123456', name: 'Amit' });
  });

  it('leaves all keys unchanged when redactKeys is undefined', () => {
    const input = { otp: '123456', name: 'Amit' };
    const result = redactNamedParams(input, undefined);
    expect(result).toBe(input); // same reference, no copy
    expect(result).toEqual({ otp: '123456', name: 'Amit' });
  });

  it('silently ignores redactKeys entries not present in namedParams', () => {
    const input = { name: 'Amit' };
    const result = redactNamedParams(input, ['otp', 'password']);
    expect(result).toEqual({ name: 'Amit' });
    expect(result).not.toHaveProperty('otp');
    expect(result).not.toHaveProperty('password');
  });

  it('does not mutate the original namedParams object', () => {
    const input = { otp: '123456', name: 'Amit' };
    const inputBefore = { ...input };
    redactNamedParams(input, ['otp']);
    expect(input).toEqual(inputBefore);
    expect(input.otp).toBe('123456');
  });
});
