// =============================================================================
// FILE: app/api/admin/group-classes/[sessionId]/route.ts
// PURPOSE: Admin API for single session operations
// FEATURES: Edit, Cancel (with Google Calendar), Delete
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { google, calendar_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// GOOGLE CALENDAR CLIENT - Same as lib/googleCalendar.ts
// =============================================================================
function getCalendarClient(): calendar_v3.Calendar | null {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const delegatedUser = process.env.GOOGLE_CALENDAR_DELEGATED_USER;

  if (!serviceEmail || !privateKey || !delegatedUser) {
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: {
        subject: delegatedUser,
      },
    });

    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Error creating Google Calendar client:', error);
    return null;
  }
}

// =============================================================================
// CANCEL GOOGLE CALENDAR EVENT
// =============================================================================
async function cancelGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const calendar = getCalendarClient();
  if (!calendar || !eventId) return false;

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'primary';
    
    // Delete the event
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all', // Notify attendees
    });
    
    console.log('✅ Google Calendar event cancelled:', eventId);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to cancel Google Calendar event:', error.message);
    return false;
  }
}

// =============================================================================
// CANCEL RECALL.AI BOT
// =============================================================================
async function cancelRecallBot(botId: string): Promise<boolean> {
  if (!process.env.RECALL_API_KEY || !botId) return false;

  try {
    const response = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${botId}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
      },
    });

    if (response.ok) {
      console.log('✅ Recall.ai bot cancelled:', botId);
      return true;
    } else {
      console.error('❌ Failed to cancel Recall.ai bot');
      return false;
    }
  } catch (error) {
    console.error('Recall.ai cancellation error:', error);
    return false;
  }
}

// Helper: Extract sessionId from URL
function getSessionIdFromUrl(request: NextRequest): string | null {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1];
  if (sessionId && UUID_REGEX.test(sessionId)) {
    return sessionId;
  }
  return null;
}

// =============================================================================
// GET
// =============================================================================
export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  try {
    const sessionId = getSessionIdFromUrl(request);
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from('group_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get related data
    let classType = null;
    let instructor = null;
    let book = null;

    if (session.class_type_id) {
      const { data } = await supabase.from('group_class_types').select('*').eq('id', session.class_type_id).single();
      classType = data;
    }

    if (session.instructor_id) {
      const { data } = await supabase.from('coaches').select('id, name, email, photo_url, phone').eq('id', session.instructor_id).single();
      instructor = data;
    }

    if (session.book_id) {
      const { data } = await supabase.from('books').select('id, title, author, cover_image_url').eq('id', session.book_id).single();
      book = data;
    }

    return NextResponse.json({ 
      session: { ...session, class_type: classType, instructor, book }
    });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update session (including cancel)
// =============================================================================
export async function PATCH(
  request: NextRequest,
  context: { params: any }
) {
  try {
    const sessionId = getSessionIdFromUrl(request);
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const body = await request.json();
    console.log('PATCH sessionId:', sessionId);
    console.log('PATCH body:', JSON.stringify(body, null, 2));

    // Get current session (to get google_event_id and recall_bot_id for cancellation)
    const { data: currentSession } = await supabase
      .from('group_sessions')
      .select('google_event_id, recall_bot_id, status')
      .eq('id', sessionId)
      .single();

    // Build update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // String fields
    if (typeof body.title === 'string' && body.title.trim()) {
      updateData.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      updateData.description = body.description.trim() || null;
    }
    if (typeof body.notes === 'string') {
      updateData.notes = body.notes.trim() || null;
    }
    
    // Handle status change
    if (typeof body.status === 'string' && body.status.trim()) {
      updateData.status = body.status.trim();
      
      // If cancelling, also cancel Google Calendar event and Recall.ai bot
      if (updateData.status === 'cancelled' && currentSession?.status !== 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_reason = body.cancelledReason || body.cancelled_reason || 'Cancelled by admin';
        
        // Cancel Google Calendar event
        if (currentSession?.google_event_id) {
          console.log('Cancelling Google Calendar event:', currentSession.google_event_id);
          await cancelGoogleCalendarEvent(currentSession.google_event_id);
        }
        
        // Cancel Recall.ai bot
        if (currentSession?.recall_bot_id) {
          console.log('Cancelling Recall.ai bot:', currentSession.recall_bot_id);
          await cancelRecallBot(currentSession.recall_bot_id);
        }
      }
      
      if (updateData.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }

    // Date/Time
    if (typeof body.scheduledDate === 'string' && body.scheduledDate) {
      updateData.scheduled_date = body.scheduledDate;
    }
    if (typeof body.scheduledTime === 'string' && body.scheduledTime) {
      updateData.scheduled_time = body.scheduledTime;
    }

    // Numbers
    if (body.durationMinutes != null && body.durationMinutes !== '') {
      const num = parseInt(body.durationMinutes);
      if (!isNaN(num) && num > 0) updateData.duration_minutes = num;
    }
    if (body.maxParticipants != null && body.maxParticipants !== '') {
      const num = parseInt(body.maxParticipants);
      if (!isNaN(num) && num > 0) updateData.max_participants = num;
    }
    if (body.priceInr != null && body.priceInr !== '') {
      const num = parseInt(body.priceInr);
      if (!isNaN(num) && num >= 0) updateData.price_inr = num;
    }
    if (body.ageMin != null && body.ageMin !== '') {
      const num = parseInt(body.ageMin);
      if (!isNaN(num) && num >= 0) updateData.age_min = num;
    }
    if (body.ageMax != null && body.ageMax !== '') {
      const num = parseInt(body.ageMax);
      if (!isNaN(num) && num >= 0) updateData.age_max = num;
    }

    // UUIDs
    if (body.classTypeId !== undefined) {
      if (body.classTypeId && UUID_REGEX.test(body.classTypeId)) {
        updateData.class_type_id = body.classTypeId;
      }
    }
    if (body.instructorId !== undefined) {
      if (body.instructorId && UUID_REGEX.test(body.instructorId)) {
        updateData.instructor_id = body.instructorId;
      } else {
        updateData.instructor_id = null;
      }
    }
    if (body.bookId !== undefined) {
      if (body.bookId && UUID_REGEX.test(body.bookId)) {
        updateData.book_id = body.bookId;
      } else {
        updateData.book_id = null;
      }
    }

    console.log('Update data:', JSON.stringify(updateData, null, 2));

    // Do update
    const { error: updateError } = await supabase
      .from('group_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update: ' + updateError.message }, { status: 500 });
    }

    // Fetch updated session
    const { data: session } = await supabase
      .from('group_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ session: { id: sessionId }, message: 'Updated' });
    }

    // Get related data
    let classType = null;
    let instructor = null;
    let book = null;

    if (session.class_type_id) {
      const { data } = await supabase.from('group_class_types').select('id, name, slug, icon_emoji').eq('id', session.class_type_id).single();
      classType = data;
    }

    if (session.instructor_id) {
      const { data } = await supabase.from('coaches').select('id, name').eq('id', session.instructor_id).single();
      instructor = data;
    }

    if (session.book_id) {
      const { data } = await supabase.from('books').select('id, title').eq('id', session.book_id).single();
      book = data;
    }

    return NextResponse.json({ 
      session: { ...session, class_type: classType, instructor, book }
    });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Soft delete (cancel) session
// =============================================================================
export async function DELETE(
  request: NextRequest,
  context: { params: any }
) {
  try {
    const sessionId = getSessionIdFromUrl(request);

    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session to check for participants and get event IDs
    const { data: session } = await supabase
      .from('group_sessions')
      .select('google_event_id, recall_bot_id')
      .eq('id', sessionId)
      .single();

    // Check for active participants
    const { data: participants } = await supabase
      .from('group_session_participants')
      .select('id')
      .eq('group_session_id', sessionId)
      .neq('attendance_status', 'cancelled')
      .limit(1);

    if (participants && participants.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete session with active registrations. Cancel instead.' },
        { status: 400 }
      );
    }

    // Cancel Google Calendar event
    if (session?.google_event_id) {
      await cancelGoogleCalendarEvent(session.google_event_id);
    }

    // Cancel Recall.ai bot
    if (session?.recall_bot_id) {
      await cancelRecallBot(session.recall_bot_id);
    }

    // Soft delete
    const { error } = await supabase
      .from('group_sessions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: 'Deleted by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Session cancelled' });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
