// =============================================================================
// FILE: app/api/cron/parent-reminders-24h/route.ts
// PURPOSE: 24-hour session reminder for parents — TUITION-ONLY.
//          Fires for sessions scheduled on tomorrow's IST date that haven't
//          been reminded yet, sends parent_session_reminder_24h_v3 via Lead Bot.
// SCHEDULE: dispatcher every 60 min (registered in dispatcher JOBS).
// PATTERN:  mirrors app/api/cron/coach-reminders-1h/route.ts structurally;
//           differs in recipient (PARENT, fan-out per child), template, and
//           the SQL inner-join to enrollments for the tuition guard.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { groupSessionsForReminder } from '@/lib/scheduling/group-sessions-for-reminder';
import { formatTime12 } from '@/lib/utils/date-format';
import { ONLINE_24H_TEMPLATE_LIVE } from './_config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

interface ReminderResult {
  sent: number;
  failed: number;
  skipped: number;
  skippedOnline: number;
  errors: string[];
}

async function processReminders(requestId: string): Promise<{ results: ReminderResult; error?: string }> {
  const startTime = Date.now();
  const results: ReminderResult = { sent: 0, failed: 0, skipped: 0, skippedOnline: 0, errors: [] };

  const supabase = createAdminClient();

  // Target = tomorrow's IST date.
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCDate(nowIST.getUTCDate() + 1);
  const targetDateStr = nowIST.toISOString().split('T')[0];

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_24h_started',
    targetDate: targetDateStr,
  }));

  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      batch_id,
      scheduled_date,
      scheduled_time,
      session_mode,
      coach_id,
      child_id,
      enrollment_id,
      parent_reminder_24h_sent,
      children (id, name, child_name, parent_phone),
      coaches (id, name),
      enrollments!inner (enrollment_type)
    `)
    .eq('scheduled_date', targetDateStr)
    .eq('status', 'scheduled')
    .eq('enrollments.enrollment_type', 'tuition')
    .or('parent_reminder_24h_sent.is.null,parent_reminder_24h_sent.eq.false');

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'parent_reminders_24h_db_error',
      error: error.message,
    }));
    return { results, error: error.message };
  }

  if (!sessions || sessions.length === 0) {
    console.log(JSON.stringify({
      requestId,
      event: 'parent_reminders_24h_no_sessions',
      targetDate: targetDateStr,
    }));
    return { results };
  }

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_24h_sessions_found',
    count: sessions.length,
  }));

  type SessionRow = (typeof sessions)[number];
  const groups = groupSessionsForReminder<SessionRow>(sessions);

  for (const group of groups) {
    // C1 fan-out: one reminder per session in the group (one parent per child).
    // batch grouping is preserved for context logging + bulk-update symmetry.
    for (const sib of group.siblings) {
      const child = Array.isArray(sib.children) ? sib.children[0] : sib.children;
      const coach = Array.isArray(sib.coaches) ? sib.coaches[0] : sib.coaches;

      if (!child?.parent_phone) {
        results.skipped++;
        results.errors.push(`Session ${sib.id}: no parent phone`);
        continue;
      }

      const isOnline = sib.session_mode === 'online';

      // Gate online sessions until _online_v1 is APPROVED on Meta + DB row flipped.
      if (isOnline && !ONLINE_24H_TEMPLATE_LIVE) {
        results.skippedOnline++;
        console.log(JSON.stringify({
          requestId,
          event: 'parent_reminder_24h_online_gated',
          sessionId: sib.id,
          reason: 'ONLINE_24H_TEMPLATE_LIVE=false',
        }));
        continue;
      }

      const childName = child.child_name || child.name || 'your child';
      const coachName = coach?.name || 'your coach';

      // 24h online has NO button (the join link arrives in the 1h reminder).
      const templateCode = isOnline
        ? 'parent_session_reminder_24h_online_v1'
        : 'parent_session_reminder_24h_v3';

      try {
        const waResult = await sendNotification(
          templateCode,
          child.parent_phone,
          {
            child_name: childName,
            time: formatTime12(sib.scheduled_time),
            coach_name: coachName,
          },
          {
            triggeredBy: 'cron',
            contextType: 'scheduled_session',
            contextId: sib.id,
            // 2B dedup scope (template.dedup_scope = [contextId, scheduledDate]):
            // raw DB scheduled_date string; survives reschedule (which resets the marker).
            scheduledDate: sib.scheduled_date,
            contextData: {
              batch_id: sib.batch_id ?? null,
              group_key: group.key,
              session_mode: sib.session_mode,
            },
          },
        );

        if (waResult.success || waResult.deferred) {
          // 1a: latch the per-template sent flag on a real send OR a successful
          // quiet-hours deferral. notify.ts returns {success:false, deferred:true}
          // when it parks the send in communication_queue; the drained row carries
          // the actual send, so latching here stops the hourly re-enqueue loop.
          await supabase
            .from('scheduled_sessions')
            .update({
              parent_reminder_24h_sent: true,
              parent_reminder_24h_sent_at: new Date().toISOString(),
            })
            .eq('id', sib.id);
          if (waResult.success) results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Session ${sib.id}: ${waResult.reason ?? 'send_failed'}`);
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Session ${sib.id}: ${e?.message ?? 'unknown'}`);
      }

      // Light pacing — matches coach-reminders-1h convention.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_24h_complete',
    durationMs: Date.now() - startTime,
    sent: results.sent,
    failed: results.failed,
    skipped: results.skipped,
    skippedOnline: results.skippedOnline,
    errorCount: results.errors.length,
  }));

  return { results };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results, error } = await processReminders(requestId);

  if (error) {
    return NextResponse.json({ success: false, requestId, error, results }, { status: 500 });
  }
  return NextResponse.json({ success: true, requestId, results });
}
