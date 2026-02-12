// ============================================================
// FILE: app/api/admin/templates/route.ts
// PURPOSE: List and create session templates (admin only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const ageBand = searchParams.get('age_band');

    let query = supabase
      .from('session_templates')
      .select('*')
      .order('age_band', { ascending: true })
      .order('recommended_order', { ascending: true });

    if (ageBand && ['foundation', 'building', 'mastery'].includes(ageBand)) {
      query = query.eq('age_band', ageBand);
    }

    const { data, error } = await query;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'templates_list_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'templates_list_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const body = await request.json();
    const {
      template_code,
      title,
      age_band,
      description,
      skill_dimensions,
      difficulty_level,
      duration_minutes,
      prerequisites,
      recommended_order,
      materials_needed,
      parent_involvement,
      activity_flow,
      coach_prep_notes,
      is_diagnostic,
      is_season_finale,
      is_active,
    } = body;

    if (!template_code || !title || !age_band) {
      return NextResponse.json(
        { error: 'template_code, title, and age_band are required' },
        { status: 400 }
      );
    }

    if (!['foundation', 'building', 'mastery'].includes(age_band)) {
      return NextResponse.json({ error: 'Invalid age_band' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('session_templates')
      .insert({
        template_code,
        title,
        age_band,
        description: description || null,
        skill_dimensions: skill_dimensions || [],
        difficulty_level: difficulty_level || 1,
        duration_minutes: duration_minutes || 45,
        prerequisites: prerequisites || [],
        recommended_order: recommended_order || 1,
        materials_needed: materials_needed || [],
        parent_involvement: parent_involvement || null,
        activity_flow: activity_flow || [],
        coach_prep_notes: coach_prep_notes || null,
        is_diagnostic: is_diagnostic || false,
        is_season_finale: is_season_finale || false,
        is_active: is_active !== false,
        created_by: auth.email,
      })
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'template_create_error', error: error.message }));
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Template code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    console.log(JSON.stringify({ requestId, event: 'template_created', templateId: data.id, code: template_code, by: auth.email }));

    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'template_create_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
