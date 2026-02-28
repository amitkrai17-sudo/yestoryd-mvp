// ============================================================
// FILE: app/api/parent/report/[enrollmentId]/route.ts
// PURPOSE: Parent-facing season completion report (before/after)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getPricingConfig } from '@/lib/config/pricing-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { enrollmentId } = await params;
    const supabase = getServiceSupabase();

    // Get enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, child_id, coach_id, total_sessions, season_number, age_band, status, updated_at, created_at')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Get child + verify parent ownership
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id, parent_email')
      .eq('id', enrollment.child_id!)
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

    // Get season completion event
    const { data: completionEvent } = await supabase
      .from('learning_events')
      .select('event_data, created_at')
      .eq('child_id', child.id)
      .eq('event_type', 'season_completion')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const completionData = (completionEvent?.event_data as any) || {};

    // Get coach info
    let coachName = null;
    if (enrollment.coach_id) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('name')
        .eq('id', enrollment.coach_id)
        .maybeSingle();
      coachName = coach?.name || null;
    }

    // Get exit assessment for coach message
    const { data: exitEvent } = await supabase
      .from('learning_events')
      .select('event_data')
      .eq('child_id', child.id)
      .eq('event_type', 'exit_assessment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const exitData = (exitEvent?.event_data as any)?.exit_data || (exitEvent?.event_data as any) || {};

    // Get completed session count
    const { count: sessionsCompleted } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed');

    // Get next season preview (upcoming roadmap)
    const { data: nextRoadmap } = await supabase
      .from('season_roadmaps')
      .select('season_number, season_name, focus_area, milestone_description')
      .eq('child_id', child.id)
      .eq('status', 'upcoming')
      .order('season_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Build before/after from completion event or compute fresh
    const beforeAfter = completionData.before_after || {};

    // Format for parent display
    const skillGrowth = Object.entries(beforeAfter).map(([label, vals]: [string, any]) => ({
      skill: friendlySkill(label),
      before: vals.before || '--',
      after: vals.after || '--',
    }));

    const seasonNumber = enrollment.season_number || 1;
    const pricingConfig = await getPricingConfig();
    const ageBand = enrollment.age_band || child.age_band || 'building';
    const bandSessions = pricingConfig.ageBands.find(b => b.id === ageBand)?.sessionsPerSeason;
    const totalSessions = enrollment.total_sessions || bandSessions || 9;

    return NextResponse.json({
      success: true,
      child: {
        id: child.id,
        name: child.child_name || child.name,
        age: child.age,
        age_band: child.age_band || enrollment.age_band,
      },
      season: {
        number: seasonNumber,
        age_band: enrollment.age_band || child.age_band,
        sessions_completed: sessionsCompleted || completionData.sessions_completed || 0,
        sessions_total: totalSessions,
        completion_rate: completionData.completion_rate || (totalSessions > 0 ? (sessionsCompleted || 0) / totalSessions : 0),
        completed_at: enrollment.updated_at || completionEvent?.created_at,
        started_at: enrollment.created_at,
      },
      skill_growth: skillGrowth,
      coach: {
        name: coachName,
        notes: exitData.coach_notes_for_next_season || null,
        biggest_achievement: exitData.biggest_achievement || null,
        overall_progress: exitData.overall_progress || null,
        parent_engagement: exitData.parent_engagement_rating || null,
      },
      next_season: nextRoadmap ? {
        season_number: nextRoadmap.season_number,
        season_name: nextRoadmap.season_name || `Season ${nextRoadmap.season_number}`,
        focus_areas: nextRoadmap.focus_area ? [friendlySkill(nextRoadmap.focus_area)] : [],
        milestone: nextRoadmap.milestone_description || null,
      } : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_report_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
