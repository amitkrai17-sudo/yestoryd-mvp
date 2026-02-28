// ============================================================
// UIP (Unified Intelligence Profile) Type Definitions
// Strict TypeScript interfaces for the intelligence layer.
// These types are the application-level contract — DB types
// are generated in lib/supabase/database.types.ts.
// ============================================================

// ============================================================
// Enums
// ============================================================

/** How confident we are in a learning signal */
export type SignalConfidence = 'high' | 'medium' | 'low';

/** Where the intelligence signal originated */
export type SignalSource =
  | 'coaching_session'
  | 'group_class'
  | 'micro_assessment'
  | 'structured_capture'
  | 'elearning'
  | 'parent_report'
  | 'assessment'
  | 'discovery_call';

/** How the session was delivered */
export type SessionModality =
  | 'online_1on1'
  | 'online_group'
  | 'in_person_1on1'
  | 'in_person_group'
  | 'hybrid'
  | 'elearning'
  | 'self_practice';

/** How structured capture data was entered */
export type CaptureMethod =
  | 'auto_filled'
  | 'voice_to_structured'
  | 'manual_structured'
  | 'instructor_console';

/** Profile freshness — how recent is the intelligence */
export type FreshnessStatus = 'fresh' | 'aging' | 'stale';

/** Overall confidence in the profile */
export type ProfileConfidence = 'high' | 'medium' | 'low' | 'insufficient';

/** Skill performance rating in structured capture */
export type SkillRating = 'struggling' | 'developing' | 'proficient' | 'advanced';

/** Engagement level during a session */
export type EngagementLevel = 'low' | 'moderate' | 'high' | 'exceptional';

/** Micro-assessment status */
export type MicroAssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

/** Fluency rating from micro-assessment */
export type FluencyRating = 'pre_reader' | 'beginner' | 'developing' | 'fluent' | 'advanced';

/** Trend direction */
export type TrendDirection = 'improving' | 'stable' | 'declining';

// ============================================================
// The 5 UIP Intelligence Signals
// ============================================================

/**
 * A single intelligence signal extracted from any learning event.
 * This is the atomic unit of the UIP system — every observation
 * about a child's reading ability flows through this shape.
 */
export interface IntelligenceSignal {
  /** Which skill was observed (FK to el_skills.id) */
  skillId: string;
  /** Human-readable skill name (denormalized for display) */
  skillName: string;
  /** Rating assigned to performance on this skill */
  rating: SkillRating;
  /** 0-100 numeric score (null if not quantifiable) */
  score: number | null;
  /** Where this signal came from */
  source: SignalSource;
  /** How much we trust this signal */
  confidence: SignalConfidence;
  /** When this was observed (ISO 8601) */
  observedAt: string;
  /** Optional free-text observation */
  observation?: string;
  /** The learning_event ID that produced this signal */
  eventId?: string;
}

// ============================================================
// Structured Capture (Coach/Instructor Input)
// ============================================================

/** Individual skill performance entry within a structured capture */
export interface SkillPerformance {
  /** FK to el_skills.id */
  skillId: string;
  /** Rating for this skill */
  rating: SkillRating;
  /** Selected observation IDs (FK to el_skill_observations.id) */
  observationIds: string[];
  /** Free-text note from coach */
  note?: string;
}

/**
 * The payload submitted by the structured capture form.
 * This is what the coach/instructor sends after a session.
 */
export interface StructuredCapturePayload {
  childId: string;
  coachId: string;
  /** 1:1 session ID or null for group */
  sessionId: string | null;
  /** Group session ID or null for 1:1 */
  groupSessionId: string | null;
  sessionDate: string; // YYYY-MM-DD
  sessionModality: SessionModality;
  captureMethod: CaptureMethod;
  /** Which skills were covered in this session */
  skillsCovered: string[]; // el_skills.id[]
  /** Per-skill performance ratings */
  skillPerformances: SkillPerformance[];
  /** Overall engagement */
  engagementLevel: EngagementLevel;
  /** Strength observation IDs selected */
  strengthObservations: string[];
  /** Struggle observation IDs selected */
  struggleObservations: string[];
  /** Free-text strength note */
  customStrengthNote?: string;
  /** Free-text struggle note */
  customStruggleNote?: string;
  /** Tags for context (e.g. "first_session", "post_break") */
  contextTags?: string[];
  /** Was the form pre-filled by AI? */
  aiPrefilled?: boolean;
  /** Did the coach confirm/edit the AI prefill? */
  coachConfirmed?: boolean;
  /** Voice input audio URL (for voice_to_structured) */
  voiceInputUrl?: string;
  /** Child artifact (reading sample, etc.) */
  childArtifact?: {
    type: 'audio' | 'text' | 'image';
    url: string;
    text?: string;
    durationSeconds?: number;
    analysis?: Record<string, unknown>;
  };
}

// ============================================================
// Intelligence Score
// ============================================================

/**
 * Computed intelligence score for a single event/capture.
 * Represents the quality and richness of the intelligence gathered.
 */
export interface IntelligenceScore {
  /** 0-100 composite score */
  score: number;
  /** Breakdown of score components */
  components: {
    /** Number of distinct skills observed (0-30 pts) */
    skillCoverage: number;
    /** Specificity of observations (0-25 pts) */
    observationDepth: number;
    /** Confidence of the source signal (0-20 pts) */
    sourceConfidence: number;
    /** Whether artifacts support the observation (0-15 pts) */
    artifactSupport: number;
    /** Recency bonus (0-10 pts) */
    recency: number;
  };
}

// ============================================================
// Child Intelligence Profile (the full UIP)
// ============================================================

/** Per-skill rating within the profile, aggregated across signals */
export interface ProfileSkillRating {
  skillId: string;
  skillName: string;
  /** Current consensus rating */
  rating: SkillRating;
  /** Confidence in this rating */
  confidence: SignalConfidence;
  /** Number of signals that informed this rating */
  signalCount: number;
  /** When we last observed this skill */
  lastObservedAt: string;
  /** Trend over time */
  trend: TrendDirection;
}

/** Signal source coverage within the profile */
export interface ModalityCoverage {
  source: SignalSource;
  eventCount: number;
  lastEventAt: string;
  avgConfidence: SignalConfidence;
}

/** Narrative profile generated by AI synthesis */
export interface NarrativeProfile {
  /** 2-3 sentence overall summary */
  summary: string;
  /** Key strengths */
  strengths: string[];
  /** Areas needing attention */
  areasForGrowth: string[];
  /** Recommended focus for next session */
  nextSessionFocus: string;
  /** When this narrative was generated */
  generatedAt: string;
  /** Model used for generation */
  model: string;
}

/**
 * The full child intelligence profile — the UIP.
 * One per child, continuously updated as signals arrive.
 */
export interface ChildIntelligenceProfile {
  id: string;
  childId: string;
  /** Per-skill ratings map (keyed by skill ID) */
  skillRatings: Record<string, ProfileSkillRating>;
  /** Overall reading level assessment */
  overallReadingLevel: string | null;
  /** How fresh is this profile */
  freshnessStatus: FreshnessStatus;
  /** Overall confidence in the profile */
  overallConfidence: ProfileConfidence;
  /** Where signals come from */
  signalSources: ModalityCoverage[];
  /** AI-generated narrative */
  narrativeProfile: NarrativeProfile | null;
  /** Primary learning modality */
  primaryModality: SessionModality | null;
  /** Coverage across modalities */
  modalityCoverage: Record<string, ModalityCoverage>;
  /** Engagement pattern */
  engagementPattern: string | null;
  /** Event counts by confidence tier */
  totalEventCount: number;
  highConfidenceEventCount: number;
  mediumConfidenceEventCount: number;
  lowConfidenceEventCount: number;
  /** Timestamps */
  lastHighConfidenceSignalAt: string | null;
  lastAnySignalAt: string | null;
  lastSynthesizedAt: string | null;
  /** IDs of events used in last synthesis */
  synthesisEventIds: string[];
  /** Model used for last synthesis */
  synthesisModel: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Skill Observation (from el_skill_observations)
// ============================================================

/**
 * A predefined observation that coaches can select.
 * Linked to a specific skill, categorized by type.
 */
export interface SkillObservation {
  id: string;
  skillId: string;
  observationText: string;
  /** 'strength' | 'struggle' | 'neutral' */
  observationType: 'strength' | 'struggle' | 'neutral';
  /** Which age bands this observation applies to */
  ageBands: string[] | null;
  sortOrder: number | null;
  isActive: boolean;
}

// ============================================================
// Micro-Assessment
// ============================================================

/** Gemini analysis result from audio processing */
export interface MicroAssessmentGeminiAnalysis {
  overallScore: number;
  fluencyScore: number;
  accuracyScore: number;
  expressionScore: number;
  wordsPerMinute: number;
  errors: string[];
  feedback: string;
}

/**
 * A micro-assessment triggered during group classes.
 * Quick reading fluency check processed by Gemini.
 */
export interface MicroAssessmentResult {
  id: string;
  childId: string;
  groupSessionId: string | null;
  status: MicroAssessmentStatus;
  triggeredBy: string;
  /** Audio recording */
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  /** The passage read */
  passageId: string | null;
  passageText: string | null;
  /** Results */
  fluencyRating: FluencyRating | null;
  estimatedWpm: number | null;
  comprehensionScore: number | null;
  comprehensionQuestions: Record<string, unknown> | null;
  /** Gemini AI analysis */
  geminiAnalysis: MicroAssessmentGeminiAnalysis | null;
  /** Context */
  attendanceCountAtTrigger: number | null;
  completedAt: string | null;
  createdAt: string;
}
