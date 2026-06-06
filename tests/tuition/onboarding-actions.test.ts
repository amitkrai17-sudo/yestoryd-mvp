// =============================================================================
// EXPIRED-CARD ACTIONS — resend(revive) + archive(soft-dismiss)
// tests/tuition/onboarding-actions.test.ts
//
// UI-1.2:
//  - resend route (app/api/admin/tuition/[id]/resend) now accepts expired records
//    and REVIVES them: regenerate token, status→parent_pending, created_at reset
//    (restart lifecycle clock), send parent_tuition_onboarding_v4, log 'revived'.
//  - archive route (app/api/admin/tuition/[id]/archive) soft-dismisses: status→
//    'archived', activity_log, NEVER deletes. parent_completed/enrolled rejected.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  onboarding: null as any,
  updateCalls: [] as Array<{ table: string; patch: any }>,
  insertCalls: [] as Array<{ table: string; obj: any }>,
  deleteCalled: false,
  notifyCalls: [] as any[],
}));

const supabaseStub = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(() => {
        if (table === 'tuition_onboarding') return Promise.resolve({ data: state.onboarding, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn((patch: any) => {
        state.updateCalls.push({ table, patch });
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      }),
      insert: vi.fn((obj: any) => {
        state.insertCalls.push({ table, obj });
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn(() => {
        state.deleteCalled = true; // should NEVER happen
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      }),
    };
    return chain;
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdmin: vi.fn(async () => ({ authorized: true, email: 'admin@x.com', role: 'admin', userId: 'u-1' })),
  requireCoach: vi.fn(async () => ({ authorized: false })),
  requireAdminOrCoach: vi.fn(async () => ({ authorized: false })),
  requireAuth: vi.fn(async () => ({ authorized: false })),
  getServiceSupabase: vi.fn(() => supabaseStub),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async (template: string, phone: string, vars: any, meta: any) => {
    state.notifyCalls.push({ template, phone, vars, meta });
    return { success: true };
  }),
}));

vi.mock('@/lib/communication/resolveParentName', () => ({
  resolveParentFullName: vi.fn(async () => 'Test Parent'),
}));

import { POST as resendPOST } from '@/app/api/admin/tuition/[id]/resend/route';
import { POST as archivePOST } from '@/app/api/admin/tuition/[id]/archive/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const reqWith = (body: any): any => ({ json: async () => body });
const reqNoBody = (): any => ({ json: async () => { throw new Error('no body'); } });

function baseOnboarding(over: Record<string, any> = {}) {
  return {
    id: 'onb-1',
    child_name: 'Test Child',
    child_id: 'child-1',
    parent_phone: '9687606177',
    parent_name_hint: 'Parent',
    coach_id: 'coach-1',
    status: 'parent_pending',
    sessions_purchased: 8,
    session_rate: 25000,
    created_at: '2026-05-01T00:00:00.000Z',
    enrollment_id: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.onboarding = baseOnboarding();
  state.updateCalls = [];
  state.insertCalls = [];
  state.deleteCalled = false;
  state.notifyCalls = [];
});

describe('resend route — revive expired', () => {
  it('EXPIRED → regenerate token + status→parent_pending + created_at reset + send v4 + log revived', async () => {
    state.onboarding = baseOnboarding({ status: 'expired' });
    const res = await resendPOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(200);

    const upd = state.updateCalls.find(u => u.table === 'tuition_onboarding');
    expect(upd).toBeTruthy();
    expect(typeof upd!.patch.parent_form_token).toBe('string');
    expect(upd!.patch.status).toBe('parent_pending');   // revived back into lifecycle
    expect(typeof upd!.patch.created_at).toBe('string'); // clock restarted (no re-expire churn)

    expect(state.notifyCalls[0]?.template).toBe('parent_tuition_onboarding_v4');

    const log = state.insertCalls.find(i => i.table === 'activity_log');
    expect(log!.obj.action).toBe('tuition_onboarding_revived');
    expect(log!.obj.metadata.previous_status).toBe('expired');
  });

  it('PARENT_PENDING → regenerate token, NO status/created_at change, log resent', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_pending' });
    const res = await resendPOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(200);

    const upd = state.updateCalls.find(u => u.table === 'tuition_onboarding')!;
    expect(typeof upd.patch.parent_form_token).toBe('string');
    expect('status' in upd.patch).toBe(false);       // unchanged for plain resend
    expect('created_at' in upd.patch).toBe(false);

    const log = state.insertCalls.find(i => i.table === 'activity_log')!;
    expect(log.obj.action).toBe('tuition_onboarding_resent');
  });

  it('PARENT_COMPLETED → 400, no update, no send', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_completed' });
    const res = await resendPOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(400);
    expect(state.updateCalls.filter(u => u.table === 'tuition_onboarding')).toHaveLength(0);
    expect(state.notifyCalls).toHaveLength(0);
  });

  it('WA-FIX.1: send meta carries triggeredBy + contextType + contextId=newToken (dedup bypass)', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_pending' });
    await resendPOST(reqNoBody(), params('onb-1'));
    const meta = state.notifyCalls[0]?.meta;
    expect(meta?.triggeredBy).toBe('admin');
    expect(meta?.contextType).toBe('tuition_onboarding_resend');
    // contextId is the regenerated token (also the templateButtons url) → unique per resend
    expect(typeof meta?.contextId).toBe('string');
    expect(meta?.contextId.length).toBeGreaterThan(0);
    expect(meta?.contextId).toBe(meta?.templateButtons?.url);
  });

  it('WA-FIX.1: two resends → DIFFERENT contextId (regenerated token → distinct idempotency key)', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_pending' });
    await resendPOST(reqNoBody(), params('onb-1'));
    await resendPOST(reqNoBody(), params('onb-1'));
    expect(state.notifyCalls).toHaveLength(2);
    expect(state.notifyCalls[0].meta.contextId).not.toBe(state.notifyCalls[1].meta.contextId);
  });
});

describe('archive route — soft-dismiss', () => {
  it('EXPIRED → status→archived + activity_log + NEVER deletes', async () => {
    state.onboarding = baseOnboarding({ status: 'expired' });
    const res = await archivePOST(reqWith({ reason: 'duplicate' }), params('onb-1'));
    expect(res.status).toBe(200);

    const upd = state.updateCalls.find(u => u.table === 'tuition_onboarding')!;
    expect(upd.patch.status).toBe('archived');
    expect(state.deleteCalled).toBe(false);

    const log = state.insertCalls.find(i => i.table === 'activity_log')!;
    expect(log.obj.action).toBe('tuition_onboarding_archived');
    expect(log.obj.metadata.previous_status).toBe('expired');
    expect(log.obj.metadata.reason).toBe('duplicate');
  });

  it('DRAFT and PARENT_PENDING are archivable', async () => {
    for (const status of ['draft', 'parent_pending']) {
      state.onboarding = baseOnboarding({ status });
      state.updateCalls = [];
      const res = await archivePOST(reqNoBody(), params('onb-1'));
      expect(res.status).toBe(200);
      expect(state.updateCalls.find(u => u.table === 'tuition_onboarding')!.patch.status).toBe('archived');
    }
  });

  it('PARENT_COMPLETED → 400, not archived, no delete', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_completed' });
    const res = await archivePOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(400);
    expect(state.updateCalls.filter(u => u.table === 'tuition_onboarding')).toHaveLength(0);
    expect(state.deleteCalled).toBe(false);
  });

  it('ENROLLED (enrollment_id set) → 400 even if status archivable', async () => {
    state.onboarding = baseOnboarding({ status: 'parent_pending', enrollment_id: 'enr-1' });
    const res = await archivePOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(400);
    expect(state.updateCalls.filter(u => u.table === 'tuition_onboarding')).toHaveLength(0);
  });

  it('already ARCHIVED → idempotent 200 no-op, no second update', async () => {
    state.onboarding = baseOnboarding({ status: 'archived' });
    const res = await archivePOST(reqNoBody(), params('onb-1'));
    expect(res.status).toBe(200);
    expect(state.updateCalls.filter(u => u.table === 'tuition_onboarding')).toHaveLength(0);
  });
});
