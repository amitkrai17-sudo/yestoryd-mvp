#!/usr/bin/env npx tsx
/**
 * scripts/setup-qstash-schedules.ts
 *
 * Sets up QStash schedules for cron jobs that exceed Vercel Hobby plan limits.
 * Run once after deployment or whenever schedules need updating.
 *
 * Usage:
 *   npx tsx scripts/setup-qstash-schedules.ts
 *
 * Required env vars (in .env.local):
 *   QSTASH_TOKEN
 *   QSTASH_CURRENT_SIGNING_KEY
 *   QSTASH_NEXT_SIGNING_KEY
 */

import { config } from 'dotenv';
import { Client } from '@upstash/qstash';

// Load .env.local
config({ path: '.env.local' });

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
if (!QSTASH_TOKEN) {
  console.error('[ERROR] QSTASH_TOKEN not found in .env.local');
  process.exit(1);
}

const qstash = new Client({ token: QSTASH_TOKEN });

// App URL — same logic as lib/qstash.ts
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

// ── Schedules to create ──────────────────────────────────────
interface ScheduleConfig {
  scheduleId: string;
  destination: string;
  cron: string;
  description: string;
}

const SCHEDULES: ScheduleConfig[] = [
  {
    scheduleId: 'session-completion-nudge-15min',
    destination: `${APP_URL}/api/cron/session-completion-nudge`,
    cron: '*/15 * * * *',
    description: 'Nudge coaches to complete pending sessions (every 15 min)',
  },
  // Add more sub-daily schedules here as needed
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('[SETUP] QStash Schedule Setup');
  console.log(`   APP_URL: ${APP_URL}`);
  console.log(`   Token:   ${QSTASH_TOKEN!.slice(0, 8)}...`);
  console.log('');

  // 1. List existing schedules
  console.log('[LIST] Existing QStash schedules:');
  const existing = await qstash.schedules.list();

  if (existing.length === 0) {
    console.log('   (none)');
  } else {
    for (const s of existing) {
      console.log(`   • ${s.scheduleId || '(no id)'} → ${s.destination} [${s.cron}]`);
    }
  }
  console.log('');

  // 2. Create / update schedules
  const existingIds = new Set(existing.map((s) => s.scheduleId));

  for (const sched of SCHEDULES) {
    if (existingIds.has(sched.scheduleId)) {
      console.log(`[SKIP] "${sched.scheduleId}" already exists — updating...`);
    } else {
      console.log(`[CREATE] Creating "${sched.scheduleId}"...`);
    }

    try {
      const result = await qstash.schedules.create({
        scheduleId: sched.scheduleId,
        destination: sched.destination,
        cron: sched.cron,
        retries: 3,
      });

      console.log(`   [OK] ${sched.description}`);
      console.log(`      scheduleId: ${result.scheduleId}`);
      console.log(`      destination: ${sched.destination}`);
      console.log(`      cron:        ${sched.cron}`);
    } catch (err: any) {
      console.error(`   [FAIL] Failed: ${err.message}`);
    }
    console.log('');
  }

  // 3. Final listing
  console.log('[LIST] All schedules after setup:');
  const final = await qstash.schedules.list();
  for (const s of final) {
    console.log(`   • ${s.scheduleId || '(no id)'} → ${s.destination} [${s.cron}]`);
  }

  console.log('\n[OK] Done. QStash will call your endpoints on schedule.');
  console.log('   Dashboard: https://console.upstash.com/qstash');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
