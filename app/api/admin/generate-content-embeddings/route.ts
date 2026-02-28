// ============================================================
// FILE: app/api/admin/generate-content-embeddings/route.ts
// PURPOSE: Generate embeddings for el_learning_units content
// Uses: Google gemini-embedding-001 (768-dim) via lib/rai/embeddings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding, buildContentSearchableText } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST: Generate embeddings for units where embedding IS NULL
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'content_embeddings_start', mode: 'null_only', admin: auth.email }));

    const supabase = getServiceSupabase();

    // Fetch units without embeddings, joined with skill name
    const { data: units, error: fetchError } = await supabase
      .from('el_learning_units')
      .select('id, name, description, tags, coach_guidance, parent_instruction, arc_stage, content_code, difficulty, quest_title, quest_description, skill_id, el_skills(name)')
      .is('embedding', null)
      .or('is_active.eq.true,status.eq.published');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message, requestId }, { status: 500 });
    }

    if (!units || units.length === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'All content units already have embeddings',
        processed: 0,
      });
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const unit of units) {
      try {
        // Build searchable text
        const skillData = unit.el_skills as { name: string } | { name: string }[] | null;
        const skillName = Array.isArray(skillData) ? skillData[0]?.name : skillData?.name;

        const searchText = buildContentSearchableText({
          name: unit.name,
          description: unit.description,
          tags: unit.tags,
          coach_guidance: unit.coach_guidance as any,
          parent_instruction: unit.parent_instruction,
          arc_stage: unit.arc_stage,
          content_code: unit.content_code,
          difficulty: unit.difficulty,
          quest_title: unit.quest_title,
          quest_description: unit.quest_description,
          skill_name: skillName || undefined,
        });

        // Generate embedding
        const embedding = await generateEmbedding(searchText);

        // Store
        const { error: updateError } = await supabase
          .from('el_learning_units')
          .update({ embedding: embedding as any })
          .eq('id', unit.id);

        if (updateError) {
          results.failed++;
          results.errors.push(`${unit.name}: ${updateError.message}`);
        } else {
          results.success++;
          console.log(JSON.stringify({ requestId, event: 'unit_embedded', unit: unit.name, textLength: searchText.length }));
        }

        // Rate limit: 100ms between requests to avoid Gemini throttling
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: unknown) {
        results.failed++;
        results.errors.push(`${unit.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'content_embeddings_generated',
      metadata: {
        request_id: requestId,
        mode: 'null_only',
        total: units.length,
        success: results.success,
        failed: results.failed,
        duration_ms: Date.now() - startTime,
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'content_embeddings_complete', total: units.length, success: results.success, failed: results.failed, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Content embedding generation complete',
      total: units.length,
      success_count: results.success,
      failed_count: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration_ms: duration,
    });

  } catch (error: unknown) {
    console.error(JSON.stringify({ requestId, event: 'content_embeddings_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', requestId }, { status: 500 });
  }
}

/**
 * PUT: Force-regenerate ALL embeddings (even if already set)
 */
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'content_embeddings_start', mode: 'force_refresh', admin: auth.email }));

    const supabase = getServiceSupabase();

    // Fetch ALL active units (ignore existing embeddings)
    const { data: units, error: fetchError } = await supabase
      .from('el_learning_units')
      .select('id, name, description, tags, coach_guidance, parent_instruction, arc_stage, content_code, difficulty, quest_title, quest_description, skill_id, el_skills(name)')
      .or('is_active.eq.true,status.eq.published');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message, requestId }, { status: 500 });
    }

    if (!units || units.length === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No active content units found',
        processed: 0,
      });
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const unit of units) {
      try {
        const skillData = unit.el_skills as { name: string } | { name: string }[] | null;
        const skillName = Array.isArray(skillData) ? skillData[0]?.name : skillData?.name;

        const searchText = buildContentSearchableText({
          name: unit.name,
          description: unit.description,
          tags: unit.tags,
          coach_guidance: unit.coach_guidance as any,
          parent_instruction: unit.parent_instruction,
          arc_stage: unit.arc_stage,
          content_code: unit.content_code,
          difficulty: unit.difficulty,
          quest_title: unit.quest_title,
          quest_description: unit.quest_description,
          skill_name: skillName || undefined,
        });

        const embedding = await generateEmbedding(searchText);

        const { error: updateError } = await supabase
          .from('el_learning_units')
          .update({ embedding: embedding as any })
          .eq('id', unit.id);

        if (updateError) {
          results.failed++;
          results.errors.push(`${unit.name}: ${updateError.message}`);
        } else {
          results.success++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: unknown) {
        results.failed++;
        results.errors.push(`${unit.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'content_embeddings_generated',
      metadata: {
        request_id: requestId,
        mode: 'force_refresh',
        total: units.length,
        success: results.success,
        failed: results.failed,
        duration_ms: Date.now() - startTime,
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'content_embeddings_complete', mode: 'force_refresh', total: units.length, success: results.success, failed: results.failed, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Content embedding force-refresh complete',
      total: units.length,
      success_count: results.success,
      failed_count: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration_ms: duration,
    });

  } catch (error: unknown) {
    console.error(JSON.stringify({ requestId, event: 'content_embeddings_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', requestId }, { status: 500 });
  }
}
