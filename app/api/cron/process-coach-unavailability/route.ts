// ============================================================================
// FILE: app/api/cron/process-coach-unavailability/route.ts
// PURPOSE: Daily cron to process upcoming coach unavailability windows
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { processUnavailability } from '@/lib/scheduling/coach-availability-handler';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) return true;

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) return true;

  return false;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    processed: 0,
    errors: [] as string[],
  };

  try {
    console.log(JSON.stringify({
      requestId,
      event: 'coach_unavailability_cron_started',
    }));

    const supabase = getServiceSupabase();

    // Find coach_availability entries that:
    // 1. Start within the next 3 days (give time to process)
    // 2. Haven't been processed yet
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const todayStr = now.toISOString().split('T')[0];
    const thresholdStr = threeDaysFromNow.toISOString().split('T')[0];

    // NOTE: processing_status column doesn't exist - fetching all unavailabilities
    const { data: unavailabilities, error } = await supabase
      .from('coach_availability')
      .select('id, coach_id, start_date, end_date, reason')
      .lte('start_date', thresholdStr)
      .gte('end_date', todayStr); // Still ongoing or upcoming

    if (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'coach_unavailability_fetch_error',
        error: error.message,
      }));
      return NextResponse.json(
        { success: false, requestId, error: error.message },
        { status: 500 }
      );
    }

    if (!unavailabilities || unavailabilities.length === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'no_coach_unavailabilities_to_process',
      }));
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No unavailabilities to process',
        results,
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'processing_unavailabilities',
      count: unavailabilities.length,
    }));

    for (const unavail of unavailabilities) {
      try {
        // NOTE: processing_status column doesn't exist - would need migration
        // await supabase.from('coach_availability').update({ processing_status: 'processing' }).eq('id', unavail.id);

        const result = await processUnavailability(
          unavail.coach_id,
          unavail.start_date,
          unavail.end_date,
          unavail.reason || 'Unavailable'
        );

        // Mark as processed
        // NOTE: processing_status and processing_result columns don't exist
        // Would log result to console instead
        console.log(JSON.stringify({
          requestId,
          event: 'unavailability_processed',
          unavailabilityId: unavail.id,
          coachId: unavail.coach_id,
          result,
        }));

        results.processed++;

        if (result.errors.length > 0) {
          results.errors.push(`Coach ${unavail.coach_id}: ${result.errors.join(', ')}`);
        }
      } catch (e: any) {
        results.errors.push(`Coach ${unavail.coach_id}: ${e.message}`);

        console.error(JSON.stringify({
          requestId,
          event: 'unavailability_processing_failed',
          unavailabilityId: unavail.id,
          error: e.message,
        }));
      }
    }

    const duration = Date.now() - startTime;

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: 'engage@yestoryd.com',
      user_type: 'system',
      action: 'coach_unavailability_cron_executed',
      metadata: {
        request_id: requestId,
        processed: results.processed,
        errors: results.errors.length,
        duration_ms: duration,
      },
      created_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({
      requestId,
      event: 'coach_unavailability_cron_complete',
      processed: results.processed,
      errors: results.errors.length,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      duration: `${duration}ms`,
      results,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'coach_unavailability_cron_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
