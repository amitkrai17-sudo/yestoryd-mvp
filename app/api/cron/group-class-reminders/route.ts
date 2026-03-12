// ============================================================
// FILE: app/api/cron/group-class-reminders/route.ts
// ============================================================
// Pre-session reminders for group classes (24h + 1h windows).
// Dispatched every 15 min by the cron dispatcher.
//
// 24h window (23–25 hours before):
//   Parent WhatsApp + email: session details + meet link
//
// 1h window (50–70 minutes before):
//   Parent WhatsApp + email: urgent reminder with meet link
//   Instructor WhatsApp + email + in-app notification
//
// Dedup via communication_logs (template_code + child_id + session_id).
// Follows patterns from coach-reminders-1h, group-class-notifications.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const getSupabase = createAdminClient;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ── Auth ──────────────────────────────────────────────────────


// ── Time helpers ──────────────────────────────────────────────

function getISTNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Parse IST date + time into a "fake UTC" Date for arithmetic comparison with getISTNow() */
function toISTDate(scheduledDate: string, scheduledTime: string): Date {
  const [y, mo, d] = scheduledDate.split('-').map(Number);
  const parts = scheduledTime.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, parts[0] || 0, parts[1] || 0, 0));
}

function formatISTDateTime(scheduledDate: string, scheduledTime: string): string {
  const d = new Date(scheduledDate + 'T00:00:00');
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = scheduledTime.slice(0, 5);
  // Convert to 12h format
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${day}, ${h12}:${String(m).padStart(2, '0')} ${ampm} IST`;
}

// ── Dedup ─────────────────────────────────────────────────────

async function alreadySent(
  supabase: ReturnType<typeof createAdminClient>,
  templateCode: string,
  sessionId: string,
  recipientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('template_code', templateCode)
    .eq('recipient_id', recipientId)
    .filter('context_data->>session_id', 'eq', sessionId)
    .eq('wa_sent', true)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ── Main processor ────────────────────────────────────────────

async function processReminders(requestId: string, source: string) {
  const startTime = Date.now();
  const results = {
    parent_24h: { sent: 0, skipped: 0, failed: 0 },
    parent_1h: { sent: 0, skipped: 0, failed: 0 },
    instructor_1h: { sent: 0, skipped: 0, failed: 0 },
    errors: [] as string[],
  };

  try {
    const supabase = getSupabase();
    const nowIST = getISTNow();
    const todayIST = nowIST.toISOString().split('T')[0];
    const tomorrowIST = new Date(nowIST.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(JSON.stringify({
      requestId,
      event: 'group_class_reminders_start',
      source,
      istNow: nowIST.toISOString(),
      dates: [todayIST, tomorrowIST],
    }));

    // Fetch scheduled group sessions for today + tomorrow
    const { data: sessions, error: sessErr } = await supabase
      .from('group_sessions')
      .select(`
        id,
        title,
        scheduled_date,
        scheduled_time,
        google_meet_link,
        instructor_id,
        class_type_id,
        blueprint_id,
        current_participants,
        group_class_types ( name ),
        group_class_blueprints ( name )
      `)
      .eq('status', 'scheduled')
      .in('scheduled_date', [todayIST, tomorrowIST]);

    if (sessErr) {
      console.error(JSON.stringify({ requestId, event: 'db_error', error: sessErr.message }));
      return NextResponse.json({ success: false, requestId, error: sessErr.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_upcoming_sessions' }));
      return NextResponse.json({ success: true, requestId, message: 'No upcoming sessions', results });
    }

    // Classify sessions into time windows
    type WindowType = '24h' | '1h';
    const sessionWindows: { session: (typeof sessions)[number]; window: WindowType }[] = [];

    for (const session of sessions) {
      const sessionIST = toISTDate(session.scheduled_date, session.scheduled_time);
      const minutesUntil = (sessionIST.getTime() - nowIST.getTime()) / (60 * 1000);

      if (minutesUntil >= 23 * 60 && minutesUntil <= 25 * 60) {
        sessionWindows.push({ session, window: '24h' });
      }
      if (minutesUntil >= 50 && minutesUntil <= 70) {
        sessionWindows.push({ session, window: '1h' });
      }
    }

    if (sessionWindows.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_sessions_in_window' }));
      return NextResponse.json({ success: true, requestId, message: 'No sessions in reminder windows', results });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'sessions_in_window',
      count: sessionWindows.length,
      windows: sessionWindows.map(sw => ({ id: sw.session.id, window: sw.window })),
    }));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

    for (const { session, window } of sessionWindows) {
      const classTypeRaw = session.group_class_types;
      const classType = Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw;
      const className = classType?.name || session.title || 'Group Class';
      const dateTime = formatISTDateTime(session.scheduled_date, session.scheduled_time);
      const meetLink = session.google_meet_link || `${baseUrl}/group-classes`;

      // ── Fetch participants (paid or free, not cancelled) ──
      const { data: participants } = await supabase
        .from('group_session_participants')
        .select('child_id, parent_id')
        .eq('group_session_id', session.id)
        .in('payment_status', ['paid', 'free'])
        .is('cancelled_at', null);

      if (!participants || participants.length === 0) continue;

      // ── Parent reminders ──
      for (const participant of participants) {
        if (!participant.child_id || !participant.parent_id) continue;

        const templateCode = window === '24h'
          ? 'group_class_reminder_24h'
          : 'group_class_reminder_1h';

        // Dedup check
        const sent = await alreadySent(supabase, templateCode, session.id, participant.child_id);
        if (sent) {
          results[window === '24h' ? 'parent_24h' : 'parent_1h'].skipped++;
          continue;
        }

        // Fetch parent + child
        const [{ data: parent }, { data: child }] = await Promise.all([
          supabase.from('parents').select('id, name, phone, email').eq('id', participant.parent_id).single(),
          supabase.from('children').select('id, child_name').eq('id', participant.child_id).single(),
        ]);

        if (!parent) continue;

        const parentName = parent.name || 'Parent';
        const childName = child?.child_name || 'your child';
        const bucket = window === '24h' ? results.parent_24h : results.parent_1h;

        let waSent = false;
        let emailSent = false;

        // WhatsApp via AiSensy
        if (parent.phone) {
          try {
            const variables = window === '24h'
              ? [parentName, childName, className, dateTime, meetLink]
              : [parentName, childName, className, meetLink];

            const waResult = await sendWhatsAppMessage({
              to: parent.phone,
              templateName: templateCode,
              variables,
            });

            waSent = waResult.success;
            if (!waResult.success) {
              results.errors.push(`WA ${templateCode} to ${parent.phone}: ${waResult.error}`);
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown';
            results.errors.push(`WA ${templateCode} exception: ${msg}`);
          }
        }

        // Email via Resend (fallback or complement)
        if (parent.email) {
          try {
            const subject = window === '24h'
              ? `Reminder: ${childName}'s ${className} is tomorrow!`
              : `Starting soon: ${childName}'s ${className} in 1 hour`;

            const emailResult = await sendEmail({
              to: parent.email,
              subject,
              html: buildParentReminderEmail(parentName, childName, className, dateTime, meetLink, window),
            });

            emailSent = emailResult.success;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown';
            results.errors.push(`Email ${templateCode} exception: ${msg}`);
          }
        }

        // Log to communication_logs (dedup source of truth)
        try {
          await supabase.from('communication_logs').insert({
            template_code: templateCode,
            recipient_type: 'parent',
            recipient_id: participant.child_id, // keyed by child for per-child dedup
            recipient_phone: parent.phone,
            recipient_email: parent.email,
            wa_sent: waSent,
            email_sent: emailSent,
            context_data: {
              session_id: session.id,
              child_id: participant.child_id,
              parent_id: participant.parent_id,
              class_name: className,
              window,
            },
            sent_at: (waSent || emailSent) ? new Date().toISOString() : null,
          });
        } catch (logErr) {
          console.error(JSON.stringify({ requestId, event: 'comm_log_failed', error: String(logErr) }));
        }

        if (waSent || emailSent) {
          bucket.sent++;
        } else if (!parent.phone && !parent.email) {
          bucket.skipped++;
        } else {
          bucket.failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // ── Instructor 1h reminder ──
      if (window === '1h' && session.instructor_id) {
        const instructorTemplateCode = 'group_class_instructor_reminder_1h';

        const instructorSent = await alreadySent(supabase, instructorTemplateCode, session.id, session.instructor_id);
        if (instructorSent) {
          results.instructor_1h.skipped++;
        } else {
          const { data: instructor } = await supabase
            .from('coaches')
            .select('id, name, phone, email')
            .eq('id', session.instructor_id)
            .single();

          if (instructor) {
            const instructorName = instructor.name?.split(' ')[0] || 'Instructor';
            const participantCount = String(session.current_participants || participants.length);
            const blueprintRaw = session.group_class_blueprints;
            const blueprint = Array.isArray(blueprintRaw) ? blueprintRaw[0] : blueprintRaw;
            const blueprintName = blueprint?.name || className;
            const sessionTime = session.scheduled_time.slice(0, 5);

            let instructorWaSent = false;
            let instructorEmailSent = false;

            // WhatsApp
            if (instructor.phone) {
              try {
                const waResult = await sendWhatsAppMessage({
                  to: instructor.phone,
                  templateName: instructorTemplateCode,
                  variables: [instructorName, className, sessionTime, participantCount, meetLink],
                });
                instructorWaSent = waResult.success;
                if (!waResult.success) {
                  results.errors.push(`Instructor WA: ${waResult.error}`);
                }
              } catch (e: unknown) {
                results.errors.push(`Instructor WA exception: ${e instanceof Error ? e.message : 'Unknown'}`);
              }
            }

            // Email
            if (instructor.email) {
              try {
                const emailResult = await sendEmail({
                  to: instructor.email,
                  subject: `Starting in 1 hour: ${className} (${participantCount} participants)`,
                  html: buildInstructorReminderEmail(instructorName, className, sessionTime, participantCount, meetLink, blueprintName),
                });
                instructorEmailSent = emailResult.success;
              } catch (e: unknown) {
                results.errors.push(`Instructor email exception: ${e instanceof Error ? e.message : 'Unknown'}`);
              }
            }

            // In-app notification
            try {
              await supabase.from('in_app_notifications').insert({
                user_id: session.instructor_id,
                user_type: 'coach',
                title: `${className} starts in 1 hour`,
                body: `${participantCount} participants registered. Blueprint: ${blueprintName}.`,
                notification_type: 'reminder',
                action_url: `/instructor/session/${session.id}`,
                metadata: { session_id: session.id, type: 'group_class_instructor_reminder' },
                is_read: false,
                is_dismissed: false,
              });
            } catch (inappErr) {
              console.error(JSON.stringify({ requestId, event: 'instructor_inapp_failed', error: String(inappErr) }));
            }

            // Log
            try {
              await supabase.from('communication_logs').insert({
                template_code: instructorTemplateCode,
                recipient_type: 'coach',
                recipient_id: session.instructor_id,
                recipient_phone: instructor.phone,
                recipient_email: instructor.email,
                wa_sent: instructorWaSent,
                email_sent: instructorEmailSent,
                context_data: {
                  session_id: session.id,
                  class_name: className,
                  participant_count: participantCount,
                },
                sent_at: (instructorWaSent || instructorEmailSent) ? new Date().toISOString() : null,
              });
            } catch (logErr) {
              console.error(JSON.stringify({ requestId, event: 'instructor_comm_log_failed', error: String(logErr) }));
            }

            if (instructorWaSent || instructorEmailSent) {
              results.instructor_1h.sent++;
            } else {
              results.instructor_1h.failed++;
            }
          }
        }
      }
    }

    // ── Activity log ──
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'group_class_reminders_executed',
        metadata: {
          request_id: requestId,
          source,
          sessions_in_window: sessionWindows.length,
          parent_24h: results.parent_24h,
          parent_1h: results.parent_1h,
          instructor_1h: results.instructor_1h,
          error_count: results.errors.length,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error(JSON.stringify({ requestId, event: 'activity_log_failed', error: String(logErr) }));
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_class_reminders_complete', duration: `${duration}ms`, results }));

    return NextResponse.json({ success: true, requestId, results });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_class_reminders_error', error: message }));
    return NextResponse.json({ success: false, requestId, error: message }, { status: 500 });
  }
}

// ── Email templates ──────────────────────────────────────────

function buildParentReminderEmail(
  parentName: string,
  childName: string,
  className: string,
  dateTime: string,
  meetLink: string,
  window: '24h' | '1h',
): string {
  const heading = window === '24h'
    ? `${className} is tomorrow!`
    : `${className} starts in 1 hour!`;

  const subtext = window === '24h'
    ? `${childName}'s group class is scheduled for <strong>${dateTime}</strong>. Make sure they're ready!`
    : `${childName}'s group class is about to start. Time to join!`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hi ${parentName}!</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">${subtext}</p>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #333;"><strong>Class:</strong> ${className}</p>
        <p style="margin: 4px 0; color: #333;"><strong>When:</strong> ${dateTime}</p>
        <p style="margin: 4px 0; color: #333;"><strong>Child:</strong> ${childName}</p>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${meetLink}" style="display: inline-block; background: #6c5ce7; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${window === '1h' ? 'Join Class Now' : 'Save Meet Link'}
        </a>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">— Team Yestoryd</p>
    </div>
  `;
}

function buildInstructorReminderEmail(
  instructorName: string,
  className: string,
  sessionTime: string,
  participantCount: string,
  meetLink: string,
  blueprintName: string,
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hi ${instructorName}!</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">Your group class starts in 1 hour. Here's a quick summary:</p>
      <div style="background: #f0f4ff; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #333;"><strong>Class:</strong> ${className}</p>
        <p style="margin: 4px 0; color: #333;"><strong>Time:</strong> ${sessionTime} IST</p>
        <p style="margin: 4px 0; color: #333;"><strong>Participants:</strong> ${participantCount}</p>
        <p style="margin: 4px 0; color: #333;"><strong>Blueprint:</strong> ${blueprintName}</p>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${meetLink}" style="display: inline-block; background: #2d3436; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Open Meet Link
        </a>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">— Yestoryd Platform</p>
    </div>
  `;
}

// ── Route handlers ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return processReminders(requestId, auth.source);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return processReminders(requestId, auth.source);
}
