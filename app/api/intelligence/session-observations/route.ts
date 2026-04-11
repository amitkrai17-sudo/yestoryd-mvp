// ============================================================
// GET /api/intelligence/session-observations?sessionId=...
// Returns observation chips for MicroNotePanel based on session's
// planned skills. Fallback: child's recent struggle areas.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface ObservationChip {
  id: string;
  text: string;
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

    // 1. Get session + template skill_dimensions
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, session_template_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ strengths: [], struggles: [] });
    }

    let skillIds: string[] = [];

    // 2a. Try template's skill_dimensions → resolve to skill IDs
    if (session.session_template_id) {
      const { data: template } = await supabase
        .from('session_templates')
        .select('skill_dimensions')
        .eq('id', session.session_template_id)
        .single();

      if (template?.skill_dimensions?.length) {
        const { data: skills } = await supabase
          .from('el_skills')
          .select('id')
          .in('skill_tag', template.skill_dimensions)
          .eq('is_active', true);

        if (skills?.length) {
          skillIds = skills.map(s => s.id);
        }
      }
    }

    // 2b. Fallback: child's recent struggle areas from learning_events
    if (skillIds.length === 0 && session.child_id) {
      const { data: recentEvents } = await supabase
        .from('learning_events')
        .select('event_data')
        .eq('child_id', session.child_id)
        .eq('event_type', 'structured_capture')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentEvents?.length) {
        const recentSkillTags = new Set<string>();
        for (const ev of recentEvents) {
          const data = ev.event_data as Record<string, any> | null;
          const skills = data?.skills_covered || data?.skills_worked_on;
          if (Array.isArray(skills)) {
            for (const s of skills) recentSkillTags.add(typeof s === 'string' ? s : s.id || s.skillId);
          }
        }

        if (recentSkillTags.size > 0) {
          // Try matching as UUIDs first, then as skill_tags
          const tagArray = Array.from(recentSkillTags).slice(0, 5);
          const { data: skillsById } = await supabase
            .from('el_skills')
            .select('id')
            .in('id', tagArray)
            .eq('is_active', true);

          if (skillsById?.length) {
            skillIds = skillsById.map(s => s.id);
          } else {
            const { data: skillsByTag } = await supabase
              .from('el_skills')
              .select('id')
              .in('skill_tag', tagArray)
              .eq('is_active', true);
            if (skillsByTag?.length) {
              skillIds = skillsByTag.map(s => s.id);
            }
          }
        }
      }
    }

    // 2c. Last fallback: load top general observations (phonics, fluency, comprehension)
    if (skillIds.length === 0) {
      const { data: defaultSkills } = await supabase
        .from('el_skills')
        .select('id')
        .in('skill_tag', ['phonics', 'fluency', 'comprehension', 'vocabulary'])
        .eq('is_active', true);
      if (defaultSkills?.length) {
        skillIds = defaultSkills.map(s => s.id);
      }
    }

    if (skillIds.length === 0) {
      return NextResponse.json({ strengths: [], struggles: [] });
    }

    // 3. Fetch observations for these skills
    const { data: observations } = await supabase
      .from('el_skill_observations')
      .select('id, observation_text, observation_type')
      .in('skill_id', skillIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!observations?.length) {
      return NextResponse.json({ strengths: [], struggles: [] });
    }

    const strengths: ObservationChip[] = observations
      .filter(o => o.observation_type === 'strength')
      .slice(0, 8)
      .map(o => ({ id: o.id, text: o.observation_text }));

    const struggles: ObservationChip[] = observations
      .filter(o => o.observation_type === 'struggle')
      .slice(0, 8)
      .map(o => ({ id: o.id, text: o.observation_text }));

    return NextResponse.json({ strengths, struggles });
  } catch (err) {
    console.error('[session-observations] Error:', err);
    return NextResponse.json({ strengths: [], struggles: [] });
  }
}
