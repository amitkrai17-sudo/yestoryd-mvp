#!/usr/bin/env npx tsx
/**
 * scripts/migrate-to-dispatcher.ts
 *
 * Migrates from individual QStash schedules to a single dispatcher schedule.
 * Interactive — shows current state, asks for confirmation, then migrates.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-dispatcher.ts
 *
 * What it does:
 *   1. Lists all existing QStash schedules
 *   2. Deletes old individual schedules (except goals-capture)
 *   3. Creates the unified dispatcher schedule (every 15 min)
 *   4. Creates/keeps the goals-capture schedule (every 5 min)
 *   5. Shows final state
 *
 * Required env vars (in .env.local):
 *   QSTASH_TOKEN
 */

import { config } from 'dotenv';
import { Client } from '@upstash/qstash';
import * as readline from 'readline';

// Load .env.local
config({ path: '.env.local' });

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
if (!QSTASH_TOKEN) {
  console.error('QSTASH_TOKEN not found in .env.local');
  process.exit(1);
}

const qstash = new Client({ token: QSTASH_TOKEN });

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

// ── Interactive prompt ───────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Schedules to create ──────────────────────────────────────

const DISPATCHER_SCHEDULE = {
  scheduleId: 'cron-dispatcher-15min',
  destination: `${APP_URL}/api/cron/dispatcher`,
  cron: '*/15 * * * *',
};

const GOALS_CAPTURE_SCHEDULE = {
  scheduleId: 'goals-capture-every-5min',
  destination: `${APP_URL}/api/jobs/goals-capture`,
  cron: '*/5 * * * *',
};

// Schedules that should NOT be deleted (they're the new ones)
const KEEP_SCHEDULE_IDS = new Set([
  DISPATCHER_SCHEDULE.scheduleId,
  GOALS_CAPTURE_SCHEDULE.scheduleId,
]);

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('=== QStash Dispatcher Migration ===');
  console.log(`APP_URL: ${APP_URL}`);
  console.log(`Token:   ${QSTASH_TOKEN!.slice(0, 8)}...`);
  console.log('');

  // 1. List existing schedules
  console.log('--- Current QStash Schedules ---');
  const existing = await qstash.schedules.list();

  if (existing.length === 0) {
    console.log('  (none)');
  } else {
    for (const s of existing) {
      const id = s.scheduleId || '(no id)';
      console.log(`  ${id}`);
      console.log(`    destination: ${s.destination}`);
      console.log(`    cron:        ${s.cron}`);
      console.log('');
    }
  }

  console.log(`Total: ${existing.length} schedules`);
  console.log('');

  // 2. Identify schedules to delete
  const toDelete = existing.filter((s) => !KEEP_SCHEDULE_IDS.has(s.scheduleId || ''));
  const toKeep = existing.filter((s) => KEEP_SCHEDULE_IDS.has(s.scheduleId || ''));

  console.log('--- Migration Plan ---');
  console.log('');
  console.log('KEEP (or create if missing):');
  console.log(`  1. ${DISPATCHER_SCHEDULE.scheduleId} → ${DISPATCHER_SCHEDULE.destination} [${DISPATCHER_SCHEDULE.cron}]`);
  console.log(`  2. ${GOALS_CAPTURE_SCHEDULE.scheduleId} → ${GOALS_CAPTURE_SCHEDULE.destination} [${GOALS_CAPTURE_SCHEDULE.cron}]`);
  console.log('');

  if (toDelete.length > 0) {
    console.log(`DELETE (${toDelete.length} old schedules):`);
    for (const s of toDelete) {
      console.log(`  - ${s.scheduleId || s.destination} [${s.cron}]`);
    }
  } else {
    console.log('DELETE: (none — no old schedules to remove)');
  }
  console.log('');
  console.log(`After migration: 2 schedules (dispatcher + goals-capture)`);
  console.log(`QStash free tier: 10 slots → 8 remaining`);
  console.log('');

  // 3. Confirm
  const answer = await ask('Proceed with migration? (yes/no): ');
  if (answer !== 'yes' && answer !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  console.log('');

  // 4. Delete old schedules
  if (toDelete.length > 0) {
    console.log('--- Deleting old schedules ---');
    for (const s of toDelete) {
      const id = s.scheduleId;
      if (!id) {
        console.log(`  Skipping schedule with no ID (destination: ${s.destination})`);
        continue;
      }
      try {
        await qstash.schedules.delete(id);
        console.log(`  Deleted: ${id}`);
      } catch (err: any) {
        console.error(`  Failed to delete ${id}: ${err.message}`);
      }
    }
    console.log('');
  }

  // 5. Create/update dispatcher schedule
  console.log('--- Creating dispatcher schedule ---');
  try {
    const result = await qstash.schedules.create({
      scheduleId: DISPATCHER_SCHEDULE.scheduleId,
      destination: DISPATCHER_SCHEDULE.destination,
      cron: DISPATCHER_SCHEDULE.cron,
      retries: 3,
    });
    console.log(`  Created: ${result.scheduleId}`);
    console.log(`  destination: ${DISPATCHER_SCHEDULE.destination}`);
    console.log(`  cron: ${DISPATCHER_SCHEDULE.cron}`);
  } catch (err: any) {
    console.error(`  Failed: ${err.message}`);
  }
  console.log('');

  // 6. Create/update goals-capture schedule
  console.log('--- Creating goals-capture schedule ---');
  try {
    const result = await qstash.schedules.create({
      scheduleId: GOALS_CAPTURE_SCHEDULE.scheduleId,
      destination: GOALS_CAPTURE_SCHEDULE.destination,
      cron: GOALS_CAPTURE_SCHEDULE.cron,
      retries: 3,
    });
    console.log(`  Created: ${result.scheduleId}`);
    console.log(`  destination: ${GOALS_CAPTURE_SCHEDULE.destination}`);
    console.log(`  cron: ${GOALS_CAPTURE_SCHEDULE.cron}`);
  } catch (err: any) {
    console.error(`  Failed: ${err.message}`);
  }
  console.log('');

  // 7. Final listing
  console.log('--- Final QStash Schedules ---');
  const final = await qstash.schedules.list();
  for (const s of final) {
    console.log(`  ${s.scheduleId || '(no id)'} → ${s.destination} [${s.cron}]`);
  }
  console.log(`Total: ${final.length} schedules`);
  console.log('');

  // 8. Reminder about vercel.json
  console.log('--- Next Steps ---');
  console.log('1. The dispatcher is now handling all periodic crons via QStash.');
  console.log('2. You can optionally clean up vercel.json crons (they will still');
  console.log('   fire via Vercel but the dispatcher handles scheduling now).');
  console.log('3. Monitor the dispatcher via:');
  console.log('   - activity_log: action = "cron_dispatcher_complete"');
  console.log('   - QStash dashboard: https://console.upstash.com/qstash');
  console.log('   - Daily health check WhatsApp report');
  console.log('');
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
