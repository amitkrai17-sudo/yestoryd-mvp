/**
 * One-off script: Create 4 Google Calendar events for Suryanshi+Parinee batch
 * via the Yestoryd service account (engage@yestoryd.com delegation).
 *
 * Usage: npx tsx scripts/create-batch-sessions-calendar.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Batch config
const BATCH_ID = '7c6d6c79-ccd1-4280-acb7-8d17ebdc6a57';
const COACH_EMAIL = 'rucha.rai@yestoryd.com';
const MEET_LINK = 'https://meet.google.com/wjj-cdtk-wyj';

const PARENT_EMAILS = [
  { email: 'sonalirahate@yahoo.com', displayName: 'Sonali Koli (Parinee)' },
  { email: 'shiwani.tomar@gmail.com', displayName: 'Shivani (Suryanshi)' },
];

const SESSIONS = [
  { date: '2026-04-04', num: 1 },
  { date: '2026-04-11', num: 2 },
  { date: '2026-04-18', num: 3 },
  { date: '2026-04-25', num: 4 },
];

(async () => {
  // Auth via service account with domain-wide delegation (coach as organizer)
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
    COACH_EMAIL
  );
  const calendar = google.calendar({ version: 'v3', auth });

  const results: { date: string; eventId: string; meetLink: string }[] = [];

  for (const sess of SESSIONS) {
    const start = `${sess.date}T16:00:00+05:30`;
    const end = `${sess.date}T18:00:00+05:30`;

    console.log(`\nCreating event for ${sess.date} (Session ${sess.num})...`);

    try {
      const calEvent = await calendar.events.insert({
        calendarId: COACH_EMAIL,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: 'Yestoryd: Grammar & Syntax \u2014 Rucha',
          description: [
            `Batch tuition session - Session ${sess.num}/4`,
            `Students: Parinee Shyam Koli, Suryanshi Tomar`,
            `Coach: Rucha Rai`,
            `Batch ID: ${BATCH_ID}`,
          ].join('\n'),
          start: { dateTime: start, timeZone: 'Asia/Kolkata' },
          end: { dateTime: end, timeZone: 'Asia/Kolkata' },
          attendees: [
            ...PARENT_EMAILS,
            { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' },
          ],
          conferenceData: {
            createRequest: {
              requestId: `yestoryd-batch-${BATCH_ID}-s${sess.num}-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 1440 },
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 10 },
            ],
          },
          guestsCanModify: false,
          guestsCanInviteOthers: false,
        },
      });

      const eventId = calEvent.data.id!;
      const generatedMeet =
        calEvent.data.conferenceData?.entryPoints?.find(
          (ep: any) => ep.entryPointType === 'video'
        )?.uri || calEvent.data.hangoutLink || '';

      const finalMeet = generatedMeet || MEET_LINK;

      results.push({ date: sess.date, eventId, meetLink: finalMeet });

      console.log(`  Event ID: ${eventId}`);
      console.log(`  Meet link: ${finalMeet}`);
      console.log(`  Organizer: ${calEvent.data.organizer?.email}`);
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`);
      // Continue with remaining sessions
    }
  }

  if (results.length === 0) {
    console.error('\nNo events created. Exiting.');
    process.exit(1);
  }

  // Update scheduled_sessions with new event IDs + meet links
  console.log('\n--- Updating scheduled_sessions ---');
  for (const r of results) {
    const { error, count } = await supabase
      .from('scheduled_sessions')
      .update({
        google_event_id: r.eventId,
        google_meet_link: r.meetLink,
      })
      .eq('batch_id', BATCH_ID)
      .eq('scheduled_date', r.date);

    console.log(`  ${r.date}: updated ${count ?? '?'} sessions (event: ${r.eventId}) ${error ? 'ERROR: ' + error.message : ''}`);
  }

  // Update tuition_onboarding with meet link from first event
  const primaryMeet = results[0]?.meetLink || MEET_LINK;
  console.log('\n--- Updating tuition_onboarding ---');
  const { error: onbErr, count: onbCount } = await supabase
    .from('tuition_onboarding')
    .update({
      meet_link: primaryMeet,
      calendar_event_id: results[0]?.eventId,
    })
    .eq('batch_id', BATCH_ID);

  console.log(`  Updated ${onbCount ?? '?'} onboarding records ${onbErr ? 'ERROR: ' + onbErr.message : ''}`);

  // Schedule Recall.ai bot for today's session only
  const todayResult = results.find((r) => r.date === '2026-04-04');
  if (todayResult && process.env.RECALL_API_KEY && todayResult.meetLink) {
    console.log('\n--- Scheduling Recall.ai bot for today ---');
    const joinAt = new Date('2026-04-04T15:59:00+05:30');

    try {
      const botResp = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_url: todayResult.meetLink,
          bot_name: 'rAI by Yestoryd - Parinee & Suryanshi - Tuition',
          join_at: joinAt.toISOString(),
          automatic_leave: {
            waiting_room_timeout: 600,
            noone_joined_timeout: 300,
            everyone_left_timeout: 60,
          },
          recording_mode: 'speaker_view',
          transcription_options: { provider: 'default' },
          metadata: {
            batch_id: BATCH_ID,
            session_type: 'tuition',
            platform: 'yestoryd',
          },
        }),
      });

      if (botResp.ok) {
        const bot = await botResp.json();
        console.log(`  Bot ID: ${bot.id}`);

        // Update both today's sessions with bot ID
        await supabase
          .from('scheduled_sessions')
          .update({ recall_bot_id: bot.id, recall_status: 'scheduled' })
          .eq('batch_id', BATCH_ID)
          .eq('scheduled_date', '2026-04-04');
        console.log(`  Updated today's sessions with recall_bot_id`);
      } else {
        console.error(`  Recall API error: ${botResp.status} - ${await botResp.text()}`);
      }
    } catch (err: any) {
      console.error(`  Recall error: ${err.message}`);
    }
  }

  // Final verification
  console.log('\n--- Final Verification ---');
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, scheduled_date, google_event_id, google_meet_link, recall_bot_id')
    .eq('batch_id', BATCH_ID)
    .order('scheduled_date');

  console.table(sessions);

  const { data: onboarding } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, meet_link, calendar_event_id')
    .eq('batch_id', BATCH_ID);

  console.table(onboarding);

  console.log('\nDone!');
})();
