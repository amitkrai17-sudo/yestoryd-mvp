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

    const { data: weekTasks } = await supabase
      .from('parent_daily_tasks')
      .select('*')
      .eq('child_id', childId)
      .gte('task_date', mondayStr)
      .lte('task_date', sundayStr)
      .order('task_date', { ascending: true });

    // Find today's task
    const todayTask = (weekTasks || []).find(t => t.task_date === todayStr) || null;

    // Completion stats
    const completedThisWeek = (weekTasks || []).filter(t => t.is_completed).length;
    const totalThisWeek = (weekTasks || []).length;

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

      return {
        ...t,
        skill_label: SKILL_LABELS[t.linked_skill ?? ''] || t.linked_skill,
        is_today: t.task_date === todayStr,
        is_past: t.task_date < todayStr,
        recommended_reason,
      };
    });

    return NextResponse.json({
      success: true,
      child_name: child.child_name || child.name,
      today_task: todayTask ? {
        ...todayTask,
        skill_label: SKILL_LABELS[todayTask.linked_skill ?? ''] || todayTask.linked_skill,
        recommended_reason: enrichedTasks.find(t => t.id === todayTask.id)?.recommended_reason || null,
      } : null,
      week_tasks: enrichedTasks,
      stats: {
        completed_this_week: completedThisWeek,
        total_this_week: totalThisWeek,
        current_streak: currentStreak,
        longest_streak: longestStreak,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_tasks_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
