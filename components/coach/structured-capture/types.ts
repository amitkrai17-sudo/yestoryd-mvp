// ============================================================
// Structured Capture Form — Types & Constants
// ============================================================

import type {
  SkillRating,
  EngagementLevel,
  SessionModality,
  SkillPerformance,
} from '@/lib/intelligence/types';

// ============================================================
// Skill module group (from /api/intelligence/skills)
// ============================================================

export interface SkillItem {
  id: string;
  name: string;
  skillTag: string;
  description: string | null;
  difficulty: number | null;
  orderIndex: number;
}

export interface ModuleGroup {
  module: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    orderIndex: number;
  };
  skills: SkillItem[];
}

// ============================================================
// Observation (from /api/intelligence/observations)
// ============================================================

export interface ObservationItem {
  id: string;
  text: string;
  type: 'strength' | 'struggle' | 'neutral';
  sortOrder: number;
}

export interface SkillObservations {
  skillId: string;
  observations: ObservationItem[];
}

// ============================================================
// Artifact types
// ============================================================

export type ArtifactType = 'audio' | 'text' | 'photo' | 'none';

// ============================================================
// Context tags
// ============================================================

export const CONTEXT_TAGS = [
  'first_session',
  'post_break',
  'assessment_day',
  'makeup_session',
  'parent_observed',
  'outdoor_session',
  'peer_learning',
  'holiday_theme',
] as const;

export const CONTEXT_TAG_LABELS: Record<string, string> = {
  first_session: 'First Session',
  post_break: 'Post Break',
  assessment_day: 'Assessment Day',
  makeup_session: 'Makeup Session',
  parent_observed: 'Parent Observed',
  outdoor_session: 'Outdoor Session',
  peer_learning: 'Peer Learning',
  holiday_theme: 'Holiday Theme',
};

// ============================================================
// Rating display maps
// ============================================================

export const SKILL_RATING_LABELS: Record<SkillRating, string> = {
  struggling: 'Emerging',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced: 'Mastered',
};

export const SKILL_RATING_COLORS: Record<SkillRating, string> = {
  struggling: 'bg-red-500/20 text-red-400 border-red-500/30',
  developing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  proficient: 'bg-green-500/20 text-green-400 border-green-500/30',
  advanced: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export const ENGAGEMENT_LABELS: Record<EngagementLevel, string> = {
  exceptional: 'Exceptional',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export const ENGAGEMENT_COLORS: Record<EngagementLevel, string> = {
  exceptional: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export type ParentUpdateType = 'celebrate' | 'support' | 'homework' | 'concern';

// ============================================================
// Form state
// ============================================================

export interface CaptureFormState {
  // Card 1: Skills
  selectedSkillIds: string[];

  // Card 2: Performance
  skillPerformances: Record<string, { rating: SkillRating | null; note: string }>;

  // Card 3: Artifact
  artifactType: ArtifactType;
  artifactUrl: string;
  artifactText: string;

  // Card 4: Observations
  strengthObservationIds: string[];
  struggleObservationIds: string[];
  customStrengthNote: string;
  customStruggleNote: string;

  // Card 5: Engagement & Submit
  engagementLevel: EngagementLevel | null;
  contextTags: string[];
  homeworkAssigned: boolean;
  homeworkDescription: string;
  parentUpdateNeeded: boolean;
  parentUpdateType: ParentUpdateType | null;
}

export function createInitialCaptureState(): CaptureFormState {
  return {
    selectedSkillIds: [],
    skillPerformances: {},
    artifactType: 'none',
    artifactUrl: '',
    artifactText: '',
    strengthObservationIds: [],
    struggleObservationIds: [],
    customStrengthNote: '',
    customStruggleNote: '',
    engagementLevel: null,
    contextTags: [],
    homeworkAssigned: false,
    homeworkDescription: '',
    parentUpdateNeeded: false,
    parentUpdateType: null,
  };
}

// ============================================================
// Component props
// ============================================================

export interface CaptureFormProps {
  sessionId: string;
  childId: string;
  childName: string;
  childAge: number;
  coachId: string;
  sessionNumber?: number;
  modality?: SessionModality;
  groupSessionId?: string | null;
  onClose: () => void;
  onComplete: (result: { captureId: string; intelligenceScore: number }) => void;
}

export interface CardProps {
  state: CaptureFormState;
  onUpdate: (updates: Partial<CaptureFormState>) => void;
}

// Re-export intelligence types for convenience
export type { SkillRating, EngagementLevel, SessionModality, SkillPerformance };
