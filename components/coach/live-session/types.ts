// ============================================================
// FILE: components/coach/live-session/types.ts
// PURPOSE: Shared types for the Coach Companion Panel
// ============================================================

// --- Content reference linking an activity to el_* assets ---
export interface ContentRef {
  type: 'video' | 'game' | 'worksheet';
  id: string;          // UUID from el_videos / el_game_content / el_worksheets
  label: string;       // display name for quick reference
}

// --- Activity step within a session template ---
// BACKWARD COMPAT: Old format has only { time, activity, purpose }.
// New format adds optional fields. Renderers check for their presence.
export interface ActivityStep {
  // === Legacy fields (always present) ===
  time: string;                             // e.g. "0-5"
  activity: string;                         // e.g. "Warm-up: Rhyming Pairs"
  purpose: string;                          // e.g. "Phonological awareness activation"

  // === V2 fields (optional — missing on legacy templates) ===
  activity_id?: string;                     // unique within template: "act_01", "act_02"
  activity_name?: string;                   // structured name (falls back to `activity`)
  planned_duration_minutes?: number;
  content_refs?: ContentRef[];              // linked el_* content
  is_required?: boolean;                    // true = must do, false = optional/enrichment
  coach_can_substitute?: boolean;           // false = use exact content, true = similar ok
}

// Helper: get display name for an activity step (handles both formats)
export function getActivityDisplayName(step: ActivityStep): string {
  return step.activity_name || step.activity;
}

export type ActivityStatus = 'completed' | 'partial' | 'skipped' | 'struggled';

// --- Resolved content = content_ref enriched with asset details from el_* ---
export interface ResolvedContent {
  type: 'video' | 'game' | 'worksheet';
  id: string;
  label: string;
  title: string;
  thumbnail_url: string | null;
  asset_url: string | null;       // video_url / asset_url
  asset_format: string | null;    // pdf, png, etc. (worksheets only)
  duration_seconds: number | null;// videos only
  coach_guidance: Record<string, any> | null; // from parent el_learning_unit
}

export interface TrackedActivity extends ActivityStep {
  index: number;
  status: ActivityStatus | null;
  startedAt: number | null;      // timestamp ms
  completedAt: number | null;    // timestamp ms
  actualSeconds: number | null;
  coachNote: string | null;
  resolved_content?: ResolvedContent[]; // populated by live route when content_refs exist
}

export interface TemplateData {
  id: string;
  template_code: string;
  title: string;
  description: string | null;
  activity_flow: ActivityStep[] | null;
  materials_needed: string[] | null;
  coach_prep_notes: string | null;
  parent_involvement: string | null;
  skill_dimensions: string[] | null;
  difficulty_level: number | null;
  duration_minutes: number;
  is_diagnostic: boolean;
}

export interface SessionData {
  id: string;
  child_id: string;
  session_number: number | null;
  session_type: string;
  is_diagnostic: boolean;
  duration_minutes: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  google_meet_link: string | null;
  total_sessions: number;
}

export interface ChildData {
  id: string;
  child_name: string;
  age: number;
  age_band: string | null;
  parent_name: string | null;
  parent_email: string | null;
  latest_assessment_score: number | null;
  current_streak: number;
}

export interface RecentSession {
  id: string;
  event_type: string;
  summary: string | null;
  data: Record<string, any> | null;
  created_at: string;
}

export interface ParentTaskSummary {
  completed: number;
  total: number;
  streak: number;
}

export interface ParentContentEngagement {
  materials_assigned: number;
  materials_viewed: number;
  completion_rate: number; // 0.0-1.0
}

export interface StruggleFlag {
  activity_name: string;
  session_number: number | null;
  coach_note: string | null;
}

export interface LiveSessionData {
  session: SessionData;
  child: ChildData;
  template: TemplateData | null;
  resolved_content?: Record<number, ResolvedContent[]>;
  recent_sessions: RecentSession[];
  parent_tasks: ParentTaskSummary | null;
  parent_content_engagement?: ParentContentEngagement | null;
  recent_struggles: StruggleFlag[];
  coach_sessions_logged: number;
  next_session_id: string | null;
}

export type SessionPhase = 'pre' | 'live' | 'complete';
export type LiveTab = 'flow' | 'info' | 'rai';

export interface RecommendedContentItem {
  id: string;
  title: string;
  content_type: string;
  skills: string[];
  yrl_level: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommended_content?: RecommendedContentItem[];
}
