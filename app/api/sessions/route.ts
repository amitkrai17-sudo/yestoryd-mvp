// app/api/sessions/route.ts
// Manage sessions: Get, Reschedule, Cancel

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rescheduleEvent, cancelEvent } from '@/lib/googleCalendar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get sessions for a child
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const { data: session, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, session });
    }

    if (childId) {
      const { data: sessions, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', childId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, sessions });
    }

    return NextResponse.json(
      { error: 'childId or sessionId required' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Reschedule a session
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, newDateTime } = body;

    if (!sessionId || !newDateTime) {
      return NextResponse.json(
        { error: 'sessionId and newDateTime required' },
        { status: 400 }
      );
    }

    // Get session from database
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Reschedule in Google Calendar
    const result = await rescheduleEvent(
      session.google_event_id,
      new Date(newDateTime),
      session.duration_minutes
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to reschedule' },
        { status: 500 }
      );
    }

    // Update database
    const newDate = new Date(newDateTime);
    await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newDate.toISOString().split('T')[0],
        scheduled_time: newDate.toTimeString().slice(0, 8),
        status: 'rescheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session rescheduled',
      newDateTime,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Cancel a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // Get session
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Cancel in Google Calendar
    await cancelEvent(session.google_event_id, true);

    // Update database
    await supabase
      .from('scheduled_sessions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return NextResponse.json({ success: true, message: 'Session cancelled' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}