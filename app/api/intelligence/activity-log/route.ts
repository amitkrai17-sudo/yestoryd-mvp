// ============================================================
// GET /api/intelligence/activity-log?sessionId=...
// Returns companion panel activity data formatted for SCF pre-fill.
// Maps skill-tagged activities to observation IDs for deterministic linking.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface ActivityLogPreFill {
  skillsCovered: string[];
  suggestedStrengths: string[];
  suggestedStruggles: string[];
  customStrengthNote: string;
  customStruggleNote: string;
  engagementLevel: string;
  activitySummary: string;
  activityCount: number;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // 1. Fetch activity logs for this session
    const { data: activities, error } = await supabase
      .from('session_activity_log')
      .select('activity_name, activity_purpose, status, coach_note, skill_id')
      .eq('session_id', sessionId)
      .order('activity_index', { ascending: true });

    if (error || !activities?.length) {
      return NextResponse.json({ data: null });
    }

    const completed = activities.filter(a => a.status === 'completed');
    const struggled = activities.filter(a => a.status === 'struggled');
    const partial = activities.filter(a => a.status === 'partial');

    // 2. Collect unique skill IDs from tagged activities
    const completedSkillIds = Array.from(new Set(completed.map(a => a.skill_id).filter(Boolean))) as string[];
    const struggledSkillIds = Array.from(new Set(struggled.map(a => a.skill_id).filter(Boolean))) as string[];
    const allSkillIds = Array.from(new Set(completedSkillIds.concat(struggledSkillIds)));

    // 3. Query matching observations for skill-tagged activities
    let suggestedStrengths: string[] = [];
    let suggestedStruggles: string[] = [];

    if (allSkillIds.length > 0) {
      const { data: observations } = await supabase
        .from('el_skill_observations')
        .select('id, skill_id, observation_type')
        .in('skill_id', allSkillIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (observations) {
        // Top 3 strength observations for completed-skill activities
        suggestedStrengths = observations
          .filter(o => o.observation_type === 'strength' && completedSkillIds.includes(o.skill_id))
          .slice(0, 3)
          .map(o => o.id);

        // Top 3 struggle observations for struggled-skill activities
        suggestedStruggles = observations
          .filter(o => o.observation_type === 'struggle' && struggledSkillIds.includes(o.skill_id))
          .slice(0, 3)
          .map(o => o.id);
      }
    }

    // 4. Build note summaries
    const completedNames = completed.map(a => a.activity_name);
    const struggledNames = struggled.map(a => a.activity_name);
    const allNotes = activities
      .filter(a => a.coach_note)
      .map(a => `${a.activity_name}: ${a.coach_note}`)
      .join('. ');

    const customStrengthNote = completedNames.length > 0
      ? `Completed: ${completedNames.join(', ')}${allNotes ? '. ' + allNotes : ''}`
      : '';
    const customStruggleNote = struggledNames.length > 0
      ? `Struggled: ${struggledNames.join(', ')}`
      : '';

    // 5. Derive engagement from completion ratio
    const completionRatio = completed.length / activities.length;
    const engagementLevel = completionRatio > 0.7 ? 'high'
      : completionRatio > 0.4 ? 'moderate'
      : 'low';

    const activitySummary = `${activities.length} activities: ${completed.length} completed${
      struggled.length ? `, ${struggled.length} struggled` : ''
    }${partial.length ? `, ${partial.length} partial` : ''
    }${activities.length - completed.length - struggled.length - partial.length > 0
      ? `, ${activities.length - completed.length - struggled.length - partial.length} skipped`
      : ''}`;

    const result: ActivityLogPreFill = {
      skillsCovered: completedSkillIds,
      suggestedStrengths,
      suggestedStruggles,
      customStrengthNote,
      customStruggleNote,
      engagementLevel,
      activitySummary,
      activityCount: activities.length,
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[activity-log] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
