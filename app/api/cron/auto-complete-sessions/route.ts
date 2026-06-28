// =============================================================================
// FILE: app/api/cron/auto-complete-sessions/route.ts
// PURPOSE: Auto-complete delivered-but-unconfirmed OFFLINE TUITION sessions.
//   Coaches stopped manual capture and no fallback completion existed, so past
//   offline tuition sessions sat in status='scheduled' forever — never billed,
//   counter never moved. This cron completes them via the SOLE status writer
//   (transitionSessionStatus) with side-effects ON, so the tuition balance
//   deduct + coach payout + sessions_completed counter all fire.
//
//   SAFETY (no double-bill): billing is idempotent independently of this cron —
//     - tuition_session_ledger partial unique index (session_id WHERE
//       reason='session_completed') → repeated deduct is a no-op (23505).
//     - coach_payouts existingPayout guard on (session_id, product_type).
//     - transitionSessionStatus from==='completed' → noop (no side-effects).
//   So a re-run, or a later manual coach completion, can never double-charge.
//
// GRACE: a session is eligible only when its start (scheduled_date +
//   scheduled_time, IST) is > 48h in the past — delivered and settled.
// SCOPE: NO offline_request_status filter (all target rows are NULL; owner
//   decision: treat all past offline tuition as delivered).
// SCHEDULE: dispatcher daily 05:00 IST.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const GRACE_MS = 48 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' for an IST instant via getUTC* (no toISOString rollover). */
function istDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface Result {
  completed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result: Result = { completed: 0, skipped: 0, failed: 0, errors: [] };

  // Coarse pre-filter: IST date of (now − 48h). An eligible row (start > 48h
  // ago) always has scheduled_date <= this date; the precise (date+time) cutoff
  // is applied per-row in JS below.
  const cutoffDateStr = istDateStr(new Date(Date.now() + IST_OFFSET_MS - GRACE_MS));
  const cutoffMs = Date.now() - GRACE_MS; // UTC instant of now − 48h

  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      child_id,
      enrollment_id,
      scheduled_date,
      scheduled_time,
      enrollments!inner (enrollment_type)
    `)
    .eq('status', 'scheduled')
    .eq('session_mode', 'offline')
    .eq('enrollments.enrollment_type', 'tuition')
    .lte('scheduled_date', cutoffDateStr);

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'auto_complete_db_error', error: error.message }));
    return NextResponse.json({ success: false, requestId, error: error.message }, { status: 500 });
  }

  for (const session of sessions ?? []) {
    // Precise grace gate: session start (IST wall-clock) must be > 48h in the past.
    if (!session.scheduled_time) {
      result.skipped++;
      continue;
    }
    const startMs = new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`).getTime();
    if (!Number.isFinite(startMs) || startMs >= cutoffMs) {
      result.skipped++;
      continue;
    }

    try {
      const t = await transitionSessionStatus({
        sessionId: session.id,
        to: 'completed',
        actor: 'cron',
        requestId,
        opts: { sessionsDelivered: 1 },
      });

      if (t.ok && !t.noop) {
        result.completed++;
        await supabase.from('activity_log').insert({
          action: 'session_auto_completed',
          user_email: COMPANY_CONFIG.supportEmail,
          user_type: 'system',
          metadata: {
            session_id: session.id,
            child_id: session.child_id,
            enrollment_id: session.enrollment_id,
            scheduled_date: session.scheduled_date,
            balance_deducted: t.sideEffects.balanceDeducted ?? false,
            payout_inserted: t.sideEffects.payoutInserted ?? false,
            request_id: requestId,
          },
          created_at: new Date().toISOString(),
        });
      } else if (t.noop) {
        // Already completed by a concurrent/earlier path — no side-effects fired.
        result.skipped++;
      } else {
        result.failed++;
        result.errors.push(`Session ${session.id}: ${t.error ?? 'transition_failed'}`);
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Session ${session.id}: ${e?.message ?? 'unknown'}`);
    }

    // Light pacing — matches reminder-cron convention.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(JSON.stringify({
    requestId,
    event: 'auto_complete_sessions_complete',
    completed: result.completed,
    skipped: result.skipped,
    failed: result.failed,
    errorCount: result.errors.length,
  }));

  return NextResponse.json({ success: true, requestId, ...result });
}
