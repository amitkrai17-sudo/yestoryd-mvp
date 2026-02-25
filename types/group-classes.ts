// =============================================================================
// YESTORYD GROUP CLASSES: TYPE DEFINITIONS
// =============================================================================
// Domain types for group class blueprints, sessions, and micro-insights.
// Mirrors Supabase schema with strict TypeScript typing.
// Pattern: matches types/database.ts and types/elearning.ts conventions.
// =============================================================================

import { Database } from '@/lib/supabase/database.types';

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ SUPABASE ROW TYPE ALIASES                                                ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

type BlueprintRow = Database['public']['Tables']['group_class_blueprints']['Row'];
type BlueprintInsert = Database['public']['Tables']['group_class_blueprints']['Insert'];
type BlueprintUpdate = Database['public']['Tables']['group_class_blueprints']['Update'];

type GroupSessionRow = Database['public']['Tables']['group_sessions']['Row'];
type GroupClassTypeRow = Database['public']['Tables']['group_class_types']['Row'];
type GroupParticipantRow = Database['public']['Tables']['group_session_participants']['Row'];
type GroupWaitlistRow = Database['public']['Tables']['group_class_waitlist']['Row'];
type GroupCertificateRow = Database['public']['Tables']['group_class_certificates']['Row'];

// Re-export row types for direct DB usage
export type {
  BlueprintRow,
  BlueprintInsert,
  BlueprintUpdate,
  GroupSessionRow,
  GroupClassTypeRow,
  GroupParticipantRow,
  GroupWaitlistRow,
  GroupCertificateRow,
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ BLUEPRINT SEGMENT TYPES                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type SegmentType =
  | 'content_playback'
  | 'group_discussion'
  | 'individual_moment'
  | 'creative_activity'
  | 'wrap_up';

export type AgeBand = '4-6' | '7-9' | '10-12';

export type CaptureMethod =
  | 'instructor_observation'
  | 'parent_device_form'
  | 'both';

export interface VerbalMomentConfig {
  applicable_age_bands: AgeBand[];
  prompt: string;
  duration_per_child_seconds: number;
  capture_method: 'instructor_observation';
}

export interface TypedMomentConfig {
  applicable_age_bands: AgeBand[];
  prompt_7_9?: string;
  prompt_10_12?: string;
  capture_method: 'parent_device_form';
}

export interface BlueprintSegment {
  index: number;
  name: string;
  type: SegmentType;
  duration_minutes: number;
  instructions: string;
  content_item_id?: string;
  guided_questions?: string[];
  individual_config?: {
    verbal?: VerbalMomentConfig;
    typed?: TypedMomentConfig;
  };
  instructor_notes?: string;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ INDIVIDUAL MOMENT CONFIG                                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type IndividualMomentType = 'verbal' | 'typed' | 'mixed';

export interface IndividualMomentConfig {
  type: IndividualMomentType;
  prompts: Record<AgeBand, string>;
  duration_per_child_seconds: number;
  capture_method: CaptureMethod;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GROUP CLASS BLUEPRINT                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type BlueprintStatus = 'draft' | 'published' | 'archived';

export interface GroupClassBlueprint {
  id: string;
  name: string;
  description: string | null;
  class_type_id: string;
  age_band: AgeBand;
  segments: BlueprintSegment[];
  individual_moment_config: IndividualMomentConfig;
  guided_questions: string[] | null;
  content_refs: ContentRef[] | null;
  quiz_refs: QuizRef[] | null;
  skill_tags: string[] | null;
  total_duration_minutes: number | null;
  status: BlueprintStatus;
  times_used: number | null;
  avg_instructor_rating: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;

  // Joined relations (optional, depends on query)
  class_type?: GroupClassType;
  creator?: { id: string; name: string };
}

export interface ContentRef {
  content_item_id: string;
  segment_index: number;
  type: 'video' | 'story' | 'image' | 'audio' | 'document';
  title?: string;
}

export interface QuizRef {
  quiz_id: string;
  segment_index: number;
  title?: string;
  passing_score?: number;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GROUP CLASS TYPE (with optional new columns)                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface GroupClassType {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  icon_emoji: string | null;
  color_hex: string | null;
  image_url: string | null;
  price_inr: number;
  duration_minutes: number;
  age_min: number | null;
  age_max: number | null;
  min_participants: number | null;
  max_participants: number | null;
  features: string[] | null;
  learning_outcomes: string[] | null;
  typical_days: string[] | null;
  typical_times: string[] | null;
  default_instructor_split_percent: number | null;
  requires_book: boolean | null;
  is_featured: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  // Added via ALTER TABLE (will appear after migration + type regen)
  skill_tags?: Record<string, string[]> | null;
  created_at: string | null;
  updated_at: string | null;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GROUP SESSION (with blueprint)                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type GroupSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface GroupSession {
  id: string;
  title: string;
  description: string | null;
  session_type: string;
  class_type_id: string | null;
  // Added via ALTER TABLE (will appear after migration + type regen)
  blueprint_id?: string | null;
  instructor_id: string | null;
  instructor_split_percent: number | null;
  coach_id: string | null;
  book_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  max_participants: number | null;
  current_participants: number | null;
  price_inr: number | null;
  age_min: number | null;
  age_max: number | null;
  status: GroupSessionStatus | null;
  waitlist_enabled: boolean | null;
  registration_deadline: string | null;
  google_meet_link: string | null;
  google_event_id: string | null;
  google_calendar_event_id: string | null;
  recall_bot_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;

  // Joined relations
  class_type?: GroupClassType | null;
  blueprint?: GroupClassBlueprint | null;
  instructor?: { id: string; name: string; email: string; photo_url: string | null } | null;
  book?: { id: string; title: string; author: string; cover_image_url: string | null } | null;
  participants?: GroupParticipant[];
}

export interface GroupSessionWithBlueprint extends GroupSession {
  blueprint: GroupClassBlueprint;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ PARTICIPANT & REGISTRATION                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type PaymentStatus = 'pending' | 'paid' | 'free' | 'refunded' | 'failed';
export type AttendanceStatus = 'registered' | 'confirmed' | 'present' | 'absent' | 'cancelled';
export type RefundStatus = 'none' | 'requested' | 'processed' | 'credited';

export interface GroupParticipant {
  id: string;
  group_session_id: string | null;
  child_id: string | null;
  parent_id: string | null;
  payment_status: PaymentStatus | null;
  attendance_status: AttendanceStatus | null;
  amount_original: number | null;
  amount_paid: number | null;
  discount_amount: number | null;
  coupon_id: string | null;
  coupon_code_used: string | null;
  is_enrolled_free: boolean | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  refund_amount: number | null;
  refund_status: RefundStatus | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  attendance_marked_at: string | null;
  attendance_marked_by: string | null;
  participation_rating: number | null;
  participation_notes: string | null;
  certificate_sent: boolean | null;
  certificate_sent_at: string | null;
  registration_date: string | null;
  updated_at: string | null;

  // Joined relations
  child?: { id: string; name: string; age: number | null } | null;
  parent?: { id: string; name: string | null; email: string; phone: string | null } | null;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ INSTRUCTOR RATING                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface InstructorRating {
  blueprint_id: string;
  session_id: string;
  instructor_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback: string | null;
  difficulty_notes: string | null;
  suggested_changes: string | null;
  rated_at: string;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GROUP CLASS EVENT DATA (for learning_events RAG pipeline)                ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface GroupClassEventData {
  session_id: string;
  session_title: string;
  class_type_slug: string;
  class_type_name: string;
  blueprint_id: string | null;
  age_band: AgeBand;
  instructor_name: string;
  child_participation: {
    attendance: 'present' | 'absent';
    participation_rating: number | null;
    participation_notes: string | null;
  };
  individual_moment?: {
    segment_index: number;
    prompt: string;
    response_type: 'verbal' | 'typed';
    response_text?: string;
    instructor_observation?: string;
    score?: number;
  };
  skills_practiced: string[];
  session_date: string;
  duration_minutes: number;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ MICRO-INSIGHT REQUEST (for rAI processing)                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface MicroInsightRequest {
  child_id: string;
  session_id: string;
  blueprint_id: string;
  segment_index: number;
  moment_type: IndividualMomentType;
  prompt: string;
  response: {
    text?: string;
    instructor_observation?: string;
    audio_url?: string;
  };
  age_band: AgeBand;
  skill_tags: string[];
  timestamp: string;
}

export interface MicroInsightResult {
  child_id: string;
  session_id: string;
  insight_text: string;
  skills_demonstrated: string[];
  areas_for_growth: string[];
  confidence_level: 'emerging' | 'developing' | 'proficient';
  recommended_follow_up: string | null;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GAMIFICATION EXTENSIONS (group class tracking)                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface GroupClassGamification {
  group_class_streak: number;
  group_class_total_attended: number;
  last_group_class_date: string | null;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ WAITLIST                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type WaitlistStatus = 'waiting' | 'notified' | 'promoted' | 'expired' | 'cancelled';

export interface GroupWaitlistEntry {
  id: string;
  group_session_id: string;
  child_id: string;
  parent_id: string | null;
  position: number;
  status: WaitlistStatus | null;
  notified_at: string | null;
  notification_expires_at: string | null;
  promoted_at: string | null;
  promoted_to_registration_id: string | null;
  created_at: string | null;
  updated_at: string | null;

  // Joined relations
  child?: { id: string; name: string } | null;
  session?: GroupSession | null;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ BADGE CONTEXT (extended el_badges)                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type BadgeContext = 'elearning' | 'group_class' | 'coaching' | 'assessment';

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API REQUEST / RESPONSE TYPES                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface CreateBlueprintRequest {
  name: string;
  class_type_id: string;
  age_band: AgeBand;
  description?: string;
  segments: BlueprintSegment[];
  individual_moment_config: IndividualMomentConfig;
  guided_questions?: string[];
  content_refs?: ContentRef[];
  quiz_refs?: QuizRef[];
  skill_tags?: string[];
}

export interface CreateSessionFromBlueprintRequest {
  blueprint_id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  instructor_id?: string;
  max_participants?: number;
  price_inr?: number;
  notes?: string;
}
