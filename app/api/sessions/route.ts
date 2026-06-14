// app/api/sessions/route.ts
// Manage sessions: Get, Reschedule, Cancel
// HARDENED: Full TypeScript, validation, error handling, null-safe
// FEATURE: Creates calendar event on reschedule if none exists

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';
import { rescheduleSession } from '@/lib/scheduling/operations/reschedule-session';
import { randomUUID } from 'crypto';

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
  return createAdminClient();
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

    const newDateStr = formatDateForDB(newDate);
    const newTimeStr = formatTimeForDB(newDate);

    // Reschedule via the canonical helper — it OWNS the calendar reschedule, the
    // recall-bot cancel, the 6 reminder-flag resets, and notify('session.rescheduled').
    // Fixes divergences #10/#11: this route previously reset NO reminder flags and
    // cancelled NO recall bot. (The helper PATCHes the existing event; it does not
    // create one for a session that has no event — matching the orchestrator path used
    // everywhere else.)
    const reResult = await rescheduleSession(sessionId, { date: newDateStr, time: newTimeStr }, 'Rescheduled');

    if (!reResult.success) {
      logError('PATCH reschedule via helper', reResult.error);
      if (reResult.error?.includes('no_double_booking')) {
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

    const newMeetLink = reResult.meetLink ?? null;
    const calendarUpdated = true; // helper rescheduled the existing event (where present)

    logInfo('PATCH', `Session ${sessionId} rescheduled to ${newDateTime}`);

    // Create learning event for tracking (non-blocking)
    try {
      const rescheduleContentForEmbedding = `Session ${typedSession.session_number || '?'} rescheduled from ${typedSession.scheduled_date} to ${formatDateForDB(newDate)}`;

      const insertResult = await insertLearningEvent({
        childId: typedSession.child_id,
        coachId: typedSession.coach_id,
        sessionId,
        eventType: 'session_rescheduled',
        eventDate: new Date().toISOString(),
        eventData: {
          session_number: typedSession.session_number,
          old_date: typedSession.scheduled_date,
          old_time: typedSession.scheduled_time,
          new_date: formatDateForDB(newDate),
          new_time: formatTimeForDB(newDate),
          calendar_updated: calendarUpdated,
        },
        contentForEmbedding: rescheduleContentForEmbedding,
        signalSource: 'system_generated',
        signalConfidence: 'low',
      });

      if (!insertResult) {
        logError('PATCH insert learning_event', 'insertLearningEvent returned null');
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

    // Cancel via the SOLE status writer — owns POLICY-D calendar + recall teardown
    // AND the status flip in one atomic place. notify:false — DELETE sends no template.
    const cancelResult = await transitionSessionStatus({
      sessionId,
      to: 'cancelled',
      actor: 'admin',
      reason,
      requestId: randomUUID(),
      opts: { notify: false, extraSessionFields: { coach_notes: reason } },
    });

    if (!cancelResult.ok && !cancelResult.noop) {
      logError('DELETE cancel via service', cancelResult.error);
      return NextResponse.json(
        { error: 'Failed to cancel session' },
        { status: 500 }
      );
    }

    // calendar_cancelled for the learning_event below now comes from the service result.
    const calendarCancelled = cancelResult.sideEffects.calendarTorndown ?? false;

    logInfo('DELETE', `Session ${sessionId} cancelled. Reason: ${reason}`);

    // Create learning event for tracking (non-blocking)
    try {
      const cancelContentForEmbedding = `Session ${typedSession.session_number || '?'} cancelled: ${reason}`;

      const insertResult = await insertLearningEvent({
        childId: typedSession.child_id,
        coachId: typedSession.coach_id,
        sessionId,
        eventType: 'session_cancelled',
        eventDate: new Date().toISOString(),
        eventData: {
          session_number: typedSession.session_number,
          scheduled_date: typedSession.scheduled_date,
          scheduled_time: typedSession.scheduled_time,
          reason,
          calendar_cancelled: calendarCancelled,
        },
        contentForEmbedding: cancelContentForEmbedding,
        signalSource: 'system_generated',
        signalConfidence: 'low',
      });

      if (!insertResult) {
        logError('DELETE insert learning_event', 'insertLearningEvent returned null');
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