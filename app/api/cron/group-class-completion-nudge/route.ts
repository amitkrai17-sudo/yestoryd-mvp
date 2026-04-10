// ============================================================
// FILE: app/api/cron/group-class-completion-nudge/route.ts
// ============================================================
// Nudge instructors who haven't submitted ratings after a group
// class session has ended.
//
// Two escalation tiers:
//   30 min overdue → instructor in-app notification
//   2 hours overdue → admin WhatsApp + email
//
// Runs every 15 min via dispatcher.
// Dedup via activity_log (action + session_id).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ── Auth ──────────────────────────────────────────────────────


// ── Dedup via activity_log ────────────────────────────────────

async function nudgeAlreadySent(
  supabase: ReturnType<typeof createAdminClient>,
  action: string,
  sessionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('activity_log')
    .select('id')
    .eq('action', action)
    .filter('metadata->>session_id', 'eq', sessionId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ── Main processor ────────────────────────────────────────────

async function processNudges(requestId: string, source: string) {
  const startTime = Date.now();
  const results = {
    instructor_nudges: 0,
    admin_escalations: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const supabase = getSupabase();

    // IST now for computing session end time
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const todayIST = nowIST.toISOString().split('T')[0];
    // Also check yesterday (session at 23:00 IST, checked at 00:30 IST next day)
    const yesterdayIST = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(JSON.stringify({
      requestId,
      event: 'group_class_completion_nudge_start',
      source,
      istNow: nowIST.toISOString(),
    }));

    // Query group sessions that are still 'scheduled' (not completed) from today or yesterday
    const { data: sessions, error: sessErr } = await supabase
      .from('group_sessions')
      .select(`
        id,
        title,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        instructor_id,
        class_type_id,
        group_class_types ( name ),
        coaches!group_sessions_instructor_id_fkey ( id, name, phone, email )
      `)
      .eq('status', 'scheduled')
      .in('scheduled_date', [todayIST, yesterdayIST]);

    if (sessErr) {
      console.error(JSON.stringify({ requestId, event: 'db_error', error: sessErr.message }));
      return NextResponse.json({ success: false, requestId, error: sessErr.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_uncompleted_sessions' }));
      return NextResponse.json({ success: true, requestId, message: 'No uncompleted sessions', results });
    }

    for (const session of sessions) {
      // Compute when the session should have ended (in IST "fake UTC" space)
      const [y, mo, d] = session.scheduled_date.split('-').map(Number);
      const timeParts = session.scheduled_time.split(':').map(Number);
      const sessionStartIST = new Date(Date.UTC(y, mo - 1, d, timeParts[0] || 0, timeParts[1] || 0, 0));
      const durationMs = (session.duration_minutes || 45) * 60 * 1000;
      const sessionEndIST = new Date(sessionStartIST.getTime() + durationMs);

      const minutesOverdue = (nowIST.getTime() - sessionEndIST.getTime()) / (60 * 1000);

      if (minutesOverdue < 30) continue; // Not overdue yet

      const classTypeRaw = session.group_class_types;
      const classType = Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw;
      const className = classType?.name || session.title || 'Workshop';

      const instructorRaw = session.coaches;
      const instructor = Array.isArray(instructorRaw) ? instructorRaw[0] : instructorRaw;
      const instructorName = (instructor as any)?.name || 'Instructor';
      const sessionTime = session.scheduled_time.slice(0, 5);

      // ── Tier 1: Instructor nudge (30+ min overdue) ──
      if (minutesOverdue >= 30) {
        const nudgeAction = 'group_class_instructor_completion_nudge';
        const alreadyNudged = await nudgeAlreadySent(supabase, nudgeAction, session.id);

        if (!alreadyNudged && session.instructor_id) {
          try {
            await supabase.from('in_app_notifications').insert({
              user_id: session.instructor_id,
              user_type: 'coach',
              title: `Please submit ratings for ${className}`,
              body: `Your ${className} session ended ${Math.round(minutesOverdue)} minutes ago. Please submit participant ratings to generate insights for parents.`,
              notification_type: 'warning',
              action_url: `/instructor/session/${session.id}`,
              metadata: { session_id: session.id, type: 'completion_nudge' },
              is_read: false,
              is_dismissed: false,
            });
          } catch (err) {
            results.errors.push(`In-app for ${session.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          // Log to activity_log for dedup
          try {
            await supabase.from('activity_log').insert({
              user_email: COMPANY_CONFIG.supportEmail,
              user_type: 'system',
              action: nudgeAction,
              metadata: {
                request_id: requestId,
                session_id: session.id,
                instructor_id: session.instructor_id,
                class_name: className,
                minutes_overdue: Math.round(minutesOverdue),
              },
              created_at: new Date().toISOString(),
            });
          } catch (err) {
            results.errors.push(`Activity log for ${session.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          results.instructor_nudges++;

          console.log(JSON.stringify({
            requestId,
            event: 'instructor_nudge_sent',
            sessionId: session.id,
            minutesOverdue: Math.round(minutesOverdue),
          }));
        } else {
          results.skipped++;
        }
      }

      // ── Tier 2: Admin escalation (2+ hours overdue) ──
      if (minutesOverdue >= 120) {
        const escalationAction = 'group_class_admin_completion_escalation';
        const alreadyEscalated = await nudgeAlreadySent(supabase, escalationAction, session.id);

        if (!alreadyEscalated) {
          const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';
          const hoursOverdue = String(Math.round(minutesOverdue / 60));

          // Admin WhatsApp
          try {
            await sendWhatsAppMessage({
              to: adminPhone,
              templateName: 'admin_group_class_overdue',
              variables: [instructorName, className, sessionTime, hoursOverdue],
            });
          } catch (err) {
            results.errors.push(`Admin WA for ${session.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          // Admin email
          try {
            const authConfig = COMPANY_CONFIG.adminEmail;
            await sendEmail({
              to: authConfig,
              subject: `[Action Required] Workshop not completed: ${className}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #e74c3c;">Workshop Completion Overdue</h2>
                  <p><strong>Instructor:</strong> ${instructorName}</p>
                  <p><strong>Class:</strong> ${className}</p>
                  <p><strong>Scheduled time:</strong> ${sessionTime} IST on ${session.scheduled_date}</p>
                  <p><strong>Overdue by:</strong> ${hoursOverdue} hours</p>
                  <p style="color: #e74c3c;">The intelligence pipeline is blocked until the instructor submits ratings.</p>
                </div>
              `,
            });
          } catch (err) {
            results.errors.push(`Admin email for ${session.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          // Log for dedup
          try {
            await supabase.from('activity_log').insert({
              user_email: COMPANY_CONFIG.supportEmail,
              user_type: 'system',
              action: escalationAction,
              metadata: {
                request_id: requestId,
                session_id: session.id,
                instructor_name: instructorName,
                class_name: className,
                hours_overdue: hoursOverdue,
              },
              created_at: new Date().toISOString(),
            });
          } catch (err) {
            results.errors.push(`Escalation log for ${session.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          results.admin_escalations++;

          console.log(JSON.stringify({
            requestId,
            event: 'admin_escalation_sent',
            sessionId: session.id,
            hoursOverdue,
          }));
        }
      }
    }

    // Audit log for the cron run
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'group_class_completion_nudge_executed',
        metadata: {
          request_id: requestId,
          source,
          sessions_checked: sessions.length,
          ...results,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(JSON.stringify({ requestId, event: 'audit_log_failed', error: String(err) }));
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_class_completion_nudge_complete', duration: `${duration}ms`, results }));

    return NextResponse.json({ success: true, requestId, results });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_class_completion_nudge_error', error: message }));
    return NextResponse.json({ success: false, requestId, error: message }, { status: 500 });
  }
}

// ── Route handlers ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return processNudges(requestId, auth.source);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return processNudges(requestId, auth.source);
}
