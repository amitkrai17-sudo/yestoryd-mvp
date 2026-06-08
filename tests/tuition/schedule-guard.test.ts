// =============================================================================
// TUITION SCHEDULE PAUSED-GUARD TEST — app/api/tuition/schedule/route.ts
// tests/tuition/schedule-guard.test.ts
//
// BREAK2.1c: the schedule guard now reads the canonical paused signal
// (status='paused') instead of is_paused. This fixes the latent bug where a
// balance-paused tuition enrollment (status='paused', is_paused never written
// by the balance writer) was not reliably blocked from scheduling.
//
// Asserts: status='paused' tuition enrollment → 400 "Enrollment is paused",
// scheduleSession NEVER called; active enrollment → passes the guard and
// reaches scheduleSession.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enrollment: null as any,
  scheduleCalled: false,
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminOrCoach: vi.fn(async () => ({ authorized: true, coachId: 'coach-1', role: 'coach', email: 'c@x.com' })),
}));

vi.mock('@/lib/scheduling/operations/create-session', () => ({
  scheduleSession: vi.fn(async () => {
    state.scheduleCalled = true;
    return { success: true, sessionId: 'sess-1' };
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        single: () =>
          Promise.resolve(
            table === 'enrollments'
              ? { data: state.enrollment, error: state.enrollment ? null : { message: 'not found' } }
              : { data: null, error: null }, // tuition_onboarding → fall back to default duration
          ),
        // Count query (scheduled_sessions) + any other awaited chain.
        then: (resolve: (v: any) => any) => resolve({ data: [], count: 0, error: null }),
      };
      return chain;
    },
  })),
}));

import { POST } from '@/app/api/tuition/schedule/route';

const req = (body: any): any => ({ json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  state.enrollment = null;
  state.scheduleCalled = false;
});

describe('tuition/schedule paused guard (BREAK2.1c)', () => {
  it('rejects a status=paused tuition enrollment — the fixed latent bug', async () => {
    state.enrollment = {
      id: 'enr-1', enrollment_type: 'tuition', status: 'paused',
      child_id: 'c1', coach_id: 'coach-1', sessions_remaining: 5,
    };
    const res = await POST(req({ enrollmentId: 'enr-1', date: '2026-07-01', time: '10:00', mode: 'online' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    // Specific paused message — proves the paused guard fired, not the generic not-active one.
    expect(body.error).toBe('Enrollment is paused');
    expect(state.scheduleCalled).toBe(false);
  });

  it('allows an active tuition enrollment with balance to reach scheduling', async () => {
    state.enrollment = {
      id: 'enr-2', enrollment_type: 'tuition', status: 'active',
      child_id: 'c1', coach_id: 'coach-1', sessions_remaining: 5,
    };
    const res = await POST(req({ enrollmentId: 'enr-2', date: '2026-07-01', time: '10:00', mode: 'online' }));
    expect(state.scheduleCalled).toBe(true);
    expect(res.status).not.toBe(400);
  });
});
