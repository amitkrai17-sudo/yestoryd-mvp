// ============================================================================
// V2 SCHEMA TYPES - Phase 1: Age Band Differentiation
// ============================================================================
// Supplements the auto-generated types/supabase.ts
// These types match the v2-phase1-migration.sql additions
// ============================================================================

export type AgeBand = 'foundation' | 'building' | 'mastery';

// ============================================================================
// age_band_config table — source of truth for band parameters
// ============================================================================
export interface AgeBandConfig {
  id: string;
  age_band: AgeBand;
  label: string;
  min_age: number;
  max_age: number;
  total_sessions: number;
  session_duration_minutes: number;
  sessions_per_week: number;
  frequency_label: string;
  program_duration_weeks: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// session_templates table — curated session templates (F01-F15, B01-B13, M01-M12)
// ============================================================================
export interface SessionTemplate {
  id: string;
  template_code: string;        // e.g., 'F01', 'B05', 'M12'
  age_band: AgeBand;
  session_number: number;        // Order within the band
  title: string;
  description: string | null;
  focus_area: string | null;
  skills_targeted: string[] | null;
  activities: Record<string, unknown> | null;
  materials: string[] | null;
  is_diagnostic: boolean;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// season_roadmaps table (Phase 3 — empty for now)
// ============================================================================
export interface SeasonRoadmap {
  id: string;
  child_id: string;
  enrollment_id: string;
  season_number: number;
  age_band: AgeBand;
  roadmap_data: Record<string, unknown> | null;
  generated_by: string | null;   // 'rai' | 'coach' | 'system'
  status: string;                // 'draft' | 'active' | 'completed'
  created_at: string;
  updated_at: string;
}

// ============================================================================
// season_learning_plans table (Phase 3 — empty for now)
// ============================================================================
export interface SeasonLearningPlan {
  id: string;
  roadmap_id: string;
  session_number: number;
  session_template_id: string | null;
  focus_area: string | null;
  objectives: string[] | null;
  success_criteria: string | null;
  status: string;                // 'planned' | 'completed' | 'skipped'
  completed_at: string | null;
  coach_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Extended column types for existing tables
// ============================================================================

/** New columns added to enrollments table */
export interface EnrollmentV2Fields {
  age_band: AgeBand | null;
  season_number: number | null;
  total_sessions: number | null;
  session_duration_minutes: number | null;
  sessions_per_week: number | null;
}

/** New columns added to children table */
export interface ChildV2Fields {
  age_band: AgeBand | null;
}

/** New columns added to scheduled_sessions table */
export interface ScheduledSessionV2Fields {
  session_number: number | null;
  session_template_id: string | null;
  is_diagnostic: boolean;
  duration_minutes: number | null;
}

// ============================================================================
// Helper type for age_band_config lookup
// ============================================================================
export interface AgeBandLookupResult {
  age_band: AgeBand;
  total_sessions: number;
  session_duration_minutes: number;
  sessions_per_week: number;
  frequency_label: string;
  program_duration_weeks: number;
}

// ============================================================================
// Utility function type for computing age band from age
// ============================================================================
export function computeAgeBand(age: number): AgeBand | null {
  if (age >= 4 && age <= 6) return 'foundation';
  if (age >= 7 && age <= 9) return 'building';
  if (age >= 10 && age <= 12) return 'mastery';
  return null;
}
