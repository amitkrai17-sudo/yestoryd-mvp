// =============================================================================
// PAUSE SERVICE TESTS — lib/enrollment/pause-service.ts (BREAK2.1, Phase 2.1a)
// tests/enrollment/pause-service.test.ts
//
// Asserts the ADDITIVE canonical pause/resume service:
//   1. Policy enforcement (single point) — over-count + over-days reject BEFORE write.
//   2. Product branching — tuition: NO Recall teardown, NO season-extension;
//      coaching: Recall teardown + season-extension.
//   3. Canonical write — status='paused' (+ transition dual-write is_paused=true).
//   4. Resume — tuition sessions gate; canonical status='active'.
//
// Uses an injectable fake Supabase (PauseDeps.supabase) + fake side-effect fns,
// so no real DB / calendar / Recall is touched.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub Supabase env BEFORE imports resolve — lib/recall-auto-bot.ts instantiates
// createAdminClient() at module load. createClient is a stateless HTTPS wrapper
// (no network at construction), so dummy values are sufficient for unit tests.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
});

import {
  pause,
  resume,
  type PauseDeps,
} from '@/lib/enrollment/pause-service';
import type { PausePolicy, ProductType } from '@/lib/config/pause-policy';

// --- Mutable test state shared with the fake supabase ---
interface TestState {
  enrollment: Record<string, unknown> | null;
  windowSessions: Array<Record<string, unknown>>;
  enrollmentPatch: Record<string, unknown> | null;
  sessionsPatch: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
}

let state: TestState;

function makeSupabase() {
  return {
    from(table: string) {
      const ctx = { table, op: 'select' as 'select' | 'update' | 'insert', payload: null as unknown };
      const builder: Record<string, unknown> = {
        select() { ctx.op = 'select'; return builder; },
        update(p: unknown) { ctx.op = 'update'; ctx.payload = p; return builder; },
        insert(p: unknown) { ctx.op = 'insert'; ctx.payload = p; return builder; },
        eq() { return builder; },
        neq() { return builder; },
        gte() { return builder; },
        lte() { return builder; },
        in() { return builder; },
        order() { return builder; },
        single() {
          if (ctx.table === 'enrollments') {
            return Promise.resolve({ data: state.enrollment, error: state.enrollment ? null : { message: 'not found' } });
          }
          return Promise.resolve({ data: null, error: null });
        },
        // Thenable: terminal awaits (update / insert / list-select) resolve here.
        then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
          let result: { data: unknown; error: unknown };
          if (ctx.table === 'enrollments' && ctx.op === 'update') {
            state.enrollmentPatch = ctx.payload as Record<string, unknown>;
            result = { data: null, error: null };
          } else if (ctx.table === 'scheduled_sessions' && ctx.op === 'select') {
            result = { data: state.windowSessions, error: null };
          } else if (ctx.table === 'scheduled_sessions' && ctx.op === 'update') {
            state.sessionsPatch = ctx.payload as Record<string, unknown>;
            result = { data: null, error: null };
          } else if (ctx.table === 'enrollment_events' && ctx.op === 'insert') {
            state.events.push(ctx.payload as Record<string, unknown>);
            result = { data: null, error: null };
          } else {
            result = { data: [], error: null };
          }
          return Promise.resolve(result).then(onF, onR);
        },
      };
      return builder;
    },
  };
}

function policy(productType: ProductType): PausePolicy {
  return {
    productType,
    maxPauseCount: 3,
    maxPauseDaysTotal: 30,
    maxPauseDaysSingle: 10,
    minNoticeHours: 48,
  };
}

const FIXED_NOW = new Date('2026-06-08T00:00:00.000Z');

function baseDeps(overrides?: Partial<PauseDeps>): PauseDeps {
  return {
    supabase: makeSupabase() as unknown as PauseDeps['supabase'],
    cancelEvent: vi.fn(async () => ({ success: true })),
    cancelRecallBot: vi.fn(async () => true),
    getPausePolicy: vi.fn(async (p: ProductType) => policy(p)),
    now: () => FIXED_NOW,
    ...overrides,
  };
}

beforeEach(() => {
  state = {
    enrollment: null,
    windowSessions: [],
    enrollmentPatch: null,
    sessionsPatch: null,
    events: [],
  };
});

describe('pause-service / policy enforcement', () => {
  it('rejects when pause_count is already at the max — PARENT source (no write)', async () => {
    state.enrollment = {
      id: 'e1', child_id: 'c1', enrollment_type: 'tuition', status: 'active',
      is_paused: false, pause_count: 3, total_pause_days: 0, program_end: null,
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: 5,
    };
    const res = await pause('e1', { reason: 'exams', source: 'parent_self_service' }, baseDeps());
    expect(res.success).toBe(false);
    expect(res.rejected).toBe('policy_count');
    expect(state.enrollmentPatch).toBeNull(); // no write happened
  });

  it('S1: SYSTEM source bypasses policy — pauses even at max pause_count', async () => {
    state.enrollment = {
      id: 'e1b', child_id: 'c1', enrollment_type: 'tuition', status: 'active',
      is_paused: false, pause_count: 3, total_pause_days: 0, program_end: null,
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: 5,
    };
    const deps = baseDeps();
    const res = await pause('e1b', { reason: 'balance_zero', source: 'balance_auto', skipSideEffects: true }, deps);
    expect(res.success).toBe(true);
    expect(state.enrollmentPatch?.status).toBe('paused');
    // S3a: pause_count NOT incremented for a system source (stays 3, no quota consumed)
    expect(state.enrollmentPatch?.pause_count).toBe(3);
    // policy is never consulted for system sources
    expect(deps.getPausePolicy).not.toHaveBeenCalled();
  });

  it('rejects a single window exceeding maxPauseDaysSingle (no write)', async () => {
    state.enrollment = {
      id: 'e2', child_id: 'c1', enrollment_type: 'starter', status: 'active',
      is_paused: false, pause_count: 0, total_pause_days: 0, program_end: '2026-09-01T00:00:00.000Z',
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: null,
    };
    // 20-day window > 10-day single cap
    const res = await pause('e2', {
      reason: 'travel', source: 'parent_self_service',
      startDate: '2026-06-12', endDate: '2026-07-02',
    }, baseDeps());
    expect(res.success).toBe(false);
    expect(res.rejected).toBe('policy_days_single');
    expect(state.enrollmentPatch).toBeNull();
  });

  it('rejects when total pause days would exceed the cap (no write)', async () => {
    state.enrollment = {
      id: 'e3', child_id: 'c1', enrollment_type: 'starter', status: 'active',
      is_paused: false, pause_count: 1, total_pause_days: 25, program_end: '2026-09-01T00:00:00.000Z',
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: null,
    };
    // 8 more days on top of 25 used > 30 total
    const res = await pause('e3', {
      reason: 'exams', source: 'parent_self_service',
      startDate: '2026-06-12', endDate: '2026-06-20',
    }, baseDeps());
    expect(res.success).toBe(false);
    expect(res.rejected).toBe('policy_days_total');
    expect(state.enrollmentPatch).toBeNull();
  });
});

describe('pause-service / canonical write + product branching', () => {
  it('tuition pause: canonical status=paused, dual-write is_paused, NO Recall, NO season-extension', async () => {
    state.enrollment = {
      id: 't1', child_id: 'c9', enrollment_type: 'tuition', status: 'active',
      is_paused: false, pause_count: 0, total_pause_days: 0, program_end: null,
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: 4,
    };
    state.windowSessions = [
      { id: 's1', google_event_id: 'gcal-1', recall_bot_id: 'bot-1' },
    ];
    const deps = baseDeps();
    const res = await pause('t1', {
      reason: 'travel', source: 'parent_self_service',
      startDate: '2026-06-12', endDate: '2026-06-16',
    }, deps);

    expect(res.success).toBe(true);
    expect(res.newStatus).toBe('paused');
    // BREAK2.1d: status is the sole signal — is_paused is no longer written
    expect(state.enrollmentPatch?.status).toBe('paused');
    expect(state.enrollmentPatch?.is_paused).toBeUndefined();
    expect(state.enrollmentPatch?.pause_count).toBe(1);
    // tuition: program_end untouched, no season extension
    expect(res.seasonExtended).toBe(false);
    expect(state.enrollmentPatch?.program_end).toBeUndefined();
    // calendar teardown runs for BOTH products
    expect(deps.cancelEvent).toHaveBeenCalledWith('gcal-1', true);
    // Recall teardown NEVER runs for tuition
    expect(deps.cancelRecallBot).not.toHaveBeenCalled();
    expect(res.recallCancelled).toBe(0);
  });

  it('coaching pause: Recall teardown runs + season extension applied', async () => {
    state.enrollment = {
      id: 'k1', child_id: 'c9', enrollment_type: 'starter', status: 'active',
      is_paused: false, pause_count: 0, total_pause_days: 0,
      program_end: '2026-09-01T00:00:00.000Z',
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: null,
    };
    state.windowSessions = [
      { id: 's1', google_event_id: 'gcal-2', recall_bot_id: 'bot-2' },
    ];
    const deps = baseDeps();
    const res = await pause('k1', {
      reason: 'exams', source: 'parent_self_service',
      startDate: '2026-06-12', endDate: '2026-06-16', // 4 days
    }, deps);

    expect(res.success).toBe(true);
    expect(state.enrollmentPatch?.status).toBe('paused');
    // coaching: Recall teardown DID run
    expect(deps.cancelRecallBot).toHaveBeenCalledWith('bot-2');
    expect(res.recallCancelled).toBe(1);
    // season extension: program_end pushed out, original_end_date stored
    expect(res.seasonExtended).toBe(true);
    expect(state.enrollmentPatch?.program_end).toBeDefined();
    expect(state.enrollmentPatch?.original_end_date).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('pause-service / skipSideEffects (S2 — callers own teardown/logging)', () => {
  it('skipSideEffects:true writes canonical row but SKIPS calendar/Recall/log', async () => {
    state.enrollment = {
      id: 'ss1', child_id: 'c9', enrollment_type: 'starter', status: 'active',
      is_paused: false, pause_count: 0, total_pause_days: 0,
      program_end: '2026-09-01T00:00:00.000Z',
      original_end_date: null, resume_eligible_until: null, paused_at: null, sessions_remaining: null,
    };
    state.windowSessions = [
      { id: 's1', google_event_id: 'gcal-9', recall_bot_id: 'bot-9' },
    ];
    const deps = baseDeps();
    const res = await pause('ss1', {
      reason: 'exams', source: 'parent_self_service',
      startDate: '2026-06-12', endDate: '2026-06-16',
      skipSideEffects: true,
    }, deps);

    expect(res.success).toBe(true);
    // canonical row write still happens (incl. season extension — a row field)
    expect(state.enrollmentPatch?.status).toBe('paused');
    expect(state.enrollmentPatch?.program_end).toBeDefined();
    // side-effects suppressed: no teardown, no session update, no event log
    expect(deps.cancelEvent).not.toHaveBeenCalled();
    expect(deps.cancelRecallBot).not.toHaveBeenCalled();
    expect(state.sessionsPatch).toBeNull();
    expect(state.events.length).toBe(0);
  });
});

describe('pause-service / resume', () => {
  it('tuition resume rejected when no sessions remaining', async () => {
    state.enrollment = {
      id: 't2', child_id: 'c9', enrollment_type: 'tuition', status: 'paused',
      is_paused: true, pause_count: 1, total_pause_days: 4, program_end: null,
      original_end_date: null, resume_eligible_until: null, paused_at: '2026-06-01T00:00:00.000Z',
      pause_start_date: '2026-06-01', pause_end_date: '2026-06-05', sessions_remaining: 0,
    };
    const res = await resume('t2', { source: 'admin_manual' }, baseDeps());
    expect(res.success).toBe(false);
    expect(res.rejected).toBe('no_sessions');
    expect(state.enrollmentPatch).toBeNull();
  });

  it('happy resume writes canonical status=active and clears pause fields', async () => {
    state.enrollment = {
      id: 't3', child_id: 'c9', enrollment_type: 'tuition', status: 'paused',
      is_paused: true, pause_count: 1, total_pause_days: 4, program_end: null,
      original_end_date: null, resume_eligible_until: null, paused_at: '2026-06-01T00:00:00.000Z',
      pause_start_date: '2026-06-01', pause_end_date: '2026-06-05', sessions_remaining: 3,
    };
    const res = await resume('t3', { source: 'admin_manual' }, baseDeps());
    expect(res.success).toBe(true);
    expect(res.newStatus).toBe('active');
    expect(state.enrollmentPatch?.status).toBe('active');
    // BREAK2.1d: is_paused no longer written on resume either
    expect(state.enrollmentPatch?.is_paused).toBeUndefined();
    expect(state.enrollmentPatch?.paused_at).toBeNull();
    expect(state.enrollmentPatch?.resume_eligible_until).toBeNull();
  });
});
