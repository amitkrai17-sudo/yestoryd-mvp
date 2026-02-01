import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Known test data
const ENROLLMENT_ID = '8be2f014-37b9-4613-9af1-6209d297d8bc';
const CHILD_ID = '4a7c7385-21a3-47d5-a35a-cbfab50e6607';
const CHILD_NAME = 'sita';
const COACH_ID = '9fb07277-60b6-4410-a71c-9de94b8b9971';
const COACH_EMAIL = 'rucha.rai@yestoryd.com';
const PARENT_EMAIL = 'amitraiforyou@gmail.com';
const PARENT_NAME = 'rita rai';

(async () => {
  // 1. Calculate time: 15 minutes from now
  const sessionStart = new Date();
  sessionStart.setMinutes(sessionStart.getMinutes() + 15);
  sessionStart.setSeconds(0, 0);

  const sessionEnd = new Date(sessionStart);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + 30); // 30-min test session

  const dateStr = sessionStart.toISOString().split('T')[0];
  const timeStr = sessionStart.toTimeString().slice(0, 8);

  console.log(`\nScheduling test session for: ${sessionStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);

  // 2. Create Google Calendar event (coach as organizer)
  console.log('Creating Google Calendar event (coach as organizer)...');
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
    COACH_EMAIL // Coach is organizer
  );
  const calendar = google.calendar({ version: 'v3', auth });

  const calEvent = await calendar.events.insert({
    calendarId: COACH_EMAIL,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: `TEST: Yestoryd: ${CHILD_NAME} - Coaching Session`,
      description: `TEST SESSION - Coach-as-Organizer Verification\n\nChild: ${CHILD_NAME}\nCoach: Rucha Rai\nParent: ${PARENT_NAME}\nDuration: 30 minutes\n\nThis is a test session to verify the coach appears as the organizer.`,
      start: { dateTime: sessionStart.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: sessionEnd.toISOString(), timeZone: 'Asia/Kolkata' },
      attendees: [
        { email: PARENT_EMAIL, displayName: PARENT_NAME },
        { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' },
      ],
      conferenceData: {
        createRequest: {
          requestId: `test-coach-organizer-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 5 }],
      },
      colorId: '9',
    },
  });

  const googleEventId = calEvent.data.id!;
  const meetLink = calEvent.data.conferenceData?.entryPoints?.find(
    (ep: any) => ep.entryPointType === 'video'
  )?.uri || '';
  const organizer = calEvent.data.organizer;

  console.log(`  Event ID: ${googleEventId}`);
  console.log(`  Meet Link: ${meetLink}`);
  console.log(`  Organizer: ${organizer?.email} (self: ${organizer?.self})`);
  console.log(`  Attendees:`);
  for (const a of calEvent.data.attendees || []) {
    console.log(`    - ${a.email} (${a.displayName}) [${a.responseStatus}]`);
  }

  // 3. Insert session into DB
  console.log('\nInserting session into database...');
  const { data: session, error: dbError } = await supabase
    .from('scheduled_sessions')
    .insert({
      enrollment_id: ENROLLMENT_ID,
      child_id: CHILD_ID,
      coach_id: COACH_ID,
      session_number: 99, // Test session number
      session_type: 'coaching',
      week_number: 99,
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      duration_minutes: 30,
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('DB insert failed:', dbError.message);
    console.log('Calendar event was created. Clean up manually:', googleEventId);
    process.exit(1);
  }

  console.log(`  Session ID: ${session.id}`);

  // 4. Schedule Recall.ai bot
  console.log('\nScheduling Recall.ai bot...');
  let recallBotId: string | null = null;

  if (process.env.RECALL_API_KEY && meetLink) {
    try {
      const joinAt = new Date(sessionStart);
      joinAt.setMinutes(joinAt.getMinutes() - 1); // Join 1 min early

      const botResp = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_url: meetLink,
          bot_name: 'rAI by Yestoryd - TEST',
          join_at: joinAt.toISOString(),
          automatic_leave: {
            waiting_room_timeout: 300,
            noone_joined_timeout: 120,
            everyone_left_timeout: 30,
          },
          recording_mode: 'speaker_view',
          transcription_options: { provider: 'default' },
        }),
      });

      if (botResp.ok) {
        const bot = await botResp.json();
        recallBotId = bot.id;
        console.log(`  Bot ID: ${recallBotId}`);
        console.log(`  Bot status: ${bot.status?.code || 'created'}`);

        // Update session with bot ID
        await supabase
          .from('scheduled_sessions')
          .update({ recall_bot_id: recallBotId, recall_status: 'scheduled' })
          .eq('id', session.id);
      } else {
        const errText = await botResp.text();
        console.log(`  Recall API error: ${botResp.status} - ${errText}`);
      }
    } catch (err: any) {
      console.log(`  Recall error: ${err.message}`);
    }
  } else {
    console.log('  Skipped (no RECALL_API_KEY or no Meet link)');
  }

  // 5. Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  TEST SESSION CREATED');
  console.log('='.repeat(60));
  console.log(`  Session ID:     ${session.id}`);
  console.log(`  Scheduled for:  ${sessionStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`  Google Event:   ${googleEventId}`);
  console.log(`  Google Meet:    ${meetLink}`);
  console.log(`  Recall Bot:     ${recallBotId || 'N/A'}`);
  console.log(`  Organizer:      ${organizer?.email}`);
  console.log(`  Coach in attn:  ${(calEvent.data.attendees || []).some(a => a.email === COACH_EMAIL) ? 'YES (wrong!)' : 'NO (correct - organizer is implicit)'}`);
  console.log(`  engage@ in attn: ${(calEvent.data.attendees || []).some(a => a.email === 'engage@yestoryd.com') ? 'YES (correct)' : 'NO (wrong!)'}`);
  console.log('='.repeat(60));

  // Cleanup SQL
  console.log('\nTo clean up after testing:');
  console.log(`  -- Delete test session`);
  console.log(`  DELETE FROM scheduled_sessions WHERE id = '${session.id}';`);
  if (recallBotId) {
    console.log(`  -- Cancel Recall bot`);
    console.log(`  curl -X DELETE https://us-west-2.recall.ai/api/v1/bot/${recallBotId}/ -H "Authorization: Token $RECALL_API_KEY"`);
  }
  console.log(`  -- Google Calendar event will need manual deletion from Rucha's calendar`);
  console.log(`  -- Event ID: ${googleEventId}\n`);
})();
