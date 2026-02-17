#!/usr/bin/env npx tsx
/**
 * Test Script: Coach-as-Organizer Calendar Event Creation
 *
 * Tests that coaching session calendar events are created with
 * the coach as the organizer (not engage@yestoryd.com).
 *
 * Usage:
 *   npx tsx scripts/test-coach-organizer.ts
 *
 * Prerequisites:
 *   - Local dev server running (npm run dev)
 *   - .env.local with INTERNAL_API_KEY, GOOGLE_*, RECALL_API_KEY
 *   - Valid enrollment + sessions in DB for the test child
 */

import { Database } from '@/lib/supabase/database.types';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const BASE_URL = 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_CHILD_ID = '4a7c7385-21a3-47d5-a35a-cbfab50e6607'; // sita
const TEST_COACH_EMAIL = 'rucha.rai@yestoryd.com';

const supabase = createClient(
  SUPABASE_URL, SUPABASE_KEY);

// --- HELPERS ---
function log(label: string, data: unknown) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(60));
  if (typeof data === 'string') console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

// --- STEP 1: Find or create test data ---
async function getTestData() {
  log('STEP 1: Fetching test data from database', '');

  // Get child + parent
  const { data: child, error: childErr } = await supabase
    .from('children')
    .select('id, child_name, name, parent_email, parent_id')
    .eq('id', TEST_CHILD_ID)
    .single();

  if (childErr || !child) {
    console.error('Child not found:', childErr?.message);
    process.exit(1);
  }

  // Fetch parent separately to avoid ambiguous FK
  let parent: any = null;
  if (child.parent_id) {
    const { data: p } = await supabase
      .from('parents')
      .select('id, name, email, phone')
      .eq('id', child.parent_id)
      .single();
    parent = p;
  }

  console.log(`  Child: ${child.child_name || child.name} (${child.id})`);
  console.log(`  Parent: ${parent?.name || 'N/A'} (${parent?.email || child.parent_email})`);

  // Get active enrollment
  const { data: enrollments, error: enrollErr } = await supabase
    .from('enrollments')
    .select('id, coach_id, status, schedule_confirmed')
    .eq('child_id', TEST_CHILD_ID)
    .order('created_at', { ascending: false })
    .limit(1);

  const enrollment = enrollments?.[0];

  if (enrollErr || !enrollment) {
    console.error('No enrollment found for this child:', enrollErr?.message);
    console.error('Create an enrollment first or use a different child ID.');
    process.exit(1);
  }

  // Fetch coach separately
  let coach: any = null;
  if (enrollment.coach_id) {
    const { data: c } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', enrollment.coach_id)
      .single();
    coach = c;
  }

  console.log(`  Enrollment: ${enrollment.id} (status: ${enrollment.status})`);
  console.log(`  Coach: ${coach?.name || 'N/A'} (${coach?.email || TEST_COACH_EMAIL})`);

  // Get sessions without calendar events
  const { data: sessions, error: sessErr } = await supabase
    .from('scheduled_sessions')
    .select('id, session_number, session_type, google_event_id, google_meet_link, scheduled_date')
    .eq('enrollment_id', enrollment.id)
    .order('session_number', { ascending: true });

  if (sessErr) {
    console.error('Error fetching sessions:', sessErr.message);
    process.exit(1);
  }

  const withCalendar = sessions?.filter(s => s.google_event_id) || [];
  const withoutCalendar = sessions?.filter(s => !s.google_event_id) || [];

  console.log(`  Sessions: ${sessions?.length || 0} total, ${withCalendar.length} with calendar, ${withoutCalendar.length} without`);

  return { child, parent, enrollment, coach, sessions: sessions || [], withoutCalendar };
}

// --- STEP 2: Call enrollment-complete endpoint ---
async function callEnrollmentComplete(
  enrollmentId: string,
  childId: string,
  childName: string,
  parentEmail: string,
  parentName: string,
  coachId: string,
  coachEmail: string,
  coachName: string
) {
  log('STEP 2: Calling /api/jobs/enrollment-complete', '');

  const payload = {
    enrollmentId,
    childId,
    childName,
    parentEmail,
    parentName,
    coachId,
    coachEmail,
    coachName,
    source: 'verify',
  };

  console.log('  Payload:');
  console.log(JSON.stringify(payload, null, 2));

  const response = await fetch(`${BASE_URL}/api/jobs/enrollment-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': INTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log(`\n  Response status: ${response.status}`);
  console.log('  Response body:');
  console.log(JSON.stringify(result, null, 2));

  return { status: response.status, result };
}

// --- STEP 3: Verify calendar events ---
async function verifyCalendarEvents(enrollmentId: string, expectedCoachEmail: string) {
  log('STEP 3: Verifying calendar events in database', '');

  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select('id, session_number, session_type, google_event_id, google_meet_link, scheduled_date, scheduled_time, status')
    .eq('enrollment_id', enrollmentId)
    .not('google_event_id', 'is', null)
    .order('session_number', { ascending: true });

  if (error) {
    console.error('Error fetching sessions:', error.message);
    return [];
  }

  console.log(`  Sessions with calendar events: ${sessions?.length || 0}`);

  for (const s of sessions || []) {
    console.log(`  Session #${s.session_number} (${s.session_type}):`);
    console.log(`    Event ID: ${s.google_event_id}`);
    console.log(`    Meet Link: ${s.google_meet_link}`);
    console.log(`    Date: ${s.scheduled_date} ${s.scheduled_time}`);
    console.log(`    Status: ${s.status}`);
  }

  // Verify by fetching the actual Google Calendar event via the API
  // We use the Google Calendar API through our test endpoint
  if (sessions && sessions.length > 0) {
    const firstSession = sessions[0];
    log('STEP 3b: Verifying Google Calendar event organizer', '');
    console.log(`  Checking event ${firstSession.google_event_id} on coach calendar...`);

    // Direct Google Calendar API check via googleapis
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        clientOptions: {
          subject: expectedCoachEmail,
        },
      });
      const calendar = google.calendar({ version: 'v3', auth });

      const event = await calendar.events.get({
        calendarId: expectedCoachEmail,
        eventId: firstSession.google_event_id!,
      });

      const organizer = event.data.organizer;
      const attendees = event.data.attendees || [];

      console.log(`\n  Event: ${event.data.summary}`);
      console.log(`  Organizer: ${organizer?.email} (self: ${organizer?.self})`);
      console.log(`  Attendees:`);
      for (const a of attendees) {
        console.log(`    - ${a.email} (${a.displayName || 'no name'}) [${a.responseStatus}]`);
      }

      // ASSERTIONS
      console.log('\n  --- Assertions ---');
      assert(
        organizer?.email === expectedCoachEmail,
        `Organizer is coach (${organizer?.email} === ${expectedCoachEmail})`
      );
      assert(
        organizer?.email !== 'engage@yestoryd.com',
        `Organizer is NOT engage@ (${organizer?.email})`
      );
      assert(
        attendees.some(a => a.email === 'engage@yestoryd.com'),
        'engage@yestoryd.com is an attendee (for Recall.ai)'
      );
      assert(
        !attendees.some(a => a.email === expectedCoachEmail),
        'Coach is NOT in attendees list (organizer is implicit)'
      );
      assert(
        !!event.data.conferenceData?.entryPoints?.length,
        'Google Meet link was created'
      );

    } catch (err: any) {
      console.error(`  Failed to verify via Google Calendar API: ${err.message}`);
      if (err.message?.includes('Not Found')) {
        console.error('  Event not found on coach calendar — organizer may not be the coach');
      }
    }
  }

  return sessions || [];
}

// --- STEP 4: Verify Recall.ai bots ---
async function verifyRecallBots(enrollmentId: string) {
  log('STEP 4: Verifying Recall.ai bots', '');

  const { data: bots, error } = await supabase
    .from('recall_bot_sessions')
    .select('id, session_id, recall_bot_id, status, created_at, scheduled_sessions(session_number, session_type, google_meet_link)')
    .eq('scheduled_sessions.enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  // Alternative: query by session IDs
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('id, session_number, recall_bot_id, recall_status')
    .eq('enrollment_id', enrollmentId)
    .not('recall_bot_id', 'is', null);

  console.log(`  Sessions with Recall bots: ${sessions?.length || 0}`);

  for (const s of sessions || []) {
    console.log(`  Session #${s.session_number}:`);
    console.log(`    Bot ID: ${s.recall_bot_id}`);
    console.log(`    Status: ${s.recall_status}`);

    // Verify bot exists on Recall.ai
    if (s.recall_bot_id && process.env.RECALL_API_KEY) {
      try {
        const resp = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${s.recall_bot_id}/`, {
          headers: { 'Authorization': `Token ${process.env.RECALL_API_KEY}` },
        });
        if (resp.ok) {
          const bot = await resp.json();
          console.log(`    Recall status: ${bot.status?.code || 'unknown'}`);
          console.log(`    Meeting URL: ${bot.meeting_url || 'none'}`);
          assert(!!bot.meeting_url, 'Bot has a meeting URL');
        } else {
          console.log(`    Recall API: ${resp.status} ${resp.statusText}`);
        }
      } catch (e: any) {
        console.log(`    Recall API check failed: ${e.message}`);
      }
    }
  }

  return sessions || [];
}

// --- STEP 5: Cleanup helper ---
async function showCleanupInstructions(enrollmentId: string, sessions: any[]) {
  log('CLEANUP (optional)', '');
  console.log('  To undo this test, run these SQL commands in Supabase:');
  console.log('');
  console.log(`  -- Remove calendar event IDs (events stay on Google Calendar)`);
  console.log(`  UPDATE scheduled_sessions`);
  console.log(`  SET google_event_id = NULL, google_meet_link = NULL, status = 'pending'`);
  console.log(`  WHERE enrollment_id = '${enrollmentId}';`);
  console.log('');
  console.log(`  -- Or to fully delete Google Calendar events, use the admin API`);
  console.log(`  -- or manually delete them from the coach's Google Calendar.`);
}

// --- MAIN ---
async function main() {
  console.log('\n🧪 Coach-as-Organizer Calendar Test');
  console.log('===================================\n');

  // Step 1: Get data
  const { child, parent, enrollment, coach, sessions, withoutCalendar } = await getTestData();

  if (withoutCalendar.length === 0) {
    console.log('\n⚠️  All sessions already have calendar events.');
    console.log('  To re-test, clear google_event_id from some sessions:');
    console.log(`  UPDATE scheduled_sessions SET google_event_id = NULL, google_meet_link = NULL WHERE enrollment_id = '${enrollment.id}' LIMIT 1;`);

    // Still verify existing events
    const coachEmail = coach?.email || TEST_COACH_EMAIL;
    await verifyCalendarEvents(enrollment.id, coachEmail);
    await verifyRecallBots(enrollment.id);
    return;
  }

  const coachEmail = coach?.email || TEST_COACH_EMAIL;
  const coachName = coach?.name || 'Rucha Rai';
  const childName = child.child_name || child.name || 'Anaya';

  // Step 2: Call the endpoint
  const { status, result } = await callEnrollmentComplete(
    enrollment.id,
    child.id,
    childName,
    parent?.email || child.parent_email,
    parent?.name || 'Parent',
    enrollment.coach_id,
    coachEmail,
    coachName,
  );

  if (status !== 200 || !result.success) {
    console.error('\n❌ Endpoint call failed. Check dev server logs for details.');
    if (result.error) console.error(`  Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\n✅ Endpoint returned success`);
  console.log(`  Sessions scheduled: ${result.sessionsWithCalendar}`);
  console.log(`  Bots scheduled: ${result.botsScheduled}`);
  console.log(`  Email sent: ${result.emailSent}`);

  // Step 3: Verify calendar
  await verifyCalendarEvents(enrollment.id, coachEmail);

  // Step 4: Verify Recall
  await verifyRecallBots(enrollment.id);

  // Step 5: Cleanup info
  await showCleanupInstructions(enrollment.id, sessions);

  log('TEST COMPLETE', '');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
