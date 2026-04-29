// ============================================================
// FILE: app/api/cron/expire-stale-tasks/route.ts
// PURPOSE: Auto-expire stale parent_daily_tasks rows.
// SCHEDULE: Daily at 06:00 IST (00:30 UTC) via dispatcher.
// ============================================================
// Transitions rows from status='active' to status='expired' once they
// fall outside the configured grace window (task_expiry_days, default 7).
// is_completed is left untouched — expired != completed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { getTaskLimits } from '@/lib/config/task-limits';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const config = await getTaskLimits();
    const cutoff = new Date(Date.now() - config.taskExpiryDays * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Cast: status column added in migration 20260429130100; database.types.ts
    // regenerates after deploy. PR 2.5 will type the column properly.
    const { data: expired, error } = await (supabase
      .from('parent_daily_tasks') as any)
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('task_date', cutoff)
      .select('id');

    if (error) {
      throw error;
    }

    const expiredCount = expired?.length ?? 0;
    const latencyMs = Date.now() - start;

    console.log(JSON.stringify({
      requestId,
      event: 'expire_stale_tasks_complete',
      expiredCount,
      cutoff,
      taskExpiryDays: config.taskExpiryDays,
      latencyMs,
    }));

    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'cron_expire_stale_tasks_complete',
        metadata: {
          request_id: requestId,
          source: auth.source,
          expired_count: expiredCount,
          cutoff,
          task_expiry_days: config.taskExpiryDays,
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logErr: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'expire_stale_tasks_activity_log_failed',
        error: logErr.message,
      }));
    }

    return NextResponse.json({
      success: true,
      requestId,
      expired_count: expiredCount,
      cutoff,
      latency_ms: latencyMs,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.error(JSON.stringify({
      requestId,
      event: 'expire_stale_tasks_fatal',
      error: err.message,
      latencyMs,
    }));

    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'cron_expire_stale_tasks_failures',
        metadata: {
          request_id: requestId,
          source: auth.source,
          error: err.message?.slice(0, 500) || 'unknown',
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch { /* swallow — already logged to console */ }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
