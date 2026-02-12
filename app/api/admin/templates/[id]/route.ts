// ============================================================
// FILE: app/api/admin/templates/[id]/route.ts
// PURPOSE: Get and update a single session template (admin only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('session_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'template_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow updating known fields
    const allowedFields = [
      'template_code', 'title', 'description', 'age_band',
      'skill_dimensions', 'difficulty_level', 'duration_minutes',
      'prerequisites', 'recommended_order', 'materials_needed',
      'parent_involvement', 'activity_flow', 'coach_prep_notes',
      'is_diagnostic', 'is_season_finale', 'is_active',
    ];

    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (updates.age_band && !['foundation', 'building', 'mastery'].includes(updates.age_band)) {
      return NextResponse.json({ error: 'Invalid age_band' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('session_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'template_update_error', error: error.message }));
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Template code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    console.log(JSON.stringify({ requestId, event: 'template_updated', templateId: id, fields: Object.keys(updates), by: auth.email }));

    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'template_update_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
