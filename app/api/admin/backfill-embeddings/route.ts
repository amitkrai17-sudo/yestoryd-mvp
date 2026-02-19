// ============================================================
// FILE: app/api/admin/backfill-embeddings/route.ts
// ============================================================
// Re-embed all learning_events with text-embedding-004 (unified model)
// Idempotent — safe to re-run. Processes in batches of 10 with 1s delay.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();

    // Parse optional limit from body
    let limit = 500;
    try {
      const body = await request.json();
      if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
        limit = Math.min(body.limit, 2000);
      }
    } catch {
      // No body or invalid JSON — use default
    }

    console.log(JSON.stringify({ requestId, event: 'backfill_start', limit }));

    // Fetch events that have content_for_embedding but need re-embedding
    const { data: events, error: fetchError } = await supabase
      .from('learning_events')
      .select('id, content_for_embedding')
      .not('content_for_embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message, requestId }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No events with content_for_embedding found',
        total: 0,
        processed: 0,
        errors: 0,
      });
    }

    const results = { processed: 0, errors: 0, errorDetails: [] as string[] };

    // Process in batches
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (event) => {
          try {
            if (!event.content_for_embedding) return;

            const embedding = await generateEmbedding(event.content_for_embedding);
            const { error: updateError } = await supabase
              .from('learning_events')
              .update({ embedding: JSON.stringify(embedding) })
              .eq('id', event.id);

            if (updateError) {
              results.errors++;
              results.errorDetails.push(`${event.id}: ${updateError.message}`);
            } else {
              results.processed++;
            }
          } catch (err: unknown) {
            results.errors++;
            const msg = err instanceof Error ? err.message : 'Unknown error';
            results.errorDetails.push(`${event.id}: ${msg}`);
          }
        })
      );

      // Delay between batches to avoid quota issues
      if (i + BATCH_SIZE < events.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const duration = Date.now() - startTime;

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'backfill_embeddings',
      metadata: {
        request_id: requestId,
        total: events.length,
        processed: results.processed,
        errors: results.errors,
        duration_ms: duration,
        model: 'text-embedding-004',
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({
      requestId,
      event: 'backfill_complete',
      total: events.length,
      processed: results.processed,
      errors: results.errors,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      total: events.length,
      processed: results.processed,
      errors: results.errors,
      errorDetails: results.errorDetails.length > 0 ? results.errorDetails.slice(0, 20) : undefined,
      durationMs: duration,
    });
  } catch (error: unknown) {
    console.error(JSON.stringify({ requestId, event: 'backfill_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', requestId },
      { status: 500 }
    );
  }
}
