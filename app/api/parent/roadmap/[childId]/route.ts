// ============================================================
// FILE: app/api/parent/roadmap/[childId]/route.ts
// PURPOSE: Parent roadmap view — season progress + session timeline
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Parent-friendly skill translations
const SKILL_LABELS: Record<string, string> = {
  phonemic_awareness: 'Sound Skills',
  phonics: 'Letter Sounds',
  decoding: 'Word Reading',
  fluency: 'Reading Speed',
  vocabulary: 'Word Power',
  comprehension: 'Understanding Stories',
  grammar: 'Language Skills',
  writing: 'Writing',
  confidence: 'Reading Confidence',
  expression: 'Reading with Feeling',
  listening: 'Listening Skills',
  sight_words: 'Sight Words',
  blending: 'Word Building',
  rhyming: 'Rhyming',
  prosody: 'Reading with Feeling',
  stamina: 'Reading Stamina',
};

function friendlySkill(skill: string): string {
  return SKILL_LABELS[skill] || skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const supabase = getServiceSupabase();

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id, parent_email')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Validate ownership: check parent_email matches auth user
    if (child.parent_email !== auth.email) {
      // Also check parent_id
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Get active enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, total_sessions, status, age_band, session_duration_minutes, coach_id, coaches!coach_id(id, name)')
      .eq('child_id', childId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get all roadmaps for this child (current + future seasons)
    const { data: roadmaps } = await supabase
      .from('season_roadmaps')
      .select('*')
      .eq('child_id', childId)
      .order('season_number', { ascending: true });

    // Find active roadmap
    const activeRoadmap = roadmaps?.find(r => r.status === 'active') ||
      roadmaps?.find(r => r.status === 'draft') ||
      null;

    let planItems: any[] = [];
    if (activeRoadmap) {
      // Get plan items with template titles
      const { data: plans } = await supabase
        .from('season_learning_plans')
        .select(`
          id, week_number, session_template_id, skill_focus,
          status
        `)
        .eq('season_roadmap_id', activeRoadmap.id)
        .order('week_number', { ascending: true });

      if (plans && plans.length > 0) {
        // Get template details
        const templateIds = plans.map(p => p.session_template_id).filter((id): id is string => !!id);
        let templatesMap: Record<string, any> = {};
        if (templateIds.length > 0) {
          const { data: templates } = await supabase
            .from('session_templates')
            .select('id, template_code, title, skill_dimensions, duration_minutes, is_season_finale')
            .in('id', templateIds);
          if (templates) {
            templatesMap = Object.fromEntries(templates.map(t => [t.id, t]));
          }
        }

        planItems = plans.map(p => {
          const template = p.session_template_id ? templatesMap[p.session_template_id] : null;
          return {
            id: p.id,
            session_number: p.week_number,
            title: template?.title || 'Session',
            template_code: template?.template_code || null,
            skills: (template?.skill_dimensions || []).map(friendlySkill),
            duration_minutes: template?.duration_minutes || null,
            is_finale: template?.is_season_finale || false,
            status: p.status,
          };
        });
      }
    }

    // Get completed session count
    const { count: completedCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed');

    // Get next upcoming session with template details
    const today = new Date().toISOString().split('T')[0];
    const { data: nextSession } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, session_number, scheduled_date, scheduled_time,
        google_meet_link, session_template_id, duration_minutes,
        status, is_diagnostic
      `)
      .eq('child_id', childId)
      .gte('scheduled_date', today)
      .in('status', ['scheduled', 'rescheduled', 'confirmed', 'pending'])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    let nextSessionData = null;
    if (nextSession) {
      let templateTitle = null;
      if (nextSession.session_template_id) {
        const { data: template } = await supabase
          .from('session_templates')
          .select('title, template_code')
          .eq('id', nextSession.session_template_id)
          .single();
        templateTitle = template?.title;
      }

      const coachName = enrollment?.coaches ? (enrollment.coaches as any).name : null;

      nextSessionData = {
        id: nextSession.id,
        session_number: nextSession.session_number,
        date: nextSession.scheduled_date,
        time: nextSession.scheduled_time,
        google_meet_link: nextSession.google_meet_link,
        template_title: templateTitle,
        duration_minutes: nextSession.duration_minutes,
        is_diagnostic: nextSession.is_diagnostic,
        coach_name: coachName,
      };
    }

    // Get last 3 session summaries from learning_events
    const { data: recentSummaries } = await supabase
      .from('learning_events')
      .select('id, event_type, event_data, ai_summary, created_at')
      .eq('child_id', childId)
      .eq('event_type', 'session')
      .order('created_at', { ascending: false })
      .limit(3);

    const sessionSummaries = (recentSummaries || []).map(e => ({
      id: e.id,
      session_number: (e.event_data as any)?.session_number || null,
      focus: friendlySkill((e.event_data as any)?.focus_area || ''),
      highlights: (e.event_data as any)?.highlights || [],
      progress: (e.event_data as any)?.progress_rating || null,
      summary: e.ai_summary || null,
      date: e.created_at,
    }));

    // Future seasons (locked)
    const futureSeasons = (roadmaps || [])
      .filter(r => r.id !== activeRoadmap?.id && r.season_number > (activeRoadmap?.season_number || 0))
      .map(r => ({
        season_number: r.season_number,
        season_name: r.season_name || `Season ${r.season_number}`,
        status: r.status,
      }));

    return NextResponse.json({
      success: true,
      child: {
        id: child.id,
        name: child.child_name || child.name,
        age: child.age,
        age_band: child.age_band,
      },
      roadmap: activeRoadmap ? {
        id: activeRoadmap.id,
        season_number: activeRoadmap.season_number,
        season_name: activeRoadmap.season_name || `Season ${activeRoadmap.season_number}`,
        status: activeRoadmap.status,
        focus_areas: activeRoadmap.focus_area ? [friendlySkill(activeRoadmap.focus_area)] : [],
        milestone_description: activeRoadmap.milestone_description || null,
        total_planned_sessions: activeRoadmap.estimated_sessions || planItems.length,
      } : null,
      plan_items: planItems,
      completed_count: completedCount || 0,
      total_sessions: enrollment?.total_sessions || planItems.length || 9,
      next_session: nextSessionData,
      recent_summaries: sessionSummaries,
      future_seasons: futureSeasons,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_roadmap_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
