// ============================================================
// FILE: lib/payment/coach-assigner.ts
// PURPOSE: Coach assignment with smart matching and fallback
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { loadCoachConfig } from '@/lib/config/loader';

const supabase = createAdminClient();

// --- Types ---

export interface CoachGroup {
  id: string;
  name: string;
  display_name: string;
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
  is_internal: boolean;
}

export interface CoachWithGroup {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tds_cumulative_fy: number;
  coach_groups: CoachGroup | CoachGroup[] | null;
}

// --- Functions ---

/**
 * Get Coach with smart matching and fallback
 * Priority: provided coachId > smart match (skill + load + rating) > default coach
 */
export async function getCoach(
  coachId: string | null | undefined,
  requestId: string
): Promise<CoachWithGroup> {
  // Try provided coachId first
  if (coachId) {
    const { data: coach } = await supabase
      .from('coaches')
      .select(`
        id, name, email, phone, tds_cumulative_fy,
        coach_groups (
          id, name, display_name,
          lead_cost_percent, coach_cost_percent, platform_fee_percent,
          is_internal
        )
      `)
      .eq('id', coachId)
      .single();

    if (coach) {
      console.log(JSON.stringify({ requestId, event: 'coach_found', coachId: coach.id }));
      return coach as unknown as CoachWithGroup;
    }
  }

  // Try smart matching before falling back to default
  try {
    const { data: allCoaches } = await supabase
      .from('coaches')
      .select(`
        id, name, email, phone, tds_cumulative_fy, skill_tags, avg_rating,
        total_sessions_completed, max_children, current_children,
        is_accepting_new, is_available,
        coach_groups (
          id, name, display_name,
          lead_cost_percent, coach_cost_percent, platform_fee_percent,
          is_internal
        )
      `)
      .eq('is_active', true)
      .eq('is_available', true)
      .eq('is_accepting_new', true);

    const eligible = (allCoaches || []).filter(
      (c: any) => (c.current_children || 0) < (c.max_children || 30)
    );

    if (eligible.length > 0) {
      // Fetch specializations for skill-based scoring
      const coachIds = eligible.map((c: any) => c.id);
      const { data: specs } = await supabase
        .from('coach_specializations')
        .select('coach_id, specialization_type, proficiency_level')
        .in('coach_id', coachIds);

      // Build skill score map per coach
      const skillScores = new Map<string, number>();
      if (specs && specs.length > 0) {
        for (const s of specs) {
          const current = skillScores.get(s.coach_id) || 0;
          const proficiency = s.proficiency_level ?? 3;
          skillScores.set(s.coach_id, current + proficiency);
        }
      }

      // Sort by: skill score (desc), then load balance (asc), then rating (desc)
      eligible.sort((a: any, b: any) => {
        const skillA = skillScores.get(a.id) || 0;
        const skillB = skillScores.get(b.id) || 0;
        if (skillA !== skillB) return skillB - skillA;
        const loadA = (a.current_children || 0) / (a.max_children || 30);
        const loadB = (b.current_children || 0) / (b.max_children || 30);
        if (loadA !== loadB) return loadA - loadB;
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      });

      const matched = eligible[0];
      console.log(JSON.stringify({ requestId, event: 'smart_match_coach', coachId: matched.id, coachName: matched.name, skillScore: skillScores.get(matched.id) || 0 }));
      return matched as unknown as CoachWithGroup;
    }
  } catch (matchErr) {
    console.error(JSON.stringify({ requestId, event: 'smart_match_failed', error: String(matchErr) }));
  }

  // Final fallback to default coach (from config)
  const coachConfig = await loadCoachConfig();
  const { data: defaultCoach, error } = await supabase
    .from('coaches')
    .select(`
      id, name, email, phone, tds_cumulative_fy,
      coach_groups (
        id, name, display_name,
        lead_cost_percent, coach_cost_percent, platform_fee_percent,
        is_internal
      )
    `)
    .eq('id', coachConfig.defaultCoachId)
    .single();

  if (error || !defaultCoach) {
    console.error(JSON.stringify({ requestId, event: 'no_default_coach' }));
    throw new Error('Critical: No default coach configured');
  }

  console.log(JSON.stringify({ requestId, event: 'using_default_coach', coachId: defaultCoach.id }));
  return defaultCoach as unknown as CoachWithGroup;
}
