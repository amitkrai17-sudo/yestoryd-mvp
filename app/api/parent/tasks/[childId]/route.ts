// ============================================================
// FILE: app/api/parent/tasks/[childId]/route.ts
// PURPOSE: Get daily tasks for parent, track streaks
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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
      .select('id, child_name, name, parent_id, parent_email, current_streak, longest_streak, last_task_completed_date')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Get this week's tasks (Monday to Sunday)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get start of week (Monday)
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().split('T')[0];

    // Get end of week (Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = sunday.toISOString().split('T')[0];

    // Fetch ALL pending tasks (not just this week) for priority ordering
    const [pendingResult, completedResult] = await Promise.all([
      supabase
        .from('parent_daily_tasks')
        .select(`
          *,
          enrollment:enrollments(id, billing_model, enrollment_type),
          session:scheduled_sessions(id, scheduled_date, session_number),
          content_item:el_content_items(id, title, content_type, asset_url, asset_format, parent_instruction, thumbnail_url)
        `)
        .eq('child_id', childId)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('parent_daily_tasks')
        .select(`
          *,
          enrollment:enrollments(id, billing_model, enrollment_type),
          session:scheduled_sessions(id, scheduled_date, session_number),
          content_item:el_content_items(id, title, content_type, asset_url, asset_format, parent_instruction, thumbnail_url)
        `)
        .eq('child_id', childId)
        .eq('is_completed', true)
        .gte('completed_at', mondayStr)
        .order('completed_at', { ascending: false })
        .limit(10),
    ]);

    const allPending = pendingResult.data || [];
    const completedThisWeek = completedResult.data || [];

    // Priority sort: coach_assigned > ai_recommended > template_generated > system
    const SOURCE_PRIORITY: Record<string, number> = {
      coach_assigned: 1,
      ai_recommended: 2,
      template_generated: 3,
      system: 4,
      parent_summary: 4,
    };

    const sorted = allPending.sort((a, b) => {
      const pA = SOURCE_PRIORITY[a.source ?? ''] || 5;
      const pB = SOURCE_PRIORITY[b.source ?? ''] || 5;
      if (pA !== pB) return pA - pB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const MAX_VISIBLE = 3;
    const visibleActive = sorted.slice(0, MAX_VISIBLE);
    const hiddenCount = Math.max(0, sorted.length - MAX_VISIBLE);

    // Merge for week_tasks (backward compat) — visible active + completed this week
    const weekTasks = [...visibleActive, ...completedThisWeek];

    // Find today's task from visible active only
    const todayTask = visibleActive.find(t => t.task_date === todayStr) || null;

    // Stats
    const completedThisWeekCount = completedThisWeek.length;
    const totalThisWeek = visibleActive.length + completedThisWeekCount;

    // Streak info
    const currentStreak = child.current_streak || 0;
    const longestStreak = child.longest_streak || 0;

    // Skill translation for display
    const SKILL_LABELS: Record<string, string> = {
      phonics: 'Letter Sounds',
      phonemic_awareness: 'Sound Skills',
      decoding: 'Word Reading',
      fluency: 'Reading Speed',
      comprehension: 'Understanding Stories',
      grammar: 'Language Skills',
      writing: 'Writing',
      sight_words: 'Sight Words',
      vocabulary: 'Word Power',
      expression: 'Reading with Feeling',
      stamina: 'Reading Stamina',
      reading: 'Reading',
    };

    // Fetch intelligence profile for recommendation context
    let recommendationContext: Record<string, string> = {};
    try {
      const { data: profile } = await supabase
        .from('child_intelligence_profiles')
        .select('skill_ratings, narrative_profile')
        .eq('child_id', childId)
        .maybeSingle();

      if (profile?.skill_ratings) {
        const skillRatings = profile.skill_ratings as Record<string, { skillName?: string; rating?: string }>;
        for (const [key, val] of Object.entries(skillRatings)) {
          if (val.rating === 'struggling' || val.rating === 'developing') {
            const friendlyRating = val.rating === 'struggling' ? 'building' : 'growing';
            recommendationContext[key] = `Recommended because ${child.child_name || child.name} is ${friendlyRating} ${val.skillName || key} skills`;
          }
        }
      }
    } catch {
      // Non-fatal — intelligence context is optional
    }

    const enrichedTasks = (weekTasks || []).map(t => {
      // Find recommendation reason from intelligence profile
      let recommended_reason: string | null = null;
      if (t.linked_skill) {
        const matchKey = Object.keys(recommendationContext).find(k =>
          k.includes(t.linked_skill!) || (t.linked_skill!).includes(k)
        );
        if (matchKey) recommended_reason = recommendationContext[matchKey];
      }

      // Also check if task description already contains a recommendation reason
      if (!recommended_reason && t.description?.includes('Recommended because')) {
        const match = t.description.match(/\(Recommended because .+\)/);
        if (match) recommended_reason = match[0].replace(/[()]/g, '');
      }

      // Derive program label from enrollment
      const enrollmentData = t.enrollment as { id: string; billing_model: string; enrollment_type: string } | null;
      const sessionData = t.session as { id: string; scheduled_date: string; session_number: number } | null;
      const programLabel = enrollmentData?.enrollment_type === 'tuition'
        ? 'English Classes'
        : enrollmentData ? '1:1 Coaching' : null;

      return {
        ...t,
        skill_label: SKILL_LABELS[t.linked_skill ?? ''] || t.linked_skill,
        is_today: t.task_date === todayStr,
        is_past: t.task_date < todayStr,
        recommended_reason,
        program_label: programLabel,
        session_date: sessionData?.scheduled_date || null,
        session_number: sessionData?.session_number || null,
        source: t.source || 'template_generated',
      };
    });

    return NextResponse.json({
      success: true,
      child_name: child.child_name || child.name,
      today_task: todayTask
        ? enrichedTasks.find(t => t.id === todayTask.id) || null
        : null,
      week_tasks: enrichedTasks,
      stats: {
        completed_this_week: completedThisWeekCount,
        total_this_week: totalThisWeek,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        active_count: sorted.length,
        visible_count: visibleActive.length,
        hidden_count: hiddenCount,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_tasks_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
