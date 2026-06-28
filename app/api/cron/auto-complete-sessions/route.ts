// =============================================================================
// FILE: app/api/cron/auto-complete-sessions/route.ts
// PURPOSE: ESCALATE-ONLY (blind-bill removed Step 5). Billing now flows solely
//   from the coach tap (offline → lib/whatsapp/handlers/coach-session-confirm)
//   or Recall (online). This cron only escalates sessions left unconfirmed 48h
//   after the coach prompt — it NEVER completes/bills.
//
//   Selection: tuition sessions still 'scheduled', prompted (coach_confirm_sent_at
//   IS NOT NULL) >= 48h ago, not yet escalated (coach_confirm_escalated_at IS NULL).
//   Online + offline — recall-completed online rows are already terminal, so they
//   are excluded by status='scheduled'. Per row: notify admin via
//   admin_report_overdue_v3, write activity_log, and stamp
//   coach_confirm_escalated_at (once-only). Locked policy: nothing is auto-billed
//   — silence = no charge.
// SCHEDULE: dispatcher daily 08:00 IST.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ESCALATE_AFTER_MS = 48 * 60 * 60 * 1000;

interface Result {
  candidates: number;
  escalated: number;
  skipped_no_coach: number;
  failed: number;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result: Result = { candidates: 0, escalated: 0, skipped_no_coach: 0, failed: 0 };
  const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';

  // Prompted-but-unconfirmed >= 48h tuition sessions, not yet escalated.
  // Cast to any: coach_confirm_sent_at / coach_confirm_escalated_at are not in
  // the generated types yet (migrations 20260628120000 / 20260628130000).
  // TODO: drop the cast after database.types regen.
  const { data: sessions, error } = await (supabase as any)
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, scheduled_date, scheduled_time, coach_confirm_sent_at, enrollments!inner(enrollment_type)')
    .eq('status', 'scheduled')
    .eq('enrollments.enrollment_type', 'tuition')
    .not('coach_confirm_sent_at', 'is', null)
    .lt('coach_confirm_sent_at', new Date(Date.now() - ESCALATE_AFTER_MS).toISOString())
    .is('coach_confirm_escalated_at', null);

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'session_confirm_escalate_db_error', error: error.message }));
    return NextResponse.json({ success: false, requestId, error: error.message }, { status: 500 });
  }

  const rows: any[] = sessions ?? [];
  result.candidates = rows.length;

  for (const session of rows) {
    try {
      // 1. Coach — required to name in the escalation; skip if absent.
      if (!session.coach_id) { result.skipped_no_coach++; continue; }
      const { data: coach } = await supabase
        .from('coaches')
        .select('name')
        .eq('id', session.coach_id)
        .maybeSingle();
      const coachName = coach?.name || 'Unknown Coach';

      // 2. Child name.
      let childName = 'Unknown Student';
      if (session.child_id) {
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name')
          .eq('id', session.child_id)
          .maybeSingle();
        childName = child?.child_name || child?.name || childName;
      }

      // 3. hours_overdue since the coach prompt (matches the admin_report_overdue_v3 contract).
      const sentAt = session.coach_confirm_sent_at as string | null;
      const hoursOverdue = sentAt
        ? String(Math.round((Date.now() - new Date(sentAt).getTime()) / 3_600_000))
        : '?';

      // 4. Escalate to admin (reuse admin_report_overdue_v3; session_date passed RAW,
      //    matching the coach-reminders-1h caller). No forceImmediate (no buttons; the
      //    08:00 send is outside quiet hours).
      const waResult = await sendNotification('admin_report_overdue_v3', adminPhone, {
        coach_name: coachName,
        child_name: childName,
        session_date: session.scheduled_date || '',
        hours_overdue: hoursOverdue,
      });

      // 5. ONLY on send success: audit + stamp the once-only escalation gate.
      //    On failure, do NOT stamp (retries next run). NEVER touch status/balance/payout.
      if (waResult.success) {
        await supabase.from('activity_log').insert({
          action: 'session_confirm_escalated',
          user_email: COMPANY_CONFIG.supportEmail,
          user_type: 'system',
          metadata: {
            session_id: session.id,
            child_id: session.child_id,
            coach_id: session.coach_id,
            scheduled_date: session.scheduled_date,
            hours_overdue: hoursOverdue,
            request_id: requestId,
          },
          created_at: new Date().toISOString(),
        });
        await supabase
          .from('scheduled_sessions')
          // TODO: type properly after database.types regen (coach_confirm_escalated_at)
          .update({ coach_confirm_escalated_at: new Date().toISOString() } as any)
          .eq('id', session.id);
        result.escalated++;
      } else {
        result.failed++;
      }
    } catch (e: any) {
      result.failed++;
      console.error(JSON.stringify({
        requestId,
        event: 'session_confirm_escalate_row_error',
        sessionId: session.id,
        error: e?.message ?? 'unknown',
      }));
    }

    // Light pacing — matches reminder-cron convention.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(JSON.stringify({
    requestId,
    event: 'session_confirm_escalate_complete',
    candidates: result.candidates,
    escalated: result.escalated,
    skipped_no_coach: result.skipped_no_coach,
    failed: result.failed,
  }));

  return NextResponse.json({ success: true, requestId, ...result });
}
