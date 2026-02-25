// ============================================================
// FILE: app/api/admin/group-classes/blueprints/[id]/route.ts
// ============================================================
// Blueprint Management - GET (single) + PUT (update) + DELETE (archive)
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
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

const updateBlueprintSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  class_type_id: z.string().uuid().optional(),
  age_band: z.enum(['4-6', '7-9', '10-12']).optional(),
  description: z.string().max(2000).nullable().optional(),
  segments: z.array(segmentSchema).min(1).max(20).optional(),
  individual_moment_config: individualMomentConfigSchema.optional(),
  guided_questions: z.array(z.string()).nullable().optional(),
  content_refs: z.array(z.object({
    content_item_id: z.string().uuid(),
    segment_index: z.number().int().min(0),
    type: z.enum(['video', 'story', 'image', 'audio', 'document']),
    title: z.string().optional(),
  })).nullable().optional(),
  quiz_refs: z.array(z.object({
    quiz_id: z.string().uuid(),
    segment_index: z.number().int().min(0),
    title: z.string().optional(),
    passing_score: z.number().optional(),
  })).nullable().optional(),
  skill_tags: z.array(z.string()).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// --- GET: Single blueprint ---
export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'blueprint_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid blueprint ID' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'blueprint_get_request', adminEmail: auth.email, blueprintId: id }));

    const supabase = getServiceSupabase();

    const { data: blueprint, error } = await supabase
      .from('group_class_blueprints')
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex)
      `)
      .eq('id', id)
      .single();

    if (error || !blueprint) {
      console.error(JSON.stringify({ requestId, event: 'blueprint_get_not_found', blueprintId: id }));
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }

    // Parse JSON fields
    const parsed = {
      ...blueprint,
      segments: typeof blueprint.segments === 'string' ? JSON.parse(blueprint.segments) : blueprint.segments,
      individual_moment_config: typeof blueprint.individual_moment_config === 'string' ? JSON.parse(blueprint.individual_moment_config) : blueprint.individual_moment_config,
      guided_questions: blueprint.guided_questions ? (typeof blueprint.guided_questions === 'string' ? JSON.parse(blueprint.guided_questions) : blueprint.guided_questions) : null,
      content_refs: blueprint.content_refs ? (typeof blueprint.content_refs === 'string' ? JSON.parse(blueprint.content_refs) : blueprint.content_refs) : null,
      quiz_refs: blueprint.quiz_refs ? (typeof blueprint.quiz_refs === 'string' ? JSON.parse(blueprint.quiz_refs) : blueprint.quiz_refs) : null,
      skill_tags: blueprint.skill_tags ? (typeof blueprint.skill_tags === 'string' ? JSON.parse(blueprint.skill_tags) : blueprint.skill_tags) : null,
    };

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'blueprint_get_success', blueprintId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, blueprint: parsed });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blueprint_get_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PUT: Update blueprint ---
export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'blueprint_put_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid blueprint ID' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateBlueprintSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const data = validation.data;

    console.log(JSON.stringify({ requestId, event: 'blueprint_put_request', adminEmail: auth.email, blueprintId: id }));

    const supabase = getServiceSupabase();

    // Verify blueprint exists
    const { data: existing } = await supabase
      .from('group_class_blueprints')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }

    // Build update object
    const dbUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) dbUpdate.name = data.name;
    if (data.class_type_id !== undefined) dbUpdate.class_type_id = data.class_type_id;
    if (data.age_band !== undefined) dbUpdate.age_band = data.age_band;
    if (data.description !== undefined) dbUpdate.description = data.description;
    if (data.status !== undefined) dbUpdate.status = data.status;

    if (data.segments !== undefined) {
      dbUpdate.segments = JSON.stringify(data.segments);
      dbUpdate.total_duration_minutes = data.segments.reduce((sum, seg) => sum + seg.duration_minutes, 0);
    }
    if (data.individual_moment_config !== undefined) {
      dbUpdate.individual_moment_config = JSON.stringify(data.individual_moment_config);
    }
    if (data.guided_questions !== undefined) {
      dbUpdate.guided_questions = data.guided_questions ? JSON.stringify(data.guided_questions) : null;
    }
    if (data.content_refs !== undefined) {
      dbUpdate.content_refs = data.content_refs ? JSON.stringify(data.content_refs) : null;
    }
    if (data.quiz_refs !== undefined) {
      dbUpdate.quiz_refs = data.quiz_refs ? JSON.stringify(data.quiz_refs) : null;
    }
    if (data.skill_tags !== undefined) {
      dbUpdate.skill_tags = data.skill_tags ? JSON.stringify(data.skill_tags) : null;
    }

    const { data: blueprint, error } = await supabase
      .from('group_class_blueprints')
      .update(dbUpdate)
      .eq('id', id)
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex)
      `)
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'blueprint_put_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update blueprint: ' + error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'blueprint_updated',
      metadata: {
        request_id: requestId,
        blueprint_id: id,
        updated_fields: Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined),
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'blueprint_put_success', blueprintId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, blueprint });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blueprint_put_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- DELETE: Archive blueprint (soft delete) ---
export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'blueprint_delete_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid blueprint ID' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'blueprint_delete_request', adminEmail: auth.email, blueprintId: id }));

    const supabase = getServiceSupabase();

    // Soft archive — NOT hard delete (FK from group_sessions.blueprint_id)
    const { data: blueprint, error } = await supabase
      .from('group_class_blueprints')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, status')
      .single();

    if (error || !blueprint) {
      console.error(JSON.stringify({ requestId, event: 'blueprint_delete_db_error', error: error?.message || 'Not found' }));
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'blueprint_archived',
      metadata: {
        request_id: requestId,
        blueprint_id: id,
        blueprint_name: blueprint.name,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'blueprint_delete_success', blueprintId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, blueprint });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blueprint_delete_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
