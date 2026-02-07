// ============================================================
// FILE: app/api/admin/generate-embeddings/route.ts
// ============================================================
// HARDENED VERSION - Generate Embeddings for Learning Events
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- VALIDATION SCHEMA ---
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  dry_run: z.enum(['true', 'false']).default('false'),
});

// --- HELPER: Generate embedding ---
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'generate_embeddings_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      limit: searchParams.get('limit') || 50,
      dry_run: searchParams.get('dry_run') || 'false',
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { limit, dry_run } = validation.data;
    const dryRun = dry_run === 'true';

    console.log(JSON.stringify({ requestId, event: 'generate_embeddings_request', adminEmail: auth.email, limit, dryRun }));

    const supabase = getServiceSupabase();

    const { data: events, error: fetchError } = await supabase
      .from('learning_events')
      .select('id, event_type, content_for_embedding')
      .is('embedding', null)
      .not('content_for_embedding', 'is', null)
      .limit(limit);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message, requestId }, { status: 500 });
    }

    if (!events || events.length === 0) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'generate_embeddings_none_needed', duration: `${duration}ms` }));
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No events need embeddings!',
        processed: 0,
      });
    }

    if (dryRun) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'generate_embeddings_dry_run', count: events.length, duration: `${duration}ms` }));
      return NextResponse.json({
        success: true,
        requestId,
        message: 'Dry run - would process these events',
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          type: e.event_type,
          content_preview: e.content_for_embedding?.substring(0, 100),
        })),
      });
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as string[],
    };

    for (const event of events) {
      try {
        if (!event.content_for_embedding) continue;

        const embedding = await generateEmbedding(event.content_for_embedding);

        const { error: updateError } = await supabase
          .from('learning_events')
          .update({ embedding })
          .eq('id', event.id);

        if (updateError) {
          results.failedCount++;
          results.errors.push(`${event.id}: ${updateError.message}`);
        } else {
          results.successCount++;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: unknown) {
        results.failedCount++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${event.id}: ${errorMessage}`);
      }
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'embeddings_generated',
      details: {
        request_id: requestId,
        total: events.length,
        success_count: results.successCount,
        failed_count: results.failedCount,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'generate_embeddings_complete',
      total: events.length,
      successCount: results.successCount,
      failedCount: results.failedCount,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Embedding generation complete',
      total: events.length,
      successCount: results.successCount,
      failedCount: results.failedCount,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error: unknown) {
    console.error(JSON.stringify({ requestId, event: 'generate_embeddings_error', error: error instanceof Error ? error.message : 'Unknown' }));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage, requestId }, { status: 500 });
  }
}
