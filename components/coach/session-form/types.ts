// =============================================================================
// FILE: components/coach/session-form/types.ts
// PURPOSE: TypeScript interfaces for session completion form
// CRITICAL: Must match learning_events.event_data JSONB structure for rAI
// =============================================================================

/**
 * Focus area identifiers - matches learning_events.event_data->>'focus_area'
 */
export type FocusAreaKey =
  | 'phonics_letter_sounds'
  | 'reading_fluency'
  | 'reading_comprehension'
  | 'vocabulary_building'
  | 'grammar_syntax'
  | 'creative_writing'
  | 'pronunciation'
  | 'story_analysis';

/**
 * Progress level - matches learning_events.event_data->>'progress_rating'
 */
export type ProgressLevel =
  | 'breakthrough'
  | 'significant_improvement'
  | 'improved'
  | 'same'
  | 'declined';

/**
 * Engagement level - matches learning_events.event_data->>'engagement_level'
 */
export type EngagementLevel = 'high' | 'medium' | 'low';

/**
 * Parent update type
 */
export type ParentUpdateType = 'celebrate' | 'support' | 'homework' | 'concern';

/**
 * Overall session rating (1-5 scale)
 */
export type OverallRating = 1 | 2 | 3 | 4 | 5;

/**
 * Complete form state
 */
export interface SessionFormState {
  // Step 1: Quick Pulse
  overallRating: OverallRating | null;
  primaryFocus: FocusAreaKey | null;

  // Step 2: Deep Dive
  skillsPracticed: string[];
  highlights: string[];
  challenges: string[];
  focusProgress: ProgressLevel | null;
  engagementLevel: EngagementLevel | null;

  // Step 3: Planning
  nextSessionFocus: string | null;
  nextSessionActivities: string[];
  homeworkAssigned: boolean;
  homeworkItems: string[];
  parentUpdateNeeded: boolean;
  parentUpdateType: ParentUpdateType | null;

  // Step 4: Review
  additionalNotes: string;
  sendToParent: boolean;
}

/**
 * Maps to learning_events.event_data JSONB structure
 * CRITICAL: Must match existing rAI query patterns
 */
export interface LearningEventData {
  // Core identifiers
  session_id: string;
  session_number: number;
  session_type: 'coaching' | 'parent_checkin' | 'skill_booster';

  // Ratings (Step 1)
  overall_rating: number;
  focus_area: FocusAreaKey;

  // Skills & Progress (Step 2)
  skills_worked_on: string[];
  progress_rating: ProgressLevel;
  engagement_level: EngagementLevel;
  highlights: string[];
  challenges: string[];

  // Planning (Step 3)
  next_session_focus: string;
  next_session_activities: string[];
  homework_assigned: boolean;
  homework_items: string[];
  parent_update_needed: boolean;
  parent_update_type: ParentUpdateType | null;

  // Meta
  coach_notes: string;
  completed_at: string;
  form_version: '2.0'; // For future migrations
}

/**
 * Child session summary - cached in children table
 */
export interface ChildSessionSummary {
  date: string;
  focus: string;
  progress: string;
  highlights: string[];
  next_focus: string;
  homework: string[];
}

/**
 * Form props passed from parent component
 */
export interface SessionFormProps {
  sessionId: string;
  childId: string;
  childName: string;
  childAge: number;
  coachId: string;
  sessionNumber: number;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Initial form state factory
 */
export function createInitialFormState(): SessionFormState {
  return {
    // Step 1
    overallRating: null,
    primaryFocus: null,
    // Step 2
    skillsPracticed: [],
    highlights: [],
    challenges: [],
    focusProgress: null,
    engagementLevel: null,
    // Step 3
    nextSessionFocus: null,
    nextSessionActivities: [],
    homeworkAssigned: false,
    homeworkItems: [],
    parentUpdateNeeded: false,
    parentUpdateType: null,
    // Step 4
    additionalNotes: '',
    sendToParent: true,
  };
}
