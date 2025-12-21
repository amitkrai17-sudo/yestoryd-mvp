// file: app/api/admin/generate-embeddings/route.ts
// One-time utility to generate embeddings for existing learning_events

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const dryRun = searchParams.get('dry_run') === 'true';

  try {
    const { data: events, error: fetchError } = await supabase
      .from('learning_events')
      .select('id, event_type, content_for_embedding')
      .is('embedding', null)
      .not('content_for_embedding', 'is', null)
      .limit(limit);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        message: 'No events need embeddings!',
        processed: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
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
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const event of events) {
      try {
        if (!event.content_for_embedding) continue;

        console.log(`Generating embedding for event ${event.id}...`);
        
        const embedding = await generateEmbedding(event.content_for_embedding);

        const { error: updateError } = await supabase
          .from('learning_events')
          .update({ embedding })
          .eq('id', event.id);

        if (updateError) {
          results.failed++;
          results.errors.push(`${event.id}: ${updateError.message}`);
        } else {
          results.success++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: unknown) {
        results.failed++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${event.id}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      message: 'Embedding generation complete',
      total: events.length,
      success: results.success,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error: unknown) {
    console.error('Generate embeddings error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}