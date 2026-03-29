// ============================================================
// FILE: app/api/cron/dispatcher/route.ts
// PURPOSE: Single QStash dispatcher — fans out to all periodic crons
// SCHEDULE: */15 * * * * via QStash (every 15 minutes)
// ============================================================
// QStash free tier allows max 10 schedules. Yestoryd has 20+ crons.
// This dispatcher uses ONE schedule to internally dispatch all jobs
// based on IST time, with per-job fault isolation.
//
// NOT dispatched by this route (event-triggered via QStash publish):
//   - group-class-insights
//   - group-class-notifications
//   - group-class-feedback-request
//
// Separate QStash schedule (too frequent for 15-min dispatcher):
//   - goals-capture (every 5 min)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { logOpsEvent, logOpsEventBatch, generateCorrelationId } from '@/lib/backops';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes — jobs dispatched in parallel


// ── IST Time ──────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTNow() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
    day: ist.getUTCDate(),
    month: ist.getUTCMonth() + 1,
    slot: Math.floor(ist.getUTCMinutes() / 15) * 15, // snap to 0/15/30/45
  };
}

// ── Job Definitions ───────────────────────────────────────────

type JobSchedule =
  | { type: 'interval'; minutes: number }
  | { type: 'daily'; istHour: number; istMinute: number }
  | { type: 'monthly'; dayOfMonth: number; istHour: number; istMinute: number };

interface Job {
  name: string;
  path: string;
  schedule: JobSchedule;
  method: 'GET' | 'POST';
  description: string;
}

const JOBS: Job[] = [
  // ── Interval: every 15 min ────────────────────────────────
  {
    name: 'backops-signal-detector',
    path: '/api/cron/backops-signal-detector',
    schedule: { type: 'interval', minutes: 15 },
    method: 'GET',
    description: 'BackOps signal detection — scan ops_events for anomalies',
  },

  {
    name: 'session-completion-nudge',
    path: '/api/cron/session-completion-nudge',
    schedule: { type: 'interval', minutes: 15 },
    method: 'GET',
    description: 'Nudge coaches to complete pending sessions',
  },

  {
    name: 'group-class-reminders',
    path: '/api/cron/group-class-reminders',
    schedule: { type: 'interval', minutes: 15 },
    method: 'GET',
    description: 'Pre-session reminders for group classes (24h + 1h)',
  },

  {
    name: 'group-class-completion-nudge',
    path: '/api/cron/group-class-completion-nudge',
    schedule: { type: 'interval', minutes: 15 },
    method: 'GET',
    description: 'Nudge instructors to complete group sessions (30min + 2h escalation)',
  },

  // ── Interval: every 30 min ────────────────────────────────
  {
    name: 'backops-outcome-tracker',
    path: '/api/cron/backops-outcome-tracker',
    schedule: { type: 'interval', minutes: 30 },
    method: 'GET',
    description: 'BackOps outcome tracker — checks if actions achieved desired outcomes',
  },

  {
    name: 'payment-reconciliation-alert',
    path: '/api/cron/payment-reconciliation-alert',
    schedule: { type: 'interval', minutes: 30 },
    method: 'GET',
    description: 'Check for unreconciled payments',
  },

  // ── Interval: every 60 min ────────────────────────────────
  {
    name: 'coach-reminders-1h',
    path: '/api/cron/coach-reminders-1h',
    schedule: { type: 'interval', minutes: 60 },
    method: 'GET',
    description: '1-hour session reminders for coaches',
  },

  // ── Interval: every 120 min ───────────────────────────────
  {
    name: 'agent-nurture',
    path: '/api/cron/agent-nurture',
    schedule: { type: 'interval', minutes: 120 },
    method: 'GET',
    description: 'Nurture silent leads with timed messages',
  },

  // ── Daily jobs (spread across IST off-peak hours) ─────────
  {
    name: 'lead-scoring',
    path: '/api/cron/lead-scoring',
    schedule: { type: 'daily', istHour: 2, istMinute: 0 },
    method: 'POST', // POST only route
    description: 'Score and prioritize leads',
  },
  {
    name: 'intelligence-profile-synthesis',
    path: '/api/cron/intelligence-profile-synthesis',
    schedule: { type: 'daily', istHour: 2, istMinute: 30 },
    method: 'GET',
    description: 'Synthesize child intelligence profiles',
  },
  {
    name: 'coach-intelligence-scores',
    path: '/api/cron/coach-intelligence-scores',
    schedule: { type: 'daily', istHour: 3, istMinute: 0 },
    method: 'GET',
    description: 'Compute coach intelligence scores',
  },
  {
    name: 'compute-insights',
    path: '/api/cron/compute-insights',
    schedule: { type: 'daily', istHour: 3, istMinute: 30 },
    method: 'GET',
    description: 'Compute platform-wide insights',
  },
  {
    name: 'micro-assessment-trigger',
    path: '/api/cron/micro-assessment-trigger',
    schedule: { type: 'daily', istHour: 4, istMinute: 0 },
    method: 'GET', // GET only route
    description: 'Trigger micro-assessments for eligible children',
  },
  {
    name: 'process-coach-unavailability',
    path: '/api/cron/process-coach-unavailability',
    schedule: { type: 'daily', istHour: 5, istMinute: 0 },
    method: 'GET',
    description: 'Process coach unavailability windows',
  },
  {
    name: 'enrollment-lifecycle',
    path: '/api/cron/enrollment-lifecycle',
    schedule: { type: 'daily', istHour: 5, istMinute: 30 },
    method: 'GET',
    description: 'Daily enrollment lifecycle checks',
  },
  {
    name: 'coach-engagement',
    path: '/api/cron/coach-engagement',
    schedule: { type: 'daily', istHour: 6, istMinute: 0 },
    method: 'GET', // GET only route
    description: 'Coach engagement tracking',
  },
  {
    name: 'discovery-followup',
    path: '/api/cron/discovery-followup',
    schedule: { type: 'daily', istHour: 6, istMinute: 30 },
    method: 'GET',
    description: 'Follow up on pending discovery calls',
  },
  {
    name: 'smoke-test',
    path: '/api/cron/smoke-test',
    schedule: { type: 'daily', istHour: 6, istMinute: 45 },
    method: 'GET',
    description: 'Full pipeline smoke test — alerts admin on failure',
  },
  {
    name: 'daily-health-check',
    path: '/api/cron/daily-health-check',
    schedule: { type: 'daily', istHour: 7, istMinute: 0 },
    method: 'GET',
    description: 'Platform health check + WhatsApp report',
  },
  {
    name: 'intelligence-practice-recommendations',
    path: '/api/cron/intelligence-practice-recommendations',
    schedule: { type: 'daily', istHour: 8, istMinute: 0 },
    method: 'GET',
    description: 'Generate practice recommendations',
  },
  {
    name: 're-enrollment-nudge',
    path: '/api/cron/re-enrollment-nudge',
    schedule: { type: 'daily', istHour: 9, istMinute: 0 },
    method: 'GET', // GET only route
    description: 'Nudge parents for re-enrollment',
  },
  {
    name: 'daily-lead-digest',
    path: '/api/cron/daily-lead-digest',
    schedule: { type: 'daily', istHour: 9, istMinute: 15 },
    method: 'GET',
    description: 'Admin digest of new leads',
  },
  {
    name: 'practice-nudge',
    path: '/api/cron/practice-nudge',
    schedule: { type: 'daily', istHour: 10, istMinute: 0 },
    method: 'GET',
    description: 'Nudge parents with overdue practice tasks (48h+)',
  },
  {
    name: 'tuition-onboarding-nudge',
    path: '/api/cron/tuition-onboarding-nudge',
    schedule: { type: 'daily', istHour: 11, istMinute: 0 },
    method: 'GET',
    description: 'Nudge parents to complete tuition onboarding form + expire stale records',
  },
  {
    name: 'payment-reconciliation',
    path: '/api/cron/payment-reconciliation',
    schedule: { type: 'daily', istHour: 22, istMinute: 30 },
    method: 'GET',
    description: 'Reconcile payments with Razorpay',
  },

  // ── Monthly jobs ──────────────────────────────────────────
  {
    name: 'compute-coach-quality',
    path: '/api/cron/compute-coach-quality',
    schedule: { type: 'monthly', dayOfMonth: 1, istHour: 6, istMinute: 0 },
    method: 'GET',
    description: 'Monthly quality metrics → coach_quality_log + featured badges',
  },
  {
    name: 'monthly-payouts',
    path: '/api/cron/monthly-payouts',
    schedule: { type: 'monthly', dayOfMonth: 7, istHour: 9, istMinute: 30 },
    method: 'GET',
    description: 'Monthly payout processing for coaches',
  },
];

// ── Schedule Matcher ──────────────────────────────────────────

function shouldRun(
  schedule: JobSchedule,
  ist: { hour: number; slot: number; day: number },
): boolean {
  switch (schedule.type) {
    case 'interval':
      if (schedule.minutes <= 15) return true; // every tick
      if (schedule.minutes === 30) return ist.slot === 0 || ist.slot === 30;
      if (schedule.minutes === 60) return ist.slot === 0;
      if (schedule.minutes === 120) return ist.slot === 0 && ist.hour % 2 === 0;
      return false;

    case 'daily':
      return ist.hour === schedule.istHour && ist.slot === schedule.istMinute;

    case 'monthly':
      return (
        ist.day === schedule.dayOfMonth &&
        ist.hour === schedule.istHour &&
        ist.slot === schedule.istMinute
      );
  }
}

// ── Dispatcher ────────────────────────────────────────────────

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

// Infrastructure: must be under Vercel's 60s function timeout
const PER_JOB_TIMEOUT = 55_000; // 55 seconds per job

async function dispatchJob(
  job: Job,
  requestId: string,
): Promise<{ name: string; success: boolean; status?: number; error?: string; durationMs: number }> {
  const url = `${APP_URL}${job.path}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PER_JOB_TIMEOUT);

    const res = await fetch(url, {
      method: job.method,
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
        'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
        'x-api-key': process.env.INTERNAL_API_KEY || '', // for recall-reconciliation compat
        'x-dispatcher-request-id': requestId,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      name: job.name,
      success: res.ok,
      status: res.status,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: job.name,
      success: false,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      durationMs: Date.now() - start,
    };
  }
}

// ── Main Handler ──────────────────────────────────────────────

async function handler(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  // Auth
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Compute IST time
  const ist = getISTNow();

  console.log(
    JSON.stringify({
      requestId,
      event: 'dispatcher_start',
      ist: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
      day: ist.day,
      source: auth.source,
      totalJobs: JOBS.length,
    }),
  );

  // Find jobs that should run in this 15-min window
  const jobsToRun = JOBS.filter((j) => shouldRun(j.schedule, ist));

  if (jobsToRun.length === 0) {
    console.log(
      JSON.stringify({
        requestId,
        event: 'dispatcher_noop',
        ist: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
      }),
    );

    return NextResponse.json({
      success: true,
      requestId,
      ist: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
      dispatched: 0,
      jobs: [],
    });
  }

  console.log(
    JSON.stringify({
      requestId,
      event: 'dispatcher_dispatching',
      jobs: jobsToRun.map((j) => j.name),
      count: jobsToRun.length,
    }),
  );

  // Dispatch all jobs in parallel with fault isolation
  const settled = await Promise.allSettled(jobsToRun.map((j) => dispatchJob(j, requestId)));

  const results = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      name: jobsToRun[i].name,
      success: false,
      error: s.reason?.message || 'Promise rejected',
      durationMs: 0,
      status: undefined as number | undefined,
    };
  });

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  const duration = Date.now() - start;

  console.log(
    JSON.stringify({
      requestId,
      event: 'dispatcher_complete',
      ist: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
      total: results.length,
      succeeded,
      failed: failed.length,
      failedJobs: failed.map((f) => ({ name: f.name, error: f.error, status: f.status })),
      durationMs: duration,
    }),
  );

  // Log to activity_log for health check monitoring
  try {
    const sb = createAdminClient();
    await sb.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'cron_dispatcher_complete',
      metadata: {
        request_id: requestId,
        source: auth.source,
        ist_time: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
        ist_day: ist.day,
        total: results.length,
        succeeded,
        failed: failed.length,
        failed_jobs: failed.map((f) => f.name),
        dispatched_jobs: results.map((r) => r.name),
        duration_ms: duration,
      },
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(
      JSON.stringify({ requestId, event: 'activity_log_failed', error: err.message }),
    );
  }

  // Log to BackOps ops_events — per-job results + dispatcher summary
  try {
    const dispatcherCorrelationId = generateCorrelationId();

    // Batch log each job result
    const jobEvents = results.map((r) => {
      const eventType: 'cron_run' | 'cron_failure' = r.success ? 'cron_run' : 'cron_failure';
      const sev: 'info' | 'error' = r.success ? 'info' : 'error';
      return {
        event_type: eventType,
        source: `cron:${r.name}`,
        severity: sev,
        correlation_id: dispatcherCorrelationId,
        entity_type: 'cron' as const,
        metadata: {
          dispatcher_run_id: requestId,
          duration_ms: r.durationMs,
          status_code: r.status,
          error: r.error || null,
        },
      };
    });

    await logOpsEventBatch(jobEvents);

    // Dispatcher summary event
    await logOpsEvent({
      event_type: 'cron_run',
      source: 'cron:dispatcher',
      severity: failed.length > 0 ? 'warning' : 'info',
      correlation_id: dispatcherCorrelationId,
      entity_type: 'system',
      metadata: {
        dispatcher_run_id: requestId,
        ist_time: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
        total_jobs: results.length,
        succeeded,
        failed: failed.length,
        failed_jobs: failed.map((f) => f.name),
        duration_ms: duration,
      },
    });
  } catch (err: any) {
    // ops_events logging must NEVER crash the dispatcher
    console.error(
      JSON.stringify({ requestId, event: 'ops_events_log_failed', error: err.message }),
    );
  }

  return NextResponse.json({
    success: failed.length === 0,
    requestId,
    ist: `${ist.hour}:${String(ist.slot).padStart(2, '0')}`,
    dispatched: results.length,
    succeeded,
    failed: failed.length,
    results,
  });
}

export const GET = handler;
export const POST = handler;
