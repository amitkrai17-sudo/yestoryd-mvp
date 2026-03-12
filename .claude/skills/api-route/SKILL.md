---
name: api-route
description: >
  Scaffold new Yestoryd API routes following established Next.js 14 App Router patterns.
  Use when creating any new API endpoint, route handler, webhook, or backend logic.
  Trigger on: "create route", "new API", "add endpoint", "webhook handler", "route.ts",
  "POST/GET/PUT/DELETE handler", or any backend API work for Yestoryd.
  Enforces: Supabase client pattern, error handling, site_settings loader,
  activity_log writes, child_id isolation, proper TypeScript typing.
---

# API Route Skill — Yestoryd

## Before Creating ANY Route

```bash
# Check if similar route exists
grep -r "FEATURE_KEYWORD" app/api/ --include="*.ts" -l
# Check for shared utilities
grep -r "FEATURE_KEYWORD" lib/ --include="*.ts" -l
```

Report findings before proceeding. Modify existing routes over creating new ones.

## Standard API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. Parse & validate input
    const body = await request.json();
    // ... validation ...
    
    // 3. Business logic (use site_settings for config)
    // const { data: settings } = await supabase
    //   .from('site_settings')
    //   .select('setting_value')
    //   .eq('setting_key', 'your_key')
    //   .single();
    
    // 4. Database operation
    // ...
    
    // 5. Log to activity_log
    await supabase.from('activity_log').insert({
      action: 'your_action',
      actor_id: user.id,
      details: { /* relevant data */ },
    });
    
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    console.error('[API_NAME] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Critical Rules

1. **Always use `createRouteHandlerClient`** — never `createClient` directly in routes
2. **Auth first** — every non-public route checks `getUser()`
3. **child_id isolation** — when querying child data, ALWAYS filter by parent_id or coach assignment. Never expose cross-user data.
4. **site_settings for config** — pricing, thresholds, feature flags. Use `lib/config/pricing-config.ts` loader for pricing (5-min cache).
5. **activity_log for audit** — log significant actions. NOT `cron_logs`.
6. **Return 500 on failure for critical paths** — enrollment-complete, payment webhooks must return 500 to trigger retry.
7. **No hardcoded business variables** — read from DB.

## Webhook Pattern

For external webhooks (Razorpay, Recall.ai, AiSensy):
- Use `createClient` (service role) — no user auth
- Verify webhook signature (timing-safe for Razorpay)
- Idempotency check before processing
- Log to activity_log with source

## File Location

Routes go in `app/api/[feature]/route.ts`. Group related routes:
```
app/api/
├── payment/          # Razorpay
├── webhooks/         # External webhook receivers
├── cron/             # Dispatcher + goals-capture
├── discovery/        # Discovery call booking
├── parent/           # Parent-facing APIs
├── coach/            # Coach-facing APIs
├── admin/            # Admin APIs
└── jobs/             # QStash background jobs
```
