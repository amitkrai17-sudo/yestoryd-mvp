// ============================================================
// FILE: app/api/cron/coach-intelligence-scores/route.ts
// ============================================================
// Coach Intelligence Score Computation
// Runs daily at 2 AM IST via QStash to compute 30-day
// average intelligence scores per coach.
//
// QStash Schedule:
//   cron: "30 20 * * *"  (2:00 AM IST = 20:30 UTC)
//   url: /api/cron/coach-intelligence-scores
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import { getSetting } from '@/lib/settings/getSettings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// AUTH VERIFICATION
// ============================================================

async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });
      const isValid = await receiver.verify({ signature, body: body || '' });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  // Dev bypass
  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronAuth(request);
    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'coach_scores_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'coach_scores_started', authSource: auth.source }));

    const supabase = getServiceSupabase();

    // Load threshold
    const thresholdStr = await getSetting('coach_hybrid_eligibility_threshold');
    const threshold = thresholdStr ? parseInt(thresholdStr, 10) : 50;

    // Current month string
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch active coaches
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('is_active', true);

    if (coachError || !coaches) {
      console.error(JSON.stringify({ requestId, event: 'coach_scores_fetch_error', error: coachError?.message }));
      return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 });
    }

    console.log(JSON.stringify({ requestId, event: 'coach_scores_coaches_found', count: coaches.length }));

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const coach of coaches) {
      try {
        // Fetch structured captures with intelligence_score in last 30d
        const { data: captures } = await supabase
          .from('structured_capture_responses')
          .select('intelligence_score')
          .eq('coach_id', coach.id)
          .not('intelligence_score', 'is', null)
          .gte('created_at', thirtyDaysAgo);

        if (!captures || captures.length === 0) {
          skipped++;
          continue;
        }

        // Compute averages
        const scores = captures.map(c => c.intelligence_score as number);
        const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

        // Fetch previous month's score for trend
        const { data: prevScore } = await supabase
          .from('coach_scores')
          .select('intelligence_score_30d')
          .eq('coach_id', coach.id)
          .eq('month', prevMonth)
          .maybeSingle();

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (prevScore?.intelligence_score_30d != null) {
          const delta = avg - prevScore.intelligence_score_30d;
          if (delta > 5) trend = 'improving';
          else if (delta < -5) trend = 'declining';
        }

        const hybridEligible = avg >= threshold;

        // Select-then-insert-or-update on coach_scores
        const { data: existing } = await supabase
          .from('coach_scores')
          .select('id')
          .eq('coach_id', coach.id)
          .eq('month', month)
          .maybeSingle();

        const scoreData = {
          intelligence_score_avg: avg,
          intelligence_score_30d: avg,
          intelligence_trend: trend,
          hybrid_eligible: hybridEligible,
          capture_count_30d: captures.length,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from('coach_scores')
            .update(scoreData)
            .eq('id', existing.id);

          if (updateErr) {
            console.error(JSON.stringify({ requestId, event: 'coach_scores_update_error', coachId: coach.id, error: updateErr.message }));
            errors++;
            continue;
          }
        } else {
          const { error: insertErr } = await supabase
            .from('coach_scores')
            .insert({
              coach_id: coach.id,
              month,
              ...scoreData,
              created_at: new Date().toISOString(),
            });

          if (insertErr) {
            console.error(JSON.stringify({ requestId, event: 'coach_scores_insert_error', coachId: coach.id, error: insertErr.message }));
            errors++;
            continue;
          }
        }

        processed++;
        console.log(JSON.stringify({
          requestId,
          event: 'coach_score_computed',
          coachId: coach.id,
          avg,
          trend,
          hybridEligible,
          captureCount: captures.length,
        }));

      } catch (coachErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'coach_scores_coach_error',
          coachId: coach.id,
          error: (coachErr as Error).message,
        }));
        errors++;
      }
    }

    const latencyMs = Date.now() - startTime;
    const summary = { processed, skipped, errors, totalCoaches: coaches.length, month, threshold, latencyMs };

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: 'system@yestoryd.com',
        user_type: 'admin',
        action: 'coach_intelligence_scores',
        metadata: { requestId, ...summary },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }

    console.log(JSON.stringify({ requestId, event: 'coach_scores_complete', ...summary }));

    return NextResponse.json({ success: true, ...summary });

  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'coach_scores_fatal_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST delegates to GET (QStash sends POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
