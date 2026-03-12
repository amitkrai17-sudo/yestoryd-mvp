// ============================================================
// E-Learning Session Types
// ============================================================
// Defines the session plan structure stored as JSONB in
// elearning_sessions.session_plan, plus interaction result types.
// ============================================================

// ─── Intelligence Context ─────────────────────────────────────

export interface IntelligenceContext {
  weakest_skill: string | null;
  strongest_skill: string | null;
  areas_for_growth: string[];
  reading_level: string | null;
  engagement_pattern: string | null;
  age_based_fallback: boolean;
}

// ─── Warm-Up Segment ──────────────────────────────────────────

export interface WarmUpWord {
  word: string;
  phonics_focus: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface WarmUpSegment {
  type: 'warmup';
  words: WarmUpWord[];
  target_skill: string;
  instructions: string;
}

// ─── Reading Segment ──────────────────────────────────────────

export interface ReadingSegment {
  type: 'reading';
  title: string;
  passage: string;
  word_count: number;
  reading_level: string;
}

// ─── Comprehension Segment ────────────────────────────────────

export interface ComprehensionQuestion {
  question: string;
  type: 'literal' | 'inferential' | 'evaluative';
  expected_answer_hint: string;
  options?: string[];
}

export interface ComprehensionSegment {
  type: 'comprehension';
  questions: ComprehensionQuestion[];
  passage_title: string;
}

// ─── Creative Segment ─────────────────────────────────────────

export interface CreativeSegment {
  type: 'creative';
  prompt_text: string;
  prompt_type: 'retell' | 'alternate_ending' | 'character_letter' | 'opinion' | 'continuation';
  word_limit_hint: number;
}

// ─── Union Type ───────────────────────────────────────────────

export type SessionSegment =
  | WarmUpSegment
  | ReadingSegment
  | ComprehensionSegment
  | CreativeSegment;

// ─── Session Plan ─────────────────────────────────────────────

export type ContentSource = 'database' | 'generated';

export interface SessionPlan {
  version: '1.0';
  child_id: string;
  child_name: string;
  child_age: number;
  segments: SessionSegment[];
  intelligence_context: IntelligenceContext;
  content_sources: {
    warmup: ContentSource;
    reading: ContentSource;
    comprehension: ContentSource;
    creative: ContentSource;
  };
  estimated_minutes: number;
}

// ─── Interaction Result ───────────────────────────────────────

export interface InteractionResult {
  success: boolean;
  score: number;
  feedback: string;
  encouragement: string;
  details: Record<string, unknown>;
  xp_earned: number;
  learning_event_id: string | null;
}
