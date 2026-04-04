// ============================================================
// FILE: app/api/cron/intelligence-freshness/route.ts
// ============================================================
// Intelligence Profile Freshness Decay
// Runs daily at 6 AM IST via dispatcher to transition stale profiles:
//   fresh -> aging  (last signal > 7 days ago)
//   aging -> stale  (last signal > 21 days ago)
// Does NOT touch 'none' — the learning_event trigger handles none -> fresh.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronRequest(request);
    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'freshness_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'freshness_decay_started', authSource: auth.source }));

    const supabase = getServiceSupabase();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();

    // fresh -> aging (last signal > 7 days ago)
    const { data: agedRows } = await supabase
      .from('child_intelligence_profiles')
      .update({ freshness_status: 'aging', updated_at: now.toISOString() })
      .eq('freshness_status', 'fresh')
      .lt('last_any_signal_at', sevenDaysAgo)
      .select('id');
    const agedCount = agedRows?.length ?? 0;

    // aging -> stale (last signal > 21 days ago)
    const { data: staledRows } = await supabase
      .from('child_intelligence_profiles')
      .update({ freshness_status: 'stale', updated_at: now.toISOString() })
      .eq('freshness_status', 'aging')
      .lt('last_any_signal_at', twentyOneDaysAgo)
      .select('id');
    const staledCount = staledRows?.length ?? 0;

    const duration = Date.now() - startTime;

    // Log to activity_log
    await supabase.from('activity_log').insert({
      action: 'intelligence_freshness_decay',
      user_type: 'system',
      user_email: 'system@yestoryd.com',
      metadata: {
        requestId,
        aged: agedCount,
        staled: staledCount,
        duration_ms: duration,
      },
    });

    console.log(JSON.stringify({
      requestId,
      event: 'freshness_decay_complete',
      aged: agedCount,
      staled: staledCount,
      duration_ms: duration,
    }));

    return NextResponse.json({
      success: true,
      aged: agedCount,
      staled: staledCount,
      duration: `${duration}ms`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ requestId, event: 'freshness_decay_error', error: message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
