// ============================================================
// FILE: app/api/cron/coach-reminders-1h/route.ts
// ============================================================
// HARDENED VERSION - 1-Hour Session Reminders for Coaches
// Called by QStash schedule every hour
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - QStash signature verification
// - CRON_SECRET + Internal API key fallback
// - Lazy Supabase initialization
// - Request tracing
// - Structured logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import {
  groupSessionsForReminder,
  joinChildNames,
} from '@/lib/scheduling/group-sessions-for-reminder';
import { formatTime12 } from '@/lib/utils/date-format';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- MAIN PROCESSOR ---
async function processReminders(requestId: string, source: string) {
  const startTime = Date.now();
  const results = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const supabase = getServiceSupabase();

    // Calculate IST time
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);

    let targetDateStr = nowIST.toISOString().split('T')[0];
    const currentHour = nowIST.getHours();
    let targetHour = currentHour + 1;

    // Handle midnight rollover (Cinderella Bug Fix)
    // When currentHour is 23, targetHour is 24 → should be 00:00 tomorrow
    if (targetHour >= 24) {
      targetHour = targetHour - 24; // 24 → 0
      const tomorrow = new Date(nowIST);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = tomorrow.toISOString().split('T')[0];
    }

    const targetTimeStart = `${String(targetHour).padStart(2, '0')}:00:00`;
    const targetTimeEnd = `${String(targetHour).padStart(2, '0')}:59:59`;

    console.log(JSON.stringify({
      requestId,
      event: 'coach_reminders_1h_started',
      source,
      targetDate: targetDateStr,
      targetTimeRange: `${targetTimeStart} - ${targetTimeEnd}`,
    }));

    // Get sessions in the next hour
    const { data: sessions, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        batch_id,
        scheduled_date,
        scheduled_time,
        session_type,
        coach_id,
        child_id,
        google_meet_link,
        coach_reminder_1h_sent,
        children (id, name, child_name),
        coaches (id, name, phone, email)
      `)
      .eq('scheduled_date', targetDateStr)
      .eq('status', 'scheduled')
      .gte('scheduled_time', targetTimeStart)
      .lte('scheduled_time', targetTimeEnd)
      .or('coach_reminder_1h_sent.is.null,coach_reminder_1h_sent.eq.false');

    if (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_error',
        error: error.message,
      }));
      return NextResponse.json(
        { success: false, requestId, error: error.message },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'no_sessions_found',
        targetDate: targetDateStr,
        targetTimeRange: `${targetTimeStart} - ${targetTimeEnd}`,
      }));
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No sessions in next hour',
        results,
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'sessions_found',
      count: sessions.length,
    }));

    // Check AiSensy API key
    const aisensyKey = process.env.AISENSY_API_KEY;
    if (!aisensyKey) {
      console.error(JSON.stringify({
        requestId,
        event: 'config_error',
        error: 'AISENSY_API_KEY not configured',
      }));
      return NextResponse.json(
        { success: false, requestId, error: 'WhatsApp API not configured' },
        { status: 500 }
      );
    }

    // Dedupe by batch_id: sessions sharing (batch_id, scheduled_date,
    // scheduled_time) collapse into ONE reminder send per coach per slot.
    // Non-batched rows (batch_id null) fall through as their own groups of
    // one — behavior identical to pre-2.4 for today's 1:1 coaching load.
    type SessionRow = (typeof sessions)[number];
    const groups = groupSessionsForReminder<SessionRow>(sessions);

    console.log(JSON.stringify({
      requestId,
      event: 'groups_built',
      sessionCount: sessions.length,
      groupCount: groups.length,
    }));

    for (const group of groups) {
      const coach = group.primary.coaches as any;

      if (!coach?.phone) {
        results.skipped += group.sessionIds.length;
        results.errors.push(`Group ${group.key}: Coach has no phone`);
        continue;
      }

      const childName = joinChildNames(group.childNames);
      const batchId = group.primary.batch_id ?? null;

      try {
        const waResult = await sendNotification(
          'coach_session_reminder_1h_v3',
          coach.phone,
          {
            child_name: childName,
            session_time: formatTime12(group.primary.scheduled_time),
            meet_link: group.primary.google_meet_link || 'In-person session',
          },
          {
            triggeredBy: 'cron',
            contextType: 'scheduled_session',
            contextId: group.primary.id,
            contextData: {
              batch_id: batchId,
              sibling_session_ids: group.sessionIds,
              child_count: group.sessionIds.length,
            },
          },
        );

        if (waResult.success) {
          await supabase
            .from('scheduled_sessions')
            .update({
              coach_reminder_1h_sent: true,
              coach_reminder_1h_sent_at: new Date().toISOString(),
            })
            .in('id', group.sessionIds);

          results.sent += group.sessionIds.length;

          console.log(JSON.stringify({
            requestId,
            event: 'reminder_sent',
            groupKey: group.key,
            primarySessionId: group.primary.id,
            siblingSessionIds: group.sessionIds,
            childCount: group.sessionIds.length,
            coachName: coach.name,
            childName,
          }));
        } else {
          results.failed += group.sessionIds.length;
          results.errors.push(`Group ${group.key}: ${waResult.reason}`);
        }
      } catch (e: any) {
        results.failed += group.sessionIds.length;
        results.errors.push(`Group ${group.key}: ${e.message}`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================================
    // REPORT DEADLINE REMINDERS (In-Person Sessions)
    // ============================================================
    const reportResults = {
      coachReminders: 0,
      adminEscalations: 0,
      reportErrors: [] as string[],
    };

    try {
      const nowUTC = new Date().toISOString();
      const oneHourLaterUTC = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const twoHoursAgoUTC = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // A) Coach reminder: report deadline approaching (within next hour)
      const { data: approachingSessions } = await supabase
        .from('scheduled_sessions')
        .select(`
          id, session_number, report_deadline, coach_id, child_id,
          children!scheduled_sessions_child_id_fkey (child_name),
          coaches!scheduled_sessions_coach_id_fkey (name, phone)
        `)
        .eq('session_mode', 'offline')
        .is('report_submitted_at', null)
        .in('offline_request_status', ['approved', 'auto_approved'])
        .gt('report_deadline', nowUTC)
        .lte('report_deadline', oneHourLaterUTC)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (approachingSessions && approachingSessions.length > 0) {
        console.log(JSON.stringify({
          requestId,
          event: 'report_deadline_approaching',
          count: approachingSessions.length,
        }));

        for (const s of approachingSessions) {
          const coach = s.coaches as unknown as { name: string | null; phone: string | null } | null;
          const child = s.children as unknown as { child_name: string | null } | null;

          if (!coach?.phone) {
            reportResults.reportErrors.push(`Session ${s.id}: coach has no phone`);
            continue;
          }

          const coachFirstName = coach.name?.split(' ')[0] || 'Coach';
          const childName = child?.child_name?.split(' ')[0] || 'Student';
          const deadlineTime = s.report_deadline
            ? new Date(s.report_deadline).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })
            : 'soon';

          const waResult = await sendNotification(
            'coach_report_deadline_v3',
            coach.phone,
            {
              coach_first_name: coachFirstName,
              child_name: childName,
              deadline_time: deadlineTime,
            },
            {
              triggeredBy: 'cron',
              contextType: 'session',
              contextId: s.id,
            },
          );

          if (waResult.success) {
            reportResults.coachReminders++;
            console.log(JSON.stringify({ requestId, event: 'report_deadline_reminder_sent', sessionId: s.id }));
          } else {
            reportResults.reportErrors.push(`Session ${s.id}: ${waResult.reason}`);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // B) Admin escalation: report deadline passed (within last 2h to limit noise)
      const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';

      const { data: overdueSessions } = await supabase
        .from('scheduled_sessions')
        .select(`
          id, session_number, report_deadline, scheduled_date, coach_id, child_id,
          children!scheduled_sessions_child_id_fkey (child_name),
          coaches!scheduled_sessions_coach_id_fkey (name, phone)
        `)
        .eq('session_mode', 'offline')
        .is('report_submitted_at', null)
        .in('offline_request_status', ['approved', 'auto_approved'])
        .lt('report_deadline', nowUTC)
        .gt('report_deadline', twoHoursAgoUTC)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (overdueSessions && overdueSessions.length > 0) {
        console.log(JSON.stringify({
          requestId,
          event: 'report_deadline_overdue',
          count: overdueSessions.length,
        }));

        for (const s of overdueSessions) {
          const coach = s.coaches as unknown as { name: string | null; phone: string | null } | null;
          const child = s.children as unknown as { child_name: string | null } | null;

          const coachName = coach?.name || 'Unknown Coach';
          const childName = child?.child_name || 'Unknown Student';
          const hoursOverdue = s.report_deadline
            ? String(Math.round((Date.now() - new Date(s.report_deadline).getTime()) / (1000 * 60 * 60)))
            : '?';

          const waResult = await sendNotification('admin_report_overdue_v3', adminPhone, {
            coach_name: coachName,
            child_name: childName,
            session_date: s.scheduled_date || '',
            hours_overdue: hoursOverdue,
          });

          if (waResult.success) {
            reportResults.adminEscalations++;
            console.log(JSON.stringify({ requestId, event: 'report_overdue_admin_alert', sessionId: s.id }));
          } else {
            reportResults.reportErrors.push(`Admin alert ${s.id}: ${waResult.reason}`);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (reportErr: unknown) {
      const msg = reportErr instanceof Error ? reportErr.message : 'Unknown error';
      console.error(JSON.stringify({ requestId, event: 'report_deadline_check_error', error: msg }));
      reportResults.reportErrors.push(`Report deadline check failed: ${msg}`);
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'coach_reminders_1h_executed',
      metadata: {
        request_id: requestId,
        source,
        target_date: targetDateStr,
        target_time: `${targetTimeStart} - ${targetTimeEnd}`,
        sessions_found: sessions.length,
        groups_built: groups.length,
        sent: results.sent,
        failed: results.failed,
        skipped: results.skipped,
        report_coach_reminders: reportResults.coachReminders,
        report_admin_escalations: reportResults.adminEscalations,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'coach_reminders_1h_complete',
      duration: `${duration}ms`,
      results,
      reportResults,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      targetTime: `${targetTimeStart} - ${targetTimeEnd}`,
      results,
      reportResults,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'coach_reminders_1h_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

// --- HANDLERS ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await verifyCronRequest(request);

  if (!auth.isValid) {
    console.error(JSON.stringify({
      requestId,
      event: 'auth_failed',
      error: 'Unauthorized cron request',
    }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processReminders(requestId, auth.source);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await request.text();
  const auth = await verifyCronRequest(request, body);

  if (!auth.isValid) {
    console.error(JSON.stringify({
      requestId,
      event: 'auth_failed',
      error: 'Unauthorized cron request',
    }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processReminders(requestId, auth.source);
}
