// ============================================================
// FILE: app/api/jobs/enrollment-complete/route.ts
// ============================================================
// HARDENED VERSION - Background Worker for Post-Payment Enrollment
// Called by QStash after successful payment
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - QStash signature verification (REMOVED direct-call bypass!)
// - Internal API key for admin testing
// - Lazy initialization
// - Request tracing
// - Audit logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/api-auth';
import { google } from 'googleapis';
import { scheduleBotsForEnrollment } from '@/lib/recall-auto-bot';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// --- SESSION CONFIGURATION ---
const SESSION_CONFIG = {
  totalSessions: 9,
  coachingSessions: 6,
  parentSessions: 3,
  coachingDurationMinutes: 45,
  parentDurationMinutes: 20,
  defaultHour: 10,
  schedule: [
    { day: 0, type: 'coaching', number: 1, week: 1 },
    { day: 5, type: 'coaching', number: 2, week: 1 },
    { day: 10, type: 'parent', number: 1, week: 2 },
    { day: 15, type: 'coaching', number: 3, week: 3 },
    { day: 20, type: 'coaching', number: 4, week: 3 },
    { day: 25, type: 'parent', number: 2, week: 4 },
    { day: 30, type: 'coaching', number: 5, week: 5 },
    { day: 35, type: 'coaching', number: 6, week: 5 },
    { day: 40, type: 'parent', number: 3, week: 6 },
  ],
};

// --- VALIDATION SCHEMA ---
const enrollmentJobSchema = z.object({
  enrollmentId: z.string().uuid(),
  childId: z.string().uuid(),
  childName: z.string().min(1),
  parentEmail: z.string().email(),
  parentName: z.string().min(1),
  coachId: z.string().uuid(),
  coachEmail: z.string().email(),
  coachName: z.string().min(1),
});

// --- VERIFICATION ---
async function verifyAuth(request: NextRequest, body: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check internal API key (for admin testing)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 2. Check QStash signature (production)
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  // 3. Development bypass (ONLY in dev, not production!)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Get request body
    const body = await request.text();

    // 2. Verify authorization
    // SECURITY: Removed dangerous x-direct-call bypass!
    const auth = await verifyAuth(request, body);

    if (!auth.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Unauthorized enrollment job request',
      }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse and validate job data
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = enrollmentJobSchema.safeParse(parsedBody);
    if (!validation.success) {
      console.error(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors: validation.error.flatten(),
      }));
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const supabase = getServiceSupabase();

    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_complete_started',
      source: auth.source,
      enrollmentId: data.enrollmentId,
      childName: data.childName,
      coachName: data.coachName,
    }));

    // 4. IDEMPOTENCY CHECK - Don't reprocess if already completed
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('schedule_confirmed, sessions_scheduled')
      .eq('id', data.enrollmentId)
      .single();

    if (enrollment?.schedule_confirmed) {
      console.log(JSON.stringify({
        requestId,
        event: 'skipping_duplicate',
        enrollmentId: data.enrollmentId,
        reason: 'Already processed',
      }));

      return NextResponse.json({
        success: true,
        message: 'Enrollment already processed',
        sessionsScheduled: enrollment.sessions_scheduled,
      });
    }

    // 5. Schedule Google Calendar sessions
    console.log(JSON.stringify({ requestId, event: 'scheduling_calendar_sessions' }));
    const calendarResult = await scheduleCalendarSessions(data, requestId, supabase);

    console.log(JSON.stringify({
      requestId,
      event: 'calendar_sessions_created',
      count: calendarResult.sessionsCreated,
      errors: calendarResult.errors.length,
    }));

    // 6. Schedule Recall.ai bots for session recording
    let botsScheduled = 0;
    try {
      console.log(JSON.stringify({ requestId, event: 'scheduling_recall_bots' }));
      const botResult = await scheduleBotsForEnrollment(data.enrollmentId);
      botsScheduled = botResult.botsCreated;

      console.log(JSON.stringify({
        requestId,
        event: 'recall_bots_scheduled',
        botsCreated: botResult.botsCreated,
        errors: botResult.errors.length,
      }));
    } catch (botError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'recall_bot_error',
        error: botError.message,
      }));
      // Non-fatal - continue with enrollment
    }

    // 7. Send confirmation email
    console.log(JSON.stringify({ requestId, event: 'sending_confirmation_email' }));
    const emailResult = await sendConfirmationEmail(data, calendarResult.sessions);

    // 8. Update enrollment status
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        schedule_confirmed_at: new Date().toISOString(),
        sessions_scheduled: calendarResult.sessionsCreated,
      })
      .eq('id', data.enrollmentId);

    if (updateError) {
      console.error(JSON.stringify({
        requestId,
        event: 'enrollment_update_error',
        error: updateError.message,
      }));
    }

    // 9. AUDIT LOG
    await supabase.from('activity_log').insert({
      user_email: 'system@yestoryd.com',
      action: 'enrollment_complete_processed',
      details: {
        request_id: requestId,
        source: auth.source,
        enrollment_id: data.enrollmentId,
        child_name: data.childName,
        coach_name: data.coachName,
        sessions_scheduled: calendarResult.sessionsCreated,
        bots_scheduled: botsScheduled,
        email_sent: emailResult.success,
        calendar_errors: calendarResult.errors.length,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // 10. Return success
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_complete_finished',
      enrollmentId: data.enrollmentId,
      sessionsScheduled: calendarResult.sessionsCreated,
      botsScheduled,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      enrollmentId: data.enrollmentId,
      sessionsScheduled: calendarResult.sessionsCreated,
      botsScheduled,
      emailSent: emailResult.success,
      errors: calendarResult.errors.length > 0 ? calendarResult.errors : undefined,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_complete_error',
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
    }));

    // Return 500 so QStash will retry
    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Schedule all 9 sessions in Google Calendar
 * 
 * ⚠️ SCALING TODO (when >10 enrollments/minute):
 * Google Calendar API limits: ~60 requests/minute per user
 * 10 enrollments × 9 events = 90 requests → 429 errors
 * 
 * Fixes when hitting limits:
 * 1. Increase delay between events (currently 300ms → try 1000ms)
 * 2. Use Google Calendar batch endpoint (limited Node.js support)
 * 3. Service account pooling (multiple accounts for high volume)
 * 4. Queue enrollments and process sequentially via QStash
 */
async function scheduleCalendarSessions(
  data: z.infer<typeof enrollmentJobSchema>,
  requestId: string,
  supabase: ReturnType<typeof getSupabase>
) {
  const sessionsCreated: any[] = [];
  const errors: any[] = [];

  // Initialize Google Calendar API
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
    process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com'
  );

  const calendar = google.calendar({ version: 'v3', auth });

  // Start from tomorrow
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(SESSION_CONFIG.defaultHour, 0, 0, 0);

  for (const session of SESSION_CONFIG.schedule) {
    try {
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + session.day);

      const duration = session.type === 'coaching'
        ? SESSION_CONFIG.coachingDurationMinutes
        : SESSION_CONFIG.parentDurationMinutes;

      const endDate = new Date(sessionDate);
      endDate.setMinutes(endDate.getMinutes() + duration);

      const isCoaching = session.type === 'coaching';
      const eventTitle = isCoaching
        ? `📚 Yestoryd: ${data.childName} - Coaching Session ${session.number}`
        : `👨‍👩‍👧 Yestoryd: ${data.childName} - Parent Check-in ${session.number}`;

      const eventDescription = isCoaching
        ? `1:1 Reading Coaching Session with ${data.childName}\n\nCoach: ${data.coachName}\nParent: ${data.parentName}\nDuration: ${duration} minutes\n\nQuestions? WhatsApp: +91 89762 87997`
        : `Parent Progress Check-in for ${data.childName}\n\nCoach: ${data.coachName}\nParent: ${data.parentName}\nDuration: ${duration} minutes\n\nQuestions? WhatsApp: +91 89762 87997`;

      const event = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com',
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: eventTitle,
          description: eventDescription,
          start: { dateTime: sessionDate.toISOString(), timeZone: 'Asia/Kolkata' },
          end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
          attendees: [
            { email: data.parentEmail, displayName: data.parentName },
            { email: data.coachEmail, displayName: data.coachName },
            { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' },
          ],
          conferenceData: {
            createRequest: {
              requestId: `yestoryd-${data.enrollmentId}-session-${session.day}-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 30 },
            ],
          },
          colorId: isCoaching ? '9' : '5',
        },
      });

      const meetLink = event.data.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video'
      )?.uri || '';

      // Save to database
      const { data: savedSession, error: dbError } = await supabase
        .from('scheduled_sessions')
        .insert({
          child_id: data.childId,
          coach_id: data.coachId,
          enrollment_id: data.enrollmentId,
          session_type: session.type,
          session_number: session.number,
          week_number: session.week,
          scheduled_date: sessionDate.toISOString().split('T')[0],
          scheduled_time: sessionDate.toTimeString().slice(0, 8),
          duration_minutes: duration,
          google_event_id: event.data.id,
          google_meet_link: meetLink,
          status: 'scheduled',
        })
        .select()
        .single();

      if (dbError) {
        console.error(JSON.stringify({
          requestId,
          event: 'session_db_error',
          sessionNumber: session.number,
          error: dbError.message,
        }));
      }

      sessionsCreated.push({
        sessionNumber: session.number,
        type: session.type,
        week: session.week,
        date: sessionDate.toISOString(),
        meetLink,
        eventId: event.data.id,
        dbId: savedSession?.id,
      });

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (calError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'calendar_error',
        sessionNumber: session.number,
        error: calError.message,
      }));

      errors.push({
        session: session.number,
        type: session.type,
        error: calError.message,
      });
    }
  }

  return { sessionsCreated: sessionsCreated.length, sessions: sessionsCreated, errors };
}

/**
 * Send enrollment confirmation email via SendGrid
 */
async function sendConfirmationEmail(
  data: z.infer<typeof enrollmentJobSchema>,
  sessions: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionList = sessions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s) => {
        const date = new Date(s.date);
        const dateStr = date.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        const icon = s.type === 'coaching' ? '📚' : '👨‍👩‍👧';
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${icon} ${s.type === 'coaching' ? 'Coaching' : 'Parent Check-in'} #${s.sessionNumber}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${dateStr}</td>
        </tr>`;
      })
      .join('');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: data.parentEmail, name: data.parentName }] }],
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
        reply_to: { email: 'support@yestoryd.com', name: 'Yestoryd Support' },
        subject: `🎉 Welcome to Yestoryd! ${data.childName}'s Reading Journey Begins`,
        content: [{
          type: 'text/html',
          value: generateEmailHtml(data, sessionList),
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Email send failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate email HTML (extracted for cleaner code)
 */
function generateEmailHtml(data: z.infer<typeof enrollmentJobSchema>, sessionList: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #FF0099; margin: 0; font-size: 28px;">Welcome to Yestoryd! 🎉</h1>
      <p style="color: #666; margin-top: 8px;">Your child's reading transformation begins now</p>
    </div>

    <p style="font-size: 16px; color: #333;">Hi ${data.parentName},</p>
    <p style="font-size: 16px; color: #333;">
      Great news! <strong style="color: #FF0099;">${data.childName}</strong> is officially enrolled in the
      <strong>Yestoryd Reading Program</strong>.
    </p>

    <div style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); color: white; padding: 24px; border-radius: 12px; margin: 24px 0;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">📋 Enrollment Summary</h2>
      <table style="width: 100%; color: white;">
        <tr><td>👧 Child:</td><td><strong>${data.childName}</strong></td></tr>
        <tr><td>👩‍🏫 Coach:</td><td><strong>${data.coachName}</strong></td></tr>
        <tr><td>📅 Sessions:</td><td><strong>9 sessions over 6 weeks</strong></td></tr>
        <tr><td>⏱️ Duration:</td><td><strong>3-month program</strong></td></tr>
      </table>
    </div>

    <h2 style="color: #00ABFF; font-size: 18px; margin-top: 32px;">📅 Your Session Schedule</h2>
    <p style="color: #666; font-size: 14px;">Calendar invites have been sent to your email.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Session</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Date & Time</th>
        </tr>
      </thead>
      <tbody>
        ${sessionList || '<tr><td colspan="2" style="padding: 12px; color: #666;">Sessions are being scheduled...</td></tr>'}
      </tbody>
    </table>

    <div style="text-align: center; margin: 32px 0;">
      <a href="https://yestoryd.com/parent/dashboard"
         style="background: #FF0099; color: white; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; font-size: 16px;">
        View Your Dashboard →
      </a>
    </div>

    <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 24px;">
      <p style="color: #666; font-size: 14px; margin: 0;">
        <strong>Questions?</strong><br>
        📧 Email: support@yestoryd.com<br>
        💬 WhatsApp: <a href="https://wa.me/918976287997" style="color: #25D366;">+91 89762 87997</a>
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px; color: #999; font-size: 12px;">
      <p>Let's make reading fun! 📖✨</p>
      <p>— Team Yestoryd</p>
    </div>
  </div>
</body>
</html>
  `;
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Enrollment Complete Job',
    description: 'Background worker for post-payment enrollment processing',
    timestamp: new Date().toISOString(),
  });
}