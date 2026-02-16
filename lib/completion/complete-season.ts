// ============================================================
// FILE: lib/completion/complete-season.ts
// PURPOSE: Season completion — metrics, roadmap close, next season preview
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
const getSupabase = createAdminClient;

// ============================================================
// Types
// ============================================================

export interface SeasonCompletionResult {
  success: boolean;
  enrollment_id?: string;
  season_number?: number;
  before_after?: Record<string, { before: string | null; after: string | null }>;
  stats?: {
    sessions_completed: number;
    sessions_total: number;
    completion_rate: number;
  };
  next_season_preview?: {
    season_number: number;
    season_name: string;
    focus_areas: string[];
  } | null;
  error?: string;
}

// Age band config for estimated seasons
const AGE_BAND_SEASONS: Record<string, number> = {
  foundation: 4, // 24 sessions × 4 = 96 sessions potential
  building: 3,   // 18 sessions × 3 = 54 sessions
  mastery: 2,    // 12 sessions × 2 = 24 sessions
};

// Season name templates for next season
const NEXT_SEASON_NAMES: Record<string, string[]> = {
  foundation: [
    'Sound Foundations',
    'Word Builders',
    'Reading Adventures',
    'Story Explorers',
  ],
  building: [
    'Fluency Foundations',
    'Comprehension Quest',
    'Reading Mastery',
  ],
  mastery: [
    'Critical Readers',
    'Literary Explorers',
  ],
};

// ============================================================
// Main Function
// ============================================================

export async function completeSeason(enrollmentId: string): Promise<SeasonCompletionResult> {
  try {
    const supabase = getSupabase();

    // 1. Get enrollment details
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, child_id, coach_id, total_sessions, season_number, age_band, status')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    if (enrollment.status === 'season_completed' || enrollment.status === 'completed') {
      return { success: false, error: 'Season already completed' };
    }

    const childId = enrollment.child_id;
    const seasonNumber = enrollment.season_number || 1;
    const ageBand = enrollment.age_band || 'building';

    // 2. Count completed sessions
    const { count: completedCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed');

    const sessionsCompleted = completedCount || 0;
    const sessionsTotal = enrollment.total_sessions || 9;
    const completionRate = sessionsTotal > 0 ? sessionsCompleted / sessionsTotal : 0;

    // 3. Get diagnostic data (Session 1 baseline)
    const { data: diagnosticEvent } = await supabase
      .from('learning_events')
      .select('event_data')
      .eq('child_id', childId)
      .eq('event_type', 'diagnostic_assessment')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // 4. Get exit assessment data (latest)
    const { data: exitEvent } = await supabase
      .from('learning_events')
      .select('event_data')
      .eq('child_id', childId)
      .eq('event_type', 'exit_assessment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Compute before/after deltas
    const diagnosticData = diagnosticEvent?.event_data?.diagnostic_data || {};
    const exitData = exitEvent?.event_data?.exit_data || exitEvent?.event_data?.diagnostic_data || {};

    const beforeAfter: Record<string, { before: string | null; after: string | null }> = {};

    // Compare key skill fields based on age band
    const skillFields = getSkillFields(ageBand);
    for (const field of skillFields) {
      const before = diagnosticData[field.key] || null;
      const after = exitData[field.key] || null;
      if (before !== null || after !== null) {
        beforeAfter[field.label] = {
          before: formatValue(before),
          after: formatValue(after),
        };
      }
    }

    // 6. Mark enrollment as season_completed
    await supabase
      .from('enrollments')
      .update({
        status: 'season_completed',
        season_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // 7. Mark active roadmap as completed
    const { data: roadmap } = await supabase
      .from('season_roadmaps')
      .select('id')
      .eq('child_id', childId)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roadmap) {
      await supabase
        .from('season_roadmaps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', roadmap.id);
    }

    // 8. Generate season completion learning event
    const completionEventData = {
      enrollment_id: enrollmentId,
      season_number: seasonNumber,
      age_band: ageBand,
      sessions_completed: sessionsCompleted,
      sessions_total: sessionsTotal,
      completion_rate: completionRate,
      before_after: beforeAfter,
      coach_id: enrollment.coach_id,
      completed_at: new Date().toISOString(),
      exit_data: exitData,
    };

    await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        coach_id: enrollment.coach_id,
        event_type: 'season_completion',
        event_date: new Date().toISOString(),
        event_data: completionEventData,
        data: completionEventData,
        content_for_embedding: `Season ${seasonNumber} completed for ${ageBand} program. ${sessionsCompleted}/${sessionsTotal} sessions (${Math.round(completionRate * 100)}%). Focus areas: ${Object.keys(beforeAfter).join(', ')}.`,
        created_by: 'system',
      });

    // 9. Generate next season preview (if applicable)
    let nextSeasonPreview = null;
    const maxSeasons = AGE_BAND_SEASONS[ageBand] || 3;

    if (seasonNumber < maxSeasons) {
      const nextSeasonNumber = seasonNumber + 1;

      // Determine next season name
      const nameOptions = NEXT_SEASON_NAMES[ageBand] || ['Next Season'];
      const nextName = nameOptions[nextSeasonNumber - 1] || `Season ${nextSeasonNumber}`;

      // Determine focus from exit assessment recommendations
      const nextFocus = exitData.recommended_next_focus ||
        exitData.areas_still_developing ||
        Object.keys(beforeAfter).slice(0, 3);

      // Create upcoming season roadmap entry
      await supabase
        .from('season_roadmaps')
        .insert({
          child_id: childId,
          enrollment_id: enrollmentId,
          season_number: nextSeasonNumber,
          age_band: ageBand,
          roadmap_data: {
            season_name: nextName,
            focus_areas: nextFocus,
            generated_from: 'season_completion',
            previous_season: seasonNumber,
          },
          generated_by: 'system',
          status: 'upcoming',
        });

      nextSeasonPreview = {
        season_number: nextSeasonNumber,
        season_name: nextName,
        focus_areas: nextFocus,
      };
    }

    // 10. Schedule re-enrollment nudges
    await scheduleNudges(supabase, childId, enrollmentId);

    console.log(JSON.stringify({
      event: 'season_completed',
      enrollmentId,
      childId,
      seasonNumber,
      sessionsCompleted,
      completionRate: Math.round(completionRate * 100),
      hasNextSeason: !!nextSeasonPreview,
    }));

    return {
      success: true,
      enrollment_id: enrollmentId,
      season_number: seasonNumber,
      before_after: beforeAfter,
      stats: {
        sessions_completed: sessionsCompleted,
        sessions_total: sessionsTotal,
        completion_rate: completionRate,
      },
      next_season_preview: nextSeasonPreview,
    };
  } catch (error: any) {
    console.error('Season completion error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Helpers
// ============================================================

interface SkillFieldDef {
  key: string;
  label: string;
}

function getSkillFields(ageBand: string): SkillFieldDef[] {
  switch (ageBand) {
    case 'foundation':
      return [
        { key: 'letter_sounds_known', label: 'Letter Sounds' },
        { key: 'can_blend', label: 'Blending' },
        { key: 'rhyme_recognition', label: 'Rhyming' },
        { key: 'sight_words_known', label: 'Sight Words' },
        { key: 'listening_comprehension', label: 'Listening' },
        { key: 'confidence_level', label: 'Confidence' },
        { key: 'vocabulary', label: 'Vocabulary' },
      ];
    case 'building':
      return [
        { key: 'cvc_decode', label: 'CVC Decoding' },
        { key: 'oral_reading_fluency', label: 'Fluency' },
        { key: 'prosody', label: 'Prosody' },
        { key: 'literal_comprehension', label: 'Comprehension' },
        { key: 'sight_words_auto', label: 'Sight Words' },
        { key: 'writing_level', label: 'Writing' },
        { key: 'confidence_level', label: 'Confidence' },
      ];
    case 'mastery':
      return [
        { key: 'reading_level', label: 'Reading Level' },
        { key: 'evaluative_comprehension', label: 'Evaluative Comprehension' },
        { key: 'vocabulary_strategy', label: 'Vocabulary Strategy' },
        { key: 'prosody_engagement', label: 'Prosody' },
        { key: 'grammar_accuracy', label: 'Grammar' },
        { key: 'writing_composition', label: 'Writing' },
        { key: 'reading_stamina_minutes', label: 'Reading Stamina' },
        { key: 'confidence_level', label: 'Confidence' },
      ];
    default:
      return [
        { key: 'confidence_level', label: 'Confidence' },
      ];
  }
}

function formatValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.join(', ');
  return String(val).replace(/_/g, ' ');
}

async function scheduleNudges(
  supabase: any,
  childId: string,
  enrollmentId: string
): Promise<void> {
  const now = new Date();

  const nudges = [
    { nudge_number: 1, days: 1, channel: 'whatsapp' },
    { nudge_number: 2, days: 3, channel: 'whatsapp' },
    { nudge_number: 3, days: 7, channel: 'whatsapp' },
    { nudge_number: 4, days: 14, channel: 'whatsapp' },
  ];

  const rows = nudges.map(n => ({
    child_id: childId,
    enrollment_id: enrollmentId,
    nudge_number: n.nudge_number,
    scheduled_for: new Date(now.getTime() + n.days * 24 * 60 * 60 * 1000).toISOString(),
    channel: n.channel,
    status: 'pending',
  }));

  await supabase
    .from('re_enrollment_nudges')
    .insert(rows);
}
