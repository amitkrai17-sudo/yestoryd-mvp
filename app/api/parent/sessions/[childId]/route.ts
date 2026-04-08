// ============================================================
// FILE: app/api/parent/sessions/[childId]/route.ts
// PURPOSE: Parent-facing sessions list with insight summaries
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Friendly skill labels for focus_area
const FOCUS_LABELS: Record<string, string> = {
  phonics: 'phonics',
  phonemic_awareness: 'sound skills',
  decoding: 'word reading',
  fluency: 'reading fluency',
  comprehension: 'comprehension',
  grammar: 'grammar',
  writing: 'writing',
  sight_words: 'sight words',
  vocabulary: 'vocabulary',
  expression: 'reading expression',
  stamina: 'reading stamina',
  reading: 'reading',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
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

    // Fetch enrollment for total sessions + coach info
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('total_sessions, age_band, enrollment_type, coaches(id, name)')
      .eq('child_id', childId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let totalSessions = enrollment?.total_sessions || 0;
    if (!totalSessions && enrollment?.age_band) {
      const { data: bandRow } = await supabase
        .from('age_band_config')
        .select('sessions_per_season, skill_booster_credits')
        .eq('id', enrollment.age_band)
        .single();
      totalSessions = (bandRow?.sessions_per_season || 0) + (bandRow?.skill_booster_credits || 0);
    }

    const coachName = (enrollment?.coaches as any)?.name || null;

    // Fetch all sessions
    const { data: sessionsData } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, session_number, session_type, status,
        scheduled_date, scheduled_time, duration_minutes,
        google_meet_link, focus_area, is_diagnostic,
        title, session_template_id,
        session_templates:session_template_id(title)
      `)
      .eq('child_id', childId)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false });

    const sessions = sessionsData || [];

    // Fetch session notes for completed sessions (for insight lines)
    const completedIds = sessions
      .filter(s => s.status === 'completed')
      .map(s => s.id);

    let notesMap: Record<string, { highlights?: string; areas_to_improve?: string }> = {};

    if (completedIds.length > 0) {
      const { data: notes } = await supabase
        .from('session_notes')
        .select('session_id, highlights, areas_to_improve')
        .in('session_id', completedIds);

      if (notes) {
        for (const note of notes) {
          if (note.session_id) {
            notesMap[note.session_id] = {
              highlights: note.highlights ?? undefined,
              areas_to_improve: note.areas_to_improve ?? undefined,
            };
          }
        }
      }
    }

    // Enrich sessions with insights
    const enriched = sessions.map(s => {
      const templateTitle = (s.session_templates as any)?.title || null;
      const note = notesMap[s.id];

      // Build insight line from available data
      let insight: string | null = null;
      if (note?.highlights) {
        // Use first sentence of highlights
        insight = note.highlights.split(/[.!?\n]/)[0].trim();
        if (insight && !insight.endsWith('.')) insight += '';
      } else if (s.focus_area) {
        const friendly = FOCUS_LABELS[s.focus_area] || s.focus_area.replace(/_/g, ' ');
        insight = `Focused on ${friendly}`;
      } else if (templateTitle) {
        insight = templateTitle;
      }

      return {
        id: s.id,
        session_number: s.session_number,
        session_type: s.session_type,
        status: s.status,
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        duration_minutes: s.duration_minutes,
        google_meet_link: s.google_meet_link,
        focus_area: s.focus_area,
        is_diagnostic: s.is_diagnostic,
        title: s.title,
        template_title: templateTitle,
        insight,
      };
    });

    const completedCount = sessions.filter(s => s.status === 'completed').length;

    return NextResponse.json({
      success: true,
      child_name: child.child_name || child.name,
      coach_name: coachName,
      enrollment_type: enrollment?.enrollment_type || null,
      total_sessions: totalSessions,
      completed_count: completedCount,
      sessions: enriched,
    });
  } catch (error: any) {
    console.error('Parent sessions API error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
