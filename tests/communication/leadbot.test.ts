// =============================================================================
// LEAD BOT ADAPTER TESTS — lib/communication/leadbot.ts
// tests/communication/leadbot.test.ts
//
// Phase A coverage: pure-translation correctness (buildLeadBotPayload),
// dry-run safety, env + phone validation, and the real-send paths
// (Path 3 success, Path 4 failed POST, Path 5 network exception).
// Plus B1 amendment (AUTH: prefix on 401/403).
//
// Mocking strategy A (mirrors validate-notification.test.ts):
//   - vi.mock('@/lib/supabase/admin') — captures every row inserted into
//     communication_logs by log.ts when leadbot.ts calls logCommunication().
//   - vi.stubGlobal('fetch') — captures or simulates Meta Cloud HTTP calls.
//
// No DB, no real HTTP. Tests must run offline.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mock state. vi.hoisted runs before any vi.mock calls. ---
const { insertCalls, supabaseChain } = vi.hoisted(() => {
  const insertCalls: Array<{ table: string; row: any }> = [];
  const supabaseChain = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: any) => {
        insertCalls.push({ table, row });
        return Promise.resolve({ data: null, error: null });
      }),
    })),
  };
  return { insertCalls, supabaseChain };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseChain),
}));

import { buildLeadBotPayload, sendLeadBotMessage } from '@/lib/communication/leadbot';
import type { WaSendParams } from '@/lib/communication/types';

// =============================================================================
// FIXTURES
// =============================================================================

const PHONE_OK = '919687606177';
const PHONE_BAD = '12345';

const BASIC_PARAMS: WaSendParams = {
  to: PHONE_OK,
  templateName: 'test_template',
  variables: ['Alice', 'Bob'],
};

const PARAMS_WITH_HEADER_IMAGE: WaSendParams = {
  to: PHONE_OK,
  templateName: 'test_with_image',
  variables: [],
  header: { type: 'image', url: 'https://example.com/img.png' },
};

const PARAMS_WITH_LEGACY_MEDIA: WaSendParams = {
  to: PHONE_OK,
  templateName: 'test_with_doc',
  variables: [],
  mediaUrl: 'https://example.com/doc.pdf',
  mediaFilename: 'report.pdf',
};

const PARAMS_WITH_BUTTONS: WaSendParams = {
  to: PHONE_OK,
  templateName: 'test_with_buttons',
  variables: [],
  buttons: [
    { type: 'button', parameters: [{ type: 'payload', text: 'yes_btn' }] },
    { type: 'button', parameters: [{ type: 'payload', text: 'no_btn' }] },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  insertCalls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('META_WA_PHONE_NUMBER_ID', '1055529114299828');
  vi.stubEnv('META_WA_ACCESS_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// =============================================================================
// buildLeadBotPayload — 8 tests
// =============================================================================

describe('buildLeadBotPayload', () => {
  it('text-only template builds a body component with text parameters', () => {
    const payload = buildLeadBotPayload(BASIC_PARAMS);
    expect(payload.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Alice' },
          { type: 'text', text: 'Bob' },
        ],
      },
    ]);
  });

  it('variables map positionally to body parameters in order', () => {
    const payload = buildLeadBotPayload({
      ...BASIC_PARAMS,
      variables: ['First', 'Second', 'Third'],
    });
    const body = payload.template.components?.find((c) => c.type === 'body');
    expect(body?.parameters).toEqual([
      { type: 'text', text: 'First' },
      { type: 'text', text: 'Second' },
      { type: 'text', text: 'Third' },
    ]);
  });

  it('header via params.header (image) produces image component', () => {
    const payload = buildLeadBotPayload(PARAMS_WITH_HEADER_IMAGE);
    expect(payload.template.components?.[0]).toEqual({
      type: 'header',
      parameters: [{ type: 'image', image: { link: 'https://example.com/img.png' } }],
    });
  });

  it('header via legacy mediaUrl/mediaFilename defaults to document type', () => {
    const payload = buildLeadBotPayload(PARAMS_WITH_LEGACY_MEDIA);
    expect(payload.template.components?.[0]).toEqual({
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: { link: 'https://example.com/doc.pdf', filename: 'report.pdf' },
        },
      ],
    });
  });

  it('quick-reply buttons produce one component per button with index as STRING', () => {
    const payload = buildLeadBotPayload(PARAMS_WITH_BUTTONS);
    const buttons = payload.template.components?.filter((c) => c.type === 'button');
    expect(buttons).toHaveLength(2);
    expect(buttons?.[0]).toEqual({
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [{ type: 'payload', text: 'yes_btn' }],
    });
    expect(buttons?.[1]).toEqual({
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [{ type: 'payload', text: 'no_btn' }],
    });
  });

  it('languageCode defaults to en when absent', () => {
    const payload = buildLeadBotPayload(BASIC_PARAMS);
    expect(payload.template.language).toEqual({ code: 'en' });
  });

  it('empty params (no vars/header/buttons) omits components field', () => {
    const payload = buildLeadBotPayload({
      to: PHONE_OK,
      templateName: 'empty_template',
      variables: [],
    });
    expect(payload.template.components).toBeUndefined();
  });

  it('phone normalization: input "+91 8591287997" produces "918591287997" in payload.to', () => {
    const payload = buildLeadBotPayload({
      ...BASIC_PARAMS,
      to: '+91 8591287997',
    });
    expect(payload.to).toBe('918591287997');
  });
});

// =============================================================================
// sendLeadBotMessage — env + phone validation — 2 tests
// =============================================================================

describe('sendLeadBotMessage — env + phone validation', () => {
  it('Path 1: env vars unset returns Lead Bot not configured', async () => {
    // Override beforeEach env stubs with empty strings (falsy → triggers env check fail)
    vi.stubEnv('META_WA_PHONE_NUMBER_ID', '');
    vi.stubEnv('META_WA_ACCESS_TOKEN', '');

    const result = await sendLeadBotMessage(BASIC_PARAMS);
    expect(result).toEqual({
      success: false,
      error: 'Lead Bot not configured',
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.error_message).toBe('Lead Bot not configured');
    expect(insertCalls[0].row.wa_sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Path 2: invalid phone returns Invalid phone number', async () => {
    const result = await sendLeadBotMessage({
      ...BASIC_PARAMS,
      to: PHONE_BAD,
    });
    expect(result).toEqual({
      success: false,
      error: 'Invalid phone number',
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.error_message).toContain('Invalid phone number');
    expect(insertCalls[0].row.wa_sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// sendLeadBotMessage — dry-run (Phase A safety) — 3 tests
// =============================================================================

describe('sendLeadBotMessage — dry-run (Phase A safety)', () => {
  it('default isDryRun=true returns DRY_RUN_ messageId, fetch NOT called', async () => {
    const result = await sendLeadBotMessage(BASIC_PARAMS);
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^DRY_RUN_\d+$/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.error_message).toBe('dry_run');
    expect(insertCalls[0].row.wa_sent).toBe(false);
    // The DRY_RUN_<ts> marker must also appear in context_data.provider_message_id
    expect(insertCalls[0].row.context_data?.provider_message_id).toMatch(/^DRY_RUN_\d+$/);
    expect(insertCalls[0].row.context_data?.payload).toBeDefined();
  });

  it('dry-run preserves meta.templateCode in log row (B2)', async () => {
    await sendLeadBotMessage({
      ...BASIC_PARAMS,
      meta: { templateCode: 'parent_practice_tasks_v3' },
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.template_code).toBe('parent_practice_tasks_v3');
    // template_code is preserved; the dry-run flag lives in error_message only
    expect(insertCalls[0].row.error_message).toBe('dry_run');
  });

  it('dry-run with no meta uses direct: prefix template_code', async () => {
    await sendLeadBotMessage(BASIC_PARAMS);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.template_code).toBe('direct:test_template');
  });
});

// =============================================================================
// sendLeadBotMessage — real-send paths — 4 tests
// =============================================================================

describe('sendLeadBotMessage — real-send paths', () => {
  it('Path 3: 200 with messages[0].id returns success and logs wa_sent=true', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.ABC123' }] }),
    });

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result).toEqual({ success: true, messageId: 'wamid.ABC123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].row.wa_sent).toBe(true);
    expect(insertCalls[0].row.context_data?.provider_message_id).toBe('wamid.ABC123');
    expect(insertCalls[0].row.context_data?.http_status).toBe(200);
  });

  it('Path 4: 500 with error.message returns failure, logs wa_sent=false (no AUTH prefix)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal server error' } }),
    });

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal server error');
    expect(insertCalls[0].row.wa_sent).toBe(false);
    expect(insertCalls[0].row.error_message).toBe('Internal server error');
    expect(insertCalls[0].row.error_message).not.toMatch(/^AUTH:/);
    expect(insertCalls[0].row.context_data?.http_status).toBe(500);
  });

  it('Path 5: fetch throws returns network exception, logs context_data.exception=true', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNRESET');
    expect(insertCalls[0].row.wa_sent).toBe(false);
    expect(insertCalls[0].row.error_message).toBe('ECONNRESET');
    expect(insertCalls[0].row.context_data?.exception).toBe(true);
  });

  it('real-send mode passes correct URL, Authorization header, and JSON body to fetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.X' }] }),
    });

    await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/1055529114299828/messages');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.recipient_type).toBe('individual');
    expect(body.to).toBe(PHONE_OK);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('test_template');
    expect(body.template.language).toEqual({ code: 'en' });
  });
});

// =============================================================================
// B1 AUTH: prefix on 401/403 — 3 tests
// =============================================================================

describe('B1 AUTH: prefix on 401/403', () => {
  it('401 prefixes errorMessage with "AUTH: "', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth token' } }),
    });

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^AUTH: /);
    expect(result.error).toContain('Invalid OAuth token');
    expect(insertCalls[0].row.error_message).toMatch(/^AUTH: /);
  });

  it('403 prefixes errorMessage with "AUTH: "', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Permission denied' } }),
    });

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^AUTH: /);
    expect(result.error).toContain('Permission denied');
    expect(insertCalls[0].row.error_message).toMatch(/^AUTH: /);
  });

  it('400 does NOT prefix errorMessage (negative case)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Template parameter mismatch' } }),
    });

    const result = await sendLeadBotMessage(BASIC_PARAMS, { isDryRun: false });
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/^AUTH: /);
    expect(result.error).toBe('Template parameter mismatch');
    expect(insertCalls[0].row.error_message).not.toMatch(/^AUTH: /);
  });
});
