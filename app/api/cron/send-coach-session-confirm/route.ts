// =============================================================================
// FILE: app/api/cron/send-coach-session-confirm/route.ts
// PURPOSE: At end-of-class, prompt the session's coach with
//   coach_session_confirm_v1 (3 quick-reply buttons → complete / cancel /
//   missed) ONCE per past-due, undispositioned TUITION session (online AND
//   offline). Per-send button payloads carry csc_<action>:<sessionId> so the
//   inbound tap resolves the exact session (handled by
//   lib/whatsapp/handlers/coach-session-confirm.ts).
//
//   forceImmediate → never defers to communication_queue (the drainer strips
//   templateButtons). Once-only gate: scheduled_sessions.coach_confirm_sent_at
//   (stamped on send success; NULL rows only) + the template's
//   dedup_scope={contextId} backstop.
//
// NOT YET REGISTERED in dispatcher — pending Step 5 autocomplete rework
// (blind-bill race). Register as { type:'interval', minutes:60 } when Step 5
// lands.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { formatDayMonth, formatTime12 } from '@/lib/utils/date-format';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throttle: cap SUCCESSFUL sends per run. Single-coach today; a global
// oldest-first cap == per-coach cap. If a 2nd coach joins, switch to per-coach
// capping to avoid starving one.
const CONFIRM_BATCH_PER_RUN = 8;

interface Result {
  candidates: number;
  sent: number;
  skipped_no_coach: number;
  skipped_not_ended: number;
  failed: number;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result: Result = { candidates: 0, sent: 0, skipped_no_coach: 0, skipped_not_ended: 0, failed: 0 };

  // Candidates: TUITION, still 'scheduled', not yet prompted (online AND offline).
  // coach_confirm_sent_at is the once-only query gate (column added by migration
  // 20260628120000, applied to live DB via MCP after deploy).
  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, scheduled_date, scheduled_time, duration_minutes, enrollments!inner(enrollment_type)')
    .eq('status', 'scheduled')
    .eq('enrollments.enrollment_type', 'tuition')
    // TODO: type properly after database.types regen (coach_confirm_sent_at)
    .is('coach_confirm_sent_at' as any, null)
    .order('scheduled_date', { ascending: true }); // oldest-first (pairs with the per-run cap)

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'cron_coach_session_confirm_db_error', error: error.message }));
    return NextResponse.json({ success: false, requestId, error: error.message }, { status: 500 });
  }

  result.candidates = sessions?.length ?? 0;

  for (const session of sessions ?? []) {
    try {
      // 1. END-TIME gate — class must have ended. IST-safe +05:30 anchor; never toISOString.
      if (!session.scheduled_time) { result.skipped_not_ended++; continue; }
      const endMs =
        new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`).getTime() +
        (session.duration_minutes || 45) * 60 * 1000;
      if (!Number.isFinite(endMs) || endMs > Date.now()) { result.skipped_not_ended++; continue; }

      // 2. Coach phone — required to address the confirm.
      if (!session.coach_id) { result.skipped_no_coach++; continue; }
      const { data: coach } = await supabase
        .from('coaches')
        .select('phone')
        .eq('id', session.coach_id)
        .maybeSingle();
      const coachPhone = coach?.phone ?? null;
      if (!coachPhone) { result.skipped_no_coach++; continue; }

      // 3. Child canonical FULL name (Pattern B: DB derives child_first_name).
      let childName = 'your student';
      if (session.child_id) {
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name')
          .eq('id', session.child_id)
          .maybeSingle();
        childName = child?.child_name || child?.name || childName;
      }

      // 4. SEND — forceImmediate (never queue → templateButtons preserved),
      //    contextId=sessionId, per-send payloads carry csc_<action>:<sessionId>.
      const waResult = await sendNotification(
        'coach_session_confirm_v1',
        coachPhone,
        {
          child_name: childName,
          session_date: formatDayMonth(session.scheduled_date),
          session_time: formatTime12(session.scheduled_time),
        },
        {
          triggeredBy: 'cron',
          contextType: 'scheduled_session',
          contextId: session.id,
          forceImmediate: true,
          templateButtons: {
            category: 'marketing_quick_reply',
            payloads: [
              { id: 'csc_yes:' + session.id,    title: 'Yes, class happened' },
              { id: 'csc_no:' + session.id,     title: "Class didn't happen" },
              { id: 'csc_noshow:' + session.id, title: "Child didn't attend" },
            ],
          },
        },
      );

      // 5. ONCE-ONLY STAMP — only on send success (a failure retries next tick).
      if (waResult.success) {
        await supabase
          .from('scheduled_sessions')
          // TODO: type properly after database.types regen (coach_confirm_sent_at)
          .update({ coach_confirm_sent_at: new Date().toISOString() } as any)
          .eq('id', session.id);
        result.sent++;
        // Throttle: only SUCCESSFUL sends count toward the cap (skips do not).
        if (result.sent >= CONFIRM_BATCH_PER_RUN) break;
      } else {
        result.failed++;
      }
    } catch (e: any) {
      result.failed++;
      console.error(JSON.stringify({
        requestId,
        event: 'cron_coach_session_confirm_row_error',
        sessionId: session.id,
        error: e?.message ?? 'unknown',
      }));
    }

    // Light pacing — matches reminder / auto-complete convention.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(JSON.stringify({
    requestId,
    event: 'cron_coach_session_confirm',
    candidates: result.candidates,
    sent: result.sent,
    skipped_no_coach: result.skipped_no_coach,
    skipped_not_ended: result.skipped_not_ended,
    failed: result.failed,
  }));

  return NextResponse.json({ success: true, requestId, ...result });
}
