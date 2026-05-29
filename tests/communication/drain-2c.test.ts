// =============================================================================
// DRAIN-2C DRAINER TESTS — app/api/cron/process-deferred-comms/route.ts
// tests/communication/drain-2c.test.ts
//
// DRAIN-2C-FIX A+ coverage for the drainer:
//   T2 — _meta.templateButtons passes through to sendNotification with titles
//        identical to the queued envelope (title-fidelity end-to-end).
//   T3 — success-branch UPDATE writes sent_at alongside processed_at.
//   T4 — regression: row with NO templateButtons drains identically to today
//        (no throw, sendNotification receives templateButtons=undefined).
//   T6 — _meta.contextType + contextId WIN over native columns + cron literal
//        (passes ORIGINAL caller's intent through, strengthens dedup).
//   T7 — _meta lacks context but row.related_entity_* are set → columns used.
//   T8 — neither _meta context nor columns set → 'cron:process-deferred-comms'
//        + null literal (regression-identical to today).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  queueRows: [] as any[],
  updates: [] as Array<{ payload: any; eqId: string }>,
  sendCalls: [] as Array<{
    templateCode: string;
    recipient: string;
    templateVars: Record<string, string>;
    meta: any;
  }>,
  sendNotificationResult: { success: true, logId: 'log-fixture-id' } as any,
}));

const supabaseMock = vi.hoisted(() => {
  const makeChain = (table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      is:     vi.fn(() => chain),
      lte:    vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      lt:     vi.fn(() => chain),
      gt:     vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      neq:    vi.fn(() => chain),
      in:     vi.fn(() => chain),
      not:    vi.fn(() => chain),
      or:     vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => chain),
      returns: vi.fn(() => chain),
      update: vi.fn((payload: any) => ({
        eq: vi.fn((_col: string, id: string) => {
          state.updates.push({ payload, eqId: id });
          return Promise.resolve({ data: null, error: null });
        }),
      })),
      then: (resolve: (v: any) => any) => {
        if (table === 'communication_queue') {
          return resolve({ data: state.queueRows, error: null });
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

vi.mock('@/lib/api/verify-cron', () => ({
  verifyCronRequest: vi.fn(async () => ({ isValid: true })),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async (
    templateCode: string,
    recipient: string,
    templateVars: Record<string, string>,
    meta: any,
  ) => {
    state.sendCalls.push({ templateCode, recipient, templateVars, meta });
    return state.sendNotificationResult;
  }),
}));

import { GET } from '@/app/api/cron/process-deferred-comms/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const RENEWAL_PAYLOADS = [
  { id: 'btn_renew_yes',   title: 'Yes, renew' },
  { id: 'btn_renew_pause', title: 'Pause for now' },
  { id: 'btn_renew_talk',  title: 'Talk to coach' },
];

function makeRow(overrides: Partial<{
  id: string;
  template_code: string;
  recipient_id: string | null;
  recipient_phone: string | null;
  variables: any;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  scheduled_for: string;
}> = {}): any {
  return {
    id: 'q-default',
    template_code: 'parent_renewal_intent_v1',
    recipient_id: null,
    recipient_phone: '919687606177',
    variables: null,
    related_entity_type: null,
    related_entity_id: null,
    created_by: 'system',
    scheduled_for: '2026-05-28T02:30:00Z',
    ...overrides,
  };
}

function fakeRequest(): any {
  // verifyCronRequest is mocked to ignore args; safe to pass an empty stub.
  return {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('drainer (process-deferred-comms) — DRAIN-2C-FIX A+', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queueRows = [];
    state.updates = [];
    state.sendCalls = [];
    state.sendNotificationResult = { success: true, logId: 'log-fixture-id' };
  });

  it('T2: _meta.templateButtons passes through to sendNotification with titles intact', async () => {
    state.queueRows = [makeRow({
      id: 'q-T2',
      variables: {
        template_vars: { parent_name: 'Amit Kumar Rai', child_name: 'Ira Rai' },
        _meta: {
          triggered_by_user_id: null,
          templateButtons: {
            category: 'marketing_quick_reply',
            payloads: RENEWAL_PAYLOADS,
          },
        },
      },
    })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    const meta = state.sendCalls[0].meta;
    expect(meta.templateButtons).toEqual({
      category: 'marketing_quick_reply',
      payloads: RENEWAL_PAYLOADS,
    });
    // Title fidelity end-to-end (objective-critical).
    expect(meta.templateButtons.payloads[0].title).toBe('Yes, renew');
    expect(meta.templateButtons.payloads[1].title).toBe('Pause for now');
    expect(meta.templateButtons.payloads[2].title).toBe('Talk to coach');
  });

  it('T3: success-branch UPDATE writes sent_at alongside processed_at', async () => {
    state.queueRows = [makeRow({
      id: 'q-T3',
      variables: { template_vars: {}, _meta: { triggered_by_user_id: null } },
    })];

    await GET(fakeRequest());

    // Success branch is the only path that sets BOTH processed_at AND log_id.
    const successUpdate = state.updates.find(
      u => u.eqId === 'q-T3' && u.payload.processed_at && u.payload.log_id !== undefined,
    );
    expect(successUpdate).toBeDefined();
    expect(successUpdate!.payload.sent_at).toBe(successUpdate!.payload.processed_at);
    expect(successUpdate!.payload.error_message).toBeNull();
    expect(successUpdate!.payload.last_attempt_at).toBeDefined();
  });

  it('T4: regression — row without templateButtons drains identically (no throw, templateButtons=undefined)', async () => {
    state.queueRows = [makeRow({
      id: 'q-T4',
      variables: {
        template_vars: { parent_name: 'Amit', child_name: 'Ira' },
        _meta: { triggered_by_user_id: null },   // pre-A+ shape — mirrors the 15 historical rows
      },
    })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].meta.templateButtons).toBeUndefined();
  });

  it('T6: _meta context WINS over native columns + cron literal', async () => {
    state.queueRows = [makeRow({
      id: 'q-T6',
      // Native columns ALSO set, to prove _meta wins.
      related_entity_type: 'should_be_ignored',
      related_entity_id: 'should_also_be_ignored',
      variables: {
        template_vars: {},
        _meta: {
          triggered_by_user_id: null,
          contextType: 'enrollment',
          contextId: 'enr-uuid-original',
        },
      },
    })];

    await GET(fakeRequest());

    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].meta.contextType).toBe('enrollment');
    expect(state.sendCalls[0].meta.contextId).toBe('enr-uuid-original');
  });

  it('T7: _meta lacks context, row.related_entity_* set → column fallback used', async () => {
    state.queueRows = [makeRow({
      id: 'q-T7',
      related_entity_type: 'session',
      related_entity_id: 'sess-uuid-456',
      variables: { template_vars: {}, _meta: { triggered_by_user_id: null } },
    })];

    await GET(fakeRequest());

    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].meta.contextType).toBe('session');
    expect(state.sendCalls[0].meta.contextId).toBe('sess-uuid-456');
  });

  it('T8: neither _meta context nor columns → cron literal + null (regression-identical to today)', async () => {
    state.queueRows = [makeRow({
      id: 'q-T8',
      related_entity_type: null,
      related_entity_id: null,
      variables: { template_vars: {}, _meta: { triggered_by_user_id: null } },
    })];

    await GET(fakeRequest());

    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].meta.contextType).toBe('cron:process-deferred-comms');
    expect(state.sendCalls[0].meta.contextId).toBeNull();
  });
});
