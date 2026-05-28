// =============================================================================
// RENEWAL INTENT HANDLER TESTS — lib/whatsapp/handlers/renewal-intent.ts
// tests/whatsapp/renewal-intent.test.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state — hoisted so vi.mock() can reference it.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  parentRow: null as { id: string; name: string | null } | null,
  enrollmentRow: null as {
    id: string;
    child_id: string | null;
    coach_id: string | null;
    sessions_remaining: number | null;
  } | null,
  coachRow: null as { id: string; name: string | null; phone: string | null } | null,

  enrollmentUpdateCalls: [] as Array<{ patch: any; eqId: string }>,
  learningEventInserts: [] as any[],
  activityLogInserts: [] as any[],

  sendTextCalls: [] as Array<{ phone: string; text: string }>,
  sendNotificationCalls: [] as Array<{ template: string; phone: string; vars: any; meta: any }>,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'parents') {
        return {
          select: () => ({
            or: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: state.parentRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'enrollments') {
        return {
          select: () => ({
            in: () => ({
              not: () => ({
                is: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({ data: state.enrollmentRow, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (patch: any) => ({
            eq: (_col: string, id: string) => {
              state.enrollmentUpdateCalls.push({ patch, eqId: id });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'learning_events') {
        return {
          insert: (row: any) => {
            state.learningEventInserts.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === 'activity_log') {
        return {
          insert: (row: any) => {
            state.activityLogInserts.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === 'coaches') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: state.coachRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

vi.mock('../../lib/whatsapp/cloud-api', () => ({
  sendText: vi.fn((phone: string, text: string) => {
    state.sendTextCalls.push({ phone, text });
    return Promise.resolve({ success: true, messageId: 'wamid.ACK' });
  }),
}));

vi.mock('@/lib/whatsapp/cloud-api', () => ({
  sendText: vi.fn((phone: string, text: string) => {
    state.sendTextCalls.push({ phone, text });
    return Promise.resolve({ success: true, messageId: 'wamid.ACK' });
  }),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn((template: string, phone: string, vars: any, meta: any) => {
    state.sendNotificationCalls.push({ template, phone, vars, meta });
    return Promise.resolve({ success: true, logId: 'log-id' });
  }),
}));

import { handleRenewalIntent } from '@/lib/whatsapp/handlers/renewal-intent';
import type { EnrolledChild } from '@/lib/whatsapp/enrolled-parent-lookup';

const PHONE = '+919687606177';
const PARENT_ID = '00000000-0000-0000-0000-000000000aaa';
const ENROLLMENT_ID = '00000000-0000-0000-0000-000000000eee';
const CHILD_ID = '00000000-0000-0000-0000-000000000ccc';
const COACH_ID = '00000000-0000-0000-0000-0000000000c1';

const CHILDREN: EnrolledChild[] = [
  {
    id: CHILD_ID,
    child_name: 'Shloka Vavia',
    name: null,
    coachName: 'Rucha Rai',
    enrollmentId: ENROLLMENT_ID,
  },
];

beforeEach(() => {
  state.parentRow = { id: PARENT_ID, name: 'Amit Rai' };
  state.enrollmentRow = {
    id: ENROLLMENT_ID,
    child_id: CHILD_ID,
    coach_id: COACH_ID,
    sessions_remaining: 1,
  };
  state.coachRow = { id: COACH_ID, name: 'Rucha Rai', phone: '+918765432109' };
  state.enrollmentUpdateCalls = [];
  state.learningEventInserts = [];
  state.activityLogInserts = [];
  state.sendTextCalls = [];
  state.sendNotificationCalls = [];
});

describe('handleRenewalIntent', () => {
  it("'yes_renew' → enrollment updated + learning_event written + ack with topup URL + activity_log", async () => {
    await handleRenewalIntent('btn_renew_yes', PHONE, CHILDREN, 'wamid.IN');

    expect(state.enrollmentUpdateCalls).toHaveLength(1);
    expect(state.enrollmentUpdateCalls[0].patch).toMatchObject({
      parent_renewal_decision: 'yes_renew',
    });
    expect(state.enrollmentUpdateCalls[0].patch.parent_renewal_decision_at).toBeTruthy();
    expect(state.enrollmentUpdateCalls[0].eqId).toBe(ENROLLMENT_ID);

    expect(state.learningEventInserts).toHaveLength(1);
    expect(state.learningEventInserts[0]).toMatchObject({
      child_id: CHILD_ID,
      event_type: 'parent_renewal_decision',
      signal_source: 'parent_whatsapp',
    });
    expect(state.learningEventInserts[0].event_data.decision).toBe('yes_renew');

    expect(state.sendTextCalls).toHaveLength(1);
    expect(state.sendTextCalls[0].phone).toBe(PHONE);
    expect(state.sendTextCalls[0].text).toContain(`/parent/topup/${ENROLLMENT_ID}`);

    expect(state.activityLogInserts).toHaveLength(1);
    expect(state.activityLogInserts[0]).toMatchObject({
      action: 'parent_renewal_decision',
      user_type: 'parent',
    });

    // No coach notification on yes_renew
    expect(state.sendNotificationCalls).toHaveLength(0);
  });

  it("'pause_for_now' → enrollment updated + learning_event written + ack (no coach notify)", async () => {
    await handleRenewalIntent('btn_renew_pause', PHONE, CHILDREN, 'wamid.IN');

    expect(state.enrollmentUpdateCalls[0].patch.parent_renewal_decision).toBe('pause_for_now');
    expect(state.learningEventInserts[0].event_data.decision).toBe('pause_for_now');
    expect(state.sendTextCalls[0].text).toMatch(/hold things|check in/i);
    expect(state.sendNotificationCalls).toHaveLength(0);
  });

  it("'talk_to_coach' → ack with coach name + fires coach_parent_callback_request_v1 to coach phone", async () => {
    await handleRenewalIntent('btn_renew_talk', PHONE, CHILDREN, 'wamid.IN');

    expect(state.enrollmentUpdateCalls[0].patch.parent_renewal_decision).toBe('talk_to_coach');
    expect(state.sendTextCalls[0].text).toContain('Rucha');

    expect(state.sendNotificationCalls).toHaveLength(1);
    expect(state.sendNotificationCalls[0].template).toBe('coach_parent_callback_request_v1');
    expect(state.sendNotificationCalls[0].phone).toBe('+918765432109');
    expect(state.sendNotificationCalls[0].vars).toMatchObject({
      coach_name: 'Rucha Rai',
      parent_name: 'Amit Rai',
      child_name: 'Shloka Vavia',
      parent_phone: PHONE,
    });
  });

  it('unknown button payload (btn_renew_unknown) → no-op (no DB writes, no sends)', async () => {
    await handleRenewalIntent('btn_renew_unknown', PHONE, CHILDREN, 'wamid.IN');

    expect(state.enrollmentUpdateCalls).toHaveLength(0);
    expect(state.learningEventInserts).toHaveLength(0);
    expect(state.activityLogInserts).toHaveLength(0);
    expect(state.sendTextCalls).toHaveLength(0);
    expect(state.sendNotificationCalls).toHaveLength(0);
  });
});
