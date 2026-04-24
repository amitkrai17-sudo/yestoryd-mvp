#!/usr/bin/env npx tsx
/**
 * scripts/backfill-missing-calendar-events.ts
 *
 * Backfills Google Calendar events for 4 scheduled_sessions rows that are
 * missing google_event_id. Sequential (respects rate limits), idempotent
 * (skips rows already populated).
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-calendar-events.ts --dry-run
 *   npx tsx scripts/backfill-missing-calendar-events.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { scheduleCalendarEvent } from '@/lib/calendar';
import { createAdminClient } from '@/lib/supabase/admin';

const SESSION_IDS = [
  '4bb63867-ddbc-44e6-883f-09c73726f994', // Shivaay Vavia  Apr 23 17:30
  '1e039169-0b7e-4afc-a744-75064a45e0cf', // Shloka Vavia   Apr 23 17:30
  '4f327031-1ff0-449e-ac82-9139cf0431ca', // Harshi Sohoni  Apr 26 12:45
  'c52a6c82-136e-4872-9bd7-8c11fbc5e0b8', // Harshi Sohoni  Apr 29 18:45
];

const DRY_RUN = process.argv.includes('--dry-run');

type SessionRow = {
  id: string;
  session_type: string;
  session_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  child_id: string;
  coach_id: string;
  children: {
    id: string;
    child_name: string | null;
    name: string | null;
    parent_email: string | null;
  } | null;
  coaches: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
};

async function run() {
  const mode = DRY_RUN ? 'DRY-RUN' : 'LIVE';
  console.log(`\n[backfill-missing-calendar-events] mode=${mode}`);
  console.log(`[backfill-missing-calendar-events] ${SESSION_IDS.length} sessions queued\n`);

  const supabase = createAdminClient();

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const sessionId of SESSION_IDS) {
    console.log(`--- session ${sessionId} ---`);

    const { data: session, error: fetchErr } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        session_type,
        session_number,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        google_event_id,
        google_meet_link,
        child_id,
        coach_id,
        children:child_id ( id, child_name, name, parent_email ),
        coaches:coach_id ( id, email, name )
      `)
      .eq('id', sessionId)
      .single<SessionRow>();

    if (fetchErr || !session) {
      console.error(`  [FAIL] fetch: ${fetchErr?.message || 'not found'}`);
      failed++;
      continue;
    }

    if (session.google_event_id) {
      console.log(`  [SKIP] already has google_event_id=${session.google_event_id}`);
      skipped++;
      continue;
    }

    const child = session.children;
    const coach = session.coaches;
    const childName = child?.child_name || child?.name || 'Student';
    const parentEmail = child?.parent_email || '';
    const coachEmail = coach?.email || '';

    if (!parentEmail || !coachEmail) {
      console.error(`  [FAIL] missing email — parent='${parentEmail}' coach='${coachEmail}'`);
      failed++;
      continue;
    }

    const duration = session.duration_minutes ?? 45;
    const startTime = new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`);
    const endTime = new Date(startTime.getTime() + duration * 60_000);

    const attendees = [parentEmail, coachEmail];
    const title = `Yestoryd ${session.session_type} - ${childName} (Session ${session.session_number ?? ''})`;
    const description = `Reading ${session.session_type} session for ${childName}`;

    console.log(`  child:       ${childName}`);
    console.log(`  coach:       ${coachEmail}`);
    console.log(`  parent:      ${parentEmail}`);
    console.log(`  start (IST): ${session.scheduled_date} ${session.scheduled_time} +05:30`);
    console.log(`  start (UTC): ${startTime.toISOString()}`);
    console.log(`  end   (UTC): ${endTime.toISOString()}`);
    console.log(`  duration:    ${duration} min`);
    console.log(`  attendees:   ${attendees.join(', ')}`);
    console.log(`  title:       ${title}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] would call scheduleCalendarEvent() and UPDATE scheduled_sessions`);
      succeeded++;
      continue;
    }

    try {
      const sessionType: 'coaching' | 'parent_checkin' =
        session.session_type === 'parent_checkin' ? 'parent_checkin' : 'coaching';

      const result = await scheduleCalendarEvent({
        title,
        description,
        startTime,
        endTime,
        attendees,
        sessionType,
      });

      if (!result.eventId) {
        console.error(`  [FAIL] calendar returned empty eventId`);
        failed++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('scheduled_sessions')
        .update({
          google_event_id: result.eventId,
          google_meet_link: result.meetLink,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateErr) {
        console.error(`  [FAIL] DB update: ${updateErr.message}`);
        console.error(`         calendar event was created — eventId=${result.eventId}, meetLink=${result.meetLink}`);
        failed++;
        continue;
      }

      console.log(`  [OK] eventId=${result.eventId}`);
      console.log(`       meetLink=${result.meetLink}`);
      succeeded++;
    } catch (err: any) {
      console.error(`  [FAIL] ${err?.message || err}`);
      failed++;
    }
  }

  console.log(`\n=== FINAL REPORT (${mode}) ===`);
  console.log(`succeeded: ${succeeded}  skipped: ${skipped}  failed: ${failed}\n`);

  const { data: finalRows, error: finalErr } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      google_event_id,
      google_meet_link,
      children:child_id ( child_name, name )
    `)
    .in('id', SESSION_IDS);

  if (finalErr) {
    console.error(`[final-report] query failed: ${finalErr.message}`);
  } else {
    for (const row of finalRows || []) {
      const c: any = (row as any).children;
      const name = c?.child_name || c?.name || '(unknown)';
      console.log(`  ${row.id}  ${name.padEnd(20)}  event=${(row as any).google_event_id || 'NULL'}  meet=${(row as any).google_meet_link || 'NULL'}`);
    }
  }

  const allSucceeded = succeeded === SESSION_IDS.length && failed === 0 && skipped === 0;
  const noFailures = failed === 0;
  const exitCode = DRY_RUN ? (noFailures ? 0 : 1) : (allSucceeded ? 0 : 1);
  console.log(`\nexit code: ${exitCode}`);
  process.exit(exitCode);
}

run().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
