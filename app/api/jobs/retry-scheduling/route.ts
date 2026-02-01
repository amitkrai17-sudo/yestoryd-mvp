// ============================================================================
// FILE: app/api/jobs/retry-scheduling/route.ts
// PURPOSE: QStash handler for retry scheduling attempts
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processRetry } from '@/lib/scheduling/retry-queue';
import { z } from 'zod';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RetrySchema = z.object({
  sessionId: z.string().uuid(),
  attempt: z.number().optional(),
  reason: z.string().optional(),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // QStash signature verification (skip in dev)
    if (process.env.NODE_ENV !== 'development') {
      const signature = request.headers.get('upstash-signature');
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = request.headers.get('authorization');
      const internalKey = request.headers.get('x-internal-api-key');

      const hasValidAuth = signature ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
        (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY);

      if (!hasValidAuth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = RetrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, attempt } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'retry_scheduling_started',
      sessionId,
      attempt,
    }));

    const result = await processRetry(sessionId);

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'retry_scheduling_complete',
      sessionId,
      success: result.success,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: result.success,
      requestId,
      sessionId,
      error: result.error,
      duration: `${duration}ms`,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'retry_scheduling_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Retry Scheduling Job',
    timestamp: new Date().toISOString(),
  });
}
