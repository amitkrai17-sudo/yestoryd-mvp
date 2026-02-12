// ============================================================
// FILE: app/api/coach/children/[id]/plan/approve/route.ts
// PURPOSE: Approve a draft learning plan and schedule sessions
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Get draft roadmap
    const { data: roadmap } = await supabase
      .from('season_roadmaps')
      .select('id, status, enrollment_id, roadmap_data')
      .eq('child_id', childId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!roadmap) {
      return NextResponse.json({ error: 'No draft plan found to approve' }, { status: 404 });
    }

    // Update roadmap status to active
    const { error: roadmapError } = await supabase
      .from('season_roadmaps')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roadmap.id);

    if (roadmapError) {
      return NextResponse.json({ error: 'Failed to approve plan' }, { status: 500 });
    }

    // Get plan items to link templates to scheduled sessions
    const { data: planItems } = await supabase
      .from('season_learning_plans')
      .select('id, session_number, session_template_id')
      .eq('roadmap_id', roadmap.id)
      .order('session_number', { ascending: true });

    // Update scheduled sessions with template assignments from the plan
    if (planItems && planItems.length > 0 && roadmap.enrollment_id) {
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select('id, session_number')
        .eq('enrollment_id', roadmap.enrollment_id)
        .eq('is_diagnostic', false)
        .in('status', ['scheduled', 'pending', 'confirmed'])
        .order('session_number', { ascending: true });

      if (sessions) {
        // Map plan items to sessions by session_number
        for (const planItem of planItems) {
          const matchingSession = sessions.find(s => s.session_number === planItem.session_number);
          if (matchingSession && planItem.session_template_id) {
            await supabase
              .from('scheduled_sessions')
              .update({
                session_template_id: planItem.session_template_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchingSession.id);
          }
        }
      }
    }

    // Log approval event
    await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'milestone',
        event_date: new Date().toISOString(),
        data: {
          type: 'plan_approved',
          roadmap_id: roadmap.id,
          season_name: roadmap.roadmap_data?.season_name,
          approved_by: auth.email,
        },
        event_data: {
          type: 'plan_approved',
          roadmap_id: roadmap.id,
        },
        content_for_embedding: `Learning plan approved: ${roadmap.roadmap_data?.season_name || 'Season'}. Templates assigned to scheduled sessions.`,
        created_by: auth.email,
      });

    console.log(JSON.stringify({
      requestId,
      event: 'plan_approved',
      childId,
      roadmapId: roadmap.id,
      sessionsUpdated: planItems?.length || 0,
      by: auth.email,
    }));

    return NextResponse.json({
      success: true,
      message: 'Plan approved and templates assigned to sessions',
      sessionsUpdated: planItems?.length || 0,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'plan_approve_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
