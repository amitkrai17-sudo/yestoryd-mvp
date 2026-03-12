// ============================================================
// FILE: app/api/cron/daily-health-check/route.ts
// PURPOSE: Daily platform health check — WhatsApp morning report
// SCHEDULE: Daily at 7:00 AM IST (1:30 AM UTC) via vercel.json
// ============================================================
// AiSensy template required: "daily_health_report"
//   Body: {{1}}  (single variable containing the full report text)
//   Create this template in AiSensy dashboard before WhatsApp will work.
//   Email fallback works immediately without any setup.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/database.types';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


// ── Types ─────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  indicator: string;
  summary: string;
  details?: string;
  passed: boolean;
}

type SB = ReturnType<typeof createClient<Database>>;

// ── Helpers ───────────────────────────────────────────────────

const getSupabase = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms)
    ),
  ]);
}

// ── Cron Registry ─────────────────────────────────────────────
// key: substring to match in activity_log.action (underscore-delimited)
// exclude: substring to exclude (avoids payment_reconciliation matching payment_reconciliation_alert)
// maxH: max hours since last successful run before it's flagged

const CRON_REGISTRY = [
  // Dispatcher (runs every 15 min — flag if no run in 1 hour)
  { name: 'cron-dispatcher', key: 'cron_dispatcher', exclude: '', maxH: 1 },
  // Hourly
  { name: 'coach-reminders-1h', key: 'coach_reminder', exclude: '', maxH: 2 },
  // Daily
  { name: 'enrollment-lifecycle', key: 'enrollment_lifecycle', exclude: '', maxH: 26 },
  { name: 'session-completion-nudge', key: 'session_completion_nudge', exclude: '', maxH: 26 },
  { name: 'payment-reconciliation', key: 'payment_reconciliation', exclude: 'alert', maxH: 26 },
  { name: 'coach-engagement', key: 'coach_engagement', exclude: '', maxH: 26 },
  { name: 'coach-intelligence', key: 'coach_intelligence', exclude: '', maxH: 26 },
  { name: 'compute-insights', key: 'compute_insights', exclude: '', maxH: 26 },
  { name: 'daily-lead-digest', key: 'lead_digest', exclude: '', maxH: 26 },
  { name: 'discovery-followup', key: 'discovery_followup', exclude: '', maxH: 26 },
  { name: 'practice-recommendations', key: 'practice_recommendation', exclude: '', maxH: 26 },
  { name: 'profile-synthesis', key: 'profile_synthesis', exclude: '', maxH: 26 },
  { name: 'agent-nurture', key: 'agent_nurture', exclude: '', maxH: 26 },
  { name: 're-enrollment-nudge', key: 're_enrollment', exclude: '', maxH: 26 },
  { name: 'coach-unavailability', key: 'coach_unavailability', exclude: '', maxH: 26 },
  { name: 'lead-scoring', key: 'lead_scoring', exclude: '', maxH: 26 },
  { name: 'micro-assessment', key: 'micro_assessment', exclude: '', maxH: 26 },
  { name: 'group-class-notifications', key: 'group_class_notif', exclude: '', maxH: 26 },
  { name: 'group-class-insights', key: 'group_class_insight', exclude: 'feedback', maxH: 26 },
  { name: 'group-class-feedback', key: 'group_class_feedback', exclude: '', maxH: 26 },
  // Monthly
  { name: 'monthly-payouts', key: 'monthly_payout', exclude: '', maxH: 744 },
  { name: 'coach-quality', key: 'coach_quality_computed', exclude: '', maxH: 744 },
];

// ── Health Checks ─────────────────────────────────────────────

async function checkCronHealth(sb: SB): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await sb
    .from('activity_log')
    .select('action, created_at')
    .ilike('action', '%cron%')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(500);

  const failed: string[] = [];
  let checked = 0;

  for (const cron of CRON_REGISTRY) {
    // Skip monthly payout check unless we're near payout day (7th–10th)
    if (cron.maxH >= 744) {
      const day = new Date().getDate();
      if (day < 8 || day > 10) continue;
    }
    checked++;

    const match = logs?.find(l => {
      const a = l.action.toLowerCase();
      if (!a.includes(cron.key)) return false;
      if (cron.exclude && a.includes(cron.exclude)) return false;
      return a.includes('complete') || a.includes('executed') || a.includes('success');
    });

    if (!match) {
      failed.push(`${cron.name} (no run)`);
    } else {
      const hoursAgo = (Date.now() - new Date(match.created_at!).getTime()) / 3_600_000;
      if (hoursAgo > cron.maxH) {
        failed.push(`${cron.name} (${Math.round(hoursAgo)}h ago)`);
      }
    }
  }

  const healthy = checked - failed.length;
  if (failed.length === 0) {
    return { name: 'Crons', indicator: '[OK]', summary: `${healthy}/${checked} healthy`, passed: true };
  }
  return {
    name: 'Crons', indicator: '[FAIL]', summary: `${healthy}/${checked} healthy`,
    details: failed.join(', '), passed: false,
  };
}

async function checkEnrollmentIntegrity(sb: SB): Promise<CheckResult> {
  const { data: enrollments } = await sb
    .from('enrollments')
    .select('id, child_id, children:child_id(child_name)')
    .eq('status', 'active');

  if (!enrollments?.length) {
    return { name: 'Enrollments', indicator: '[OK]', summary: 'No active', passed: true };
  }

  // Batch: get all enrollment_ids that have at least one session
  const ids = enrollments.map(e => e.id);
  const { data: sessRows } = await sb
    .from('scheduled_sessions')
    .select('enrollment_id')
    .in('enrollment_id', ids);

  const hasSession = new Set((sessRows || []).map(s => s.enrollment_id));
  const missing = enrollments.filter(e => !hasSession.has(e.id));

  if (missing.length === 0) {
    return { name: 'Enrollments', indicator: '[OK]', summary: 'All have sessions', passed: true };
  }
  const names = missing.map(e => (e as any).children?.child_name || e.id.slice(0, 6));
  return {
    name: 'Enrollments', indicator: '[FAIL]', summary: `${missing.length} missing sessions`,
    details: names.slice(0, 5).join(', '), passed: false,
  };
}

async function checkSessionRecording(sb: SB): Promise<CheckResult> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: sessions } = await sb
    .from('scheduled_sessions')
    .select('id, scheduled_time, children:child_id(child_name)')
    .eq('status', 'completed')
    .gte('scheduled_date', yesterdayStr)
    .or('session_mode.eq.online,session_mode.is.null')
    .is('recall_bot_id', null);

  if (!sessions?.length) {
    return { name: 'Recordings', indicator: '[OK]', summary: 'All recorded', passed: true };
  }
  const details = sessions.slice(0, 3).map(s => {
    const name = (s as any).children?.child_name || '?';
    return `${name} ${s.scheduled_time?.slice(0, 5) || ''}`;
  }).join(', ');
  return {
    name: 'Recordings', indicator: '[WARN]', summary: `${sessions.length} missing`,
    details, passed: false,
  };
}

async function checkEmbeddingConsistency(sb: SB): Promise<CheckResult> {
  // Spot-check 20 recent embeddings for correct dimensions
  const { data: samples } = await sb
    .from('learning_events')
    .select('id, embedding')
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  let wrongDims = 0;
  for (const s of samples || []) {
    try {
      const arr = JSON.parse(s.embedding as string);
      if (!Array.isArray(arr) || arr.length !== 768) wrongDims++;
    } catch {
      wrongDims++;
    }
  }

  // Check for missing embeddings in last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: total }, { count: missing }] = await Promise.all([
    sb.from('learning_events').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
    sb.from('learning_events').select('*', { count: 'exact', head: true }).gte('created_at', yesterday).is('embedding', null),
  ]);

  if (wrongDims === 0 && (missing || 0) === 0) {
    return { name: 'Embeddings', indicator: '[OK]', summary: 'Consistent', passed: true };
  }
  const parts: string[] = [];
  if (wrongDims > 0) parts.push(`${wrongDims}/20 wrong dims`);
  if ((missing || 0) > 0) parts.push(`${missing}/${total || '?'} no embed (24h)`);
  return {
    name: 'Embeddings', indicator: wrongDims > 0 ? '[FAIL]' : '[WARN]',
    summary: parts.join(', '), passed: false,
  };
}

async function checkUpcomingSessions(sb: SB): Promise<CheckResult> {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: sessions } = await sb
    .from('scheduled_sessions')
    .select('id, scheduled_date, scheduled_time, children:child_id(child_name)')
    .in('scheduled_date', [todayStr, tomorrowStr])
    .in('status', ['scheduled', 'rescheduled'])
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(10);

  if (!sessions?.length) {
    return { name: 'Upcoming', indicator: '[SCHEDULE]', summary: 'No sessions today/tomorrow', passed: true };
  }
  const list = sessions.map(s => {
    const name = (s as any).children?.child_name || '?';
    const time = s.scheduled_time?.slice(0, 5) || '?';
    return `${name} ${time}`;
  });
  return {
    name: 'Upcoming', indicator: '[SCHEDULE]', summary: `${sessions.length} sessions`,
    details: list.join(', '), passed: true,
  };
}

async function checkPaymentHealth(sb: SB): Promise<CheckResult> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('failed_payments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);

  if ((count || 0) === 0) {
    return { name: 'Payments', indicator: '[OK]', summary: 'No failures', passed: true };
  }
  return {
    name: 'Payments', indicator: '[WARN]', summary: `${count} failures (24h)`, passed: false,
  };
}

async function checkErrorRate(): Promise<CheckResult> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) {
    return { name: 'Errors', indicator: '[SKIP]', summary: 'Sentry N/A', passed: true };
  }
  const res = await fetch(
    'https://sentry.io/api/0/projects/yestoryd/javascript-nextjs/issues/?query=is:unresolved&statsPeriod=24h',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return { name: 'Errors', indicator: '[?]', summary: `Sentry ${res.status}`, passed: true };
  }
  const issues = await res.json();
  const n = Array.isArray(issues) ? issues.length : 0;
  if (n === 0) return { name: 'Errors', indicator: '[OK]', summary: 'No new errors', passed: true };
  return {
    name: 'Errors', indicator: n > 10 ? '[FAIL]' : '[WARN]', summary: `${n} issues (24h)`, passed: n <= 5,
  };
}

// ── Message Builder ───────────────────────────────────────────

function buildHealthMessage(results: CheckResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
  });
  const overall = passed === total ? '[OK]' : passed >= total - 1 ? '[WARN]' : '[FAIL]';

  const lines = [
    `Yestoryd Health — ${dateStr}`,
    `${overall} Overall: ${passed}/${total} passed`,
    '',
    ...results.map(r => `${r.indicator} ${r.name}: ${r.summary}`),
  ];

  const issues = results.filter(r => !r.passed && r.details);
  if (issues.length > 0) {
    lines.push('', 'Details:');
    for (const r of issues) {
      lines.push(`• ${r.name}: ${r.details}`);
    }
  }
  return lines.join('\n');
}

// ── Main Handler ──────────────────────────────────────────────

async function handler(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabase();
  const TIMEOUT = 10_000;
  const CHECK_NAMES = ['Crons', 'Enrollments', 'Recordings', 'Embeddings', 'Upcoming', 'Payments', 'Errors'];

  // Run all checks in parallel, each with its own timeout + try/catch
  const settled = await Promise.allSettled([
    withTimeout(checkCronHealth(sb), TIMEOUT, 'Crons'),
    withTimeout(checkEnrollmentIntegrity(sb), TIMEOUT, 'Enrollments'),
    withTimeout(checkSessionRecording(sb), TIMEOUT, 'Recordings'),
    withTimeout(checkEmbeddingConsistency(sb), TIMEOUT, 'Embeddings'),
    withTimeout(checkUpcomingSessions(sb), TIMEOUT, 'Upcoming'),
    withTimeout(checkPaymentHealth(sb), TIMEOUT, 'Payments'),
    withTimeout(checkErrorRate(), TIMEOUT, 'Errors'),
  ]);

  const results: CheckResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(JSON.stringify({ requestId, event: 'check_failed', check: CHECK_NAMES[i], error: s.reason?.message }));
    return {
      name: CHECK_NAMES[i], indicator: '[?]', summary: 'Check failed',
      details: s.reason?.message?.slice(0, 80), passed: false,
    };
  });

  const message = buildHealthMessage(results);
  const duration = Date.now() - start;
  console.log(JSON.stringify({ requestId, event: 'health_report', duration, passed: results.filter(r => r.passed).length, total: results.length }));

  // ── Send notifications ──

  // 1. WhatsApp (primary)
  const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';
  let whatsappSent = false;
  try {
    const wa = await sendWhatsAppMessage({
      to: adminPhone,
      templateName: 'daily_health_report',
      variables: [message],
    });
    whatsappSent = wa.success;
    if (!wa.success) console.error(JSON.stringify({ requestId, event: 'whatsapp_error', error: wa.error }));
  } catch (err: any) {
    console.error(JSON.stringify({ requestId, event: 'whatsapp_exception', error: err.message }));
  }

  // 2. Email fallback
  if (!whatsappSent) {
    try {
      const { sendEmail } = require('@/lib/email/resend-client');
      await sendEmail({
        to: COMPANY_CONFIG.adminEmail,
        from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd System' },
        subject: `Daily Health — ${results.filter(r => r.passed).length}/${results.length} passed`,
        html: `<pre style="font-family:monospace;font-size:14px;line-height:1.5;white-space:pre-wrap;">${message}</pre>`,
      });
      console.log(JSON.stringify({ requestId, event: 'email_fallback_sent' }));
    } catch (err: any) {
      console.error(JSON.stringify({ requestId, event: 'email_fallback_failed', error: err.message }));
    }
  }

  // 3. In-app notification for admin dashboard
  try {
    await sb.from('in_app_notifications').insert({
      user_id: 'system',
      user_type: 'admin',
      title: 'Daily Health Report',
      body: message,
      notification_type: results.every(r => r.passed) ? 'info' : 'warning',
      metadata: {
        request_id: requestId,
        checks: results.map(r => ({ name: r.name, emoji: r.indicator, passed: r.passed })),
        duration_ms: duration,
      },
    });
  } catch (err: any) {
    console.error(JSON.stringify({ requestId, event: 'notification_failed', error: err.message }));
  }

  // 4. Activity log for cron health tracking
  try {
    await sb.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'daily_health_check_cron_complete',
      metadata: {
        request_id: requestId,
        source: auth.source,
        results: results.map(r => ({ name: r.name, passed: r.passed, summary: r.summary })),
        duration_ms: duration,
        whatsapp_sent: whatsappSent,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(JSON.stringify({ requestId, event: 'activity_log_failed', error: err.message }));
  }

  return NextResponse.json({
    success: true,
    request_id: requestId,
    duration_ms: duration,
    results: results.map(r => ({ name: r.name, emoji: r.indicator, passed: r.passed, summary: r.summary, details: r.details })),
    message,
    notifications: { whatsapp: whatsappSent, email: !whatsappSent },
  });
}

export const GET = handler;
export const POST = handler;
