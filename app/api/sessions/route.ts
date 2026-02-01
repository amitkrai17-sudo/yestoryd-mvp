// app/api/sessions/route.ts
// Manage sessions: Get, Reschedule, Cancel
// HARDENED: Full TypeScript, validation, error handling, null-safe
// FEATURE: Creates calendar event on reschedule if none exists

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { rescheduleEvent, cancelEvent, scheduleCalendarEvent } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';

// ============================================================
// CONSTANTS
// ============================================================

const API_NAME = 'sessions';
const DEFAULT_DURATION_MINUTES = 30;

// ============================================================
// TYPES
// ============================================================

interface SessionRecord {
  id: string;
  child_id: string;
  coach_id: string;
  session_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  duration_minutes: number | null;
  session_type: string | null;
}

interface ChildRecord {
  id: string;
  name: string;
  parent_name: string | null;
  parent_email: string | null;
}

interface CoachRecord {
  id: string;
  name: string;
  email: string;
}

interface RescheduleRequest {
  sessionId: string;
  newDateTime: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
}

function logError(context: string, error: unknown): void {
  console.error(`[${API_NAME}] ${context}:`, error instanceof Error ? error.message : error);
}

function logInfo(context: string, message: string): void {
  console.log(`[${API_NAME}] ${context}: ${message}`);
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidDateTime(str: string): boolean {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTimeForDB(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

// ============================================================
// GET - Get sessions for a child or specific session
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const sessionId = searchParams.get('sessionId');

    // Get single session by ID
    if (sessionId) {
      if (!isValidUUID(sessionId)) {
        return NextResponse.json(
          { error: 'Invalid sessionId format' },
          { status: 400 }
        );
      }

      const { data: session, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        logError('GET single session', error);
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, session });
    }

    // Get sessions by child ID
    if (childId) {
      if (!isValidUUID(childId)) {
        return NextResponse.json(
          { error: 'Invalid childId format' },
          { status: 400 }
        );
      }

      const { data: sessions, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', childId)
        .order('scheduled_date', { ascending: true });

      if (error) {
        logError('GET sessions by child', error);
        return NextResponse.json(
          { error: 'Failed to fetch sessions' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, sessions: sessions || [] });
    }

    return NextResponse.json(
      { error: 'childId or sessionId required' },
      { status: 400 }
    );

  } catch (error) {
    logError('GET handler', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH - Reschedule a session
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Parse and validate request body
    let body: RescheduleRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { sessionId, newDateTime } = body;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!newDateTime || typeof newDateTime !== 'string') {
      return NextResponse.json(
        { error: 'newDateTime is required' },
        { status: 400 }
      );
    }

    // Validate formats
    if (!isValidUUID(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      );
    }

    if (!isValidDateTime(newDateTime)) {
      return NextResponse.json(
        { error: 'Invalid newDateTime format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    // Validate new date is in the future
    const newDate = new Date(newDateTime);
    const now = new Date();
    if (newDate < now) {
      return NextResponse.json(
        { error: 'Cannot reschedule to a past date/time' },
        { status: 400 }
      );
    }

    // Get session from database with related data
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select(`
        *,
        children:child_id (id, name, parent_name, parent_email),
        coaches:coach_id (id, name, email)
      `)
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      logError('PATCH fetch session', fetchError);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const typedSession = session as SessionRecord & {
      children: ChildRecord;
      coaches: CoachRecord;
    };

    // Check if session can be rescheduled
    if (typedSession.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot reschedule a completed session' },
        { status: 400 }
      );
    }

    if (typedSession.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot reschedule a cancelled session' },
        { status: 400 }
      );
    }

    const duration = typedSession.duration_minutes || DEFAULT_DURATION_MINUTES;
    let calendarUpdated = false;
    let newMeetLink = typedSession.google_meet_link;
    let newEventId = typedSession.google_event_id;

    // Handle Google Calendar
    if (typedSession.google_event_id) {
      // UPDATE existing calendar event
      const result = await rescheduleEvent(
        typedSession.google_event_id,
        newDate,
        duration
      );

      if (!result.success) {
        logError('PATCH reschedule calendar', result.error);
        // Event might have been deleted - try creating new one
        logInfo('PATCH', 'Calendar update failed, attempting to create new event');
      } else {
        calendarUpdated = true;
        if (result.meetLink) {
          newMeetLink = result.meetLink;
        }
      }
    }

    // CREATE new calendar event if none exists or update failed
    if (!calendarUpdated) {
      logInfo('PATCH', `Creating new calendar event for session ${sessionId}`);
      
      const childName = typedSession.children?.name || 'Student';
      const parentEmail = typedSession.children?.parent_email || '';
      const coachEmail = typedSession.coaches?.email || '';
      const sessionType = typedSession.session_type || 'coaching';
      const sessionNum = typedSession.session_number || 1;

      const endTime = new Date(newDate);
      endTime.setMinutes(endTime.getMinutes() + duration);

      // Build attendees list
      const attendees: string[] = [];
      if (parentEmail) attendees.push(parentEmail);
      if (coachEmail) attendees.push(coachEmail);

      try {
        const createResult = await scheduleCalendarEvent({
          title: `Yestoryd ${sessionType} - ${childName} (Session ${sessionNum})`,
          description: `Reading coaching session for ${childName}\nSession ${sessionNum}\n\nRescheduled session.`,
          startTime: newDate,
          endTime: endTime,
          attendees,
          sessionType: sessionType as 'coaching' | 'parent_checkin',
        });

        if (createResult.eventId) {
          calendarUpdated = true;
          newEventId = createResult.eventId;
          newMeetLink = createResult.meetLink || null;
          logInfo('PATCH', `New calendar event created: ${newEventId}`);
        }
      } catch (calError) {
        logError('PATCH create calendar event', calError);
        // Continue without calendar - still update DB
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: formatDateForDB(newDate),
        scheduled_time: formatTimeForDB(newDate),
        status: 'scheduled', // Reset to scheduled
        google_event_id: newEventId,
        google_meet_link: newMeetLink,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      logError('PATCH update session', updateError);

      // Check for double-booking constraint violation
      if (updateError.code === '23505' && updateError.message?.includes('no_double_booking')) {
        return NextResponse.json(
          { error: 'This time slot is already booked. Please choose a different time.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    logInfo('PATCH', `Session ${sessionId} rescheduled to ${newDateTime}`);

    // Create learning event for tracking (non-blocking)
    try {
      const { error: insertError } = await supabase.from('learning_events').insert({
        child_id: typedSession.child_id,
        coach_id: typedSession.coach_id,
        session_id: sessionId,
        event_type: 'session_rescheduled',
        event_date: new Date().toISOString(),
        event_data: {
          session_number: typedSession.session_number,
          old_date: typedSession.scheduled_date,
          old_time: typedSession.scheduled_time,
          new_date: formatDateForDB(newDate),
          new_time: formatTimeForDB(newDate),
          calendar_updated: calendarUpdated,
        },
        content_for_embedding: `Session ${typedSession.session_number || '?'} rescheduled from ${typedSession.scheduled_date} to ${formatDateForDB(newDate)}`,
      });
      
      if (insertError) {
        logError('PATCH insert learning_event', insertError);
      } else {
        logInfo('PATCH', 'Learning event created for reschedule');
      }
    } catch (insertErr) {
      logError('PATCH create learning_event exception', insertErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Session rescheduled successfully',
      data: {
        sessionId,
        newDate: formatDateForDB(newDate),
        newTime: formatTimeForDB(newDate),
        calendarUpdated,
        meetLink: newMeetLink,
      },
    });

  } catch (error) {
    logError('PATCH handler', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE - Cancel a session
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const reason = searchParams.get('reason') || 'Cancelled by coach';

    // Validate sessionId
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      );
    }

    // Get session
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('*, recall_bot_id')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      logError('DELETE fetch session', fetchError);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const typedSession = session as SessionRecord;

    // Check if session can be cancelled
    if (typedSession.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed session' },
        { status: 400 }
      );
    }

    if (typedSession.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Session is already cancelled' },
        { status: 400 }
      );
    }

    let calendarCancelled = false;

    // Cancel in Google Calendar (only if event exists)
    if (typedSession.google_event_id) {
      try {
        await cancelEvent(typedSession.google_event_id, true);
        calendarCancelled = true;
        logInfo('DELETE', `Calendar event ${typedSession.google_event_id} cancelled`);
      } catch (calError) {
        logError('DELETE cancel calendar', calError);
        // Continue with DB update even if calendar fails
      }
    } else {
      logInfo('DELETE', `Session ${sessionId} has no google_event_id, skipping calendar cancel`);
    }

    // Cancel Recall.ai bot if present
    if (session.recall_bot_id) {
      try {
        await cancelRecallBot(session.recall_bot_id);
        logInfo('DELETE', `Recall bot ${session.recall_bot_id} cancelled`);
      } catch (recallError) {
        logError('DELETE cancel recall bot', recallError);
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'cancelled',
        coach_notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      logError('DELETE update session', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel session' },
        { status: 500 }
      );
    }

    logInfo('DELETE', `Session ${sessionId} cancelled. Reason: ${reason}`);

    // Create learning event for tracking (non-blocking)
    try {
      const { error: insertError } = await supabase.from('learning_events').insert({
        child_id: typedSession.child_id,
        coach_id: typedSession.coach_id,
        session_id: sessionId,
        event_type: 'session_cancelled',
        event_date: new Date().toISOString(),
        event_data: {
          session_number: typedSession.session_number,
          scheduled_date: typedSession.scheduled_date,
          scheduled_time: typedSession.scheduled_time,
          reason,
          calendar_cancelled: calendarCancelled,
        },
        content_for_embedding: `Session ${typedSession.session_number || '?'} cancelled: ${reason}`,
      });
      
      if (insertError) {
        logError('DELETE insert learning_event', insertError);
      } else {
        logInfo('DELETE', 'Learning event created for cancellation');
      }
    } catch (insertErr) {
      logError('DELETE create learning_event exception', insertErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Session cancelled successfully',
      data: {
        sessionId,
        reason,
        calendarCancelled,
      },
    });

  } catch (error) {
    logError('DELETE handler', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}