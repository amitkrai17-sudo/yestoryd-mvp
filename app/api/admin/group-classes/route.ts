// =============================================================================
// FILE: app/api/admin/group-classes/route.ts
// PURPOSE: Admin API for listing and creating group sessions
// FIXED: Using same Google Calendar approach as lib/googleCalendar.ts
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { google, calendar_v3 } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// GOOGLE CALENDAR SETUP - SAME AS lib/googleCalendar.ts
// =============================================================================
function getCalendarClient(): calendar_v3.Calendar | null {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const delegatedUser = process.env.GOOGLE_CALENDAR_DELEGATED_USER;

  console.log('=== Google Calendar Config ===');
  console.log('Service Account:', serviceEmail || 'NOT SET');
  console.log('Private Key:', privateKey ? `✓ (${privateKey.length} chars)` : 'NOT SET');
  console.log('Delegated User:', delegatedUser || 'NOT SET');

  if (!serviceEmail || !privateKey || !delegatedUser) {
    console.error('❌ Missing Google Calendar credentials');
    return null;
  }

  try {
    // SAME APPROACH AS YOUR WORKING lib/googleCalendar.ts
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: {
        subject: delegatedUser, // Domain-wide delegation - impersonate this user
      },
    });

    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('❌ Error creating Google Calendar client:', error);
    return null;
  }
}

// =============================================================================
// RECALL.AI BOT SCHEDULING
// =============================================================================
async function scheduleRecallBot(meetLink: string, sessionTitle: string, scheduledTime: Date): Promise<string | null> {
  try {
    if (!process.env.RECALL_API_KEY) {
      console.log('Recall.ai not configured');
      return null;
    }

    console.log('Scheduling Recall.ai bot...');

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
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 300,
          everyone_left_timeout: 60,
        },
        recording_mode: 'speaker_view',
        transcription_options: { provider: 'default' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Recall.ai error:', error);
      return null;
    }

    const data = await response.json();
    console.log('✅ Recall.ai bot scheduled:', data.id);
    return data.id;
  } catch (error) {
    console.error('Recall.ai error:', error);
    return null;
  }
}

// =============================================================================
// GET - List sessions
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions, total: count, limit, offset });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create session with Google Meet
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      classTypeId, title, description, scheduledDate, scheduledTime,
      durationMinutes, maxParticipants, priceInr, ageMin, ageMax,
      instructorId, bookId, notes,
    } = body;

    console.log('=== Creating Group Session ===');
    console.log('Title:', title);
    console.log('Date:', scheduledDate, scheduledTime);

    if (!classTypeId || !title || !scheduledDate || !scheduledTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get class type
    const { data: classType } = await supabase
      .from('group_class_types')
      .select('*')
      .eq('id', classTypeId)
      .single();

    if (!classType) {
      return NextResponse.json({ error: 'Invalid class type' }, { status: 400 });
    }

    // Get instructor
    let instructorEmail = process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com';
    let instructorName = 'Yestoryd Team';
    if (instructorId) {
      const { data: instructor } = await supabase
        .from('coaches')
        .select('name, email')
        .eq('id', instructorId)
        .single();
      if (instructor) {
        instructorEmail = instructor.email;
        instructorName = instructor.name;
      }
    }

    // Build datetime (IST)
    const sessionDateTime = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`);
    const sessionEndTime = new Date(sessionDateTime);
    sessionEndTime.setMinutes(sessionEndTime.getMinutes() + (durationMinutes || classType.duration_minutes || 45));

    // =============================================================================
    // CREATE GOOGLE CALENDAR EVENT
    // =============================================================================
    let googleMeetLink = null;
    let googleEventId = null;

    const calendar = getCalendarClient();
    
    if (calendar) {
      console.log('=== Creating Google Calendar Event ===');
      
      try {
        const eventDescription = `📚 ${classType.name} - Group Class

${description || classType.description || ''}

👨‍🏫 Instructor: ${instructorName} (${instructorEmail})
⏱️ Duration: ${durationMinutes || classType.duration_minutes} minutes
👧 Ages: ${ageMin || classType.age_min}-${ageMax || classType.age_max} years
💰 Price: ₹${priceInr ?? classType.price_inr}

📌 This session will be recorded.

WhatsApp: +91 89762 87997`;

        // Use delegated user's calendar (engage@yestoryd.com)
        const calendarId = process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'primary';
        console.log('Calendar ID:', calendarId);

        const event = await calendar.events.insert({
          calendarId,
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {
            summary: `📚 Yestoryd: ${title}`,
            description: eventDescription,
            start: {
              dateTime: sessionDateTime.toISOString(),
              timeZone: 'Asia/Kolkata',
            },
            end: {
              dateTime: sessionEndTime.toISOString(),
              timeZone: 'Asia/Kolkata',
            },
            attendees: [
              { email: instructorEmail, displayName: instructorName },
            ],
            conferenceData: {
              createRequest: {
                requestId: `yestoryd-gc-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 60 },
                { method: 'popup', minutes: 15 },
              ],
            },
          },
        });

        googleEventId = event.data.id;
        googleMeetLink = event.data.conferenceData?.entryPoints?.find(
          (e: any) => e.entryPointType === 'video'
        )?.uri || event.data.hangoutLink || null;

        console.log('✅ Event created:', googleEventId);
        console.log('✅ Meet link:', googleMeetLink);
        console.log('✅ HTML link:', event.data.htmlLink);

      } catch (calError: any) {
        console.error('❌ Google Calendar Error:');
        console.error('Message:', calError.message);
        console.error('Code:', calError.code);
        console.error('Status:', calError.response?.status);
        console.error('Data:', JSON.stringify(calError.response?.data, null, 2));
      }
    } else {
      console.log('⚠️ Google Calendar not configured');
    }

    // =============================================================================
    // SCHEDULE RECALL.AI BOT
    // =============================================================================
    let recallBotId = null;
    if (googleMeetLink) {
      recallBotId = await scheduleRecallBot(googleMeetLink, title, sessionDateTime);
    }

    // =============================================================================
    // SAVE TO DATABASE
    // =============================================================================
    const sessionData = {
      session_type: classType.slug || 'group_class',
      title,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration_minutes: durationMinutes || classType.duration_minutes || 45,
      class_type_id: classTypeId,
      description: description || classType.description || null,
      max_participants: maxParticipants || classType.max_participants || 10,
      current_participants: 0,
      price_inr: priceInr ?? classType.price_inr ?? 199,
      age_min: ageMin ?? classType.age_min ?? 4,
      age_max: ageMax ?? classType.age_max ?? 12,
      instructor_id: instructorId || null,
      instructor_split_percent: classType.default_instructor_split_percent || 50,
      book_id: bookId || null,
      status: 'scheduled',
      notes: notes || null,
      google_meet_link: googleMeetLink,
      google_event_id: googleEventId,
      recall_bot_id: recallBotId,
    };

    const { data: session, error } = await supabase
      .from('group_sessions')
      .insert(sessionData)
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji),
        instructor:coaches!group_sessions_instructor_id_fkey(id, name),
        book:books(id, title)
      `)
      .single();

    if (error) {
      console.error('DB Error:', error);
      return NextResponse.json({ error: 'Failed to create: ' + error.message }, { status: 500 });
    }

    console.log('=== Session Created ===');
    console.log('ID:', session.id);
    console.log('Meet:', googleMeetLink || 'None');
    console.log('Recall:', recallBotId || 'None');

    return NextResponse.json({ 
      session,
      integrations: {
        googleMeet: !!googleMeetLink,
        recallBot: !!recallBotId,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}