// =============================================================================
// FILE: app/api/cron/parent-reminders-1h/route.ts
// PURPOSE: 1-hour session reminder for parents — TUITION-ONLY.
//          OFFLINE sessions → parent_session_reminder_1h_v3 (plain body, no button).
//          ONLINE  sessions → parent_session_reminder_1h_online_v1 (utility_cta
//          with /j/<sessionId> URL button) — GATED behind ONLINE_1H_TEMPLATE_LIVE
//          because that template is UNDER REVIEW at Meta.
// SCHEDULE: dispatcher every 60 min.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { groupSessionsForReminder } from '@/lib/scheduling/group-sessions-for-reminder';
import { ONLINE_1H_TEMPLATE_LIVE } from './_config';

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

  // Target = sessions starting in the next IST hour (current hour + 1).
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  let targetDateStr = nowIST.toISOString().split('T')[0];
  const currentHour = nowIST.getUTCHours();
  let targetHour = currentHour + 1;

  // Cinderella fix (mirrors coach-reminders-1h:57-64).
  if (targetHour >= 24) {
    targetHour = targetHour - 24;
    const tomorrow = new Date(nowIST);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    targetDateStr = tomorrow.toISOString().split('T')[0];
  }

  const targetTimeStart = `${String(targetHour).padStart(2, '0')}:00:00`;
  const targetTimeEnd = `${String(targetHour).padStart(2, '0')}:59:59`;

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_1h_started',
    targetDate: targetDateStr,
    targetTimeRange: `${targetTimeStart} - ${targetTimeEnd}`,
    onlineTemplateLive: ONLINE_1H_TEMPLATE_LIVE,
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
      parent_reminder_1h_sent,
      children (id, name, child_name, parent_phone),
      coaches (id, name),
      enrollments!inner (enrollment_type)
    `)
    .eq('scheduled_date', targetDateStr)
    .eq('status', 'scheduled')
    .eq('enrollments.enrollment_type', 'tuition')
    .gte('scheduled_time', targetTimeStart)
    .lte('scheduled_time', targetTimeEnd)
    .or('parent_reminder_1h_sent.is.null,parent_reminder_1h_sent.eq.false');

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'parent_reminders_1h_db_error',
      error: error.message,
    }));
    return { results, error: error.message };
  }

  if (!sessions || sessions.length === 0) {
    console.log(JSON.stringify({
      requestId,
      event: 'parent_reminders_1h_no_sessions',
      targetDate: targetDateStr,
    }));
    return { results };
  }

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_1h_sessions_found',
    count: sessions.length,
  }));

  type SessionRow = (typeof sessions)[number];
  const groups = groupSessionsForReminder<SessionRow>(sessions);

  for (const group of groups) {
    for (const sib of group.siblings) {
      const child = Array.isArray(sib.children) ? sib.children[0] : sib.children;
      const coach = Array.isArray(sib.coaches) ? sib.coaches[0] : sib.coaches;

      if (!child?.parent_phone) {
        results.skipped++;
        results.errors.push(`Session ${sib.id}: no parent phone`);
        continue;
      }

      const isOnline = sib.session_mode === 'online';

      // Gate online sessions until _online_v1 is Active on Meta.
      if (isOnline && !ONLINE_1H_TEMPLATE_LIVE) {
        results.skippedOnline++;
        console.log(JSON.stringify({
          requestId,
          event: 'parent_reminder_1h_online_gated',
          sessionId: sib.id,
          reason: 'ONLINE_1H_TEMPLATE_LIVE=false',
        }));
        continue;
      }

      const childName = child.child_name || child.name || 'your child';
      const coachName = coach?.name || 'your coach';

      const templateCode = isOnline
        ? 'parent_session_reminder_1h_online_v1'
        : 'parent_session_reminder_1h_v3';

      try {
        const waResult = await sendNotification(
          templateCode,
          child.parent_phone,
          {
            child_name: childName,
            coach_name: coachName,
          },
          {
            triggeredBy: 'cron',
            contextType: 'scheduled_session',
            contextId: sib.id,
            contextData: {
              batch_id: sib.batch_id ?? null,
              group_key: group.key,
              session_mode: sib.session_mode,
            },
            ...(isOnline
              ? { templateButtons: { category: 'utility_cta' as const, url: `j/${sib.id}` } }
              : {}),
          },
        );

        if (waResult.success) {
          await supabase
            .from('scheduled_sessions')
            .update({
              parent_reminder_1h_sent: true,
              parent_reminder_1h_sent_at: new Date().toISOString(),
            })
            .eq('id', sib.id);
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Session ${sib.id}: ${waResult.reason ?? 'send_failed'}`);
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Session ${sib.id}: ${e?.message ?? 'unknown'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(JSON.stringify({
    requestId,
    event: 'parent_reminders_1h_complete',
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
