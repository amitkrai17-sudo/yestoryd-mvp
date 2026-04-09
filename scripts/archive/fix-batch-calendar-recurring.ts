/**
 * One-off: Replace 3 individual calendar events (Apr 11, 18, 25)
 * with ONE recurring event matching the enrollment-complete code path.
 * Keeps Apr 4 event as-is (already happened).
 *
 * Usage: npx tsx scripts/fix-batch-calendar-recurring.ts
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

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';
const RECALL_API_KEY = process.env.RECALL_API_KEY;

// Batch config
const BATCH_ID = '7c6d6c79-ccd1-4280-acb7-8d17ebdc6a57';
const COACH_EMAIL = 'rucha.rai@yestoryd.com';
const COACH_ID = '9fb07277-60b6-4410-a71c-9de94b8b9971';

// Events to delete (Apr 11, 18, 25 — individual events created manually)
const OLD_EVENT_IDS = [
  'lgr9bckvv4du56hq1f5ku0t24o', // Apr 11
  'akod8nig666ceteocrffq1t958', // Apr 18
  'fbp8ammtqnmsiuanqv3ots719c', // Apr 25
];

(async () => {
  // --- Auth via service account (coach as organizer) ---
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
    COACH_EMAIL
  );
  const calendar = google.calendar({ version: 'v3', auth });

  // =====================================================
  // STEP 1: Delete 3 old individual events
  // =====================================================
  console.log('\n=== Step 1: Deleting 3 individual calendar events ===');
  for (const eventId of OLD_EVENT_IDS) {
    try {
      await calendar.events.delete({
        calendarId: COACH_EMAIL,
        eventId,
        sendUpdates: 'none', // Don't spam parents with cancellations
      });
      console.log(`  Deleted: ${eventId}`);
    } catch (err: any) {
      console.error(`  Failed to delete ${eventId}: ${err.message}`);
    }
  }

  // =====================================================
  // STEP 2: Create ONE recurring event (mirrors enrollment-complete)
  // =====================================================
  console.log('\n=== Step 2: Creating recurring calendar event ===');

  // Gather attendees from batch (same pattern as enrollment-complete lines 561-587)
  const { data: batchSiblings } = await supabase
    .from('tuition_onboarding')
    .select('enrollment_id, child_name')
    .eq('batch_id', BATCH_ID);

  const attendeeEmails: { email: string; displayName: string }[] = [];
  for (const sib of batchSiblings || []) {
    if (!sib.enrollment_id) continue;
    const { data: enr } = await supabase
      .from('enrollments')
      .select('parent_id')
      .eq('id', sib.enrollment_id)
      .single();
    if (enr?.parent_id) {
      const { data: parent } = await supabase
        .from('parents')
        .select('email, name')
        .eq('id', enr.parent_id)
        .single();
      if (parent?.email && !attendeeEmails.some(a => a.email === parent.email)) {
        attendeeEmails.push({ email: parent.email, displayName: parent.name || 'Parent' });
      }
    }
  }
  attendeeEmails.push({ email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' });

  const childNames = (batchSiblings || []).map(s => s.child_name).filter(Boolean);
  console.log(`  Attendees: ${attendeeEmails.map(a => a.email).join(', ')}`);
  console.log(`  Students: ${childNames.join(', ')}`);

  // Fetch subject label (same as enrollment-complete lines 550-558)
  const { data: onb } = await supabase
    .from('tuition_onboarding')
    .select('category_id')
    .eq('batch_id', BATCH_ID)
    .not('category_id', 'is', null)
    .limit(1)
    .single();

  let subjectLabel = 'Grammar & Syntax';
  if (onb?.category_id) {
    const { data: cat } = await supabase
      .from('skill_categories')
      .select('label')
      .eq('id', onb.category_id)
      .single();
    if (cat?.label) subjectLabel = cat.label;
  }

  // Start from Apr 11 (first remaining Saturday), recurring weekly on Saturdays
  // COUNT=3 gives us exactly Apr 11, 18, 25
  const eventStart = new Date('2026-04-11T16:00:00+05:30');
  const eventEnd = new Date('2026-04-11T18:00:00+05:30');
  const eventTitle = `Yestoryd: ${subjectLabel} \u2014 Rucha`;

  const recurringEvent = await calendar.events.insert({
    calendarId: COACH_EMAIL,
    conferenceDataVersion: 1, // Enable Meet link generation
    sendUpdates: 'all',
    requestBody: {
      summary: eventTitle,
      description: [
        `${subjectLabel} session`,
        `Coach: Rucha Rai`,
        `Students: ${childNames.join(', ')}`,
        `Duration: 120 minutes`,
        ``,
        `Questions? WhatsApp: +91 85912 87997`,
      ].join('\n'),
      start: { dateTime: eventStart.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: eventEnd.toISOString(), timeZone: 'Asia/Kolkata' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA;COUNT=3'],
      attendees: attendeeEmails,
      conferenceData: {
        createRequest: {
          requestId: `yestoryd-batch-${BATCH_ID}-recurring-${Date.now()}`,
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
      colorId: '6', // Orange for tuition
      guestsCanModify: false,
      guestsCanInviteOthers: false,
    },
  });

  const recurringEventId = recurringEvent.data.id!;
  const meetLink = recurringEvent.data.conferenceData?.entryPoints?.find(
    (ep: any) => ep.entryPointType === 'video'
  )?.uri || recurringEvent.data.hangoutLink || '';

  console.log(`  Recurring Event ID: ${recurringEventId}`);
  console.log(`  Meet Link: ${meetLink}`);
  console.log(`  Organizer: ${recurringEvent.data.organizer?.email}`);
  console.log(`  RRULE: FREQ=WEEKLY;BYDAY=SA;COUNT=3`);
  console.log(`  Occurrences: Apr 11, Apr 18, Apr 25`);

  // =====================================================
  // STEP 3: Update scheduled_sessions (Apr 11, 18, 25)
  // =====================================================
  console.log('\n=== Step 3: Updating scheduled_sessions ===');

  const futureDates = ['2026-04-11', '2026-04-18', '2026-04-25'];
  for (const date of futureDates) {
    const { error, count } = await supabase
      .from('scheduled_sessions')
      .update({
        google_event_id: recurringEventId,
        google_meet_link: meetLink,
        updated_at: new Date().toISOString(),
      })
      .eq('batch_id', BATCH_ID)
      .eq('scheduled_date', date);

    console.log(`  ${date}: updated ${count ?? '?'} sessions ${error ? 'ERROR: ' + error.message : ''}`);
  }

  // =====================================================
  // STEP 4: Update tuition_onboarding (all 3 records)
  // =====================================================
  console.log('\n=== Step 4: Updating tuition_onboarding ===');

  const { error: onbErr, count: onbCount } = await supabase
    .from('tuition_onboarding')
    .update({
      meet_link: meetLink,
      calendar_event_id: recurringEventId,
      updated_at: new Date().toISOString(),
    })
    .eq('batch_id', BATCH_ID);

  console.log(`  Updated ${onbCount ?? '?'} onboarding records ${onbErr ? 'ERROR: ' + onbErr.message : ''}`);

  // =====================================================
  // STEP 5: Schedule Recall.ai bots (1 per date, using createRecallBot pattern)
  // =====================================================
  console.log('\n=== Step 5: Scheduling Recall.ai bots ===');

  if (!RECALL_API_KEY) {
    console.log('  RECALL_API_KEY not set - skipping');
  } else if (!meetLink) {
    console.log('  No Meet link generated - skipping');
  } else {
    const sessionDates = [
      { date: '2026-04-11', time: '16:00:00+05:30' },
      { date: '2026-04-18', time: '16:00:00+05:30' },
      { date: '2026-04-25', time: '16:00:00+05:30' },
    ];

    for (const sd of sessionDates) {
      const scheduledTime = new Date(`${sd.date}T${sd.time}`);
      const joinAt = new Date(scheduledTime.getTime() - 60000); // 1 min early

      // Pick one session ID for this date (for metadata)
      const { data: sessForDate } = await supabase
        .from('scheduled_sessions')
        .select('id, child_id')
        .eq('batch_id', BATCH_ID)
        .eq('scheduled_date', sd.date)
        .limit(1)
        .single();

      if (!sessForDate) {
        console.log(`  ${sd.date}: no session found - skipping`);
        continue;
      }

      try {
        const botResp = await fetch(`${RECALL_API_URL}/bot`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meeting_url: meetLink,
            bot_name: `rAI by Yestoryd - ${childNames.join(' & ')} - Tuition`,
            join_at: joinAt.toISOString(),
            automatic_leave: {
              waiting_room_timeout: 600,
              noone_joined_timeout: 300,
              everyone_left_timeout: 60,
            },
            metadata: {
              session_id: sessForDate.id,
              child_id: sessForDate.child_id,
              coach_id: COACH_ID,
              child_name: childNames.join(' & '),
              session_type: 'tuition',
              platform: 'yestoryd',
              batch_id: BATCH_ID,
            },
          }),
        });

        if (botResp.ok) {
          const bot = await botResp.json();
          console.log(`  ${sd.date}: Bot created - ${bot.id}`);

          // Store in recall_bot_sessions (same as createRecallBot)
          await supabase.from('recall_bot_sessions').insert({
            bot_id: bot.id,
            session_id: sessForDate.id,
            child_id: sessForDate.child_id,
            coach_id: COACH_ID,
            meeting_url: meetLink,
            status: 'scheduled',
            scheduled_join_time: scheduledTime.toISOString(),
            metadata: {
              session_type: 'tuition',
              child_name: childNames.join(' & '),
              batch_id: BATCH_ID,
            },
          });

          // Update BOTH sessions for this date with bot ID (batch dedup: 1 bot per date)
          await supabase
            .from('scheduled_sessions')
            .update({
              recall_bot_id: bot.id,
              recall_status: 'scheduled',
            })
            .eq('batch_id', BATCH_ID)
            .eq('scheduled_date', sd.date);
        } else {
          const errText = await botResp.text();
          console.error(`  ${sd.date}: Recall API error: ${botResp.status} - ${errText}`);
        }
      } catch (err: any) {
        console.error(`  ${sd.date}: Recall error: ${err.message}`);
      }

      // Rate limit: 200ms between bot creations (same as scheduleBotsForEnrollment)
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // =====================================================
  // STEP 6: Final verification
  // =====================================================
  console.log('\n=== Final Verification ===');

  const { data: allSessions } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, scheduled_date, google_event_id, google_meet_link, recall_bot_id, recall_status')
    .eq('batch_id', BATCH_ID)
    .order('scheduled_date');

  console.log('\nScheduled Sessions:');
  console.table(allSessions);

  const { data: allOnboarding } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, meet_link, calendar_event_id')
    .eq('batch_id', BATCH_ID);

  console.log('\nTuition Onboarding:');
  console.table(allOnboarding);

  console.log('\nDone!');
})();
