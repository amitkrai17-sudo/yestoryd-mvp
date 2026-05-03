// FILE: lib/communication/redact.ts
//
// Sensitive-value redaction for communication_logs.context_data.
//
// Block 2.6b — protects credential-shaped values (OTP codes, password reset
// tokens, magic-link secrets) from being persisted in queryable log rows
// while still flowing verbatim to the message provider for delivery.
//
// Architecture: notify.ts computes safeNamedParams = redactNamedParams(
// namedParams, meta?.redactInLog) ONCE at the top of sendNotification, then
// uses safeNamedParams in every context_data write site (5 sites total per
// Phase 0 audit). The original namedParams continues to flow to the adapter
// for on-wire message construction.
//
// Future use cases beyond OTPs:
//   - Password reset tokens
//   - Magic-link secrets
//   - Payment authorization codes
//   - Any caller-supplied namedParams value where the wire-message needs the
//     real value but the audit log should mask it.

/**
 * Sentinel used in place of redacted values. Single canonical string so
 * downstream queries can detect "redacted" rows uniformly.
 */
export const REDACTION_SENTINEL = '[REDACTED]';

/**
 * Returns a shallow-copied namedParams object with values for the specified
 * keys replaced by REDACTION_SENTINEL. Non-mutating — original object is
 * untouched.
 *
 * Behavior:
 *   - If redactKeys is undefined or empty, returns the original object
 *     reference (no copy made — performance optimization for the common case).
 *   - Keys in redactKeys that are NOT present in namedParams are silently
 *     ignored (no errors thrown, no spurious '[REDACTED]' entries created).
 *   - Only keys with primitive string values are redacted (the namedParams
 *     contract is Record<string, string>).
 *
 * @param namedParams - The original named parameters as passed to sendNotification.
 * @param redactKeys - Optional list of keys whose values should be masked.
 * @returns A namedParams-shaped object safe to write to communication_logs.
 *
 * @example
 *   redactNamedParams({ otp: '123456', name: 'Amit' }, ['otp'])
 *   // → { otp: '[REDACTED]', name: 'Amit' }
 *
 *   redactNamedParams({ otp: '123456' }, undefined)
 *   // → { otp: '123456' } (same reference, no copy)
 *
 *   redactNamedParams({ name: 'Amit' }, ['otp'])
 *   // → { name: 'Amit' } (otp not present, no spurious entry)
 */
export function redactNamedParams(
  namedParams: Record<string, string>,
  redactKeys?: string[],
): Record<string, string> {
  if (!redactKeys || redactKeys.length === 0) return namedParams;

  const safeParams: Record<string, string> = { ...namedParams };
  for (const key of redactKeys) {
    if (key in safeParams) {
      safeParams[key] = REDACTION_SENTINEL;
    }
  }
  return safeParams;
}
