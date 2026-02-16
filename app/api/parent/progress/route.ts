// ============================================================
// PARENT PROGRESS DASHBOARD API
// File: app/api/parent/progress/route.ts
// GET - Get child's progress data for visual dashboard
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// =====================================================
// GET - Get child's progress data
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');
    const timeRange = searchParams.get('range') || 'all'; // 'week', 'month', 'all'

    if (!childId) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(childId)) {
      return NextResponse.json({ error: 'Invalid child_id format' }, { status: 400 });
    }

    // Verify parent owns this child
    const { data: child, error: childError } = await supabase
      .from('children')
      .select(`
        id,
        child_name,
        age,
        parent_id,
        assigned_coach_id,
        learning_needs,
        primary_focus_area,
        latest_assessment_score,
        assessment_wpm,
        total_sessions,
        sessions_completed,
        coaches (
          id,
          name,
          photo_url
        )
      `)
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Check access (parent must own child, or be admin)
    if (auth.role !== 'admin') {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', auth.userId)
        .single();

      if (!parent || parent.id !== child.parent_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Calculate date range
    let startDate: Date | null = null;
    const now = new Date();
    
    if (timeRange === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeRange === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Get completed sessions with feedback
    let sessionsQuery = supabase
      .from('scheduled_sessions')
      .select(`
        id,
        session_number,
        scheduled_date,
        status,
        focus_area,
        progress_rating,
        engagement_level,
        confidence_level,
        skills_worked_on,
        skills_improved,
        skills_need_work,
        rating_overall,
        tldv_ai_summary
      `)
      .eq('child_id', childId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: true });

    if (startDate) {
      sessionsQuery = sessionsQuery.gte('scheduled_date', startDate.toISOString().split('T')[0]);
    }

    const { data: sessions } = await sessionsQuery;

    // Get learning events (assessments, achievements)
    let eventsQuery = supabase
      .from('learning_events')
      .select('event_type, event_data, created_at')
      .eq('child_id', childId)
      .in('event_type', ['assessment', 'skill_mastered', 'session_feedback', 'achievement'])
      .order('created_at', { ascending: true });

    if (startDate) {
      eventsQuery = eventsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: events } = await eventsQuery;

    // Calculate progress metrics
    const progressMetrics = calculateProgressMetrics(sessions || [], events || []);

    // Build chart data
    const chartData = buildChartData(sessions || [], events || []);

    // Get skill tag names
    const allSkills = new Set<string>();
    (sessions || []).forEach(s => {
      (s.skills_worked_on || []).forEach((skill: string) => allSkills.add(skill));
      (s.skills_improved || []).forEach((skill: string) => allSkills.add(skill));
      (s.skills_need_work || []).forEach((skill: string) => allSkills.add(skill));
    });

    const { data: skillTags } = await supabase
      .from('skill_tags_master')
      .select('tag_slug, tag_name, category')
      .in('tag_slug', Array.from(allSkills));

    const skillNameMap = Object.fromEntries(
      (skillTags || []).map(t => [t.tag_slug, t.tag_name])
    );

    // Get next scheduled session
    const { data: nextSession } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date, scheduled_time, session_type, google_meet_link')
      .eq('child_id', childId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      child: {
        id: child.id,
        name: child.child_name,
        age: child.age,
        coach: child.coaches,
        learning_needs: child.learning_needs,
        primary_focus: child.primary_focus_area,
        initial_score: child.latest_assessment_score,
        initial_wpm: child.assessment_wpm,
      },
      progress: {
        total_sessions: child.total_sessions || 0,
        completed_sessions: child.sessions_completed || sessions?.length || 0,
        completion_rate: child.total_sessions 
          ? Math.round(((child.sessions_completed || sessions?.length || 0) / child.total_sessions) * 100) 
          : 0,
        ...progressMetrics,
      },
      charts: chartData,
      skill_names: skillNameMap,
      recent_sessions: (sessions || []).slice(-5).reverse(),
      next_session: nextSession,
      time_range: timeRange,
    });

  } catch (error) {
    console.error('Progress GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// Helper: Calculate progress metrics
// =====================================================
function calculateProgressMetrics(sessions: any[], events: any[]) {
  if (sessions.length === 0) {
    return {
      skills_mastered: [],
      skills_in_progress: [],
      skills_need_work: [],
      engagement_trend: 'stable' as const,
      overall_trend: 'stable' as const,
      average_rating: null,
      latest_rating: null,
    };
  }

  // Count skill occurrences
  const skillCounts = {
    improved: {} as Record<string, number>,
    worked: {} as Record<string, number>,
    needWork: {} as Record<string, number>,
  };

  const ratings: number[] = [];
  const engagementScores: number[] = [];

  for (const session of sessions) {
    // Skills
    (session.skills_improved || []).forEach((s: string) => {
      skillCounts.improved[s] = (skillCounts.improved[s] || 0) + 1;
    });
    (session.skills_worked_on || []).forEach((s: string) => {
      skillCounts.worked[s] = (skillCounts.worked[s] || 0) + 1;
    });
    (session.skills_need_work || []).forEach((s: string) => {
      skillCounts.needWork[s] = (skillCounts.needWork[s] || 0) + 1;
    });

    // Ratings
    if (session.rating_overall) ratings.push(session.rating_overall);
    
    // Engagement
    const engMap = { high: 3, medium: 2, low: 1 };
    if (session.engagement_level) {
      engagementScores.push(engMap[session.engagement_level as keyof typeof engMap] || 2);
    }
  }

  // Skills mastered = improved 3+ times and not in needWork recently
  const skillsMastered = Object.entries(skillCounts.improved)
    .filter(([skill, count]) => count >= 3 && !skillCounts.needWork[skill])
    .map(([skill]) => skill);

  // Skills in progress = worked on but not mastered or needing work
  const skillsInProgress = Object.keys(skillCounts.worked)
    .filter(s => !skillsMastered.includes(s) && !skillCounts.needWork[s]);

  // Skills need work = flagged in recent sessions
  const recentSessions = sessions.slice(-3);
  const skillsNeedWork = Array.from(new Set(recentSessions.flatMap(s => s.skills_need_work || [])));

  // Calculate trends
  const engagementTrend = calculateTrend(engagementScores);
  const ratingTrend = calculateTrend(ratings);

  return {
    skills_mastered: skillsMastered,
    skills_in_progress: skillsInProgress,
    skills_need_work: skillsNeedWork,
    engagement_trend: engagementTrend,
    overall_trend: ratingTrend,
    average_rating: ratings.length > 0 
      ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 
      : null,
    latest_rating: ratings.length > 0 ? ratings[ratings.length - 1] : null,
  };
}

// =====================================================
// Helper: Calculate trend from array of scores
// =====================================================
function calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
  if (scores.length < 3) return 'stable';

  const recent = scores.slice(-3);
  const older = scores.slice(-6, -3);

  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  if (recentAvg > olderAvg + 0.3) return 'improving';
  if (recentAvg < olderAvg - 0.3) return 'declining';
  return 'stable';
}

// =====================================================
// Helper: Build chart data for recharts
// =====================================================
function buildChartData(sessions: any[], events: any[]) {
  // Session progress over time
  const sessionProgress = sessions.map((s, index) => ({
    session: s.session_number || index + 1,
    date: s.scheduled_date,
    rating: s.rating_overall || null,
    engagement: s.engagement_level === 'high' ? 3 : s.engagement_level === 'medium' ? 2 : 1,
    confidence: s.confidence_level || null,
  }));

  // Skills worked on over time
  const skillsOverTime: Record<string, number[]> = {};
  sessions.forEach((s, index) => {
    const allSkills = [...(s.skills_worked_on || []), ...(s.skills_improved || [])];
    allSkills.forEach(skill => {
      if (!skillsOverTime[skill]) skillsOverTime[skill] = [];
      skillsOverTime[skill].push(index + 1);
    });
  });

  // Assessment scores over time
  const assessmentScores = events
    .filter(e => e.event_type === 'assessment' && e.event_data)
    .map(e => ({
      date: e.created_at.split('T')[0],
      score: e.event_data.overall_score || e.event_data.score,
      wpm: e.event_data.wpm,
      clarity: e.event_data.clarity_score,
      fluency: e.event_data.fluency_score,
    }));

  // Progress milestones
  const milestones = events
    .filter(e => e.event_type === 'skill_mastered' || e.event_type === 'achievement')
    .map(e => ({
      date: e.created_at.split('T')[0],
      type: e.event_type,
      skill: e.event_data?.skill || e.event_data?.achievement,
      description: e.event_data?.description || '',
    }));

  // Engagement distribution
  const engagementCounts = { high: 0, medium: 0, low: 0 };
  sessions.forEach(s => {
    if (s.engagement_level) {
      engagementCounts[s.engagement_level as keyof typeof engagementCounts]++;
    }
  });

  return {
    session_progress: sessionProgress,
    skills_timeline: Object.entries(skillsOverTime).map(([skill, sessions]) => ({
      skill,
      sessions_count: sessions.length,
      first_session: Math.min(...sessions),
      last_session: Math.max(...sessions),
    })),
    assessment_scores: assessmentScores,
    milestones,
    engagement_distribution: [
      { name: 'High', value: engagementCounts.high, color: '#22c55e' },
      { name: 'Medium', value: engagementCounts.medium, color: '#eab308' },
      { name: 'Low', value: engagementCounts.low, color: '#ef4444' },
    ],
  };
}
