// ============================================================
// FILE: app/api/admin/sessions/[id]/force-complete/route.ts
// PURPOSE: Admin escape hatch for sessions stuck in scheduled state
//          (e.g. coach never confirmed an AI-prefilled SCF).
//
// This is a deliberate intelligence-loss path. The endpoint:
//   1. Inserts a synthetic structured_capture_responses row marking the
//      session as admin-completed (capture_method='admin_force_complete',
//      coach_id=NULL, engagement_level='unknown', reason in custom_struggle_note)
//   2. Updates the session to status='completed', payout_processed=false
//   3. Writes a full activity_log audit row with the original session
//      snapshot for forensic recovery
//
// EXPLICITLY OMITTED (intentional, not oversight):
//   - parent_summary generation
//   - learning_events insertion
//   - QStash post-capture-orchestrator dispatch
//   - WhatsApp parent_session_summary template send
//
// The caller acknowledges this loss via acknowledge_intelligence_loss=true
// in the request body. Without that flag the request is rejected.
//
// SQL CHECK constraint dependencies (added by migration
// 20260426094500_extend_check_constraints_admin_force_complete):
//   - capture_method   ⊃ 'admin_force_complete'
//   - engagement_level ⊃ 'unknown'
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inferModality } from '@/lib/intelligence/modality';

export const dynamic = 'force-dynamic';

const MIN_REASON_LENGTH = 20;

interface ForceCompleteBody {
  reason?: unknown;
  acknowledge_intelligence_loss?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: sessionId } = await params;

  // ── 1. Auth ──
  // Spec: 403 (not 401) if non-admin. requireAdmin() returns
  // { authorized: false } for both unauthenticated and non-admin cases.
  // We collapse both to 403 since this is an admin-only tool and the
  // distinction between "not logged in" and "logged in but not admin" is
  // not informationally useful here.
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const adminEmail = auth.email!;
  const adminUserId = auth.userId!;

  // ── 2. Validate body ──
  let body: ForceCompleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length < MIN_REASON_LENGTH) {
    return NextResponse.json(
      { error: `Reason required (minimum ${MIN_REASON_LENGTH} characters)` },
      { status: 400 },
    );
  }
  if (body.acknowledge_intelligence_loss !== true) {
    return NextResponse.json(
      { error: 'Must acknowledge intelligence loss' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // ── 3. Fetch session + state snapshot ──
  const { data: session, error: fetchErr } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchErr) {
    console.error(JSON.stringify({
      event: 'force_complete_fetch_error',
      sessionId, adminEmail, error: fetchErr.message,
    }));
    Sentry.captureException(fetchErr, { extra: { sessionId, adminEmail } });
    return NextResponse.json(
      { error: `DB error: ${fetchErr.message}` },
      { status: 500 },
    );
  }
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const originalRow = session as Record<string, any>;
  const originalStatus = originalRow.status as string | null;

  if (originalStatus === 'completed') {
    return NextResponse.json({ error: 'Already completed' }, { status: 409 });
  }
  if (originalStatus === 'cancelled') {
    return NextResponse.json({ error: 'Session was cancelled' }, { status: 409 });
  }

  // ── 4. Step 1: INSERT synthetic capture ──
  const sessionMode = (originalRow.session_mode as string | null) ?? undefined;
  const completedAt = new Date().toISOString();
  const captureSessionDate =
    (originalRow.scheduled_date as string | null) ?? completedAt.split('T')[0];

  const { data: synthCapture, error: captureErr } = await supabase
    .from('structured_capture_responses')
    .insert({
      session_id: sessionId,
      child_id: originalRow.child_id,
      coach_id: null, // admin action, not coach
      session_modality: inferModality({ sessionMode }),
      capture_method: 'admin_force_complete',
      coach_confirmed: true,
      ai_prefilled: false,
      skills_covered: [],
      engagement_level: 'unknown',
      custom_struggle_note: reason,
      submitted_at: completedAt,
      session_date: captureSessionDate,
    } as any)
    .select('id')
    .single();

  if (captureErr || !synthCapture) {
    console.error(JSON.stringify({
      event: 'force_complete_capture_insert_error',
      sessionId, adminEmail, error: captureErr?.message,
    }));
    Sentry.captureException(
      captureErr ?? new Error('Synthetic capture insert returned no row'),
      { extra: { sessionId, adminEmail } },
    );
    return NextResponse.json(
      { error: `Failed to insert synthetic capture: ${captureErr?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }
  const syntheticCaptureId = synthCapture.id as string;

  // ── 5. Step 2: UPDATE session ──
  const { error: sessionUpdateErr } = await supabase
    .from('scheduled_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      capture_id: syntheticCaptureId,
      payout_processed: false, // monthly-payouts cron picks this up
    })
    .eq('id', sessionId);

  if (sessionUpdateErr) {
    // Best-effort rollback: delete the orphan synthetic capture so we don't
    // leave it linked to a still-scheduled session.
    await supabase.from('structured_capture_responses').delete().eq('id', syntheticCaptureId);
    console.error(JSON.stringify({
      event: 'force_complete_session_update_error',
      sessionId, adminEmail, syntheticCaptureId, error: sessionUpdateErr.message,
    }));
    Sentry.captureException(sessionUpdateErr, {
      extra: { sessionId, adminEmail, syntheticCaptureId, rolledBack: true },
    });
    return NextResponse.json(
      { error: `Failed to update session, rolled back: ${sessionUpdateErr.message}` },
      { status: 500 },
    );
  }

  // ── 6. Step 3: INSERT activity_log (P0 — retry once on failure) ──
  const auditMetadata = {
    reason,
    original_status: originalStatus,
    original_state_snapshot: originalRow,
    synthetic_capture_id: syntheticCaptureId,
    completed_at: completedAt,
    resource_type: 'scheduled_session',
    resource_id: sessionId,
    actor_id: adminUserId,
  };

  const auditAttempt = () =>
    supabase.from('activity_log').insert({
      user_email: adminEmail,
      user_type: 'admin',
      action: 'admin_force_complete_session',
      page_path: request.nextUrl.pathname,
      metadata: auditMetadata,
    });

  let auditResult = await auditAttempt();
  if (auditResult.error) {
    console.warn(JSON.stringify({
      event: 'force_complete_audit_log_retry',
      sessionId, adminEmail, error: auditResult.error.message,
    }));
    auditResult = await auditAttempt();
  }
  if (auditResult.error) {
    // P0: session is already completed but the audit trail is missing.
    // Surface as PARTIAL so ops can manually reconcile from logs/Sentry.
    console.error(JSON.stringify({
      event: 'force_complete_audit_log_p0',
      sessionId, adminEmail, syntheticCaptureId, completedAt,
      error: auditResult.error.message,
    }));
    Sentry.captureException(auditResult.error, {
      level: 'fatal',
      extra: { sessionId, adminEmail, syntheticCaptureId, completedAt, reason },
      tags: { force_complete_partial: 'true' },
    });
    return NextResponse.json(
      {
        error: 'PARTIAL: session updated but audit log failed, manual reconciliation needed',
        session_id: sessionId,
        synthetic_capture_id: syntheticCaptureId,
        audit_error: auditResult.error.message,
      },
      { status: 500 },
    );
  }

  // ── 7. Success — DELIBERATE OMISSIONS ──
  // We do NOT trigger:
  //   - parent_summary generation
  //   - learning_events insertion (no skills, no observations, no signal)
  //   - queuePostCaptureOrchestrator (would homework-spam parents)
  //   - sendNotification('parent_session_summary_*') (no real summary to send)
  //
  // Intelligence loss is intentional: the session had no observable data
  // (coach never confirmed). Synthesizing a parent-facing summary would be
  // dishonest. Acknowledged via acknowledge_intelligence_loss=true.
  return NextResponse.json({
    success: true,
    session_id: sessionId,
    synthetic_capture_id: syntheticCaptureId,
    message:
      'Session force-completed. Payout will process in next monthly cycle. No parent summary sent.',
  });
}
