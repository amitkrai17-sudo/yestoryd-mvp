// FILE: tests/communication/aisensy.test.ts
//
// Tests for lib/communication/aisensy.ts auth-category synthesis (Block 2.6a).
// Covers the new templateCategory='authentication' branch that synthesizes
// the buttons[] array from params.templateButtons.otp or variables[0].
//
// Strategy: mock fetch (since sendWhatsAppMessage makes a real network call),
// call sendWhatsAppMessage, parse the JSON body passed to fetch, and assert
// against the synthesized payload structure.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { insertCalls, supabaseChain } = vi.hoisted(() => {
  const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const supabaseChain = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: Record<string, unknown>) => {
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

import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import type { WaSendParams } from '@/lib/communication/types';

const PHONE_OK = '919687606177';

const fetchMock = vi.fn();

beforeEach(() => {
  insertCalls.length = 0;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      success: 'true',
      submitted_message_id: 'test-msg-id-123',
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('AISENSY_API_KEY', 'test-api-key-aisensy');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('sendWhatsAppMessage — authentication category synthesis', () => {
  it('synthesizes buttons[] with OTP when templateCategory=authentication and templateButtons present', async () => {
    const params: WaSendParams = {
      to: PHONE_OK,
      templateName: 'parent_otp_v3',
      templateCategory: 'authentication',
      templateButtons: { category: 'authentication', otp: '654321' },
      variables: ['654321'],
    };

    await sendWhatsAppMessage(params);

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(requestBody.buttons).toEqual([
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: '654321' }],
      },
    ]);
    expect(requestBody.templateParams).toEqual(['654321']);
  });

  it('falls back to variables[0] when templateButtons absent for authentication category', async () => {
    const params: WaSendParams = {
      to: PHONE_OK,
      templateName: 'parent_otp_v3',
      templateCategory: 'authentication',
      // templateButtons intentionally omitted
      variables: ['111111'],
    };

    await sendWhatsAppMessage(params);

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(requestBody.buttons).toEqual([
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: '111111' }],
      },
    ]);
  });

  it('forwards caller-supplied buttons[] unchanged for non-authentication templates', async () => {
    const callerButtons = [
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: 0,
        parameters: [{ type: 'text', text: 'Reply A' }],
      },
    ];

    const params: WaSendParams = {
      to: PHONE_OK,
      templateName: 'parent_session_reminder_1h_v3',
      // templateCategory NOT set — legacy/utility/marketing path
      buttons: callerButtons,
      variables: ['Ira', '7:00 PM'],
    };

    await sendWhatsAppMessage(params);

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(requestBody.buttons).toEqual(callerButtons);
  });

  it('omits buttons field entirely when non-authentication and no buttons supplied', async () => {
    const params: WaSendParams = {
      to: PHONE_OK,
      templateName: 'parent_session_reminder_1h_v3',
      // No templateCategory, no buttons, no templateButtons
      variables: ['Ira', '7:00 PM'],
    };

    await sendWhatsAppMessage(params);

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(requestBody.buttons).toBeUndefined();
  });
});
