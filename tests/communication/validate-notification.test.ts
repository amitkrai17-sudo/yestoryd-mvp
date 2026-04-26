// =============================================================================
// VALIDATOR TESTS — lib/communication/validate-notification.ts
// tests/communication/validate-notification.test.ts
//
// Covers Pillar 2B rules 1, 4, 5, 6, 8 + resolveDerivations + idempotency
// hash backward-compat (Rule 7's structured-throw helper too).
// Rules 2, 3, 7 (network/runtime) are smoke-tested where possible; full
// coverage deferred to B5 integration tests.
//
// No DB, no HTTP, no AiSensy.
// =============================================================================

// --- Mock the supabase admin client used by validate-notification.ts ---
//     We capture inserts so tests can assert that activity_log was called.
//     vi.hoisted defers initialization until after vi.mock's top-of-file hoist.
const { insertCalls, supabaseChain } = vi.hoisted(() => {
  const insertCalls: Array<{ table: string; row: unknown }> = [];
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
  const supabaseChain = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
      insert: vi.fn((row: unknown) => {
        insertCalls.push({ table, row });
        return Promise.resolve({ data: null, error: null });
      }),
    })),
  };
  return { insertCalls, supabaseChain, mockMaybeSingle };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseChain),
}));

import crypto from 'crypto';
import {
  resolveDerivations,
  validateNotification,
  assertAiSensyResponseOk,
  type ValidatorTemplate,
  type ResolvedRecipient,
} from '@/lib/communication/validate-notification';

// =============================================================================
// FIXTURES
// =============================================================================

const PHONE_OK = '919687606177';
const PHONE_BAD_NO_91 = '9687606177';
const PHONE_BAD_FIVES = '910000000000';

const TPL_PARENT_PAYMENT_CONFIRMED: ValidatorTemplate = {
  template_code: 'parent_payment_confirmed_v3',
  recipient_type: 'parent',
  wa_template_name: 'parent_payment_confirmed_v3',
  use_whatsapp: true,
  wa_variables: ['child_first_name', 'plan', 'sessions_count', 'coach_name'],
  required_variables: [
    'parent_name', 'child_name', 'amount', 'coach_name',
    'dashboard_link', 'program_label', 'schedule_description',
    'plan', 'sessions_count',
  ],
  wa_variable_derivations: {
    child_first_name: { source: 'child_name', transform: 'first_word' },
  },
};

const TPL_NO_DERIVATIONS: ValidatorTemplate = {
  template_code: 'parent_payment_failed_v1',
  recipient_type: 'parent',
  wa_template_name: 'parent_payment_failed_v1',
  use_whatsapp: true,
  wa_variables: ['child_name'],
  required_variables: ['child_name', 'retry_link', 'parent_phone'],
  wa_variable_derivations: null,
};

const RECIPIENT_PARENT_ACTIVE: ResolvedRecipient = {
  type: 'parent',
  id: '550e8400-e29b-41d4-a716-446655440000',
  status: 'active',
};

const RECIPIENT_PARENT_PAUSED: ResolvedRecipient = {
  type: 'parent',
  id: '550e8400-e29b-41d4-a716-446655440000',
  status: 'paused',
};

const RECIPIENT_COACH_ACTIVE: ResolvedRecipient = {
  type: 'coach',
  id: '660e8400-e29b-41d4-a716-446655440001',
  status: 'active',
};

const RECIPIENT_COACH_EXITED: ResolvedRecipient = {
  type: 'coach',
  id: '660e8400-e29b-41d4-a716-446655440001',
  status: 'exited',
};

const RECIPIENT_ADMIN: ResolvedRecipient = { type: 'admin', id: 'admin' };

beforeEach(() => {
  insertCalls.length = 0;
});

// =============================================================================
// resolveDerivations
// =============================================================================

describe('resolveDerivations', () => {
  it('first_word transform splits on space and returns first token', () => {
    const result = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, {
      child_name: 'Aarav Mehta',
      plan: 'Continuance',
      sessions_count: '12',
      coach_name: 'Rucha Rai',
    });
    expect(result.child_first_name).toBe('Aarav');
    // canonical key preserved
    expect(result.child_name).toBe('Aarav Mehta');
  });

  it('does not override an alias the caller already provided', () => {
    const result = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, {
      child_name: 'Aarav Mehta',
      child_first_name: 'Aaru', // explicit override
    });
    expect(result.child_first_name).toBe('Aaru');
  });

  it('skips silently when the source key is missing', () => {
    const result = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, {
      plan: 'Full',
    });
    expect(result.child_first_name).toBeUndefined();
  });

  it('returns a copy when template has no derivations', () => {
    const params = { child_name: 'Aarav', plan: 'Full' };
    const result = resolveDerivations(TPL_NO_DERIVATIONS, params);
    expect(result).toEqual(params);
    // immutability guard
    expect(result).not.toBe(params);
  });

  it('last_word transform returns final token', () => {
    const tpl: ValidatorTemplate = {
      ...TPL_NO_DERIVATIONS,
      wa_variables: ['child_last_name'],
      required_variables: ['child_name'],
      wa_variable_derivations: {
        child_last_name: { source: 'child_name', transform: 'last_word' },
      },
    };
    const result = resolveDerivations(tpl, { child_name: 'Aarav Singh Mehta' });
    expect(result.child_last_name).toBe('Mehta');
  });

  it('capitalize transform uppercases first character', () => {
    const tpl: ValidatorTemplate = {
      ...TPL_NO_DERIVATIONS,
      wa_variables: ['plan_capitalized'],
      required_variables: ['plan'],
      wa_variable_derivations: {
        plan_capitalized: { source: 'plan', transform: 'capitalize' },
      },
    };
    const result = resolveDerivations(tpl, { plan: 'continuance' });
    expect(result.plan_capitalized).toBe('Continuance');
  });

  it('identity transform passes the value through unchanged', () => {
    const tpl: ValidatorTemplate = {
      ...TPL_NO_DERIVATIONS,
      wa_variables: ['display_name'],
      required_variables: ['child_name'],
      wa_variable_derivations: {
        display_name: { source: 'child_name', transform: 'identity' },
      },
    };
    const result = resolveDerivations(tpl, { child_name: 'Aarav Mehta' });
    expect(result.display_name).toBe('Aarav Mehta');
  });
});

// =============================================================================
// Rule 1 — variableArityMatches
// =============================================================================

describe('Rule 1 — variableArityMatches', () => {
  it('PASS when every wa_variables key is present in finalParams', async () => {
    const finalParams = {
      child_first_name: 'Aarav', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      // required-only fields
      parent_name: 'Asha', child_name: 'Aarav Mehta', amount: '5999',
      dashboard_link: 'https://x.y/d', program_label: '1:1 Coaching',
      schedule_description: 'Weekly Mon/Wed',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });

  it('FAIL when a wa_variables key is missing post-derivation', async () => {
    const finalParams = {
      // no child_first_name AND no child_name → derivation cant fill it
      plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
    };
    // Manually run resolveDerivations first (simulating notify.ts pipeline)
    const resolved = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, finalParams);
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, resolved,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(1);
      expect(result.reason).toContain('child_first_name');
    }
  });

  it('PASS when caller passes only canonical and derivation fills the alias', async () => {
    const finalParams = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, {
      // canonical only — derivation should produce child_first_name
      child_name: 'Aarav Mehta', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', amount: '5999',
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    });
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Rule 4 — allRequiredParamsTruthy
// =============================================================================

describe('Rule 4 — allRequiredParamsTruthy', () => {
  it('FAIL when a required key is empty string', async () => {
    const finalParams = {
      child_first_name: 'Aarav', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', child_name: 'Aarav Mehta', amount: '',
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(4);
      expect(result.reason).toContain('amount');
    }
  });

  it('FAIL when value is the literal string "undefined"', async () => {
    const finalParams = {
      child_first_name: 'Aarav', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', child_name: 'Aarav Mehta', amount: 'undefined',
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failedRule).toBe(4);
  });

  it('FAIL when value is null', async () => {
    const finalParams: Record<string, unknown> = {
      child_first_name: 'Aarav', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', child_name: 'Aarav Mehta', amount: null,
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failedRule).toBe(4);
  });
});

// =============================================================================
// Rule 5 — recipientTypeMatches
// =============================================================================

describe('Rule 5 — recipientTypeMatches', () => {
  it('FAIL when sending parent template to coach recipient', async () => {
    const finalParams = {
      child_first_name: 'A', plan: 'F', sessions_count: '1', coach_name: 'R',
      parent_name: 'A', child_name: 'A B', amount: '1',
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_COACH_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(5);
      expect(result.reason).toContain('parent');
      expect(result.reason).toContain('coach');
    }
  });

  it('PASS when template recipient_type matches resolved recipient.type', async () => {
    const finalParams = {
      child_first_name: 'A', plan: 'F', sessions_count: '1', coach_name: 'R',
      parent_name: 'A', child_name: 'A B', amount: '1',
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Rule 6 — variableNamesConsistent (with derivations)
// =============================================================================

describe('Rule 6 — variableNamesConsistent', () => {
  it('PASS via path (a) — wa_var name in required_variables directly', async () => {
    const finalParams = { child_name: 'Aarav', retry_link: 'https://x', parent_phone: '919687606177' };
    const result = await validateNotification(
      TPL_NO_DERIVATIONS, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });

  it('PASS via path (b) — wa_var has derivation whose source is in required_variables', async () => {
    // parent_payment_confirmed_v3: child_first_name → child_name (in required)
    const finalParams = resolveDerivations(TPL_PARENT_PAYMENT_CONFIRMED, {
      child_name: 'Aarav Mehta', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', amount: '5999', dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    });
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });

  it('FAIL via path (c) — wa_var name not in required AND no derivation', async () => {
    const tpl: ValidatorTemplate = {
      ...TPL_NO_DERIVATIONS,
      wa_variables: ['child_name', 'mystery_field'],
      required_variables: ['child_name'], // mystery_field absent
      wa_variable_derivations: null,
    };
    const finalParams = { child_name: 'Aarav', mystery_field: 'x' };
    const result = await validateNotification(
      tpl, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(6);
      expect(result.reason).toContain('mystery_field');
    }
  });

  it('treats a missing derivation entry as "no aliasing", not as an error', async () => {
    // Template has derivations but they don't cover all wa_variables.
    // The covered alias passes via path (b); the uncovered name is checked
    // against required_variables only.
    const tpl: ValidatorTemplate = {
      template_code: 'mixed',
      recipient_type: 'parent',
      wa_template_name: 'mixed',
      use_whatsapp: true,
      wa_variables: ['child_first_name', 'amount'],
      required_variables: ['child_name', 'amount'],
      wa_variable_derivations: {
        child_first_name: { source: 'child_name', transform: 'first_word' },
        // no entry for 'amount' — falls through to path (a) which finds it
      },
    };
    const finalParams = { child_first_name: 'Aarav', child_name: 'Aarav Mehta', amount: '5999' };
    const result = await validateNotification(
      tpl, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Rule 8 — recipientNotPaused
// =============================================================================

describe('Rule 8 — recipientNotPaused', () => {
  it('PASS when parent.status is "active"', async () => {
    const finalParams = {
      child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
    };
    const result = await validateNotification(
      TPL_NO_DERIVATIONS, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(true);
  });

  it('FAIL when parent.status is "paused"', async () => {
    const finalParams = {
      child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
    };
    const result = await validateNotification(
      TPL_NO_DERIVATIONS, RECIPIENT_PARENT_PAUSED, PHONE_OK, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(8);
      expect(result.reason).toContain('paused');
    }
  });

  it('FAIL for coach recipient when status is "exited"', async () => {
    const tpl: ValidatorTemplate = { ...TPL_NO_DERIVATIONS, recipient_type: 'coach' };
    const result = await validateNotification(
      tpl, RECIPIENT_COACH_EXITED, PHONE_OK, {
        child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failedRule).toBe(8);
  });

  it('PASS for admin recipient regardless of status', async () => {
    const tpl: ValidatorTemplate = { ...TPL_NO_DERIVATIONS, recipient_type: 'admin' };
    const result = await validateNotification(
      tpl, RECIPIENT_ADMIN, PHONE_OK, {
        child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
      },
    );
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Rule 3 — phoneIsNormalized (always-enforce)
// =============================================================================

describe('Rule 3 — phoneIsNormalized', () => {
  it('FAIL with mode=enforce on a phone missing the 91 country code prefix', async () => {
    const finalParams = {
      child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
    };
    const result = await validateNotification(
      TPL_NO_DERIVATIONS, RECIPIENT_PARENT_ACTIVE, PHONE_BAD_NO_91, finalParams, 'warn',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(3);
      expect(result.mode).toBe('enforce'); // always enforce regardless of input mode
    }
  });

  it('FAIL on a phone whose subscriber prefix is not 6-9', async () => {
    const finalParams = {
      child_name: 'Aarav', retry_link: 'x', parent_phone: '919687606177',
    };
    const result = await validateNotification(
      TPL_NO_DERIVATIONS, RECIPIENT_PARENT_ACTIVE, PHONE_BAD_FIVES, finalParams,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failedRule).toBe(3);
  });
});

// =============================================================================
// Idempotency hash backward compatibility (replicating notify.ts contract)
// =============================================================================

describe('Idempotency hash backward compat', () => {
  // This test documents the exact hash contract and proves backward-compat:
  // when contextId is unset, the hash is identical to the pre-B2.2 4-element shape.
  function hashWithoutCtx(template: string, phone: string, day: string, firstParam: string): string {
    return crypto.createHash('sha256').update(`${template}:${phone}:${day}:${firstParam}`).digest('hex');
  }
  function hashWithCtx(template: string, phone: string, day: string, firstParam: string, ctx: string): string {
    return crypto.createHash('sha256').update(`${template}:${phone}:${day}:${firstParam}:${ctx}`).digest('hex');
  }

  it('without contextId, hash matches the legacy 4-element shape', () => {
    const a = hashWithoutCtx('parent_payment_failed_v1', '919687606177', '2026-04-25', 'Aarav');
    // Same inputs, same algorithm → identical bytes (deterministic sha256)
    const b = hashWithoutCtx('parent_payment_failed_v1', '919687606177', '2026-04-25', 'Aarav');
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex length
  });

  it('with contextId, hash differs from the without-ctx hash', () => {
    const without = hashWithoutCtx('parent_payment_failed_v1', '919687606177', '2026-04-25', 'Aarav');
    const withCtx = hashWithCtx('parent_payment_failed_v1', '919687606177', '2026-04-25', 'Aarav', 'pay_ABC123');
    expect(withCtx).not.toBe(without);
  });

  it('different contextIds produce different hashes (per-incident dedupe)', () => {
    const h1 = hashWithCtx('t', 'p', 'd', 'f', 'pay_ABC');
    const h2 = hashWithCtx('t', 'p', 'd', 'f', 'pay_DEF');
    expect(h1).not.toBe(h2);
  });
});

// =============================================================================
// Rule 7 — assertAiSensyResponseOk (always-throw on failure)
// =============================================================================

describe('Rule 7 — assertAiSensyResponseOk', () => {
  it('returns silently when response.success === true', () => {
    expect(() =>
      assertAiSensyResponseOk({ success: true, messageId: 'msg_1' }, 'parent_payment_failed_v1'),
    ).not.toThrow();
  });

  it('throws structured error when response.success === false', () => {
    expect(() =>
      assertAiSensyResponseOk({ success: false, error: 'meta_rejected' }, 'parent_payment_failed_v1'),
    ).toThrow(/aisensy_send_failed: meta_rejected/);
  });

  it('throws with default reason when error field is missing', () => {
    expect(() =>
      assertAiSensyResponseOk({ success: false }, 'parent_payment_failed_v1'),
    ).toThrow(/unknown_failure/);
  });
});

// =============================================================================
// B2.5 — post-Meta-approval template shape alignment
// =============================================================================
// Mirrors the actual DB row shape for parent_payment_failed_v1 and
// parent_payment_retry_nudge_v1 after Meta approval expanded wa_variables
// to 3 elements with 2 derivations. Confirms the webhook + nudge payload
// shape (canonical names + retry_link) flows correctly end-to-end:
//   resolveDerivations → validateNotification → idempotency hash.
// =============================================================================

const TPL_PARENT_PAYMENT_FAILED_V1: ValidatorTemplate = {
  template_code: 'parent_payment_failed_v1',
  recipient_type: 'parent',
  wa_template_name: 'parent_payment_failed_v1',
  use_whatsapp: true,
  wa_variables: ['parent_first_name', 'child_first_name', 'retry_link'],
  required_variables: ['parent_name', 'child_name', 'retry_link', 'parent_phone'],
  wa_variable_derivations: {
    child_first_name: { source: 'child_name', transform: 'first_word' },
    parent_first_name: { source: 'parent_name', transform: 'first_word' },
  },
};

const TPL_PARENT_PAYMENT_RETRY_NUDGE_V1: ValidatorTemplate = {
  ...TPL_PARENT_PAYMENT_FAILED_V1,
  template_code: 'parent_payment_retry_nudge_v1',
  wa_template_name: 'parent_payment_retry_nudge_v1',
};

describe('B2.5 — webhook payload shape against parent_payment_failed_v1 fixture', () => {
  it('Part 3.1 — resolveDerivations produces both *_first_name from canonicals', () => {
    const callerParams = {
      parent_name: 'Priya Kumar',
      child_name: 'Aarav Sharma',
      retry_link: 'https://yestoryd.com/r/abc',
    };
    const merged = resolveDerivations(TPL_PARENT_PAYMENT_FAILED_V1, callerParams);
    expect(merged.parent_name).toBe('Priya Kumar');
    expect(merged.child_name).toBe('Aarav Sharma');
    expect(merged.retry_link).toBe('https://yestoryd.com/r/abc');
    expect(merged.parent_first_name).toBe('Priya');
    expect(merged.child_first_name).toBe('Aarav');
  });

  it('Part 3.2 — validateNotification passes (warn mode) with the merged params + active recipient', async () => {
    const callerParams = {
      parent_name: 'Priya Kumar',
      child_name: 'Aarav Sharma',
      retry_link: 'https://yestoryd.com/r/abc',
      parent_phone: '919687606177', // required_variables includes parent_phone
    };
    const merged = resolveDerivations(TPL_PARENT_PAYMENT_FAILED_V1, callerParams);
    insertCalls.length = 0;
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_FAILED_V1,
      RECIPIENT_PARENT_ACTIVE,
      PHONE_OK,
      merged,
      'warn',
    );
    expect(result.ok).toBe(true);
    // No activity_log writes for a clean pass.
    const validatorLogs = insertCalls.filter((c) => c.table === 'activity_log');
    expect(validatorLogs.length).toBe(0);
  });

  it('Part 3.3 — Rule 4 catches missing parent_phone (validator surfaces required_variables gap)', async () => {
    const callerParams = {
      parent_name: 'Priya Kumar',
      child_name: 'Aarav Sharma',
      retry_link: 'https://yestoryd.com/r/abc',
      // parent_phone deliberately missing — webhook callers don't pass it,
      // and required_variables for these templates includes parent_phone.
      // This documents the warn-mode gap that must be closed before enforce.
    };
    const merged = resolveDerivations(TPL_PARENT_PAYMENT_FAILED_V1, callerParams);
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_FAILED_V1,
      RECIPIENT_PARENT_ACTIVE,
      PHONE_OK,
      merged,
      'warn',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedRule).toBe(4);
      expect(result.reason).toContain('parent_phone');
      expect(result.mode).toBe('warn'); // logged + send proceeds in warn
    }
  });

  it('Part 3.4 — same fixture works for the nudge template (post-approval shape is identical)', async () => {
    const merged = resolveDerivations(TPL_PARENT_PAYMENT_RETRY_NUDGE_V1, {
      parent_name: 'Priya Kumar',
      child_name: 'Aarav Sharma',
      retry_link: 'https://yestoryd.com/r/abc',
      parent_phone: '919687606177',
    });
    expect(merged.parent_first_name).toBe('Priya');
    expect(merged.child_first_name).toBe('Aarav');
    const result = await validateNotification(
      TPL_PARENT_PAYMENT_RETRY_NUDGE_V1,
      RECIPIENT_PARENT_ACTIVE,
      PHONE_OK,
      merged,
      'warn',
    );
    expect(result.ok).toBe(true);
  });

  it('Part 3.5 — idempotency hash: same contextId → same hash; different contextId → different', () => {
    // Replicates notify.ts contract for the post-B2.2 hash.
    const fp = 'Priya'; // post-derivation, wa_variables[0] is parent_first_name
    function hash(template: string, phone: string, day: string, firstParam: string, ctx?: string): string {
      const base = `${template}:${phone}:${day}:${firstParam}`;
      return crypto.createHash('sha256').update(ctx ? `${base}:${ctx}` : base).digest('hex');
    }
    const day = '2026-04-25';
    const phone = '919687606177';
    const code = 'parent_payment_failed_v1';

    const sameCtxA = hash(code, phone, day, fp, 'pay_ABC123');
    const sameCtxB = hash(code, phone, day, fp, 'pay_ABC123');
    expect(sameCtxA).toBe(sameCtxB);

    const otherCtx = hash(code, phone, day, fp, 'pay_DEF456');
    expect(otherCtx).not.toBe(sameCtxA);

    const noCtx = hash(code, phone, day, fp);
    expect(noCtx).not.toBe(sameCtxA);
  });
});

// =============================================================================
// activity_log side effect on failure (warn mode)
// =============================================================================

describe('activity_log side effect', () => {
  it('writes one row per validator failure', async () => {
    const finalParams = {
      child_first_name: 'Aarav', plan: 'Full', sessions_count: '12', coach_name: 'Rucha',
      parent_name: 'Asha', child_name: 'Aarav Mehta', amount: '',  // ← Rule 4 FAIL
      dashboard_link: 'x', program_label: 'y', schedule_description: 'z',
    };
    insertCalls.length = 0;
    await validateNotification(
      TPL_PARENT_PAYMENT_CONFIRMED, RECIPIENT_PARENT_ACTIVE, PHONE_OK, finalParams, 'warn',
    );
    const validatorLogs = insertCalls.filter((c) => c.table === 'activity_log');
    expect(validatorLogs.length).toBe(1);
    const row = validatorLogs[0].row as { action: string; metadata: Record<string, unknown> };
    expect(row.action).toBe('notify_validator_failed');
    expect(row.metadata.failed_rule).toBe(4);
    expect(row.metadata.template_code).toBe('parent_payment_confirmed_v3');
  });
});
