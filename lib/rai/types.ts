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
  userId?: string;
  userEmail: string;
  childId?: string;
  chatHistory?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  intent?: Intent;
  source?: ResponseSource;
  needsChildSelection?: boolean;
  children?: { id: string; name: string }[];
  debug?: {
    tier0Match?: boolean;
    cacheHit?: boolean;
    eventsRetrieved?: number;
    latencyMs?: number;
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
  coach_id?: string | null;
  event_type: string;
  event_date: string;
  event_data?: Record<string, unknown>;
  ai_summary?: string | null;
  content_for_embedding?: string | null;
  similarity?: number;
  keyword_boost?: number;
  final_score?: number;
}

export interface ChildWithCache {
  id: string;
  name?: string;
  child_name?: string;
  age?: number;
  parent_id?: string;
  parent_email?: string;
  coach_id?: string | null;
  last_session_summary?: string | null;
  last_session_date?: string | null;
  last_session_focus?: string | null;
  sessions_completed?: number;
  total_sessions?: number;
  latest_assessment_score?: number | null;
}

export interface Coach {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}
