// ============================================================
// FILE: app/api/admin/group-classes/route.ts
// ============================================================
// HARDENED VERSION - Admin Group Classes Management
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { google, calendar_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const getQuerySchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const createSessionSchema = z.object({
  classTypeId: z.string().uuid('Invalid class type ID'),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  durationMinutes: z.number().min(15).max(180).optional(),
  maxParticipants: z.number().min(1).max(50).optional(),
  priceInr: z.number().min(0).max(10000).optional(),
  ageMin: z.number().min(3).max(18).optional(),
  ageMax: z.number().min(3).max(18).optional(),
  instructorId: z.string().uuid().optional(),
  bookId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

// --- GOOGLE CALENDAR SETUP ---
function getCalendarClient(impersonateEmail?: string): calendar_v3.Calendar | null {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const subject = impersonateEmail || process.env.GOOGLE_CALENDAR_DELEGATED_USER;

  if (!serviceEmail || !privateKey || !subject) {
    console.log('Google Calendar not configured');
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: serviceEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: { subject },
    });
    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Error creating Google Calendar client:', error);
    return null;
  }
}

// --- RECALL.AI BOT SCHEDULING ---
async function scheduleRecallBot(meetLink: string, sessionTitle: string, scheduledTime: Date): Promise<string | null> {
  try {
    if (!process.env.RECALL_API_KEY) return null;

    const response = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetLink,
        bot_name: 'Yestoryd Recorder 📚',
        join_at: scheduledTime.toISOString(),
        automatic_leave: { waiting_room_timeout: 600, noone_joined_timeout: 300, everyone_left_timeout: 60 },
        recording_mode: 'speaker_view',
        transcription_options: { provider: 'default' },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.id;
  } catch {
    return null;
  }
}

// --- GET: List sessions ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'group_classes_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { status, limit, offset } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'group_classes_get_request', adminEmail: auth.email, status: status || 'all', limit, offset }));

    const supabase = getServiceSupabase();

    let query = supabase
      .from('group_sessions')
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex),
        instructor:coaches!group_sessions_instructor_id_fkey(id, name, email, photo_url),
        book:books(id, title, author, cover_image_url),
        participants:group_session_participants(
          id, child_id, payment_status, attendance_status,
          child:children(id, name, age)
        )
      `, { count: 'exact' })
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'group_classes_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_classes_get_success', count: sessions?.length || 0, total: count, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, sessions, total: count, limit, offset });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'group_classes_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Create session with Google Meet ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'group_classes_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const sessionData = validation.data;

    console.log(JSON.stringify({ requestId, event: 'group_classes_post_request', adminEmail: auth.email, title: sessionData.title, date: sessionData.scheduledDate }));

    const supabase = getServiceSupabase();

    // Get class type
    const { data: classType } = await supabase
      .from('group_class_types')
      .select('*')
      .eq('id', sessionData.classTypeId)
      .single();

    if (!classType) {
      return NextResponse.json({ error: 'Invalid class type' }, { status: 400 });
    }

    // Get instructor
    let instructorEmail: string | null = null;
    let instructorName = 'Yestoryd Team';
    if (sessionData.instructorId) {
      const { data: instructor } = await supabase
        .from('coaches')
        .select('name, email')
        .eq('id', sessionData.instructorId)
        .single();
      if (instructor) {
        instructorEmail = instructor.email;
        instructorName = instructor.name;
      }
    }
    // Fallback to engage@ if no instructor assigned
    const calendarOrganizerEmail = instructorEmail || (process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com');

    // Build datetime (IST)
    const sessionDateTime = new Date(`${sessionData.scheduledDate}T${sessionData.scheduledTime}:00+05:30`);
    const durationMins = sessionData.durationMinutes || classType.duration_minutes || 45;
    const sessionEndTime = new Date(sessionDateTime);
    sessionEndTime.setMinutes(sessionEndTime.getMinutes() + durationMins);

    // Create Google Calendar Event
    let googleMeetLink = null;
    let googleEventId = null;

    const calendar = getCalendarClient(calendarOrganizerEmail);
    if (calendar) {
      try {
        const eventDescription = `📚 ${classType.name} - Group Class

${sessionData.description || classType.description || ''}

👨‍🏫 Instructor: ${instructorName} (${calendarOrganizerEmail})
⏱️ Duration: ${durationMins} minutes
👧 Ages: ${sessionData.ageMin ?? classType.age_min}-${sessionData.ageMax ?? classType.age_max} years
💰 Price: ₹${sessionData.priceInr ?? classType.price_inr}

📌 This session will be recorded.

WhatsApp: +91 89762 87997`;

        // Build attendees: engage@ for Recall.ai tracking (organizer is implicit attendee)
        const attendees: { email: string; displayName: string }[] = [
          { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' },
        ];
        // If no instructor assigned, organizer is engage@ so no need to add it again
        // If instructor assigned, engage@ is added above as attendee for tracking

        const event = await calendar.events.insert({
          calendarId: calendarOrganizerEmail, // Organizer's calendar
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {
            summary: `📚 Yestoryd: ${sessionData.title}`,
            description: eventDescription,
            start: { dateTime: sessionDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: sessionEndTime.toISOString(), timeZone: 'Asia/Kolkata' },
            attendees,
            conferenceData: {
              createRequest: { requestId: `yestoryd-gc-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
            },
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] },
          },
        });

        googleEventId = event.data.id;
        googleMeetLink = event.data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || event.data.hangoutLink || null;

        console.log(JSON.stringify({ requestId, event: 'google_calendar_created', eventId: googleEventId, meetLink: googleMeetLink }));
      } catch (calError: any) {
        console.error(JSON.stringify({ requestId, event: 'google_calendar_error', error: calError.message }));
      }
    }

    // Schedule Recall.ai bot
    let recallBotId = null;
    if (googleMeetLink) {
      recallBotId = await scheduleRecallBot(googleMeetLink, sessionData.title, sessionDateTime);
    }

    // Save to database
    const dbData = {
      session_type: classType.slug || 'group_class',
      title: sessionData.title,
      scheduled_date: sessionData.scheduledDate,
      scheduled_time: sessionData.scheduledTime,
      duration_minutes: durationMins,
      class_type_id: sessionData.classTypeId,
      description: sessionData.description || classType.description || null,
      max_participants: sessionData.maxParticipants || classType.max_participants || 10,
      current_participants: 0,
      price_inr: sessionData.priceInr ?? classType.price_inr ?? 199,
      age_min: sessionData.ageMin ?? classType.age_min ?? 4,
      age_max: sessionData.ageMax ?? classType.age_max ?? 12,
      instructor_id: sessionData.instructorId || null,
      instructor_split_percent: classType.default_instructor_split_percent || 50,
      book_id: sessionData.bookId || null,
      status: 'scheduled',
      notes: sessionData.notes || null,
      google_meet_link: googleMeetLink,
      google_event_id: googleEventId,
      recall_bot_id: recallBotId,
    };

    const { data: session, error } = await supabase
      .from('group_sessions')
      .insert(dbData)
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji),
        instructor:coaches!group_sessions_instructor_id_fkey(id, name),
        book:books(id, title)
      `)
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'group_classes_post_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create: ' + error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'group_session_created',
      details: {
        request_id: requestId,
        session_id: session.id,
        title: sessionData.title,
        scheduled_date: sessionData.scheduledDate,
        google_meet: !!googleMeetLink,
        recall_bot: !!recallBotId,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_classes_post_success', sessionId: session.id, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      session,
      integrations: { googleMeet: !!googleMeetLink, recallBot: !!recallBotId },
    }, { status: 201 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'group_classes_post_error', error: error.message }));
    return NextResponse.json({ error: error.message || 'Internal server error', requestId }, { status: 500 });
  }
}
