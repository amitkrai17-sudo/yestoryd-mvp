// ============================================================
// FILE: app/api/group-classes/activity/responses/[sessionId]/route.ts
// ============================================================
// Instructor endpoint — returns typed responses for a session
// Polled every 5 seconds by the instructor console
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { sessionId } = await context.params;

    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Verify session exists and instructor is assigned
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, instructor_id, coach_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (auth.role !== 'admin') {
      const isAssigned = session.instructor_id === auth.coachId || session.coach_id === auth.coachId;
      if (!isAssigned) {
        return NextResponse.json({ error: 'Not assigned to this session' }, { status: 403 });
      }
    }

    // Get total participant count
    const { count: totalParticipants } = await supabase
      .from('group_session_participants')
      .select('id', { count: 'exact', head: true })
      .eq('group_session_id', sessionId)
      .neq('attendance_status', 'cancelled');

    // Get responses from learning_events
    const { data: events } = await supabase
      .from('learning_events')
      .select(`
        id,
        child_id,
        event_data,
        event_date,
        created_at
      `)
      .eq('event_type', 'group_class_response')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Get child names for the responses
    const childIds = (events || []).map(e => e.child_id).filter((id): id is string => !!id);
    const childNames: Record<string, string> = {};
    if (childIds.length > 0) {
      const { data: children } = await supabase
        .from('children')
        .select('id, name')
        .in('id', childIds);

      if (children) {
        for (const child of children) {
          if (child.id && child.name) childNames[child.id] = child.name;
        }
      }
    }

    // Build response array
    const responses = (events || []).map(e => {
      const eventData = (typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data) as Record<string, unknown> | null;
      return {
        child_id: e.child_id,
        child_name: childNames[e.child_id] || 'Unknown',
        response_text: (eventData?.response_text as string) || '',
        submitted_at: e.created_at || e.event_date,
      };
    });

    return NextResponse.json({
      success: true,
      responses,
      total_participants: totalParticipants || 0,
      submitted_count: responses.length,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'activity_responses_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
