// =============================================================================
// CHANNEL-ROUTING TESTS — lib/communication/index.ts (sendCommunication)
// tests/communication/index.test.ts
//
// Block PIPELINE-UNLOCK coverage: the channel-aware WA branch added to the
// private sendWhatsAppToRecipient wrapper. Confirms that:
//   T1 — channel='leadbot' routes to sendLeadBotMessage (with isDryRun:false)
//   T2 — channel='aisensy' routes to sendWhatsAppMessage
//   T3 — channel null/undefined preserves the legacy AiSensy default
//   T4 — Pattern B derivation fires (canonical child_name → derived
//        child_first_name in the positional array)
//
// Mocking strategy mirrors leadbot.test.ts / validate-notification.test.ts:
//   - vi.mock('@/lib/supabase/admin') — supplies the template row that
//     sendCommunication loads via .from('communication_templates').select('*').
//   - vi.mock('@/lib/communication/leadbot' | '/aisensy') — capture which
//     adapter the WA branch dispatches to. isWhatsAppConfigured()=true so the
//     aisensy branch does not early-exit.
//   - vi.mock('@/lib/email/resend-client') — keeps the email leg inert.
//
// No DB, no HTTP, no real adapters. Tests must run offline.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mock state. vi.hoisted runs before any vi.mock calls. ---
const {
  templateHolder,
  supabaseChain,
  sendLeadBotMock,
  sendWhatsAppMock,
  isWhatsAppConfiguredMock,
  sendEmailMock,
} = vi.hoisted(() => {
  // Per-test template row; each test assigns templateHolder.current before
  // calling sendCommunication. The chainable query stub returns it on .single().
  const templateHolder: { current: any } = { current: null };

  const makeQuery = () => {
    const q: any = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      limit: vi.fn(() => q),
      single: vi.fn(() => Promise.resolve({ data: templateHolder.current, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: templateHolder.current, error: null })),
    };
    return q;
  };
  const supabaseChain = { from: vi.fn(() => makeQuery()) };

  const okResult = { success: true, messageId: 'mock-msg-id-123' };
  const sendLeadBotMock = vi.fn().mockResolvedValue(okResult);
  const sendWhatsAppMock = vi.fn().mockResolvedValue(okResult);
  const isWhatsAppConfiguredMock = vi.fn().mockReturnValue(true);
  const sendEmailMock = vi.fn().mockResolvedValue({ success: true, messageId: 'mock-email-id' });

  return {
    templateHolder,
    supabaseChain,
    sendLeadBotMock,
    sendWhatsAppMock,
    isWhatsAppConfiguredMock,
    sendEmailMock,
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseChain),
}));

vi.mock('@/lib/communication/leadbot', () => ({
  sendLeadBotMessage: sendLeadBotMock,
}));

vi.mock('@/lib/communication/aisensy', () => ({
  sendWhatsAppMessage: sendWhatsAppMock,
  isWhatsAppConfigured: isWhatsAppConfiguredMock,
}));

vi.mock('@/lib/email/resend-client', () => ({
  sendEmail: sendEmailMock,
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

import { sendCommunication } from '@/lib/communication';

// =============================================================================
// FIXTURES
// =============================================================================

const PHONE_OK = '+919687606177';

// Minimal communication_templates row satisfying index.ts's reads. use_email
// is false so the email leg is skipped and only WA routing is exercised.
const BASE_TEMPLATE = {
  template_code: 'parent_payment_confirmed_v3',
  recipient_type: 'parent',
  wa_template_name: 'parent_payment_confirmed_v3',
  use_whatsapp: true,
  use_email: false,
  is_active: true,
  language_code: 'en',
  wa_variables: ['child_first_name'],
  required_variables: ['child_name'],
  wa_variable_derivations: {
    child_first_name: { source: 'child_name', transform: 'first_word' },
  },
  channel: 'leadbot',
};

// Canonical-only caller payload. Caller passes child_name; the DB-declared
// derivation produces child_first_name server-side (Pattern B).
const CALLER_PARAMS = {
  templateCode: 'parent_payment_confirmed_v3',
  recipientType: 'parent' as const,
  recipientPhone: PHONE_OK,
  variables: { child_name: 'Shloka Vavia' },
};

// =============================================================================
// TESTS
// =============================================================================

describe('sendCommunication — channel-aware WA routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isWhatsAppConfiguredMock.mockReturnValue(true);
  });

  it('T1 — channel="leadbot" routes to sendLeadBotMessage, not sendWhatsAppMessage', async () => {
    templateHolder.current = { ...BASE_TEMPLATE, channel: 'leadbot' };

    await sendCommunication(CALLER_PARAMS);

    expect(sendLeadBotMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMock).not.toHaveBeenCalled();

    const [waParams, options] = sendLeadBotMock.mock.calls[0];
    expect(waParams.templateName).toBe('parent_payment_confirmed_v3');
    expect(waParams.languageCode).toBe('en');
    expect(options).toEqual({ isDryRun: false });
  });

  it('T2 — channel="aisensy" routes to sendWhatsAppMessage, not sendLeadBotMessage', async () => {
    templateHolder.current = { ...BASE_TEMPLATE, channel: 'aisensy' };

    await sendCommunication(CALLER_PARAMS);

    expect(sendWhatsAppMock).toHaveBeenCalledTimes(1);
    expect(sendLeadBotMock).not.toHaveBeenCalled();

    const [waParams] = sendWhatsAppMock.mock.calls[0];
    expect(waParams.templateName).toBe('parent_payment_confirmed_v3');
  });

  it('T3 — channel null/undefined preserves the legacy AiSensy default', async () => {
    templateHolder.current = { ...BASE_TEMPLATE, channel: null };

    await sendCommunication(CALLER_PARAMS);

    expect(sendWhatsAppMock).toHaveBeenCalledTimes(1);
    expect(sendLeadBotMock).not.toHaveBeenCalled();
  });

  it('T4 — Pattern B: canonical child_name derives child_first_name into the positional array', async () => {
    templateHolder.current = { ...BASE_TEMPLATE, channel: 'leadbot' };

    // Caller passes ONLY child_name — never child_first_name.
    await sendCommunication({
      ...CALLER_PARAMS,
      variables: { child_name: 'Shloka Vavia' },
    });

    expect(sendLeadBotMock).toHaveBeenCalledTimes(1);
    const [waParams] = sendLeadBotMock.mock.calls[0];
    expect(waParams.variables).toEqual(['Shloka']);
  });
});
