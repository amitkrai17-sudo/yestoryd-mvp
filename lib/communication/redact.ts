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

/**
 * Returns a positionally-redacted variables array. Used by adapter-side
 * context_data writes where the on-wire variables array (a positional
 * conversion of namedParams) gets logged AS WELL AS sent. The wire send
 * uses the original un-redacted array; the log write uses the result of
 * this function.
 *
 * Mapping logic: redactKeys gives KEY NAMES (e.g. ['otp']). The schema
 * (template.wa_variables) gives the order of those keys in the positional
 * array (e.g. ['otp']). The intersection of the two gives the indices of
 * positional whose values must be replaced with REDACTION_SENTINEL.
 *
 * Behavior:
 *   - If redactKeys is undefined or empty, returns the original positional
 *     array reference (no copy made — performance optimization).
 *   - If schema and positional have mismatched lengths, the function
 *     defensively iterates only over the SHORTER length and ignores the
 *     trailing entries on the longer array (matches notify.ts's existing
 *     graceful handling of derivation drift).
 *   - Schema entries not present in redactKeys leave the corresponding
 *     positional entry untouched.
 *   - Keys in redactKeys that are NOT in schema are silently ignored
 *     (consistent with redactNamedParams).
 *
 * @param positional - The positional variables array (post-derivation,
 *                     post-conversion-from-namedParams). For OTP templates
 *                     this is e.g. ['777934'].
 * @param schema - The wa_variables array from the template row, giving the
 *                 ordered key names (e.g. ['otp']).
 * @param redactKeys - Optional list of keys whose corresponding positional
 *                     entries should be masked.
 * @returns A positional-shaped array safe to write to communication_logs.
 *
 * @example
 *   redactVariables(['777934'], ['otp'], ['otp'])
 *   // → ['[REDACTED]']
 *
 *   redactVariables(['Ira', 'reading session'], ['child_name', 'topic'], ['otp'])
 *   // → ['Ira', 'reading session'] (otp not in schema, no-op)
 *
 *   redactVariables(['777934'], ['otp'], undefined)
 *   // → ['777934'] (same reference, no copy)
 */
export function redactVariables(
  positional: string[],
  schema: string[],
  redactKeys?: string[],
): string[] {
  if (!redactKeys || redactKeys.length === 0) return positional;

  const safePositional: string[] = [...positional];
  const len = Math.min(positional.length, schema.length);
  for (let i = 0; i < len; i++) {
    if (redactKeys.includes(schema[i])) {
      safePositional[i] = REDACTION_SENTINEL;
    }
  }
  return safePositional;
}
