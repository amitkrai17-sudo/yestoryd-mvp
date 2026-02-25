// ============================================================
// FILE: app/api/instructor/session/[sessionId]/route.ts
// ============================================================
// Instructor Session Console — Fetch session + blueprint + participants
// Auth: Coach must be assigned to this session
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { generateActivityToken } from '@/lib/group-classes/activity-token';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'instructor_session_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { sessionId } = await context.params;

    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'instructor_session_get', email: auth.email, sessionId }));

    const supabase = getServiceSupabase();

    // Fetch session with blueprint and class type
    const { data: session, error: sessionError } = await supabase
      .from('group_sessions')
      .select(`
        *,
        class_type:group_class_types(id, name, slug, icon_emoji, color_hex, duration_minutes),
        instructor:coaches!group_sessions_instructor_id_fkey(id, name, email, photo_url),
        book:books(id, title, author, cover_image_url)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(JSON.stringify({ requestId, event: 'instructor_session_not_found', sessionId }));
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify this instructor is assigned to the session (admins can access any session)
    if (auth.role !== 'admin') {
      const isAssigned = session.instructor_id === auth.coachId || session.coach_id === auth.coachId;
      if (!isAssigned) {
        console.log(JSON.stringify({ requestId, event: 'instructor_session_not_assigned', coachId: auth.coachId, sessionInstructorId: session.instructor_id }));
        return NextResponse.json({ error: 'You are not assigned to this session' }, { status: 403 });
      }
    }

    // Fetch blueprint if linked
    let blueprint = null;
    if (session.blueprint_id) {
      const { data: bp } = await supabase
        .from('group_class_blueprints')
        .select('*')
        .eq('id', session.blueprint_id)
        .single();

      if (bp) {
        blueprint = {
          ...bp,
          segments: typeof bp.segments === 'string' ? JSON.parse(bp.segments) : bp.segments,
          individual_moment_config: typeof bp.individual_moment_config === 'string' ? JSON.parse(bp.individual_moment_config) : bp.individual_moment_config,
          guided_questions: bp.guided_questions ? (typeof bp.guided_questions === 'string' ? JSON.parse(bp.guided_questions) : bp.guided_questions) : null,
          content_refs: bp.content_refs ? (typeof bp.content_refs === 'string' ? JSON.parse(bp.content_refs) : bp.content_refs) : null,
          skill_tags: bp.skill_tags ? (typeof bp.skill_tags === 'string' ? JSON.parse(bp.skill_tags) : bp.skill_tags) : null,
        };
      }
    }

    // Fetch participants with child details
    const { data: participants } = await supabase
      .from('group_session_participants')
      .select(`
        id, child_id, payment_status, attendance_status,
        participation_rating, participation_notes,
        child:children(id, name, age, learning_profile, learning_style, learning_challenges)
      `)
      .eq('group_session_id', sessionId)
      .neq('attendance_status', 'cancelled');

    // Fetch content items if blueprint has content_refs
    let contentItems: Record<string, { id: string; title: string; content_type: string; thumbnail_url: string | null }> = {};
    if (blueprint?.content_refs && Array.isArray(blueprint.content_refs) && blueprint.content_refs.length > 0) {
      const contentIds = blueprint.content_refs.map((ref: { content_item_id: string }) => ref.content_item_id);
      const { data: items } = await supabase
        .from('el_content_items')
        .select('id, title, content_type, thumbnail_url')
        .in('id', contentIds);

      if (items) {
        for (const item of items) {
          contentItems[item.id] = item;
        }
      }
    }

    // Generate activity tokens for each participant (for typed response links)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000';
    const activityLinks: Record<string, { token: string; url: string; childName: string }> = {};

    for (const p of participants || []) {
      if (p.child_id) {
        const childObj = p.child as { name: string } | null;
        const childName = childObj?.name || 'Student';
        const token = generateActivityToken(sessionId, p.id, p.child_id, childName);
        activityLinks[p.child_id] = {
          token,
          url: `${baseUrl}/classes/activity/${sessionId}?token=${token}`,
          childName,
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'instructor_session_get_success',
      sessionId,
      hasBlueprint: !!blueprint,
      participantCount: participants?.length || 0,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      session,
      blueprint,
      participants: participants || [],
      contentItems,
      activityLinks,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'instructor_session_get_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
