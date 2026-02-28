// ============================================================
// FILE: app/api/coach/sessions/[id]/brief/route.ts
// PURPOSE: Pre-session brief — template context + child history
//          Post-session: activity logs, coach notes, parent summary
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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

    const { id } = await params;
    const supabase = getServiceSupabase();

    // 1. Get session details (including companion panel fields)
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, enrollment_id,
        session_type, session_number, session_title,
        is_diagnostic, session_template_id, duration_minutes,
        scheduled_date, scheduled_time, status,
        google_meet_link, companion_panel_completed, parent_summary
      `)
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.child_id) {
      return NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 });
    }

    // 2. Get child details
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band, parent_name, parent_email, latest_assessment_score')
      .eq('id', session.child_id)
      .single();

    // Fetch learning_profile separately (column may not exist until migration applied)
    let learningProfile: any = null;
    try {
      const { data: profileRow } = await supabase
        .from('children')
        .select('learning_profile')
        .eq('id', session.child_id)
        .single();
      learningProfile = profileRow?.learning_profile || null;
    } catch {
      // Column doesn't exist yet — that's fine
    }

    // Fetch intelligence profile (UIP)
    let intelligenceProfile: any = null;
    try {
      const { data: uipRow } = await supabase
        .from('child_intelligence_profiles')
        .select('skill_ratings, narrative_profile, overall_reading_level, overall_confidence, freshness_status, modality_coverage, last_high_confidence_signal_at')
        .eq('child_id', session.child_id)
        .maybeSingle();

      if (uipRow && uipRow.freshness_status) {
        const skillRatings = (uipRow.skill_ratings || {}) as Record<string, { rating?: string; skillName?: string; confidence?: string; trend?: string }>;
        const sortedSkills = Object.values(skillRatings)
          .sort((a, b) => {
            const order: Record<string, number> = { advanced: 0, proficient: 1, developing: 2, struggling: 3 };
            return (order[a.rating || ''] ?? 4) - (order[b.rating || ''] ?? 4);
          });
        const topStrengths = sortedSkills
          .filter(s => s.rating === 'advanced' || s.rating === 'proficient')
          .slice(0, 5)
          .map(s => ({ skill: s.skillName, rating: s.rating, confidence: s.confidence }));
        const topStruggles = sortedSkills
          .filter(s => s.rating === 'struggling' || s.rating === 'developing')
          .slice(0, 5)
          .map(s => ({ skill: s.skillName, rating: s.rating, confidence: s.confidence }));

        const narrativeProfile = uipRow.narrative_profile as { summary?: string } | null;

        intelligenceProfile = {
          overall_reading_level: uipRow.overall_reading_level,
          overall_confidence: uipRow.overall_confidence,
          freshness_status: uipRow.freshness_status,
          last_high_confidence_signal_at: uipRow.last_high_confidence_signal_at,
          modality_coverage: uipRow.modality_coverage,
          narrative_summary: narrativeProfile?.summary || null,
          top_strengths: topStrengths,
          top_struggles: topStruggles,
        };
      }
    } catch {
      // Non-fatal — intelligence profile may not exist
    }

    // 3. Get enrollment details (total_sessions)
    let totalSessions = 9;
    if (session.enrollment_id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('total_sessions, age_band, session_duration_minutes')
        .eq('id', session.enrollment_id)
        .single();
      if (enrollment?.total_sessions) totalSessions = enrollment.total_sessions;
    }

    // 4. Get template details if assigned
    let template = null;
    if (session.session_template_id) {
      const { data: t } = await supabase
        .from('session_templates')
        .select(`
          id, template_code, title, description,
          activity_flow, materials_needed, coach_prep_notes,
          parent_involvement, skill_dimensions, difficulty_level,
          duration_minutes, is_diagnostic
        `)
        .eq('id', session.session_template_id)
        .single();
      template = t;
    }

    // 5. Get last 2 learning events for this child (session summaries)
    const { data: recentEvents } = await supabase
      .from('learning_events')
      .select('id, event_type, event_data, ai_summary, created_at')
      .eq('child_id', session.child_id)
      .in('event_type', ['session', 'diagnostic_assessment'])
      .order('created_at', { ascending: false })
      .limit(2);

    // 5b. Get recent group class activity for this child (observations + micro-insights)
    const { data: groupClassEvents } = await supabase
      .from('learning_events')
      .select('id, event_type, event_date, event_data, ai_summary, created_at')
      .eq('child_id', session.child_id)
      .in('event_type', ['group_class_observation', 'group_class_micro_insight'])
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. Check if diagnostic was already completed
    let diagnosticCompleted = false;
    if (session.is_diagnostic) {
      const { data: diagEvent } = await supabase
        .from('learning_events')
        .select('id')
        .eq('child_id', session.child_id)
        .eq('event_type', 'diagnostic_assessment')
        .limit(1)
        .maybeSingle();
      diagnosticCompleted = !!diagEvent;
    }

    // 7. Post-completion data (only fetch if session is completed via companion panel)
    let activityLogs: any[] | null = null;
    let companionLogNotes: string | null = null;
    let nextSessionId: string | null = null;

    if (session.companion_panel_completed) {
      // Fetch activity logs
      const { data: logs } = await supabase
        .from('session_activity_log')
        .select('activity_index, activity_name, activity_purpose, status, coach_note, actual_duration_seconds')
        .eq('session_id', id)
        .order('activity_index', { ascending: true });

      activityLogs = logs || null;

      // Fetch companion log learning event for overall coach notes
      const { data: companionEvent } = await supabase
        .from('learning_events')
        .select('event_data')
        .eq('child_id', session.child_id)
        .eq('event_type', 'session_companion_log')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (companionEvent?.event_data) {
        const eventData = companionEvent.event_data as any;
        // Only use notes from the matching session
        if (eventData.session_id === id) {
          companionLogNotes = eventData.coach_notes || null;
        }
      }
    }

    // 7b. Parent content engagement (practice materials viewed since last session)
    let parentContentEngagement: { materials_assigned: number; materials_viewed: number; completion_rate: number } | null = null;
    try {
      // Find the previous session's date for this child
      let sinceDate: string | null = null;
      if (session.session_number && session.session_number > 1) {
        const { data: prevSession } = await supabase
          .from('scheduled_sessions')
          .select('scheduled_date')
          .eq('child_id', session.child_id)
          .eq('status', 'completed')
          .lt('session_number', session.session_number)
          .order('session_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        sinceDate = prevSession?.scheduled_date || null;
      }

      let query = supabase
        .from('learning_events')
        .select('event_data')
        .eq('child_id', session.child_id)
        .eq('event_type', 'parent_practice_assigned');

      if (sinceDate) {
        query = query.gte('event_date', sinceDate);
      }

      const { data: practiceEvents } = await query.order('created_at', { ascending: false }).limit(10);

      if (practiceEvents && practiceEvents.length > 0) {
        let totalAssigned = 0;
        let totalViewed = 0;
        for (const evt of practiceEvents) {
          const items = ((evt.event_data as any)?.items || []) as any[];
          totalAssigned += items.length;
          totalViewed += items.filter((i: any) => i.viewed_at).length;
        }
        parentContentEngagement = {
          materials_assigned: totalAssigned,
          materials_viewed: totalViewed,
          completion_rate: totalAssigned > 0 ? Math.round((totalViewed / totalAssigned) * 100) / 100 : 0,
        };
      }
    } catch {
      // Non-fatal — engagement data is optional
    }

    // 8. Find next scheduled session for this child (useful for completed + in_progress)
    if (session.status === 'completed' || session.status === 'in_progress') {
      const { data: nextSession } = await supabase
        .from('scheduled_sessions')
        .select('id')
        .eq('child_id', session.child_id)
        .eq('status', 'scheduled')
        .gt('session_number', session.session_number || 0)
        .order('session_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      nextSessionId = nextSession?.id || null;
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        child_id: session.child_id,
        session_number: session.session_number,
        session_type: session.session_type,
        is_diagnostic: session.is_diagnostic,
        duration_minutes: session.duration_minutes,
        scheduled_date: session.scheduled_date,
        scheduled_time: session.scheduled_time,
        status: session.status,
        google_meet_link: session.google_meet_link,
        total_sessions: totalSessions,
        companion_panel_completed: session.companion_panel_completed || false,
        parent_summary: session.parent_summary || null,
      },
      child: child ? { ...child, learning_profile: learningProfile, intelligence_profile: intelligenceProfile } : null,
      template: template || null,
      recent_sessions: (recentEvents || []).map(e => ({
        id: e.id,
        event_type: e.event_type,
        summary: e.ai_summary || null,
        data: e.event_data || null,
        created_at: e.created_at,
      })),
      diagnostic_completed: diagnosticCompleted,
      activity_logs: activityLogs,
      companion_log_notes: companionLogNotes,
      next_session_id: nextSessionId,
      parent_content_engagement: parentContentEngagement,
      group_class_activity: (groupClassEvents || []).map(e => ({
        id: e.id,
        event_type: e.event_type,
        event_date: e.event_date,
        summary: e.ai_summary || null,
        data: e.event_data || null,
        created_at: e.created_at,
      })),
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'session_brief_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
