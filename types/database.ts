/**
 * Yestoryd Database Types
 * 
 * Centralized type definitions for all database tables
 * Use these across the application for type safety
 */

// ==================== PARENTS ====================
export interface Parent {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  updated_at?: string;
}

// ==================== COACHES ====================
export interface Coach {
  id: string;
  email: string;
  name: string;
  slug: string | null;
  bio: string | null;
  avatar_url: string | null;
  specializations: string[] | null;
  hourly_rate: number | null;
  revenue_split: number; // Percentage (50 = 50%, 100 = 100%)
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ==================== CHILDREN ====================
export interface Child {
  id: string;
  child_name: string;
  name?: string; // Legacy alias
  age: number | null;
  grade: string | null;
  parent_id: string | null;
  parent_email: string;
  assigned_coach_id: string | null;
  enrollment_status: EnrollmentStatus;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  
  // Joined relations (optional, depends on query)
  parent?: Parent;
  coach?: Coach;
}

export type EnrollmentStatus = 'pending' | 'active' | 'completed' | 'cancelled';

// ==================== SCHEDULED SESSIONS ====================
export interface ScheduledSession {
  id: string;
  child_id: string;
  coach_id: string;
  parent_id: string | null;
  session_type: SessionType;
  session_number: number;
  week_number: number;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: SessionStatus;
  google_event_id: string | null;
  google_meet_link: string | null;
  tldv_meeting_id: string | null;
  tldv_transcript: string | null;
  coach_notes: string | null;
  parent_notes: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at?: string;
  
  // Joined relations
  child?: Child;
  coach?: Coach;
}

export type SessionType = 'coaching' | 'parent_checkin';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

// ==================== LEARNING EVENTS (RAG) ====================
export interface LearningEvent {
  id: string;
  child_id: string;
  event_type: EventType;
  event_date: string;
  source: EventSource;
  data: Record<string, any>;
  ai_summary: string | null;
  embedding: number[] | null; // 768-dim vector for RAG
  created_by: string | null;
  created_at: string;
  
  // Computed for display
  similarity?: number;
}

export type EventType = 
  | 'assessment' 
  | 'session' 
  | 'session_notes'
  | 'handwritten' 
  | 'quiz' 
  | 'workshop' 
  | 'milestone' 
  | 'note'
  | 'elearning';

export type EventSource = 
  | 'assessment'
  | 'coaching_session'
  | 'parent_checkin'
  | 'elearning_module'
  | 'manual_entry'
  | 'tldv_transcript';

// ==================== PAYMENTS ====================
export interface Payment {
  id: string;
  parent_id: string;
  child_id: string;
  coach_id: string | null;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number; // In paise (5999 rupees = 599900 paise)
  currency: string;
  status: PaymentStatus;
  coach_share: number;
  platform_share: number;
  package_type: string;
  created_at: string;
  paid_at: string | null;
  
  // Joined relations
  parent?: Parent;
  child?: Child;
  coach?: Coach;
}

export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';

// ==================== E-LEARNING ====================
export interface ElearningModule {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_seconds: number;
  order_index: number;
  age_group: string | null;
  skill_focus: string[] | null;
  assessment_required: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ElearningProgress {
  id: string;
  child_id: string;
  module_id: string;
  progress_percent: number; // 0-100
  completed_at: string | null;
  assessment_unlocked: boolean;
  assessment_completed: boolean;
  assessment_score: number | null;
  last_watched_at: string;
  created_at: string;
  
  // Joined relations
  module?: ElearningModule;
}

// ==================== ASSESSMENTS ====================
export interface Assessment {
  id: string;
  child_id: string;
  assessment_type: AssessmentType;
  source: string; // 'initial', 'elearning_module_1', etc.
  passage_title: string | null;
  audio_url: string | null;
  
  // Scores
  clarity_score: number;
  fluency_score: number;
  speed_score: number;
  overall_score: number;
  wpm: number | null;
  
  // AI Analysis
  strengths: string[] | null;
  areas_to_improve: string[] | null;
  ai_feedback: string | null;
  raw_ai_response: Record<string, any> | null;
  
  created_at: string;
}

export type AssessmentType = 'reading' | 'comprehension' | 'phonics';

// ==================== CURRICULUM ====================
export interface CurriculumTemplate {
  id: string;
  week_number: number;
  session_type: SessionType;
  session_number: number;
  title: string;
  description: string | null;
  focus_areas: string[] | null;
  duration_minutes: number;
  day_offset: number; // Days from enrollment start
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ==================== CHAT/RAG TYPES ====================
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface RAGSearchResult {
  event: LearningEvent;
  similarity: number;
}

// ==================== DASHBOARD STATS ====================
export interface CoachDashboardStats {
  totalStudents: number;
  activeStudents: number;
  upcomingSessions: number;
  completedSessions: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export interface ParentDashboardStats {
  childProgress: number;
  completedSessions: number;
  upcomingSessions: number;
  latestAssessmentScore: number | null;
}

export interface AdminDashboardStats {
  totalChildren: number;
  totalCoaches: number;
  totalRevenue: number;
  activeEnrollments: number;
  pendingPayments: number;
}
