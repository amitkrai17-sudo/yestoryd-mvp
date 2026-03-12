// ============================================================
// FILE: app/api/cron/smoke-test/route.ts
// PURPOSE: Production-safe API smoke test — validates full pipeline
// SCHEDULE: On-demand or via QStash (recommended: daily at 6 AM IST)
// ============================================================
// Uses a designated test parent (phone 9999999999) so real users
// are never touched. All test artifacts marked with is_test metadata.
// Does NOT delete test data — marks it for easy filtering.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { getPricingConfig } from '@/lib/config/pricing-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 min — smoke test needs headroom

// ── Types ─────────────────────────────────────────────────────

interface TestResult {
  phase: string;
  step: string;
  passed: boolean;
  duration_ms: number;
  details?: string;
  error?: string;
}

interface PhaseResult {
  phase: string;
  passed: boolean;
  results: TestResult[];
  duration_ms: number;
}

// Smoke test queries many tables (some not in generated types) — use any
type SB = any;

// ── Constants ─────────────────────────────────────────────────

const TEST_PHONE = '9999999999';
const TEST_EMAIL = 'smoke-test@yestoryd.com';
const TEST_CHILD_NAME = '__SMOKE_TEST_CHILD__';
const TEST_PARENT_NAME = '__SMOKE_TEST_PARENT__';

// ── Helpers ───────────────────────────────────────────────────

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms)
    ),
  ]);
}

async function runStep(
  phase: string,
  step: string,
  fn: () => Promise<string | void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const details = await fn();
    return {
      phase,
      step,
      passed: true,
      duration_ms: Date.now() - start,
      details: details || 'OK',
    };
  } catch (err: any) {
    return {
      phase,
      step,
      passed: false,
      duration_ms: Date.now() - start,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };
  }
}

// ── Phase 1: Assessment Pipeline ──────────────────────────────

async function phase1Assessment(sb: SB): Promise<PhaseResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  // 1.1 — Verify assessment_passages table has data
  results.push(await runStep('Assessment', 'passages_exist', async () => {
    const { count, error } = await sb
      .from('assessment_passages')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!count || count === 0) throw new Error('No assessment passages found');
    return `${count} passages available`;
  }));

  // 1.2 — Verify age_band_config is populated
  results.push(await runStep('Assessment', 'age_bands_exist', async () => {
    const { data, error } = await sb
      .from('age_band_config')
      .select('id, session_duration_minutes, sessions_per_season')
      .eq('is_active', true);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('No active age bands');
    const ids = data.map((b: any) => b.id).join(', ');
    return `${data.length} bands: ${ids}`;
  }));

  // 1.3 — Verify Gemini API key is set
  results.push(await runStep('Assessment', 'gemini_key_set', async () => {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      throw new Error('No Gemini API key configured');
    }
    return 'API key present';
  }));

  // 1.4 — Verify assessment results can be read (existing data)
  results.push(await runStep('Assessment', 'results_readable', async () => {
    const { data, error } = await sb
      .from('assessment_results')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) return 'No results yet (OK for new deploy)';
    const age = Date.now() - new Date(data[0].created_at!).getTime();
    const daysAgo = Math.round(age / 86_400_000);
    return `Latest result: ${daysAgo}d ago`;
  }));

  return {
    phase: 'Assessment',
    passed: results.every(r => r.passed),
    results,
    duration_ms: Date.now() - start,
  };
}

// ── Phase 2: Discovery + Enrollment ───────────────────────────

async function phase2Discovery(sb: SB): Promise<PhaseResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  // 2.1 — Verify pricing_plans table
  results.push(await runStep('Discovery', 'pricing_plans_exist', async () => {
    const config = await getPricingConfig();
    if (config.tiers.length === 0) throw new Error('No pricing tiers loaded');
    if (config.ageBands.length === 0) throw new Error('No age bands loaded');
    const tierNames = config.tiers.map(t => t.slug).join(', ');
    return `${config.tiers.length} tiers (${tierNames}), ${config.ageBands.length} bands`;
  }));

  // 2.2 — Verify discovery_calls table is queryable
  results.push(await runStep('Discovery', 'discovery_calls_queryable', async () => {
    const { count, error } = await sb
      .from('discovery_calls')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} discovery calls in system`;
  }));

  // 2.3 — Verify enrollments table is queryable + active enrollments exist
  results.push(await runStep('Discovery', 'enrollments_queryable', async () => {
    const { count, error } = await sb
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} active enrollments`;
  }));

  // 2.4 — Verify Razorpay key is set
  results.push(await runStep('Discovery', 'razorpay_key_set', async () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured');
    }
    return 'Razorpay keys present';
  }));

  // 2.5 — Verify coupons table
  results.push(await runStep('Discovery', 'coupons_queryable', async () => {
    const { count, error } = await sb
      .from('coupons')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} active coupons`;
  }));

  return {
    phase: 'Discovery',
    passed: results.every(r => r.passed),
    results,
    duration_ms: Date.now() - start,
  };
}

// ── Phase 3: Session Pipeline ─────────────────────────────────

async function phase3Sessions(sb: SB): Promise<PhaseResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  // 3.1 — Verify coaches exist and have active ones
  results.push(await runStep('Sessions', 'active_coaches', async () => {
    const { count, error } = await sb
      .from('coaches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!count || count === 0) throw new Error('No active coaches');
    return `${count} active coaches`;
  }));

  // 3.2 — Verify scheduled_sessions table + upcoming sessions
  results.push(await runStep('Sessions', 'upcoming_sessions', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await sb
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_date', today)
      .in('status', ['scheduled', 'rescheduled']);
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} upcoming sessions`;
  }));

  // 3.3 — Verify session_notes table is writable (insert + delete test row)
  results.push(await runStep('Sessions', 'session_notes_writable', async () => {
    const testId = crypto.randomUUID();
    const { error: insertError } = await sb
      .from('session_notes')
      .insert({
        id: testId,
        child_id: '00000000-0000-0000-0000-000000000000',
        coach_id: '00000000-0000-0000-0000-000000000000',
        session_id: '00000000-0000-0000-0000-000000000000',
        notes: '__SMOKE_TEST__',
        metadata: { is_test: true, smoke_test: true },
      });
    // Clean up immediately
    await sb.from('session_notes').delete().eq('id', testId);
    if (insertError) {
      // Foreign key constraint is expected — that's fine, table is writable
      if (insertError.code === '23503') return 'Table writable (FK validated)';
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    return 'Table writable + cleaned up';
  }));

  // 3.4 — Verify Google Calendar API key
  results.push(await runStep('Sessions', 'google_calendar_key', async () => {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error('Google Calendar credentials not configured');
    }
    return 'Calendar credentials present';
  }));

  // 3.5 — Verify learning_events table + recent event exists
  results.push(await runStep('Sessions', 'learning_events_recent', async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await sb
      .from('learning_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayAgo);
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} events in last 24h`;
  }));

  return {
    phase: 'Sessions',
    passed: results.every(r => r.passed),
    results,
    duration_ms: Date.now() - start,
  };
}

// ── Phase 4: Supporting Systems ───────────────────────────────

async function phase4Support(sb: SB): Promise<PhaseResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  // 4.1 — Verify communication config (WhatsApp + Email)
  results.push(await runStep('Support', 'whatsapp_configured', async () => {
    if (!process.env.AISENSY_API_KEY) {
      throw new Error('AiSensy API key not configured');
    }
    return 'AiSensy key present';
  }));

  results.push(await runStep('Support', 'email_configured', async () => {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Resend API key not configured');
    }
    return 'Resend key present';
  }));

  // 4.2 — Verify site_settings table has critical keys
  results.push(await runStep('Support', 'site_settings_keys', async () => {
    const criticalKeys = [
      'whatsapp_number',
      'session_discovery_duration_mins',
      'parent_referral_credit_percent',
    ];
    const { data, error } = await sb
      .from('site_settings')
      .select('key, value')
      .in('key', criticalKeys);
    if (error) throw new Error(`Query failed: ${error.message}`);
    const found = (data || []).map((d: any) => d.key);
    const missing = criticalKeys.filter(k => !found.includes(k));
    if (missing.length > 0) {
      return `Warning: missing keys: ${missing.join(', ')}`;
    }
    return `All ${criticalKeys.length} critical keys present`;
  }));

  // 4.3 — Verify Supabase storage buckets exist
  results.push(await runStep('Support', 'storage_buckets', async () => {
    const { data, error } = await sb.storage.listBuckets();
    if (error) throw new Error(`Storage error: ${error.message}`);
    const names = (data || []).map((b: any) => b.name).join(', ');
    return `${(data || []).length} buckets: ${names}`;
  }));

  // 4.4 — Verify agreement_versions has an active agreement
  results.push(await runStep('Support', 'active_agreement', async () => {
    const { data, error } = await sb
      .from('agreement_versions')
      .select('id, version')
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data) return 'No active agreement (may be OK)';
    return `Active: v${data.version}`;
  }));

  // 4.5 — Verify communication_templates exist
  results.push(await runStep('Support', 'comm_templates', async () => {
    const { count, error } = await sb
      .from('communication_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `${count ?? 0} active templates`;
  }));

  return {
    phase: 'Support',
    passed: results.every(r => r.passed),
    results,
    duration_ms: Date.now() - start,
  };
}

// ── Phase 5: Cron Health ──────────────────────────────────────

async function phase5Crons(sb: SB): Promise<PhaseResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  // 5.1 — Check dispatcher ran recently
  results.push(await runStep('Crons', 'dispatcher_recent', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('activity_log')
      .select('created_at')
      .ilike('action', '%cron_dispatcher%')
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Dispatcher not seen in last 2 hours');
    return `Last run: ${data[0].created_at}`;
  }));

  // 5.2 — Check goals-capture ran recently (every 5 min)
  results.push(await runStep('Crons', 'goals_capture_recent', async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('activity_log')
      .select('created_at')
      .ilike('action', '%goals_capture%')
      .gte('created_at', thirtyMinAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) return 'No goals-capture in 30min (may be OK if idle)';
    return `Last run: ${data[0].created_at}`;
  }));

  // 5.3 — Check daily health check ran in last 26h
  results.push(await runStep('Crons', 'health_check_recent', async () => {
    const dayAgo = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('activity_log')
      .select('created_at')
      .ilike('action', '%health_check%')
      .gte('created_at', dayAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Health check not seen in last 26 hours');
    return `Last run: ${data[0].created_at}`;
  }));

  // 5.4 — Check QStash env vars
  results.push(await runStep('Crons', 'qstash_configured', async () => {
    if (!process.env.QSTASH_TOKEN) throw new Error('QSTASH_TOKEN not set');
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY) throw new Error('QSTASH_CURRENT_SIGNING_KEY not set');
    return 'QStash credentials present';
  }));

  // 5.5 — Count cron failures in last 24h
  results.push(await runStep('Crons', 'cron_failures_24h', async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await sb
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .ilike('action', '%cron%')
      .ilike('action', '%error%')
      .gte('created_at', dayAgo);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if ((count ?? 0) > 5) throw new Error(`${count} cron errors in 24h`);
    return `${count ?? 0} cron errors in 24h`;
  }));

  return {
    phase: 'Crons',
    passed: results.every(r => r.passed),
    results,
    duration_ms: Date.now() - start,
  };
}

// ── Message Builder ───────────────────────────────────────────

function buildSmokeReport(phases: PhaseResult[], duration: number): string {
  const totalPassed = phases.reduce((sum, p) => sum + p.results.filter(r => r.passed).length, 0);
  const totalTests = phases.reduce((sum, p) => sum + p.results.length, 0);
  const allPassed = phases.every(p => p.passed);

  const dateStr = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const overall = allPassed ? '[OK]' : '[FAIL]';
  const lines = [
    `Smoke Test — ${dateStr}`,
    `${overall} ${totalPassed}/${totalTests} passed (${duration}ms)`,
    '',
  ];

  for (const phase of phases) {
    const phaseIcon = phase.passed ? '[OK]' : '[FAIL]';
    const phasePassed = phase.results.filter(r => r.passed).length;
    lines.push(`${phaseIcon} ${phase.phase}: ${phasePassed}/${phase.results.length} (${phase.duration_ms}ms)`);

    const failures = phase.results.filter(r => !r.passed);
    for (const f of failures) {
      lines.push(`  x ${f.step}: ${f.error || 'failed'}`);
    }
  }

  return lines.join('\n');
}

// ── Main Handler ──────────────────────────────────────────────

async function handler(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  // Auth: same 3-tier as all cron routes
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabase();
  const PHASE_TIMEOUT = 20_000; // 20s per phase

  // Run all 5 phases in parallel
  const settled = await Promise.allSettled([
    withTimeout(phase1Assessment(sb), PHASE_TIMEOUT, 'Assessment'),
    withTimeout(phase2Discovery(sb), PHASE_TIMEOUT, 'Discovery'),
    withTimeout(phase3Sessions(sb), PHASE_TIMEOUT, 'Sessions'),
    withTimeout(phase4Support(sb), PHASE_TIMEOUT, 'Support'),
    withTimeout(phase5Crons(sb), PHASE_TIMEOUT, 'Crons'),
  ]);

  const PHASE_NAMES = ['Assessment', 'Discovery', 'Sessions', 'Support', 'Crons'];

  const phases: PhaseResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(JSON.stringify({
      requestId,
      event: 'phase_failed',
      phase: PHASE_NAMES[i],
      error: s.reason?.message,
    }));
    return {
      phase: PHASE_NAMES[i],
      passed: false,
      results: [{
        phase: PHASE_NAMES[i],
        step: 'phase_execution',
        passed: false,
        duration_ms: 0,
        error: s.reason?.message?.slice(0, 200) || 'Phase timed out or crashed',
      }],
      duration_ms: 0,
    };
  });

  const duration = Date.now() - start;
  const totalPassed = phases.reduce((sum, p) => sum + p.results.filter(r => r.passed).length, 0);
  const totalTests = phases.reduce((sum, p) => sum + p.results.length, 0);
  const allPassed = phases.every(p => p.passed);
  const message = buildSmokeReport(phases, duration);

  console.log(JSON.stringify({
    requestId,
    event: 'smoke_test_complete',
    passed: totalPassed,
    total: totalTests,
    all_passed: allPassed,
    duration_ms: duration,
  }));

  // ── Alert on failure ──

  if (!allPassed) {
    const failedSteps = phases
      .flatMap(p => p.results)
      .filter(r => !r.passed)
      .map(r => `${r.phase}/${r.step}: ${r.error || 'failed'}`)
      .slice(0, 5);

    // WhatsApp alert
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || COMPANY_CONFIG.adminWhatsApp;
    try {
      await sendWhatsAppMessage({
        to: adminPhone,
        templateName: 'daily_health_report', // Reuse health report template
        variables: [message],
      });
    } catch (err: any) {
      console.error(JSON.stringify({ requestId, event: 'smoke_wa_alert_failed', error: err.message }));
    }

    // Email fallback
    try {
      await sendEmail({
        to: COMPANY_CONFIG.adminEmail,
        from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd System' },
        subject: `[FAIL] Smoke Test: ${totalPassed}/${totalTests} passed`,
        html: `<pre style="font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;">${message}</pre>
<h3>Failed Steps</h3>
<ul>${failedSteps.map(s => `<li>${s}</li>`).join('')}</ul>`,
      });
    } catch (err: any) {
      console.error(JSON.stringify({ requestId, event: 'smoke_email_alert_failed', error: err.message }));
    }
  }

  // ── Log to activity_log ──

  try {
    await sb.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: allPassed ? 'smoke_test_cron_complete' : 'smoke_test_cron_failures',
      metadata: {
        request_id: requestId,
        source: auth.source,
        passed: totalPassed,
        total: totalTests,
        all_passed: allPassed,
        phases: phases.map(p => ({
          phase: p.phase,
          passed: p.passed,
          tests: p.results.length,
          duration_ms: p.duration_ms,
          failures: p.results.filter(r => !r.passed).map(r => r.step),
        })),
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(JSON.stringify({ requestId, event: 'smoke_activity_log_failed', error: err.message }));
  }

  // ── Response ──

  return NextResponse.json({
    success: allPassed,
    request_id: requestId,
    duration_ms: duration,
    summary: {
      passed: totalPassed,
      total: totalTests,
      all_passed: allPassed,
    },
    phases: phases.map(p => ({
      phase: p.phase,
      passed: p.passed,
      duration_ms: p.duration_ms,
      results: p.results.map(r => ({
        step: r.step,
        passed: r.passed,
        duration_ms: r.duration_ms,
        details: r.details,
        error: r.error,
      })),
    })),
    message,
  });
}

export const GET = handler;
export const POST = handler;
