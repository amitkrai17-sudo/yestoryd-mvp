---
name: cron-task
description: >
  Wire new cron jobs into Yestoryd's consolidated dispatcher pattern.
  Use when creating scheduled tasks, background jobs, or periodic automation.
  Trigger on: "cron", "scheduled task", "background job", "periodic", "dispatcher",
  "QStash", "timer", "daily job", "weekly job", "health check", "reminder",
  or any time-based automation for Yestoryd.
  Enforces: dispatcher consolidation, IST time-matching, activity_log logging,
  QStash slot preservation, and proper error handling.
---

# Cron Task Skill — Yestoryd

## Architecture: Consolidated Dispatcher

Yestoryd uses **2 QStash slots** (of 10 free tier):
1. `/api/cron/dispatcher` — every 15 min, runs 22 crons via IST time-matching
2. `/api/cron/goals-capture` — every 5 min (high-frequency, separate slot)

**NEVER create a new QStash cron.** All new crons go into the dispatcher.

## How It Works

The dispatcher runs every 15 minutes and checks IST time to decide which crons to fire:

```typescript
// Simplified dispatcher logic
const istHour = getISTHour();
const istMinute = getISTMinute();
const istDay = getISTDay(); // 0=Sunday

const cronSchedule = [
  { name: 'your-new-cron', handler: runYourCron, hour: 9, minute: 0 },
  { name: 'coach-reminders-1h', handler: runCoachReminders, hour: null, minute: [0, 30] },
  // ... 20+ crons
];
```

## Adding a New Cron

### Step 1: Create the handler function

```typescript
// In the relevant lib/ or app/api/ file
export async function runYourCronJob(): Promise<CronResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // Your logic here
    const processed = 0;

    // ALWAYS log to activity_log
    await supabase.from('activity_log').insert({
      action: 'cron_your_job',
      details: {
        processed,
        duration_ms: Date.now() - startTime,
        status: 'success',
      },
    });

    return { success: true, processed };
  } catch (error) {
    // Log failures too
    await supabase.from('activity_log').insert({
      action: 'cron_your_job',
      details: {
        error: error instanceof Error ? error.message : 'Unknown',
        duration_ms: Date.now() - startTime,
        status: 'failed',
      },
    });
    throw error;
  }
}
```

### Step 2: Wire into dispatcher

Add your cron to the schedule array in `/api/cron/dispatcher/route.ts`:

```typescript
{
  name: 'your-new-cron',
  handler: runYourCronJob,
  // Schedule options:
  hour: 9,              // Run at 9 AM IST (null = every cycle)
  minute: 0,            // Run at :00 (null = any 15-min window)
  days: [1,2,3,4,5],   // Weekdays only (null = every day)
  enabled: true,
}
```

### Step 3: Add to health check

The daily health check at 7 AM IST monitors all crons. Add your cron's expected run pattern so missed runs are flagged.

## Critical Rules

1. **Log to `activity_log`** — NOT `cron_logs`. All cron results go to activity_log.
2. **IST timezone** — all scheduling in IST (India Standard Time, UTC+5:30)
3. **Idempotent handlers** — crons may fire twice (QStash retry). Handle gracefully.
4. **Error isolation** — one cron failure must NOT block others in the dispatcher cycle.
5. **Duration tracking** — always measure and log `duration_ms`.
6. **Service client** — crons use service role Supabase client (no user auth).

## Existing Cron Categories

| Category | Examples | Typical Schedule |
|----------|----------|-----------------|
| Reminders | Coach 1h/24h, parent check-in | Hourly windows |
| Processing | Session analysis, embedding backfill | After events |
| Health | Daily health check, stale profile detection | 7 AM IST daily |
| Financial | Payment reconciliation, monthly payouts | Every 30min / 7th of month |
| Engagement | Re-engagement nudges, NPS triggers | Weekly |
| Cleanup | Stale data cleanup, cache invalidation | Daily off-peak |

## QStash Background Jobs (Different from Crons)

For one-off async processing (not scheduled), use QStash jobs via `/api/jobs/`:
```typescript
import { Client } from '@upstash/qstash';
const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process-session`,
  body: { sessionId },
});
```

Jobs avoid Vercel's 60-second timeout for long-running tasks.
