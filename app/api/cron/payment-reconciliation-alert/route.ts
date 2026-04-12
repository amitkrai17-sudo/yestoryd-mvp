// ============================================================
// FILE: app/api/cron/payment-reconciliation-alert/route.ts
// ============================================================
// Payment Reconciliation Alert — Session Scheduling Safety Net
// Detects enrollments where payment succeeded but 0 sessions
// were scheduled (QStash job or Google Calendar failure).
// Schedule: */30 * * * * (every 30 minutes)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { loadAuthConfig } from '@/lib/config/loader';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;


// --- TYPES ---

interface StuckEnrollment {
  id: string;
  child_name: string;
  parent_name: string;
  parent_phone: string | null;
  created_at: string;
  minutes_ago: number;
  at_risk: boolean;
  at_risk_reason: string | null;
}

// ============================================================
// GET - Run Reconciliation Alert Check
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(JSON.stringify({ requestId, event: 'reconciliation_alert_start', source: auth.source }));

  const supabase = createAdminClient();

  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // 1. Find active enrollments created in last 2 hours, older than 30 min
    //    (gives the enrollment-complete job time to run before alerting)
    const { data: recentEnrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        id,
        created_at,
        at_risk,
        at_risk_reason,
        child_id,
        children (child_name, parent_name, parent_phone)
      `)
      .eq('status', 'active')
      .gte('created_at', twoHoursAgo)
      .lte('created_at', thirtyMinAgo);

    if (enrollError) {
      console.error(JSON.stringify({ requestId, event: 'enrollment_query_error', error: enrollError.message }));
      return NextResponse.json({ error: 'Query failed', requestId }, { status: 500 });
    }

    if (!recentEnrollments || recentEnrollments.length === 0) {
      await logExecution(supabase, requestId, auth.source, { checked: 0, stuck: 0 });
      return NextResponse.json({ success: true, requestId, checked: 0, stuck: 0 });
    }

    // 2. Get session counts for these enrollments in one batch query
    const enrollmentIds = recentEnrollments.map(e => e.id);
    const { data: sessionCounts, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('enrollment_id')
      .in('enrollment_id', enrollmentIds);

    if (sessionError) {
      console.error(JSON.stringify({ requestId, event: 'session_count_error', error: sessionError.message }));
    }

    // Build a set of enrollment IDs that have at least one session
    const enrollmentsWithSessions = new Set(
      (sessionCounts || []).map(s => s.enrollment_id)
    );

    // 3. Find stuck enrollments: 0 sessions OR flagged as scheduling_failed
    const stuck: StuckEnrollment[] = [];

    for (const enrollment of recentEnrollments) {
      const hasSessions = enrollmentsWithSessions.has(enrollment.id);
      const isSchedulingFailed = enrollment.at_risk_reason?.startsWith('scheduling_failed');

      if (!hasSessions || isSchedulingFailed) {
        const child = enrollment.children as any;
        const minutesAgo = Math.round((now.getTime() - new Date(enrollment.created_at!).getTime()) / 60000);

        stuck.push({
          id: enrollment.id,
          child_name: child?.child_name || 'Unknown',
          parent_name: child?.parent_name || 'Unknown',
          parent_phone: child?.parent_phone || null,
          created_at: enrollment.created_at!,
          minutes_ago: minutesAgo,
          at_risk: (enrollment.at_risk as boolean) ?? false,
          at_risk_reason: enrollment.at_risk_reason,
        });
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'reconciliation_alert_analysis',
      checked: recentEnrollments.length,
      stuck: stuck.length,
    }));

    if (stuck.length === 0) {
      await logExecution(supabase, requestId, auth.source, {
        checked: recentEnrollments.length,
        stuck: 0,
      });
      return NextResponse.json({
        success: true,
        requestId,
        checked: recentEnrollments.length,
        stuck: 0,
      });
    }

    // 4. Dedup: check activity_log for recent alerts on these enrollment IDs
    const { data: recentAlerts } = await supabase
      .from('activity_log')
      .select('metadata')
      .eq('action', 'scheduling_alert_sent')
      .gte('created_at', twoHoursAgo);

    const alreadyAlertedIds = new Set<string>();
    for (const alert of recentAlerts || []) {
      const meta = alert.metadata as any;
      if (meta?.enrollment_id) {
        alreadyAlertedIds.add(meta.enrollment_id);
      }
    }

    const newStuck = stuck.filter(s => !alreadyAlertedIds.has(s.id));

    if (newStuck.length === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'all_stuck_already_alerted',
        stuckCount: stuck.length,
      }));
      await logExecution(supabase, requestId, auth.source, {
        checked: recentEnrollments.length,
        stuck: stuck.length,
        newAlerts: 0,
        deduplicated: stuck.length,
      });
      return NextResponse.json({
        success: true,
        requestId,
        checked: recentEnrollments.length,
        stuck: stuck.length,
        newAlerts: 0,
      });
    }

    // 5. Send alerts for new stuck enrollments
    let alertsSent = 0;

    for (const enrollment of newStuck) {
      // 5a. WhatsApp alert to admin
      const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';
      const reason = enrollment.at_risk_reason?.startsWith('scheduling_failed')
        ? 'Calendar scheduling failed'
        : '0 sessions scheduled';

      await sendWhatsAppMessage({
        to: adminPhone,
        templateName: 'admin_scheduling_alert_v3',
        variables: [
          enrollment.child_name,
          enrollment.id.slice(0, 8),
          String(enrollment.minutes_ago),
          reason,
        ],
      }).catch(err =>
        console.error(JSON.stringify({
          requestId,
          event: 'whatsapp_alert_failed',
          enrollmentId: enrollment.id,
          error: String(err),
        }))
      );

      // 5b. Email alert (reliable fallback — no template dependency)
      await sendEmailAlert(enrollment, requestId).catch(err =>
        console.error(JSON.stringify({
          requestId,
          event: 'email_alert_failed',
          enrollmentId: enrollment.id,
          error: String(err),
        }))
      );

      // 5c. In-app notification for admin users
      await sendInAppNotification(supabase, enrollment, requestId).catch(err =>
        console.error(JSON.stringify({
          requestId,
          event: 'in_app_notify_failed',
          enrollmentId: enrollment.id,
          error: String(err),
        }))
      );

      // 5d. Log each alert to activity_log for dedup
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'scheduling_alert_sent',
        metadata: {
          request_id: requestId,
          enrollment_id: enrollment.id,
          child_name: enrollment.child_name,
          parent_name: enrollment.parent_name,
          minutes_since_creation: enrollment.minutes_ago,
          reason,
          at_risk: enrollment.at_risk,
        },
      });

      alertsSent++;
    }

    // 6. Log cron execution summary
    const summary = {
      checked: recentEnrollments.length,
      stuck: stuck.length,
      newAlerts: alertsSent,
      deduplicated: stuck.length - newStuck.length,
    };

    await logExecution(supabase, requestId, auth.source, summary);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'reconciliation_alert_complete',
      ...summary,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ success: true, requestId, ...summary });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'reconciliation_alert_error',
      error: String(error),
      duration: `${duration}ms`,
    }));

    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'scheduling_alert_cron_error',
        metadata: { request_id: requestId, error: String(error) },
      });
    } catch { /* best-effort */ }

    return NextResponse.json({ error: 'Reconciliation alert failed', requestId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// --- HELPERS ---

async function logExecution(
  supabase: ReturnType<typeof createAdminClient>,
  requestId: string,
  source: string,
  summary: Record<string, number>,
) {
  await supabase.from('activity_log').insert({
    user_email: COMPANY_CONFIG.supportEmail,
    user_type: 'system',
    action: 'scheduling_alert_cron_completed',
    metadata: {
      request_id: requestId,
      source,
      ...summary,
      completed_at: new Date().toISOString(),
    },
  });
}

async function sendEmailAlert(enrollment: StuckEnrollment, requestId: string) {
  const { sendEmail } = require('@/lib/email/resend-client');

  const reason = enrollment.at_risk_reason?.startsWith('scheduling_failed')
    ? `Calendar scheduling failed: ${enrollment.at_risk_reason}`
    : 'No sessions found in database';

  await sendEmail({
    to: COMPANY_CONFIG.adminEmail,
    from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd System' },
    subject: `⚠️ Enrollment ${enrollment.id.slice(0, 8)} — Payment OK, 0 Sessions Scheduled`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#dc2626;">Scheduling Alert</h2>
        <p>An enrollment has payment confirmed but <strong>0 sessions scheduled</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;font-weight:bold;">Enrollment ID</td><td style="padding:8px;">${enrollment.id}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Child</td><td style="padding:8px;">${enrollment.child_name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Parent</td><td style="padding:8px;">${enrollment.parent_name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Created</td><td style="padding:8px;">${enrollment.minutes_ago} minutes ago</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Reason</td><td style="padding:8px;color:#dc2626;">${reason}</td></tr>
        </table>
        <p>Check QStash logs and Google Calendar API status. The parent has paid but sees an empty dashboard.</p>
        <p style="margin-top:16px;">
          <a href="https://yestoryd.com/admin/enrollments" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Admin Enrollments
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
          Request ID: ${requestId} | ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
      </div>`,
  });
}

async function sendInAppNotification(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: StuckEnrollment,
  requestId: string,
) {
  // Look up admin user IDs
  let adminEmails: string[];
  try {
    const authConfig = await loadAuthConfig();
    adminEmails = authConfig.adminEmails;
  } catch {
    console.error(JSON.stringify({ requestId, event: 'admin_config_load_failed' }));
    return;
  }

  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const adminUsers = (authData?.users || []).filter(u =>
    u.email && adminEmails.includes(u.email.toLowerCase())
  );

  if (adminUsers.length === 0) return;

  const notifications = adminUsers.map(admin => ({
    user_id: admin.id,
    user_type: 'admin',
    title: `⚠️ Scheduling failed — ${enrollment.child_name}`,
    body: `Enrollment ${enrollment.id.slice(0, 8)} has payment confirmed but 0 sessions scheduled. Created ${enrollment.minutes_ago} min ago. Check QStash logs.`,
    notification_type: 'alert',
    action_url: '/admin/enrollments',
    metadata: {
      enrollment_id: enrollment.id,
      child_name: enrollment.child_name,
      parent_name: enrollment.parent_name,
      type: 'scheduling_alert',
      request_id: requestId,
    },
    is_read: false,
    is_dismissed: false,
  }));

  const { error } = await supabase.from('in_app_notifications').insert(notifications);

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'in_app_notification_insert_error',
      error: error.message,
    }));
  }
}
