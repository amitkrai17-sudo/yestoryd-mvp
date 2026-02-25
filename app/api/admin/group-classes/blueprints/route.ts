// ============================================================
// FILE: app/api/admin/group-classes/blueprints/route.ts
// ============================================================
// Blueprint Management - List (GET) + Create (POST)
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const getQuerySchema = z.object({
  class_type_id: z.string().uuid().optional(),
  age_band: z.enum(['4-6', '7-9', '10-12']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const segmentSchema = z.object({
  index: z.number().int().min(0),
  name: z.string().min(1).max(200),
  type: z.enum(['content_playback', 'group_discussion', 'individual_moment', 'creative_activity', 'wrap_up']),
  duration_minutes: z.number().min(1).max(120),
  instructions: z.string().max(5000).default(''),
  content_item_id: z.string().uuid().optional(),
  guided_questions: z.array(z.string()).optional(),
  individual_config: z.object({
    verbal: z.object({
      applicable_age_bands: z.array(z.enum(['4-6', '7-9', '10-12'])),
      prompt: z.string(),
      duration_per_child_seconds: z.number().min(10).max(300),
      capture_method: z.literal('instructor_observation'),
    }).optional(),
    typed: z.object({
      applicable_age_bands: z.array(z.enum(['4-6', '7-9', '10-12'])),
      prompt_7_9: z.string().optional(),
      prompt_10_12: z.string().optional(),
      capture_method: z.literal('parent_device_form'),
    }).optional(),
  }).optional(),
  instructor_notes: z.string().max(2000).optional(),
});

const individualMomentConfigSchema = z.object({
  type: z.enum(['verbal', 'typed', 'mixed']),
  prompts: z.record(z.enum(['4-6', '7-9', '10-12']), z.string()),
  duration_per_child_seconds: z.number().min(10).max(300),
  capture_method: z.enum(['instructor_observation', 'parent_device_form', 'both']),
});

const createBlueprintSchema = z.object({
  name: z.string().min(1).max(200),
  class_type_id: z.string().uuid('Invalid class type ID'),
  age_band: z.enum(['4-6', '7-9', '10-12']),
  description: z.string().max(2000).optional(),
  segments: z.array(segmentSchema).min(1).max(20),
  individual_moment_config: individualMomentConfigSchema,
  guided_questions: z.array(z.string()).optional(),
  content_refs: z.array(z.object({
    content_item_id: z.string().uuid(),
    segment_index: z.number().int().min(0),
    type: z.enum(['video', 'story', 'image', 'audio', 'document']),
    title: z.string().optional(),
  })).optional(),
  quiz_refs: z.array(z.object({
    quiz_id: z.string().uuid(),
    segment_index: z.number().int().min(0),
    title: z.string().optional(),
    passing_score: z.number().optional(),
  })).optional(),
  skill_tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

// --- GET: List blueprints ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'blueprints_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getQuerySchema.safeParse({
      class_type_id: searchParams.get('class_type_id') || undefined,
      age_band: searchParams.get('age_band') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { class_type_id, age_band, status, limit, offset } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'blueprints_get_request', adminEmail: auth.email, class_type_id, age_band, status: status || 'all', limit, offset }));

    const supabase = getServiceSupabase();

    let query = supabase
      .from('group_class_blueprints')
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (class_type_id) {
      query = query.eq('class_type_id', class_type_id);
    }
    if (age_band) {
      query = query.eq('age_band', age_band);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: blueprints, error, count } = await query;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'blueprints_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch blueprints' }, { status: 500 });
    }

    // Parse JSON fields
    const parsed = (blueprints || []).map((bp) => ({
      ...bp,
      segments: typeof bp.segments === 'string' ? JSON.parse(bp.segments) : bp.segments,
      individual_moment_config: typeof bp.individual_moment_config === 'string' ? JSON.parse(bp.individual_moment_config) : bp.individual_moment_config,
      guided_questions: bp.guided_questions ? (typeof bp.guided_questions === 'string' ? JSON.parse(bp.guided_questions) : bp.guided_questions) : null,
      content_refs: bp.content_refs ? (typeof bp.content_refs === 'string' ? JSON.parse(bp.content_refs) : bp.content_refs) : null,
      quiz_refs: bp.quiz_refs ? (typeof bp.quiz_refs === 'string' ? JSON.parse(bp.quiz_refs) : bp.quiz_refs) : null,
      skill_tags: bp.skill_tags ? (typeof bp.skill_tags === 'string' ? JSON.parse(bp.skill_tags) : bp.skill_tags) : null,
    }));

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'blueprints_get_success', count: parsed.length, total: count, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, blueprints: parsed, total: count, limit, offset });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blueprints_get_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Create blueprint ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'blueprints_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createBlueprintSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const data = validation.data;

    console.log(JSON.stringify({ requestId, event: 'blueprints_post_request', adminEmail: auth.email, name: data.name, classTypeId: data.class_type_id }));

    const supabase = getServiceSupabase();

    // Verify class type exists
    const { data: classType } = await supabase
      .from('group_class_types')
      .select('id')
      .eq('id', data.class_type_id)
      .single();

    if (!classType) {
      return NextResponse.json({ error: 'Invalid class type' }, { status: 400 });
    }

    // Compute total duration from segments
    const totalDuration = data.segments.reduce((sum, seg) => sum + seg.duration_minutes, 0);

    const dbData = {
      name: data.name,
      class_type_id: data.class_type_id,
      age_band: data.age_band,
      description: data.description || null,
      segments: JSON.stringify(data.segments),
      individual_moment_config: JSON.stringify(data.individual_moment_config),
      guided_questions: data.guided_questions ? JSON.stringify(data.guided_questions) : null,
      content_refs: data.content_refs ? JSON.stringify(data.content_refs) : null,
      quiz_refs: data.quiz_refs ? JSON.stringify(data.quiz_refs) : null,
      skill_tags: data.skill_tags ? JSON.stringify(data.skill_tags) : null,
      total_duration_minutes: totalDuration,
      status: data.status,
    };

    const { data: blueprint, error } = await supabase
      .from('group_class_blueprints')
      .insert(dbData)
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex)
      `)
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'blueprints_post_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create blueprint: ' + error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'blueprint_created',
      metadata: {
        request_id: requestId,
        blueprint_id: blueprint.id,
        name: data.name,
        class_type_id: data.class_type_id,
        age_band: data.age_band,
        segment_count: data.segments.length,
        total_duration_minutes: totalDuration,
        status: data.status,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'blueprints_post_success', blueprintId: blueprint.id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, blueprint }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blueprints_post_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
