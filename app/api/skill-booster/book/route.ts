// ============================================================
// FILE: app/api/skill-booster/book/route.ts
// PURPOSE: Parent books Skill Booster session slot
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { scheduleCalendarEvent } from '@/lib/googleCalendar';

export const dynamic = 'force-dynamic';

const CALENDAR_EMAIL = process.env.GOOGLE_CALENDAR_EMAIL || 'engage@yestoryd.com';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, selectedSlot } = await request.json();

    if (!sessionId || !selectedSlot) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Get session details (still uses 'remedial' type in DB for compatibility)
    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        child_id,
        coach_id,
        enrollment_id,
        focus_area,
        session_type,
        status,
        duration_minutes
      `)
      .eq('id', sessionId)
      .eq('session_type', 'remedial')
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'pending_booking') {
      return NextResponse.json({ error: 'Session already booked or completed' }, { status: 400 });
    }

    // 2. Get child details
    const { data: child } = await supabase
      .from('children')
      .select('child_name, name, parent_email, parent_phone')
      .eq('id', session.child_id)
      .single();

    // 3. Get coach details
    const { data: coach } = await supabase
      .from('coaches')
      .select('name, email')
      .eq('id', session.coach_id)
      .single();

    if (!coach || !child) {
      return NextResponse.json({ error: 'Missing coach or child data' }, { status: 404 });
    }

    // 4. Create Google Calendar event
    const startTime = new Date(selectedSlot);
    // V2: Use session duration_minutes if set, fallback to 45
    const sbDuration = session.duration_minutes || 45;
    const endTime = new Date(startTime.getTime() + sbDuration * 60 * 1000);

    const childName = child.child_name || child.name || 'Child';
    const focusAreaLabel = getFocusAreaLabel(session.focus_area);

    let calendarResult;
    try {
      calendarResult = await scheduleCalendarEvent({
        title: `[Skill Booster] ${childName} - Reading Support`,
        description: `Skill Booster Session for ${childName}

Focus Area: ${focusAreaLabel}

This is a Skill Booster session to provide additional support.
Coach will join via Google Meet.`,
        startTime: startTime,
        endTime: endTime,
        attendees: [
          child.parent_email,
          coach.email,
          CALENDAR_EMAIL
        ].filter(Boolean),
        sessionType: 'coaching'
      });
    } catch (calError: any) {
      console.error('Calendar creation failed:', calError);
      return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
    }

    // 5. Update scheduled_sessions
    const dateStr = startTime.toISOString().split('T')[0];
    const timeStr = startTime.toTimeString().slice(0, 8);

    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'scheduled',
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        google_meet_link: calendarResult.meetLink,
        google_event_id: calendarResult.eventId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return NextResponse.json({ error: 'Session update failed' }, { status: 500 });
    }

    // 6. Schedule Recall.ai bot (FIXED: correct endpoint and payload)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/recall/bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          meetingUrl: calendarResult.meetLink,
          scheduledTime: startTime.toISOString(),
          childId: session.child_id,
          coachId: session.coach_id,
          childName: childName,
          sessionType: 'coaching'
        })
      });
    } catch (recallError) {
      console.error('Recall bot scheduling failed (non-blocking):', recallError);
    }

    // 7. Send confirmation (WhatsApp + Email)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'skill_booster_scheduled',
          channel: 'whatsapp',
          recipient: {
            email: child.parent_email,
            phone: child.parent_phone
          },
          variables: {
            childName: childName,
            coachName: coach.name,
            sessionDate: startTime.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            }),
            sessionTime: startTime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }),
            meetLink: calendarResult.meetLink,
            focusArea: focusAreaLabel
          }
        })
      });
    } catch (commError) {
      console.error('Communication error (non-blocking):', commError);
    }

    return NextResponse.json({
      success: true,
      message: 'Skill Booster session booked successfully',
      meetLink: calendarResult.meetLink,
      scheduledDate: dateStr,
      scheduledTime: timeStr
    });

  } catch (error: any) {
    console.error('Book Skill Booster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function
function getFocusAreaLabel(focusArea: string): string {
  const labels: Record<string, string> = {
    phonics_sounds: 'Phonics & Letter Sounds',
    reading_fluency: 'Reading Fluency',
    comprehension: 'Reading Comprehension',
    vocabulary: 'Vocabulary Building',
    grammar: 'Grammar & Sentence Structure',
    confidence: 'Speaking Confidence',
    specific_sounds: 'Specific Sound Practice',
    other: 'Special Focus',
  };
  return labels[focusArea] || focusArea;
}
