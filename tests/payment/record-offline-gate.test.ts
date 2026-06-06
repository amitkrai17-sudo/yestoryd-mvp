// =============================================================================
// RECORD-OFFLINE GATE TESTS — app/api/payment/record-offline/route.ts
// tests/payment/record-offline-gate.test.ts
//
// OFFLINE-PAY.1: tuition payment side-effects gated to INITIAL ACTIVATION.
//  - initial (isFirstPayment, no program_start): schedules pack + writes
//    enrollment_revenue + credits balance + WA.
//  - top-up (!isFirstPayment): NO scheduleTuitionSessions, NO calculateRevenueSplit
//    (so the duplicate-key path is unreachable) — but balance is still credited + WA sent.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enrollment: null as any,
}));

const supabaseStub = vi.hoisted(() => {
  const singleData = (table: string) => {
    if (table === 'enrollments') return state.enrollment;
    if (table === 'parents') return { name: 'Parent', email: 'p@x.com', phone: '919999999999' };
    if (table === 'children') return { name: 'Test Child', child_name: 'Test Child' };
    if (table === 'payments') return { id: 'pay-1' };
    if (table === 'tuition_onboarding') return { category_id: null, skill_categories: null };
    if (table === 'coaches') return { name: 'Coach X' };
    return null;
  };
  return {
    from: vi.fn((table: string) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        is: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: singleData(table), error: null })),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        then: (resolve: (v: any) => any) => resolve({ data: null, error: null }),
      };
      return chain;
    }),
  };
});

vi.mock('@/lib/api-auth', () => ({
  requireAdmin: vi.fn(async () => ({ authorized: false })),
  requireCoach: vi.fn(async () => ({ authorized: false })),
  requireAdminOrCoach: vi.fn(async () => ({ authorized: true, email: 'admin@x.com', role: 'admin', userId: 'u-1' })),
  requireAuth: vi.fn(async () => ({ authorized: false })),
  getServiceSupabase: vi.fn(() => supabaseStub),
}));

const scheduleTuitionSessions = vi.hoisted(() => vi.fn(async () => ({ success: true, sessionsCreated: 11, errors: [] })));
vi.mock('@/lib/scheduling', () => ({ scheduleTuitionSessions }));

const calculateRevenueSplit = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock('@/lib/payment/post-payment-notifications', () => ({ calculateRevenueSplit }));

const addTuitionBalance = vi.hoisted(() => vi.fn(async (_opts: any) => ({ previousBalance: 11, newBalance: 12 })));
vi.mock('@/lib/tuition/add-balance', () => ({ addTuitionBalance }));

vi.mock('@/lib/payment/coach-assigner', () => ({
  getCoach: vi.fn(async () => ({ id: 'coach-1', email: 'c@x.com', name: 'Coach X' })),
}));

const queueEnrollmentComplete = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/qstash', () => ({ queueEnrollmentComplete }));

vi.mock('@/lib/config/loader', () => ({ loadPaymentConfig: vi.fn(async () => ({ currency: 'INR' })) }));

const sendCommunication = vi.hoisted(() => vi.fn(async () => ({ success: true, results: [] })));
vi.mock('@/lib/communication', () => ({ sendCommunication }));
vi.mock('@/lib/utils/program-label', () => ({ getProgramLabel: vi.fn(() => 'English Classes') }));

import { POST } from '@/app/api/payment/record-offline/route';

const ENR = '30495f12-0000-4000-8000-000000000001';
const makeReq = (body: any): any => ({ json: async () => body, nextUrl: { pathname: '/api/payment/record-offline' } });
const body = { enrollment_id: ENR, amount: 250, sessions_purchased: 1, payment_method: 'cash' as const };

function enrollment(over: Record<string, any> = {}) {
  return {
    id: ENR, child_id: 'child-1', parent_id: 'parent-1', coach_id: 'coach-1',
    sessions_purchased: 10, sessions_remaining: 11, amount: 1000,
    status: 'active', program_start: '2026-03-01', enrollment_type: 'tuition',
    billing_model: 'prepaid_sessions',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.enrollment = enrollment();
});

describe('record-offline — side-effects gated to initial activation', () => {
  it('TOP-UP (program_start set) → NO scheduling, NO revenue write; balance credited + WA sent', async () => {
    state.enrollment = enrollment({ program_start: '2026-03-01', status: 'active' });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);

    expect(scheduleTuitionSessions).not.toHaveBeenCalled();   // Bug A fixed
    expect(calculateRevenueSplit).not.toHaveBeenCalled();     // Bug B fixed — no colliding insert

    // balance still credited as a top_up
    expect(addTuitionBalance).toHaveBeenCalledTimes(1);
    expect(addTuitionBalance.mock.calls[0][0]).toMatchObject({ reason: 'top_up', changeAmount: 1 });
    // WA confirmation still sent
    expect(sendCommunication).toHaveBeenCalledTimes(1);
  });

  it('INITIAL (no program_start) → schedules pack + writes revenue (once) + balance + WA', async () => {
    state.enrollment = enrollment({ program_start: null, status: 'payment_pending' });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);

    expect(scheduleTuitionSessions).toHaveBeenCalledTimes(1);
    expect(calculateRevenueSplit).toHaveBeenCalledTimes(1);   // exactly one enrollment_revenue write
    expect(addTuitionBalance).toHaveBeenCalledTimes(1);
    expect(addTuitionBalance.mock.calls[0][0]).toMatchObject({ reason: 'initial_purchase', changeAmount: 1 });
    expect(sendCommunication).toHaveBeenCalledTimes(1);
  });

  it('duplicate-key path is unreachable on top-up (calculateRevenueSplit never invoked)', async () => {
    state.enrollment = enrollment({ program_start: '2026-04-01' });
    await POST(makeReq(body));
    expect(calculateRevenueSplit).toHaveBeenCalledTimes(0);
  });
});
