// ============================================================
// FILE: app/api/group-classes/activity/submit/route.ts
// ============================================================
// Public endpoint — parent submits typed response from activity page
// No auth required (validated by signed activity token)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeActivityToken } from '@/lib/group-classes/activity-token';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  token: z.string().min(1),
  response_text: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = submitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { token, response_text } = validation.data;

    // Decode and verify token
    const payload = decodeActivityToken(token);
    if (!payload) {
      console.log(JSON.stringify({ requestId, event: 'activity_submit_invalid_token' }));
      return NextResponse.json({ error: 'Invalid or tampered token' }, { status: 403 });
    }

    const { session_id, participant_id, child_id, child_name } = payload;

    console.log(JSON.stringify({ requestId, event: 'activity_submit_request', sessionId: session_id, childId: child_id }));

    const supabase = createAdminClient();

    // Verify session exists and is active
    const { data: session } = await supabase
      .from('group_sessions')
      .select(`
        id, status, blueprint_id, title,
        class_type:group_class_types(slug, name)
      `)
      .eq('id', session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress' && session.status !== 'scheduled') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Verify participant exists and matches
    const { data: participant } = await supabase
      .from('group_session_participants')
      .select('id, child_id, response_submitted_at')
      .eq('id', participant_id)
      .eq('group_session_id', session_id)
      .single();

    if (!participant || participant.child_id !== child_id) {
      return NextResponse.json({ error: 'Invalid participant' }, { status: 400 });
    }

    // Idempotent: if already submitted, return success silently
    if (participant.response_submitted_at) {
      console.log(JSON.stringify({ requestId, event: 'activity_submit_already_done', childId: child_id }));
      return NextResponse.json({ success: true, already_submitted: true });
    }

    // Get blueprint age_band and prompt
    let ageBand = '7-9';
    let prompt = '';
    if (session.blueprint_id) {
      const { data: bp } = await supabase
        .from('group_class_blueprints')
        .select('age_band, individual_moment_config')
        .eq('id', session.blueprint_id)
        .single();

      if (bp) {
        ageBand = bp.age_band || '7-9';
        const config = typeof bp.individual_moment_config === 'string'
          ? JSON.parse(bp.individual_moment_config)
          : bp.individual_moment_config;
        prompt = config?.prompts?.[ageBand] || '';
      }
    }

    const classType = session.class_type as { slug: string; name: string } | null;
    const wordCount = response_text.trim().split(/\s+/).length;
    const now = new Date().toISOString();

    // Build event data for learning_events
    const eventData = {
      session_id,
      session_title: session.title,
      class_type_slug: classType?.slug || 'group_class',
      class_type_name: classType?.name || 'Group Class',
      prompt,
      response_text,
      age_band: ageBand,
      word_count: wordCount,
      participant_id,
      response_type: 'typed',
    };

    // Build content for embedding
    const contentForEmbedding = `${child_name} response in ${classType?.name || 'Group Class'} (${ageBand}): ${response_text}`;

    // Generate embedding (non-blocking failure — insert even if embedding fails)
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(contentForEmbedding);
    } catch (embErr) {
      console.error(JSON.stringify({ requestId, event: 'activity_submit_embedding_failed', error: (embErr as Error).message }));
      // TODO: Queue background re-embedding via QStash
    }

    // Insert learning_event
    const { error: eventError } = await supabase.from('learning_events').insert({
      child_id,
      event_type: 'group_class_response',
      event_date: now,
      event_data: eventData,
      session_id,
      ai_summary: `Typed response in ${classType?.name || 'group class'}: ${response_text.slice(0, 200)}${response_text.length > 200 ? '...' : ''}`,
      content_for_embedding: contentForEmbedding,
      embedding: embedding ? JSON.stringify(embedding) : null,
    });

    if (eventError) {
      console.error(JSON.stringify({ requestId, event: 'activity_submit_event_insert_error', error: eventError.message }));
      // Don't block submission — mark participant even if event insert fails
    }

    // Update participant: mark response as submitted
    const { error: updateError } = await supabase
      .from('group_session_participants')
      .update({ response_submitted_at: now, updated_at: now })
      .eq('id', participant_id);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'activity_submit_participant_update_error', error: updateError.message }));
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'activity_submit_success', sessionId: session_id, childId: child_id, wordCount, duration: `${duration}ms` }));

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'activity_submit_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
