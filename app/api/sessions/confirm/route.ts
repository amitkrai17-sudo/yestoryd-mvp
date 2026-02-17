// ============================================================
// FILE: app/api/sessions/confirm/route.ts
// ============================================================
// ENTERPRISE REFACTOR v2 - Manual Session Scheduling
// Used when coach/admin picks a specific start day/time
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// ARCHITECTURE:
// - Sessions are CREATED in payment/verify (single source of truth)
// - This route SCHEDULES calendar events for existing sessions
// - This route NEVER creates new sessions - only UPDATEs existing ones
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { scheduleBotsForEnrollment } from '@/lib/recall-auto-bot';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Day names for response messages
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format time for display
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes || '00'} ${ampm}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enrollmentId,
      childId,
      preferredDay,
      preferredTime,
      confirmedBy, // 'coach' or 'admin' or 'system'
    } = body;

    // Validate required fields
    if (!enrollmentId || !childId || preferredDay === undefined || !preferredTime) {
      return NextResponse.json(
        { error: 'Missing required fields: enrollmentId, childId, preferredDay, preferredTime' },
        { status: 400 }
      );
    }

    // Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, coach_id, schedule_confirmed, program_start')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Check if already scheduled
    if (enrollment.schedule_confirmed) {
      return NextResponse.json(
        { error: 'Sessions already scheduled for this enrollment' },
        { status: 400 }
      );
    }

    // Get child details
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, child_name, name, parent_email, parents(email, name)')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', enrollment.coach_id!)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // ============================================================
    // QUERY EXISTING SESSIONS (created by payment/verify)
    // ============================================================
    const { data: existingSessions, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('session_number', { ascending: true });

    if (fetchError) {
      console.error('Failed to fetch sessions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch existing sessions' },
        { status: 500 }
      );
    }

    if (!existingSessions || existingSessions.length === 0) {
      return NextResponse.json(
        { error: 'No sessions found for this enrollment. Sessions should be created during payment.' },
        { status: 400 }
      );
    }

    console.log(JSON.stringify({
      event: 'sessions_confirm_start',
      enrollmentId,
      existingSessionCount: existingSessions.length,
      preferredDay,
      preferredTime,
    }));

    // ============================================================
    // SCHEDULE CALENDAR EVENTS FOR EXISTING SESSIONS
    // ============================================================

    // Initialize Google Calendar API (coach as organizer)
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      undefined,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/calendar'],
      coach.email // Impersonate coach so they become the organizer
    );
    const calendar = google.calendar({ version: 'v3', auth });

    // Calculate start date based on preferred day
    const startDate = getNextPreferredDay(parseInt(preferredDay), preferredTime);
    const childName = child.child_name || child.name || 'Child';
    const parentEmail = (child.parents as any)?.email || child.parent_email;
    const parentName = (child.parents as any)?.name || 'Parent';

    const scheduledSessions: any[] = [];
    const errors: any[] = [];

    for (const session of existingSessions) {
      // Skip if already has calendar event
      if (session.google_event_id) {
        scheduledSessions.push({
          sessionNumber: session.session_number,
          type: session.session_type,
          scheduledDate: session.scheduled_date,
          scheduledTime: session.scheduled_time,
          meetLink: session.google_meet_link,
          googleEventId: session.google_event_id,
        });
        continue;
      }

      try {
        // Calculate session date based on week number
        const sessionDate = calculateSessionDateForDay(
          startDate,
          session.week_number ?? 1,
          parseInt(preferredDay),
          preferredTime
        );

        const isCoaching = session.session_type === 'coaching';
        // V2: Use session's own duration_minutes, fallback to legacy defaults
        const duration = session.duration_minutes || (isCoaching ? 45 : 30);

        const endDate = new Date(sessionDate);
        endDate.setMinutes(endDate.getMinutes() + duration);

        // Build event
        const eventTitle = isCoaching
          ? `Yestoryd: ${childName} - Coaching Session ${session.session_number}`
          : `Yestoryd: ${childName} - Parent Check-in`;

        const eventDescription = isCoaching
          ? `1:1 Reading Coaching Session with ${childName}\n\nCoach: ${coach.name}\nParent: ${parentName}\nSession ${session.session_number}\nDuration: ${duration} minutes\n\nQuestions? WhatsApp: +91 89762 87997`
          : `Parent Progress Check-in for ${childName}\n\nCoach: ${coach.name}\nParent: ${parentName}\nDuration: ${duration} minutes\n\nQuestions? WhatsApp: +91 89762 87997`;

        // Create Google Calendar event
        const event = await calendar.events.insert({
          calendarId: coach.email, // Coach's calendar (coach is organizer)
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {
            summary: eventTitle,
            description: eventDescription,
            start: { dateTime: sessionDate.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
            attendees: [
              { email: parentEmail, displayName: parentName },
              { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' },
            ],
            conferenceData: {
              createRequest: {
                requestId: `yestoryd-${enrollmentId}-confirm-${session.id}-${Date.now()}`,
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

        const dateStr = sessionDate.toISOString().split('T')[0];
        const timeStr = sessionDate.toTimeString().slice(0, 8);

        // UPDATE existing session with calendar details (NOT INSERT!)
        const { error: updateError } = await supabase
          .from('scheduled_sessions')
          .update({
            google_event_id: event.data.id,
            google_meet_link: meetLink,
            scheduled_date: dateStr,
            scheduled_time: timeStr,
            status: 'scheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (updateError) {
          console.error('Session update failed:', updateError);
          errors.push({ sessionId: session.id, error: updateError.message });
          continue;
        }

        scheduledSessions.push({
          sessionNumber: session.session_number,
          type: session.session_type,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          meetLink,
          googleEventId: event.data.id,
        });

        console.log(JSON.stringify({
          event: 'calendar_event_created',
          sessionId: session.id,
          sessionNumber: session.session_number,
          googleEventId: event.data.id,
        }));

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (calError: any) {
        console.error('Calendar error:', calError.message);
        errors.push({
          sessionId: session.id,
          sessionNumber: session.session_number,
          error: calError.message,
        });
      }
    }

    // Update enrollment status
    await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        schedule_confirmed_by: confirmedBy || 'system',
        schedule_confirmed_at: new Date().toISOString(),
        preferred_day: preferredDay,
        preferred_time: preferredTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // Update child's program dates
    if (scheduledSessions.length > 0) {
      const sortedSessions = [...scheduledSessions].sort(
        (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );
      const firstSession = sortedSessions[0];
      const lastSession = sortedSessions[sortedSessions.length - 1];

      await supabase
        .from('children')
        .update({
          program_start_date: firstSession.scheduledDate,
          program_end_date: lastSession.scheduledDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', childId);
    }

    // ============================================================
    // RECALL.AI - Schedule bots for all sessions
    // ============================================================
    let recallBotsCreated = 0;
    try {
      console.log('Scheduling Recall.ai bots...');
      const botResult = await scheduleBotsForEnrollment(enrollmentId);
      recallBotsCreated = botResult.botsCreated;
      console.log(`Recall bots: ${botResult.botsCreated} created`);
      if (botResult.errors.length > 0) {
        console.error('Bot scheduling errors:', botResult.errors);
      }
    } catch (recallError) {
      console.error('Recall.ai bot scheduling error:', recallError);
      // Don't fail - calendar events are already created
    }

    const firstSession = scheduledSessions[0];

    return NextResponse.json({
      success: true,
      message: `${scheduledSessions.length} sessions scheduled for ${DAY_NAMES[parseInt(preferredDay)]}s at ${formatTime(preferredTime)}`,
      sessions: scheduledSessions,
      recallBotsCreated,
      errors: errors.length > 0 ? errors : undefined,
      firstSession: firstSession ? {
        date: firstSession.scheduledDate,
        time: preferredTime,
        meetLink: firstSession.meetLink,
      } : null,
    });
  } catch (error: any) {
    console.error('Session confirmation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get the next occurrence of a preferred day from today
 */
function getNextPreferredDay(preferredDay: number, preferredTime: string): Date {
  const date = new Date();
  const currentDay = date.getDay();

  // Calculate days until next preferred day
  let daysUntil = preferredDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Move to next week if today or past
  }

  date.setDate(date.getDate() + daysUntil);

  // Set preferred time
  const [hours, minutes] = preferredTime.split(':');
  date.setHours(parseInt(hours), parseInt(minutes || '0'), 0, 0);

  return date;
}

/**
 * Calculate session date based on week number and preferred day
 */
function calculateSessionDateForDay(
  startDate: Date,
  weekNumber: number,
  preferredDay: number,
  preferredTime: string
): Date {
  const date = new Date(startDate);

  // Add weeks based on week_number (1-indexed)
  if (weekNumber > 1) {
    date.setDate(date.getDate() + (weekNumber - 1) * 7);
  }

  // Ensure we land on the preferred day
  const currentDay = date.getDay();
  if (currentDay !== preferredDay) {
    const diff = preferredDay - currentDay;
    date.setDate(date.getDate() + diff);
  }

  // Set preferred time
  const [hours, minutes] = preferredTime.split(':');
  date.setHours(parseInt(hours), parseInt(minutes || '0'), 0, 0);

  return date;
}
