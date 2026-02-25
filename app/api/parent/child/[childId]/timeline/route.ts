// ============================================================
// FILE: app/api/parent/child/[childId]/timeline/route.ts
// ============================================================
// Unified child timeline — all touchpoints in one chronological
// view: coaching sessions, group classes, assessments, etc.
// Paginated with offset/limit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PARENT_VISIBLE_EVENT_TYPES = [
  'session',
  'diagnostic_assessment',
  'group_class_observation',
  'group_class_micro_insight',
  'group_class_response',
  'progress_pulse',
  'parent_session_summary',
  'assessment',
  'nps_feedback',
];

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  title: string;
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

function buildEventTitle(eventType: string, eventData: Record<string, unknown> | null): string {
  switch (eventType) {
    case 'session':
      return `Coaching Session${eventData?.session_number ? ` #${eventData.session_number}` : ''}`;
    case 'diagnostic_assessment':
      return 'Diagnostic Assessment';
    case 'assessment':
      return 'Reading Assessment';
    case 'group_class_observation':
      return `${(eventData?.class_type_name as string) || 'Group Class'}`;
    case 'group_class_micro_insight':
      return `${(eventData?.class_type_name as string) || 'Group Class'} — Insight`;
    case 'group_class_response':
      return `${(eventData?.class_type_name as string) || 'Group Class'} — Response`;
    case 'progress_pulse':
      return 'Progress Report';
    case 'parent_session_summary':
      return 'Session Summary';
    case 'nps_feedback':
      return 'Feedback Submitted';
    default:
      return eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

function extractDetails(eventType: string, eventData: Record<string, unknown> | null, aiSummary: string | null): Record<string, unknown> {
  if (!eventData) return {};

  switch (eventType) {
    case 'session':
      return {
        focus_area: eventData.focus_area || null,
        engagement_level: eventData.engagement_level || null,
        key_observations: eventData.key_observations || [],
        progress_rating: eventData.progress_rating || null,
        breakthrough_moment: eventData.breakthrough_moment || null,
      };
    case 'group_class_observation':
      return {
        class_type_name: eventData.class_type_name || null,
        engagement_level: eventData.engagement_level || null,
        skill_tags: eventData.skill_tags || [],
        instructor_notes: eventData.instructor_notes || null,
      };
    case 'group_class_micro_insight':
      return {
        insight_text: eventData.insight_text || null,
        badges_earned: eventData.badges_earned || [],
        is_enrolled: eventData.is_enrolled || false,
        cta_type: eventData.cta_type || null,
        attendance_count: eventData.attendance_count || 0,
      };
    case 'group_class_response':
      return {
        class_type_name: eventData.class_type_name || null,
        response_text: eventData.response_text || null,
        prompt: eventData.prompt || null,
      };
    case 'assessment':
    case 'diagnostic_assessment':
      return {
        score: eventData.score || null,
        wpm: eventData.wpm || null,
        fluency: eventData.fluency || null,
        reading_age: eventData.reading_age || null,
        summary: aiSummary || eventData.summary || null,
      };
    case 'progress_pulse':
      return {
        headline: eventData.headline || null,
        parent_summary: eventData.parent_summary || null,
        overall_progress: eventData.overall_progress || null,
        strengths: eventData.strengths || [],
        focus_areas: eventData.focus_areas || [],
      };
    case 'parent_session_summary':
      return {
        summary: aiSummary || eventData.summary || null,
        highlights: eventData.highlights || [],
      };
    default:
      return { summary: aiSummary };
  }
}

type RouteContext = { params: Promise<{ childId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { childId } = await context.params;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(childId)) {
      return NextResponse.json({ error: 'Invalid child ID' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', auth.email ?? '')
      .maybeSingle();

    if (!parent || parent.id !== child.parent_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Count total
    const { count: totalCount } = await supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .in('event_type', PARENT_VISIBLE_EVENT_TYPES);

    // Fetch events
    const { data: events } = await supabase
      .from('learning_events')
      .select('id, event_type, event_date, event_data, ai_summary, created_at')
      .eq('child_id', childId)
      .in('event_type', PARENT_VISIBLE_EVENT_TYPES)
      .order('event_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const timelineEvents: TimelineEvent[] = (events || []).map(e => {
      const eventData = e.event_data as Record<string, unknown> | null;
      return {
        id: e.id,
        event_type: e.event_type,
        event_date: e.event_date,
        title: buildEventTitle(e.event_type, eventData),
        summary: e.ai_summary || null,
        details: extractDetails(e.event_type, eventData, e.ai_summary),
        created_at: e.created_at,
      };
    });

    const total = totalCount || 0;

    return NextResponse.json({
      events: timelineEvents,
      total_count: total,
      has_more: offset + limit < total,
      offset,
      limit,
    });

  } catch (error: unknown) {
    console.error('[parent/child/timeline] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
