// =============================================================================
// NOTIFY STEP 5 DEFERRAL ENVELOPE TESTS — lib/communication/notify.ts
// tests/communication/notify-defer-envelope.test.ts
//
// DRAIN-2C-FIX A+ coverage: when sendNotification is called within quiet hours,
// STEP 5 inserts a row into communication_queue. The envelope MUST carry
// templateButtons (with button TITLES intact, byte-for-byte) and the original
// caller's contextType / contextId so the drained re-send preserves the
// two-way parent loop and the per-incident idempotency key.
//
// Time pin: 22:00 IST = 16:30 UTC, inside the default quiet window
// (21:00-08:00 IST) so STEP 5 deferral fires.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state — vi.mock factories reference it.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  template: null as any,
  queueInsertPayload: null as any,
  dailyCapCount: 0,
}));

const supabaseMock = vi.hoisted(() => {
  const makeChain = (table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      in:     vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      is:     vi.fn(() => chain),
      not:    vi.fn(() => chain),
      lte:    vi.fn(() => chain),
      lt:     vi.fn(() => chain),
      gt:     vi.fn(() => chain),
      neq:    vi.fn(() => chain),
      or:     vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => chain),
      single:      vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      // .insert(payload).select('id') — capture payload, return inserted-row id
      insert: vi.fn((payload: any) => {
        if (table === 'communication_queue') {
          state.queueInsertPayload = payload;
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'q-fixture' }], error: null })),
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      // Awaited shape — table-aware
      then: (resolve: (v: any) => any) => {
        if (table === 'communication_templates') {
          return resolve({ data: [state.template], error: null });
        }
        if (table === 'communication_logs') {
          // STEP 4 daily cap query awaits this chain — returns count
          return resolve({ data: null, error: null, count: state.dailyCapCount });
        }
        if (table === 'site_settings') {
          // loadEngineSettings — empty array → falls back to defaults
          return resolve({ data: [], error: null });
        }
        return resolve({ data: null, error: null });
      },
    };
    return chain;
  };
  return {
    from: vi.fn((table: string) => makeChain(table)),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseMock),
}));

vi.mock('@/lib/communication/log', () => ({
  logCommunication: vi.fn(async () => 'log-fixture-id'),
}));

vi.mock('@/lib/communication/leadbot', () => ({
  sendLeadBotMessage: vi.fn(async () => ({ success: true, messageId: 'm-1' })),
}));

vi.mock('@/lib/communication/aisensy', () => ({
  sendWhatsAppMessage: vi.fn(async () => ({ success: true, messageId: 'm-1' })),
  isWhatsAppConfigured: vi.fn(() => true),
}));

import { sendNotification } from '@/lib/communication/notify';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEMPLATE: any = {
  template_code: 'parent_renewal_intent_v1',
  recipient_type: 'parent',                  // not 'admin' → quiet-hours applies
  wa_template_name: 'parent_renewal_intent_v1',
  wa_template_category: 'marketing',         // not 'authentication' → quiet applies
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

const RENEWAL_PAYLOADS = [
  { id: 'btn_renew_yes',   title: 'Yes, renew' },
  { id: 'btn_renew_pause', title: 'Pause for now' },
  { id: 'btn_renew_talk',  title: 'Talk to coach' },
];

const PHONE = '919687606177';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('notify.ts STEP 5 deferral envelope (DRAIN-2C-FIX A+)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.template = TEMPLATE;
    state.queueInsertPayload = null;
    state.dailyCapCount = 0;
    // 22:00 IST = 16:30 UTC — inside default quiet window (21:00-08:00 IST)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T16:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('T1: defers with templateButtons → envelope._meta.templateButtons carries every TITLE verbatim', async () => {
    const result = await sendNotification(
      'parent_renewal_intent_v1',
      PHONE,
      { parent_name: 'Amit Kumar Rai', child_name: 'Ira Rai' },
      {
        templateButtons: {
          category: 'marketing_quick_reply',
          payloads: RENEWAL_PAYLOADS,
        },
        triggeredBy: 'system',
      },
    );

    expect(result.deferred).toBe(true);
    expect(result.reason).toBe('deferred_quiet_hours');

    const payload = state.queueInsertPayload;
    expect(payload).not.toBeNull();
    expect(payload.status).toBe('pending');

    const meta = payload.variables._meta;
    expect(meta.templateButtons).toEqual({
      category: 'marketing_quick_reply',
      payloads: RENEWAL_PAYLOADS,
    });
    // Title-fidelity round-trip — this is the objective.
    // Every button TITLE field must equal the input verbatim.
    expect(meta.templateButtons.payloads[0].title).toBe('Yes, renew');
    expect(meta.templateButtons.payloads[1].title).toBe('Pause for now');
    expect(meta.templateButtons.payloads[2].title).toBe('Talk to coach');
  });

  it('T5: defers with contextType + contextId → envelope._meta carries both verbatim', async () => {
    const result = await sendNotification(
      'parent_renewal_intent_v1',
      PHONE,
      { parent_name: 'Amit', child_name: 'Ira' },
      {
        contextType: 'enrollment',
        contextId: 'enr-uuid-123',
        triggeredBy: 'system',
      },
    );

    expect(result.deferred).toBe(true);

    const meta = state.queueInsertPayload.variables._meta;
    expect(meta.contextType).toBe('enrollment');
    expect(meta.contextId).toBe('enr-uuid-123');
  });
});
