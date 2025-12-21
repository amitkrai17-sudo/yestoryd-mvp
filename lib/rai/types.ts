// file: lib/rai/types.ts
// rAI v2.0 - Type definitions

export type UserRole = 'parent' | 'coach' | 'admin';

export type Intent = 'LEARNING' | 'OPERATIONAL' | 'SCHEDULE' | 'OFF_LIMITS';

export type ResponseSource = 'cache' | 'rag' | 'sql' | 'redirect';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  childId?: string;
  intent?: Intent;
}

export interface ChatRequest {
  message: string;
  userRole: UserRole;
  userId: string;
  userEmail: string;
  childId?: string;
  chatHistory?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  intent: Intent;
  source: ResponseSource;
  needsChildSelection?: boolean;
  children?: { id: string; name: string }[];
  debug?: {
    tier0Match: boolean;
    cacheHit: boolean;
    eventsRetrieved: number;
    latencyMs: number;
  };
}

export interface IntentClassification {
  intent: Intent;
  entities: string[];
  confidence: number;
}

export interface QueryFilters {
  dateRange?: {
    from: Date;
    to: Date;
  };
  eventType?: string;
  keywords: string[];
}

export interface LearningEvent {
  id: string;
  child_id: string;
  coach_id: string | null;
  event_type: string;
  event_date: string;
  event_data: Record<string, any>;
  ai_summary: string | null;
  content_for_embedding: string | null;
  similarity?: number;
  keyword_boost?: number;
  final_score?: number;
}

export interface SessionAnalysis {
  // Coach analysis fields
  focus_area: string;
  skills_worked_on: string[];
  progress_rating: 'declined' | 'same' | 'improved' | 'significant_improvement';
  engagement_level: 'low' | 'medium' | 'high';
  confidence_level?: number;
  breakthrough_moment?: string;
  concerns_noted?: string;
  homework_assigned: boolean;
  homework_topic?: string;
  homework_description?: string;
  next_session_focus?: string;
  coach_talk_ratio?: number;
  child_reading_samples?: string[];
  key_observations: string[];
  flagged_for_attention?: boolean;
  flag_reason?: string;
  
  // Parent check-in fields (optional)
  parent_sentiment?: string;
  parent_sees_progress?: string;
  home_practice_frequency?: string;
  concerns_raised?: string[];
  action_items?: string;
  
  // Common
  session_type: 'coaching' | 'parent_checkin' | 'discovery' | 'remedial';
  child_name: string | null;
  summary: string;
  
  // NEW: Parent-friendly summary
  parent_summary: string;
}

export interface ChildWithCache {
  id: string;
  name: string;
  child_name: string;
  age: number;
  parent_id: string;
  parent_email: string;
  assigned_coach_id: string | null;
  last_session_summary: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  sessions_completed: number;
  total_sessions: number;
  latest_assessment_score: number | null;
}

export interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface ScheduledSession {
  id: string;
  child_id: string;
  coach_id: string;
  session_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  google_meet_link: string | null;
  status: string;
  session_number: number | null;
}
