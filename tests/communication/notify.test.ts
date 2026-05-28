// =============================================================================
// NOTIFY TESTS — lib/communication/notify.ts
// tests/communication/notify.test.ts
//
// Regression coverage for B3-VALIDATOR-FIX: resolveDerivations() now runs
// BEFORE STEP 2's wa_variables presence check, so Pattern B callers (who
// pass canonical names like parent_name) are not rejected as
// 'missing_params'.
//
// Mock surface mirrors tests/communication/index.test.ts:
//   - @/lib/supabase/admin    — chainable query stub; resolves to fixture row
//   - @/lib/communication/leadbot   — captures the positional args passed
//   - @/lib/communication/aisensy   — same; only the leadbot path is exercised
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mock state ---
const {
  templateHolder,
  supabaseChain,
  sendLeadBotMock,
  sendWhatsAppMock,
} = vi.hoisted(() => {
  const templateHolder: { current: any } = { current: null };

  // Permissive thenable chain — every method returns the chain itself, terminal
  // resolvers (.single/.maybeSingle/.then) resolve based on the active table.
  const makeQuery = () => {
    let activeTable = '';
    const q: any = {
      _setTable(t: string) { activeTable = t; return q; },
      select: vi.fn(() => q),
      insert: vi.fn(() => q),
      update: vi.fn(() => q),
      eq: vi.fn(() => q),
      neq: vi.fn(() => q),
      in: vi.fn(() => q),
      is: vi.fn(() => q),
      not: vi.fn(() => q),
      gte: vi.fn(() => q),
      lte: vi.fn(() => q),
      gt: vi.fn(() => q),
      lt: vi.fn(() => q),
      ilike: vi.fn(() => q),
      or: vi.fn(() => q),
      order: vi.fn(() => q),
      limit: vi.fn(() => q),
      single: vi.fn(() => {
        if (activeTable === 'communication_templates') {
          return Promise.resolve({ data: templateHolder.current, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      // Awaited shape — table-aware. communication_templates SELECT chain
      // uses .limit(1) then awaits, so the await must yield rows[0]=template.
      then: (resolve: (v: any) => any) => {
        if (activeTable === 'communication_templates') {
          return resolve({ data: [templateHolder.current], error: null });
        }
        return resolve({ data: null, error: null, count: 0 });
      },
    };
    return q;
  };

  const supabaseChain = {
    from: vi.fn((table: string) => makeQuery()._setTable(table)),
  };

  const okResult = { success: true, messageId: 'mock-msg-id' };
  const sendLeadBotMock = vi.fn().mockResolvedValue(okResult);
  const sendWhatsAppMock = vi.fn().mockResolvedValue(okResult);

  return { templateHolder, supabaseChain, sendLeadBotMock, sendWhatsAppMock };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseChain),
}));

vi.mock('@/lib/communication/leadbot', () => ({
  sendLeadBotMessage: sendLeadBotMock,
}));

vi.mock('@/lib/communication/aisensy', () => ({
  sendWhatsAppMessage: sendWhatsAppMock,
  isWhatsAppConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/config/site-settings-loader', () => ({
  getSiteSettingBool: vi.fn().mockResolvedValue(true),
}));

import { sendNotification } from '@/lib/communication/notify';

// =============================================================================
// FIXTURES
// =============================================================================

const PHONE_OK = '919687606177';

// Pattern B template: display slots are *_first_name aliases derived from
// canonical *_name source keys. parent_renewal_intent_v1 shape.
const TPL_DERIVED: any = {
  template_code: 'parent_renewal_intent_v1',
  recipient_type: 'parent',
  wa_template_name: 'parent_renewal_intent_v1',
  wa_template_category: 'utility',
  language_code: 'en',
  use_whatsapp: true,
  is_active: true,
  channel: 'leadbot',
  wa_variables: ['parent_first_name', 'child_first_name'],
  required_variables: ['parent_name', 'child_name'],
  wa_variable_derivations: {
    parent_first_name: { source: 'parent_name', transform: 'first_word' },
    child_first_name:  { source: 'child_name',  transform: 'first_word' },
  },
  cost_per_send: 0.12,
};

// =============================================================================
// TESTS
// =============================================================================

describe('notify.ts STEP 2 — Pattern B caller compat (B3-VALIDATOR-FIX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templateHolder.current = TPL_DERIVED;
    // Pin system time to 06:00 UTC = 11:30 IST — outside quiet hours
    // (21:00-08:00 IST) so STEP 5 doesn't defer the test send.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T06:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Pattern B: canonical-only params pass STEP 2 and produce derived positional values', async () => {
    const result = await sendNotification(
      'parent_renewal_intent_v1',
      PHONE_OK,
      {
        parent_name: 'Amit Kumar Rai',
        child_name: 'Ira Rai',
      },
      {
        templateButtons: {
          category: 'marketing_quick_reply',
          payloads: [
            { id: 'btn_renew_yes',   title: 'Yes, renew' },
            { id: 'btn_renew_pause', title: 'Pause for now' },
            { id: 'btn_renew_talk',  title: 'Talk to coach' },
          ],
        },
        triggeredBy: 'system',
      },
    );

    // The critical regression assertion: no missing_params bail
    expect(result.reason).not.toBe('missing_params');
    expect(sendLeadBotMock).toHaveBeenCalledTimes(1);

    const [waParams] = sendLeadBotMock.mock.calls[0];
    expect(waParams.variables).toEqual(['Amit', 'Ira']);
  });

  it('Pattern A: legacy display-name params pass STEP 2 (no derivation needed)', async () => {
    const result = await sendNotification(
      'parent_renewal_intent_v1',
      PHONE_OK,
      {
        parent_first_name: 'Amit',
        child_first_name: 'Ira',
      },
      {
        templateButtons: {
          category: 'marketing_quick_reply',
          payloads: [
            { id: 'btn_renew_yes',   title: 'Yes, renew' },
            { id: 'btn_renew_pause', title: 'Pause for now' },
            { id: 'btn_renew_talk',  title: 'Talk to coach' },
          ],
        },
        triggeredBy: 'system',
      },
    );

    expect(result.reason).not.toBe('missing_params');
    expect(sendLeadBotMock).toHaveBeenCalledTimes(1);

    const [waParams] = sendLeadBotMock.mock.calls[0];
    expect(waParams.variables).toEqual(['Amit', 'Ira']);
  });

  it('Mixed: caller-supplied display value is preserved (derivation does not overwrite)', async () => {
    const result = await sendNotification(
      'parent_renewal_intent_v1',
      PHONE_OK,
      {
        parent_name: 'Amit Kumar Rai',
        parent_first_name: 'EXPLICIT_PARENT',  // caller's explicit value
        child_name: 'Ira Rai',                 // canonical, will be derived
      },
      {
        templateButtons: {
          category: 'marketing_quick_reply',
          payloads: [
            { id: 'btn_renew_yes',   title: 'Yes, renew' },
            { id: 'btn_renew_pause', title: 'Pause for now' },
            { id: 'btn_renew_talk',  title: 'Talk to coach' },
          ],
        },
        triggeredBy: 'system',
      },
    );

    expect(result.reason).not.toBe('missing_params');
    expect(sendLeadBotMock).toHaveBeenCalledTimes(1);

    const [waParams] = sendLeadBotMock.mock.calls[0];
    // parent_first_name preserved as caller passed it; child_first_name derived
    expect(waParams.variables).toEqual(['EXPLICIT_PARENT', 'Ira']);
  });
});
