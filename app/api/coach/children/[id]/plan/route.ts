// ============================================================
// FILE: app/api/coach/children/[id]/plan/route.ts
// PURPOSE: Get and update learning plan for a child
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET: Get current learning plan for a child
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const supabase = getServiceSupabase();

    // Get child info
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Get latest roadmap (prefer active, then draft)
    const { data: roadmap } = await supabase
      .from('season_roadmaps')
      .select('*')
      .eq('child_id', childId)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!roadmap) {
      return NextResponse.json({
        success: true,
        child,
        roadmap: null,
        plan_items: [],
        message: 'No learning plan found. Complete a diagnostic session to generate one.',
      });
    }

    // Get plan items with template details
    const { data: planItems } = await supabase
      .from('season_learning_plans')
      .select(`
        id, session_number, session_template_id, focus_area,
        objectives, success_criteria, status, coach_notes,
        completed_at, created_at
      `)
      .eq('roadmap_id', roadmap.id)
      .order('session_number', { ascending: true });

    // Get template details for all plan items
    const templateIds = (planItems || [])
      .map(p => p.session_template_id)
      .filter(Boolean);

    let templatesMap: Record<string, any> = {};
    if (templateIds.length > 0) {
      const { data: templates } = await supabase
        .from('session_templates')
        .select('id, template_code, title, description, skill_dimensions, difficulty_level, duration_minutes, materials_needed, is_season_finale')
        .in('id', templateIds);

      if (templates) {
        templatesMap = Object.fromEntries(templates.map(t => [t.id, t]));
      }
    }

    // Get available templates for swaps (same age band, active, not already in plan)
    const usedTemplateIds = templateIds;
    const { data: availableTemplates } = await supabase
      .from('session_templates')
      .select('id, template_code, title, skill_dimensions, difficulty_level, duration_minutes, is_diagnostic, is_season_finale')
      .eq('age_band', roadmap.age_band)
      .eq('is_active', true)
      .eq('is_diagnostic', false);

    const swapOptions = (availableTemplates || [])
      .filter(t => !usedTemplateIds.includes(t.id))
      .map(t => ({
        id: t.id,
        template_code: t.template_code,
        title: t.title,
        skill_dimensions: t.skill_dimensions,
        difficulty_level: t.difficulty_level,
        duration_minutes: t.duration_minutes,
        is_season_finale: t.is_season_finale,
      }));

    // Enrich plan items with template data
    const enrichedItems = (planItems || []).map(item => ({
      ...item,
      template: item.session_template_id ? templatesMap[item.session_template_id] || null : null,
    }));

    return NextResponse.json({
      success: true,
      child,
      roadmap: {
        id: roadmap.id,
        season_number: roadmap.season_number,
        age_band: roadmap.age_band,
        status: roadmap.status,
        season_name: roadmap.roadmap_data?.season_name || null,
        focus_areas: roadmap.roadmap_data?.focus_areas || [],
        total_planned_sessions: roadmap.roadmap_data?.total_planned_sessions || 0,
        milestone_description: roadmap.roadmap_data?.milestone_description || null,
        generated_by: roadmap.generated_by,
        created_at: roadmap.created_at,
      },
      plan_items: enrichedItems,
      swap_options: swapOptions,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'plan_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update plan items (reorder, swap template, add notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const body = await request.json();
    const { action, planItemId, data } = body;

    const supabase = getServiceSupabase();

    // Verify child exists
    const { data: child } = await supabase
      .from('children')
      .select('id')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Get roadmap
    const { data: roadmap } = await supabase
      .from('season_roadmaps')
      .select('id, status')
      .eq('child_id', childId)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!roadmap) {
      return NextResponse.json({ error: 'No active plan found' }, { status: 404 });
    }

    switch (action) {
      case 'swap_template': {
        // Swap a template in a plan item
        const { new_template_id } = data;
        if (!planItemId || !new_template_id) {
          return NextResponse.json({ error: 'planItemId and new_template_id required' }, { status: 400 });
        }

        // Verify the plan item belongs to this roadmap
        const { data: planItem } = await supabase
          .from('season_learning_plans')
          .select('id, roadmap_id, session_number')
          .eq('id', planItemId)
          .eq('roadmap_id', roadmap.id)
          .single();

        if (!planItem) {
          return NextResponse.json({ error: 'Plan item not found' }, { status: 404 });
        }

        // Get new template info for focus_area update
        const { data: newTemplate } = await supabase
          .from('session_templates')
          .select('id, skill_dimensions, title')
          .eq('id', new_template_id)
          .single();

        const { error: updateError } = await supabase
          .from('season_learning_plans')
          .update({
            session_template_id: new_template_id,
            focus_area: newTemplate?.skill_dimensions?.join(', ') || null,
            objectives: [`Swapped by coach: ${newTemplate?.title || ''}`],
            updated_at: new Date().toISOString(),
          })
          .eq('id', planItemId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to swap template' }, { status: 500 });
        }

        console.log(JSON.stringify({ requestId, event: 'template_swapped', planItemId, new_template_id, by: auth.email }));
        return NextResponse.json({ success: true, message: 'Template swapped' });
      }

      case 'reorder': {
        // Reorder plan items: data = { items: [{ id, session_number }] }
        const { items } = data;
        if (!Array.isArray(items)) {
          return NextResponse.json({ error: 'items array required' }, { status: 400 });
        }

        // Batch update session numbers
        for (const item of items) {
          await supabase
            .from('season_learning_plans')
            .update({
              session_number: item.session_number,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
            .eq('roadmap_id', roadmap.id);
        }

        console.log(JSON.stringify({ requestId, event: 'plan_reordered', roadmapId: roadmap.id, count: items.length, by: auth.email }));
        return NextResponse.json({ success: true, message: 'Plan reordered' });
      }

      case 'update_notes': {
        // Update coach notes on a plan item
        const { coach_notes } = data;
        if (!planItemId) {
          return NextResponse.json({ error: 'planItemId required' }, { status: 400 });
        }

        const { error: notesError } = await supabase
          .from('season_learning_plans')
          .update({
            coach_notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', planItemId)
          .eq('roadmap_id', roadmap.id);

        if (notesError) {
          return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Notes updated' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'plan_patch_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
