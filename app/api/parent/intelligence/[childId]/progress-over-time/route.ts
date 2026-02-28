// ============================================================
// FILE: app/api/parent/intelligence/[childId]/progress-over-time/route.ts
// PURPOSE: Intelligence score trend over time for parent charts
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
      .select('id, child_name, name, parent_id, parent_email')
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

    // Last 90 days of structured captures
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: captures } = await supabase
      .from('structured_capture_responses')
      .select('session_date, intelligence_score, session_modality, skill_performances')
      .eq('child_id', childId)
      .gte('session_date', ninetyDaysAgo)
      .not('intelligence_score', 'is', null)
      .order('session_date', { ascending: true });

    if (!captures || captures.length === 0) {
      return NextResponse.json({
        success: true,
        child_name: child.child_name || child.name,
        weekly_trend: [],
        skill_progression: [],
        message: 'Not enough data yet — complete more sessions to see trends',
      });
    }

    // Group by ISO week
    const weekGroups = new Map<string, {
      scores: number[];
      modalities: Set<string>;
      skillRatings: Map<string, string[]>;
    }>();

    for (const cap of captures) {
      const date = new Date(cap.session_date);
      const week = getISOWeek(date);

      if (!weekGroups.has(week)) {
        weekGroups.set(week, { scores: [], modalities: new Set(), skillRatings: new Map() });
      }

      const group = weekGroups.get(week)!;
      group.scores.push(cap.intelligence_score as number);
      if (cap.session_modality) group.modalities.add(cap.session_modality);

      // Track skill ratings over time
      const performances = (cap.skill_performances || []) as Array<{
        skillId?: string;
        skill_name?: string;
        skillName?: string;
        rating?: string;
      }>;
      for (const perf of performances) {
        const name = perf.skill_name || perf.skillName || perf.skillId || 'Unknown';
        if (!group.skillRatings.has(name)) group.skillRatings.set(name, []);
        if (perf.rating) group.skillRatings.get(name)!.push(perf.rating);
      }
    }

    // Build weekly trend
    const weeklyTrend = Array.from(weekGroups.entries())
      .map(([week, data]) => ({
        week,
        avg_score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        session_count: data.scores.length,
        modalities: Array.from(data.modalities),
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Build skill progression — top 5 most-observed skills
    const allSkillOccurrences = new Map<string, number>();
    for (const [, data] of Array.from(weekGroups.entries())) {
      for (const [skill] of Array.from(data.skillRatings.entries())) {
        allSkillOccurrences.set(skill, (allSkillOccurrences.get(skill) || 0) + 1);
      }
    }

    const topSkills = Array.from(allSkillOccurrences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);

    const ratingToNum: Record<string, number> = { struggling: 1, developing: 2, proficient: 3, advanced: 4 };

    const skillProgression = topSkills.map(skill => {
      const progression = Array.from(weekGroups.entries())
        .filter(([, data]) => data.skillRatings.has(skill))
        .map(([week, data]) => {
          const ratings = data.skillRatings.get(skill)!;
          const avgNum = ratings.reduce((sum, r) => sum + (ratingToNum[r] || 2), 0) / ratings.length;
          return { week, rating_numeric: Math.round(avgNum * 10) / 10 };
        })
        .sort((a, b) => a.week.localeCompare(b.week));

      return { skill_name: skill, progression };
    });

    return NextResponse.json({
      success: true,
      child_name: child.child_name || child.name,
      weekly_trend: weeklyTrend,
      skill_progression: skillProgression,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_progress_over_time_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Get ISO week string like "2026-W08" */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
