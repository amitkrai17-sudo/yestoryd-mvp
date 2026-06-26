// ============================================================
// FILE: app/api/jobs/enrollment-complete/route.ts
// ============================================================
// ENTERPRISE REFACTOR v2 - Background Worker for Post-Payment Enrollment
// Called by QStash after successful payment
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// ARCHITECTURE:
// - Sessions are CREATED in payment/verify (single source of truth)
// - This job SCHEDULES calendar events for existing sessions
// - This job NEVER creates new sessions - only UPDATEs existing ones
//
// Security features:
// - QStash signature verification
// - Internal API key for admin testing
// - Lazy initialization
// - Request tracing
// - Audit logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { getServiceSupabase } from '@/lib/api-auth';
import { scheduleBotsForEnrollment } from '@/lib/recall-auto-bot';
import { z } from 'zod';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { getProgramContext, type ProgramContext } from '@/lib/utils/program-label';
import { reconcileSessionCalendarEvent } from '@/lib/scheduling/session-calendar-writer';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// --- VALIDATION SCHEMA ---
const enrollmentJobSchema = z.object({
  enrollmentId: z.string().uuid(),
  childId: z.string().uuid(),
  childName: z.string().min(1),
  parentId: z.string().uuid().optional(),
  parentEmail: z.string().email(),
  parentName: z.string().min(1),
  parentPhone: z.string().optional(),
  coachId: z.string().uuid(),
  coachEmail: z.string().email(),
  coachName: z.string().min(1),
  source: z.enum(['verify', 'webhook']).optional(),
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
    console.warn('Development mode - skipping signature verification');
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

    // 4. Get enrollment details (include V2 fields + tuition + program label)
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, schedule_confirmed, program_start, preference_start_date, session_duration_minutes, total_sessions, age_band, enrollment_type, billing_model, program_description, sessions_remaining')
      .eq('id', data.enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      console.error(JSON.stringify({
        requestId,
        event: 'enrollment_not_found',
        enrollmentId: data.enrollmentId,
        error: enrollmentError?.message,
      }));
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // 5. Schedule Google Calendar events for EXISTING sessions
    console.log(JSON.stringify({ requestId, event: 'scheduling_calendar_sessions' }));
    const calendarResult = await scheduleCalendarForExistingSessions(
      data.enrollmentId,
      data,
      {
        program_start: enrollment.program_start ?? undefined,
        preference_start_date: enrollment.preference_start_date ?? undefined,
        session_duration_minutes: enrollment.session_duration_minutes ?? undefined,
        total_sessions: enrollment.total_sessions ?? undefined,
        age_band: enrollment.age_band ?? undefined,
      },
      requestId,
      supabase
    );

    console.log(JSON.stringify({
      requestId,
      event: 'calendar_scheduling_complete',
      sessionsUpdated: calendarResult.sessionsUpdated,
      errors: calendarResult.errors.length,
    }));

    // 5b. Tuition flag — used for the recall-bot logging below. The former tuition
    // session_mode relabel that lived here is RETIRED (3D): every insert now states
    // session_mode explicitly (3C-a), so tuition offline sessions are born offline and
    // no row ever reaches this job mislabeled 'online'. Removing it also eliminates the
    // last MUTATE bypasser of session_mode — setSessionMode is now the sole mutate-writer.
    const isTuition = enrollment.enrollment_type === 'tuition';

    // 6. Schedule Recall.ai bots for session recording
    //    (scheduleBotsForEnrollment already filters: only sessions with Meet links, skips offline)
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
        isTuition,
      }));
    } catch (botError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'recall_bot_error',
        error: botError.message,
      }));
      // Non-fatal - continue with enrollment
    }

    // 7. Build program context for email
    let categoryParentLabel: string | null = null;
    if (enrollment.billing_model === 'prepaid_sessions') {
      const { data: onboarding } = await supabase
        .from('tuition_onboarding')
        .select('category_id, skill_categories!category_id(parent_label)')
        .eq('enrollment_id', data.enrollmentId)
        .single();
      categoryParentLabel = (onboarding?.skill_categories as any)?.parent_label ?? null;
    }
    const programCtx = getProgramContext(enrollment, categoryParentLabel);

    // 7b. Send confirmation email
    console.log(JSON.stringify({ requestId, event: 'sending_confirmation_email' }));
    const emailResult = await sendConfirmationEmail(data, calendarResult.sessions, programCtx);

    // 8. Update enrollment with calendar confirmation timestamp
    // Note: schedule_confirmed is already true (set by payment/verify)
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        schedule_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'enrollment_complete_processed',
      metadata: {
        request_id: requestId,
        source: auth.source,
        enrollment_id: data.enrollmentId,
        child_name: data.childName,
        coach_name: data.coachName,
        sessions_with_calendar: calendarResult.sessionsUpdated,
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
      sessionsWithCalendar: calendarResult.sessionsUpdated,
      botsScheduled,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      enrollmentId: data.enrollmentId,
      sessionsWithCalendar: calendarResult.sessionsUpdated,
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

// ============================================================
// REFACTORED: Schedule calendar events for EXISTING sessions
// This function NEVER creates new sessions - only UPDATEs
// ============================================================

interface CalendarSession {
  id: string;
  sessionNumber: number;
  type: string;
  date: string;
  meetLink: string;
  eventId: string;
}

async function scheduleCalendarForExistingSessions(
  enrollmentId: string,
  data: z.infer<typeof enrollmentJobSchema>,
  enrollment: { program_start?: string; preference_start_date?: string; session_duration_minutes?: number; total_sessions?: number; age_band?: string },
  requestId: string,
  supabase: ReturnType<typeof getSupabase>
): Promise<{ sessionsUpdated: number; sessions: CalendarSession[]; errors: any[] }> {
  const sessionsUpdated: CalendarSession[] = [];
  const errors: any[] = [];

  // 1. QUERY EXISTING SESSIONS (created by payment/verify)
  const { data: existingSessions, error: fetchError } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('session_number', { ascending: true });

  if (fetchError) {
    console.error(JSON.stringify({
      requestId,
      event: 'sessions_fetch_error',
      enrollmentId,
      error: fetchError.message,
    }));
    return { sessionsUpdated: 0, sessions: [], errors: [{ error: fetchError.message }] };
  }

  if (!existingSessions || existingSessions.length === 0) {
    console.error(JSON.stringify({
      requestId,
      event: 'no_sessions_found',
      enrollmentId,
      message: 'No sessions exist - they should have been created by payment/verify',
    }));
    return { sessionsUpdated: 0, sessions: [], errors: [{ error: 'No sessions found' }] };
  }

  console.log(JSON.stringify({
    requestId,
    event: 'existing_sessions_fetched',
    enrollmentId,
    sessionCount: existingSessions.length,
    sessionsWithCalendar: existingSessions.filter(s => s.google_event_id).length,
  }));

  // == PHASE 2A: the per-session reconciling writer is the SOLE creator/updater. ==
  // Replaces BOTH the batch weekly-RRULE path and the inline per-session insert.
  // The writer reads date/time/mode from scheduled_sessions (SSOT) - fixing A13
  // (06:00-vs-18:00, which came from reading schedule_preference) - and is
  // idempotent: a matched event is a noop, so the every-payment re-queue is free.
  // Shared/recurring events DETACH onto a fresh unique event (no sibling breakage);
  // offline strips the Meet. NO idempotency early-return here: re-runs MUST be able
  // to reconcile (self-heal) a session whose event drifted.
  for (const session of existingSessions) {
    try {
      const r = await reconcileSessionCalendarEvent(session.id, { requestId });
      if (r.error && r.action === 'skipped') {
        errors.push({ sessionId: session.id, sessionNumber: session.session_number, error: r.error });
      }
      sessionsUpdated.push({
        id: session.id,
        sessionNumber: session.session_number ?? 0,
        type: session.session_type ?? '',
        date: session.scheduled_date ?? '',
        meetLink: r.meetLink ?? '',
        eventId: r.eventId ?? '',
      });
      console.log(JSON.stringify({
        requestId,
        event: 'session_calendar_reconciled',
        sessionId: session.id,
        sessionNumber: session.session_number,
        action: r.action,
        eventId: r.eventId,
      }));
    } catch (e: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'session_calendar_reconcile_failed',
        sessionId: session.id,
        error: e?.message ?? 'reconcile_failed',
      }));
      errors.push({ sessionId: session.id, sessionNumber: session.session_number, error: e?.message ?? 'reconcile_failed' });
    }
    // Pacing - avoid Google Calendar API rate limits.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { sessionsUpdated: sessionsUpdated.length, sessions: sessionsUpdated, errors };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get next available start date (tomorrow at 10 AM)
 */
function getNextAvailableStartDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

/**
 * Calculate session date based on week number and session type
 * Sessions are spaced ~5 days apart within the program
 */
function calculateSessionDate(
  startDate: Date,
  sessionNumber: number,
  weekNumber: number,
  sessionType: string
): Date {
  const date = new Date(startDate);

  // Use week_number if available, otherwise calculate from session_number
  if (weekNumber) {
    // Add weeks based on week_number (1-indexed)
    date.setDate(date.getDate() + (weekNumber - 1) * 7);
  } else {
    // Fallback: space sessions ~5 days apart
    date.setDate(date.getDate() + (sessionNumber - 1) * 5);
  }

  // Set appropriate time based on session type
  if (sessionType === 'coaching') {
    date.setHours(17, 0, 0, 0); // 5 PM for coaching
  } else {
    date.setHours(18, 0, 0, 0); // 6 PM for parent check-ins
  }

  return date;
}

/**
 * Send enrollment confirmation email via SendGrid
 */
async function sendConfirmationEmail(
  data: z.infer<typeof enrollmentJobSchema>,
  sessions: CalendarSession[],
  ctx: ProgramContext
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
        const isCoaching = s.type === 'coaching';
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${isCoaching ? '1:1 Coaching' : 'Parent Check-in'} #${s.sessionNumber}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${dateStr}</td>
        </tr>`;
      })
      .join('');

    const { sendEmail } = require('@/lib/email/resend-client');

    const result = await sendEmail({
      to: data.parentEmail,
      subject: ctx.emailSubject(data.childName),
      html: generateEmailHtml(data, sessionList, sessions.length, ctx),
      from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd' },
      replyTo: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd Support' },
    });

    if (!result.success) {
      throw new Error(`Email error: ${result.error}`);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Email send failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate email HTML — enrollment-type-aware
 */
function generateEmailHtml(
  data: z.infer<typeof enrollmentJobSchema>,
  sessionList: string,
  sessionCount: number,
  ctx: ProgramContext
): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
  const dashboardUrl = `${baseUrl}/parent/dashboard`;

  // Schedule section differs for tuition vs coaching
  const scheduleSection = ctx.showSchedule
    ? `
    <h2 style="color: #00ABFF; font-size: 18px; margin-top: 32px;">Your Session Schedule</h2>
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
    `
    : `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #166534; font-size: 16px; margin: 0 0 8px 0;">Session Balance</h3>
      <p style="color: #333; font-size: 16px; margin: 0;"><strong>${sessionCount} sessions</strong> available</p>
      <p style="color: #666; font-size: 14px; margin: 8px 0 0 0;">${ctx.scheduleDescription}</p>
    </div>
    `;

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
      <h1 style="color: #FF0099; margin: 0; font-size: 28px;">Welcome to Yestoryd!</h1>
      <p style="color: #666; margin-top: 8px;">${data.childName}'s learning journey begins now</p>
    </div>

    <p style="font-size: 16px; color: #333;">Hi ${data.parentName},</p>
    <p style="font-size: 16px; color: #333;">
      Great news! <strong style="color: #FF0099;">${data.childName}</strong> is officially enrolled in
      <strong>${ctx.label}</strong>.
    </p>

    <div style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); color: white; padding: 24px; border-radius: 12px; margin: 24px 0;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">Enrollment Summary</h2>
      <table style="width: 100%; color: white;">
        <tr><td>Child:</td><td><strong>${data.childName}</strong></td></tr>
        <tr><td>Coach:</td><td><strong>${data.coachName}</strong></td></tr>
        <tr><td>Sessions:</td><td><strong>${sessionCount} sessions</strong></td></tr>
        <tr><td>Program:</td><td><strong>${ctx.label}</strong></td></tr>
      </table>
    </div>

    ${scheduleSection}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}"
         style="background: #FF0099; color: white; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; font-size: 16px;">
        View Your Dashboard
      </a>
    </div>

    <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 24px;">
      <p style="color: #666; font-size: 14px; margin: 0;">
        <strong>Questions?</strong><br>
        Email: ${COMPANY_CONFIG.supportEmail}<br>
        WhatsApp: <a href="https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}" style="color: #25D366;">${COMPANY_CONFIG.leadBotWhatsAppDisplay}</a>
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px; color: #999; font-size: 12px;">
      <p>Let's make learning fun!</p>
      <p>- Team Yestoryd</p>
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
    description: 'Background worker for calendar scheduling (sessions created by payment/verify)',
    architecture: 'SINGLE_SOURCE_OF_TRUTH - sessions created in payment/verify, calendar scheduled here',
    timestamp: new Date().toISOString(),
  });
}
