// =============================================================================
// PARENT PAYMENT HISTORY API — app/api/parent/payments/route.ts
// tests/parent/payments.test.ts
//
// PARENT-PAY.1: read-only, ownership-checked payment history + pay_state.
// Asserts: ownership scoping (parent_id + enrollment_type, ledger .in owned ids),
// positive-ledger-only (.gt change_amount 0), null payment_id graceful,
// pay_due computation (initial/low/null), pay_url shape.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  parent: { id: 'parent-1' } as any,
  enrollments: [] as any[],
  ledger: [] as any[],
  payments: [] as any[],
  eqCalls: [] as Array<{ table: string; col: string; val: any }>,
  inCalls: [] as Array<{ table: string; col: string; vals: any }>,
  gtCalls: [] as Array<{ table: string; col: string; val: any }>,
}));

const supabaseStub = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: any) => { state.eqCalls.push({ table, col, val }); return chain; }),
      in: vi.fn((col: string, vals: any) => { state.inCalls.push({ table, col, vals }); return chain; }),
      gt: vi.fn((col: string, val: any) => { state.gtCalls.push({ table, col, val }); return chain; }),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: table === 'parents' ? state.parent : null, error: null })),
      then: (resolve: (v: any) => any) => {
        let data: any[] = [];
        if (table === 'enrollments') data = state.enrollments;
        else if (table === 'tuition_session_ledger') data = state.ledger;
        else if (table === 'payments') data = state.payments;
        return resolve({ data, error: null });
      },
    };
    return chain;
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn(async () => ({ authorized: true, email: 'p@x.com', userId: 'u-1' })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseStub),
}));

import { GET } from '@/app/api/parent/payments/route';

const req = (): any => ({});

beforeEach(() => {
  vi.clearAllMocks();
  state.parent = { id: 'parent-1' };
  state.enrollments = [];
  state.ledger = [];
  state.payments = [];
  state.eqCalls = [];
  state.inCalls = [];
  state.gtCalls = [];
});

describe('/api/parent/payments — ownership + scoping', () => {
  it('scopes enrollments by parent_id + enrollment_type=tuition, ledger by owned ids (.in)', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 6 }];
    state.ledger = [{ enrollment_id: 'enr-A', change_amount: 8, reason: 'initial_purchase', payment_id: null, created_at: '2026-06-01T00:00:00Z' }];

    const res = await GET(req());
    expect(res.status).toBe(200);

    // ownership: enrollments filtered by parent_id (server-resolved) + tuition
    expect(state.eqCalls).toEqual(expect.arrayContaining([
      { table: 'enrollments', col: 'parent_id', val: 'parent-1' },
      { table: 'enrollments', col: 'enrollment_type', val: 'tuition' },
    ]));
    // ledger scoped to the OWNED enrollment ids only
    const ledgerIn = state.inCalls.find(c => c.table === 'tuition_session_ledger');
    expect(ledgerIn?.vals).toEqual(['enr-A']);
  });

  it('returns ONLY the calling parent\'s enrollments (no client-supplied id path)', async () => {
    state.enrollments = [
      { id: 'enr-A', status: 'active', sessions_remaining: 6 },
      { id: 'enr-B', status: 'tuition_paused', sessions_remaining: 1 },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.enrollments.map((e: any) => e.enrollment_id).sort()).toEqual(['enr-A', 'enr-B']);
  });

  it('no tuition enrollments → { enrollments: [], history: {} }', async () => {
    state.enrollments = [];
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({ enrollments: [], history: {} });
  });

  it('unauthenticated → 401', async () => {
    const { requireAuth } = await import('@/lib/api-auth');
    (requireAuth as any).mockResolvedValueOnce({ authorized: false });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});

describe('/api/parent/payments — history rows', () => {
  const UUID = '3875f9fc-0000-4000-8000-000000000001';

  it('top_up with UUID payment_id → resolves via payments.id (.gt enforces positive-only)', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 6 }];
    state.ledger = [{ enrollment_id: 'enr-A', change_amount: 2, reason: 'top_up', payment_id: UUID, created_at: '2026-06-03T00:00:00Z' }];
    state.payments = [{ id: UUID, razorpay_payment_id: null, amount: 50000, currency: 'INR', status: 'captured', payment_method: 'cash', coupon_code: null }];

    const res = await GET(req());
    const body = await res.json();
    expect(state.gtCalls).toEqual(expect.arrayContaining([{ table: 'tuition_session_ledger', col: 'change_amount', val: 0 }]));
    // the id-keyed lookup used .in('id', [UUID])
    expect(state.inCalls).toEqual(expect.arrayContaining([{ table: 'payments', col: 'id', vals: [UUID] }]));
    const row = body.history['enr-A'][0];
    expect(row).toMatchObject({ reason: 'top_up', sessions_added: 2, amount: 50000, method: 'cash', has_payment_detail: true });
  });

  it('BUG 2: initial_purchase/renewal with "pay_xxx" → resolves via payments.razorpay_payment_id', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 6 }];
    state.ledger = [{ enrollment_id: 'enr-A', change_amount: 8, reason: 'initial_purchase', payment_id: 'pay_STq8xyz', created_at: '2026-06-01T00:00:00Z' }];
    state.payments = [{ id: UUID, razorpay_payment_id: 'pay_STq8xyz', amount: 200000, currency: 'INR', status: 'captured', payment_method: 'upi', coupon_code: null }];

    const res = await GET(req());
    const body = await res.json();
    // resolved via the razorpay key, NOT the id key
    expect(state.inCalls).toEqual(expect.arrayContaining([{ table: 'payments', col: 'razorpay_payment_id', vals: ['pay_STq8xyz'] }]));
    const row = body.history['enr-A'][0];
    expect(row).toMatchObject({ reason: 'initial_purchase', amount: 200000, method: 'upi', has_payment_detail: true });
  });

  it('null payment_id row → has_payment_detail=false, amount/status/method null', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 6 }];
    state.ledger = [{ enrollment_id: 'enr-A', change_amount: 4, reason: 'top_up', payment_id: null, created_at: '2026-06-02T00:00:00Z' }];

    const res = await GET(req());
    const body = await res.json();
    const row = body.history['enr-A'][0];
    expect(row.has_payment_detail).toBe(false);
    expect(row.amount).toBeNull();
    expect(row.status).toBeNull();
    expect(row.method).toBeNull();
    expect(row.sessions_added).toBe(4);
  });

  it('BUG 3: manual_adjustment / non-purchase reasons excluded from history', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 6 }];
    state.ledger = [
      { enrollment_id: 'enr-A', change_amount: 8, reason: 'initial_purchase', payment_id: null, created_at: '2026-06-01T00:00:00Z' },
      { enrollment_id: 'enr-A', change_amount: 3, reason: 'manual_adjustment', payment_id: null, created_at: '2026-06-04T00:00:00Z' },
      { enrollment_id: 'enr-A', change_amount: 1, reason: 'admin_adjustment: goodwill', payment_id: null, created_at: '2026-06-05T00:00:00Z' },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.history['enr-A']).toHaveLength(1);
    expect(body.history['enr-A'][0].reason).toBe('initial_purchase');
    // but lifetime_credited still counts ALL positive ledger (8+3+1=12) — admin SSOT denominator
    expect((body.enrollments[0]).lifetime_credited).toBe(12);
  });

  it('history grouped by enrollment_id', async () => {
    state.enrollments = [
      { id: 'enr-A', status: 'active', sessions_remaining: 6 },
      { id: 'enr-B', status: 'active', sessions_remaining: 3 },
    ];
    state.ledger = [
      { enrollment_id: 'enr-A', change_amount: 8, reason: 'initial_purchase', payment_id: null, created_at: '2026-06-01T00:00:00Z' },
      { enrollment_id: 'enr-B', change_amount: 10, reason: 'initial_purchase', payment_id: null, created_at: '2026-06-02T00:00:00Z' },
    ];
    const res = await GET(req());
    const body = await res.json();
    expect(body.history['enr-A']).toHaveLength(1);
    expect(body.history['enr-B']).toHaveLength(1);
  });
});

describe('/api/parent/payments — pay_state', () => {
  it('payment_pending → pay_due "initial", pay_url without renewal', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'payment_pending', sessions_remaining: 0 }];
    const res = await GET(req());
    const ps = (await res.json()).enrollments[0];
    expect(ps.pay_due).toBe('initial');
    expect(ps.pay_url).toBe('/tuition/pay/enr-A');
  });

  it('active + sessions_remaining<=2 → pay_due "low", pay_url with ?renewal=true', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 1 }];
    const res = await GET(req());
    const ps = (await res.json()).enrollments[0];
    expect(ps.pay_due).toBe('low');
    expect(ps.pay_url).toBe('/tuition/pay/enr-A?renewal=true');
  });

  it('tuition_paused + low balance → pay_due "low"', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'tuition_paused', sessions_remaining: 0 }];
    const res = await GET(req());
    const ps = (await res.json()).enrollments[0];
    expect(ps.pay_due).toBe('low');
  });

  it('active + healthy balance → pay_due null, plain pay_url', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 9 }];
    const res = await GET(req());
    const ps = (await res.json()).enrollments[0];
    expect(ps.pay_due).toBeNull();
    expect(ps.pay_url).toBe('/tuition/pay/enr-A');
  });

  it('lifetime_credited = positive ledger sum per enrollment', async () => {
    state.enrollments = [{ id: 'enr-A', status: 'active', sessions_remaining: 5 }];
    state.ledger = [
      { enrollment_id: 'enr-A', change_amount: 8, reason: 'initial_purchase', payment_id: null, created_at: '2026-06-01T00:00:00Z' },
      { enrollment_id: 'enr-A', change_amount: 4, reason: 'top_up', payment_id: null, created_at: '2026-06-03T00:00:00Z' },
    ];
    const res = await GET(req());
    const ps = (await res.json()).enrollments[0];
    expect(ps.lifetime_credited).toBe(12);
  });
});
