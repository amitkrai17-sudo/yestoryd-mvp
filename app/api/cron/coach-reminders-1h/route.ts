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
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- VERIFICATION ---
async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });

      const isValid = await receiver.verify({
        signature,
        body: body || '',
      });

      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash signature verification failed:', e);
    }
  }

  return { isValid: false, source: 'none' };
}

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

    for (const session of sessions) {
      const coach = session.coaches as any;
      const child = session.children as any;

      if (!coach?.phone) {
        results.skipped++;
        results.errors.push(`Session ${session.id}: Coach has no phone`);
        continue;
      }

      const childName = child?.name || child?.child_name || 'Student';
      const coachFirstName = coach.name?.split(' ')[0] || 'Coach';
      const sessionTime = session.scheduled_time?.slice(0, 5) || 'soon';

      try {
        const waResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: aisensyKey,
            campaignName: 'coach_session_1h',
            destination: coach.phone.replace(/\D/g, ''),
            userName: 'Yestoryd',
            templateParams: [coachFirstName, childName, sessionTime],
          }),
        });

        if (waResponse.ok) {
          await supabase
            .from('scheduled_sessions')
            .update({
              coach_reminder_1h_sent: true,
              coach_reminder_1h_sent_at: new Date().toISOString(),
            })
            .eq('id', session.id);

          results.sent++;

          console.log(JSON.stringify({
            requestId,
            event: 'reminder_sent',
            sessionId: session.id,
            coachName: coach.name,
            childName,
          }));
        } else {
          const errText = await waResponse.text();
          results.failed++;
          results.errors.push(`Session ${session.id}: ${errText}`);
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Session ${session.id}: ${e.message}`);
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

          const waResult = await sendWhatsAppMessage({
            to: coach.phone,
            templateName: 'coach_report_deadline',
            variables: [coachFirstName, childName, deadlineTime],
          });

          if (waResult.success) {
            reportResults.coachReminders++;
            console.log(JSON.stringify({ requestId, event: 'report_deadline_reminder_sent', sessionId: s.id }));
          } else {
            reportResults.reportErrors.push(`Session ${s.id}: ${waResult.error}`);
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

          const waResult = await sendWhatsAppMessage({
            to: adminPhone,
            templateName: 'admin_report_overdue',
            variables: [coachName, childName, s.scheduled_date || '', hoursOverdue],
          });

          if (waResult.success) {
            reportResults.adminEscalations++;
            console.log(JSON.stringify({ requestId, event: 'report_overdue_admin_alert', sessionId: s.id }));
          } else {
            reportResults.reportErrors.push(`Admin alert ${s.id}: ${waResult.error}`);
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
      user_email: 'engage@yestoryd.com',
      user_type: 'system',
      action: 'coach_reminders_1h_executed',
      metadata: {
        request_id: requestId,
        source,
        target_date: targetDateStr,
        target_time: `${targetTimeStart} - ${targetTimeEnd}`,
        sessions_found: sessions.length,
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
  const auth = await verifyCronAuth(request);

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
  const auth = await verifyCronAuth(request, body);

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
