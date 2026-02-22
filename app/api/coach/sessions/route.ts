// app/api/coach/sessions/route.ts
// Coach Sessions API - Hardened Version
// Single source of truth: scheduled_sessions table for session counts

import { Database } from '@/lib/supabase/database.types';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_TOTAL_SESSIONS = 9; /* V1 fallback — will be replaced by age_band_config.total_sessions */
const API_NAME = 'coach-sessions';

// ============================================================
// TYPES
// ============================================================

interface ChildData {
  id: string;
  child_name: string | null;
  parent_name: string | null;
  age: number | null;
  latest_assessment_score: number | null;
  last_session_summary: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  favorite_topics: string[] | null;
  learning_style: string | null;
  challenges: string[] | null;
  motivators: string[] | null;
}

interface SessionData {
  id: string;
  child_id: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string | null;
  session_number: number | null;
  session_title: string | null;
  duration_minutes: number | null;
  is_diagnostic: boolean;
  status: string | null;
  google_meet_link: string | null;
  coach_notes: string | null;
  session_mode: string | null;
  offline_request_status: string | null;
  report_submitted_at: string | null;
  report_deadline: string | null;
  enrollment_id: string | null;
  children: ChildData | null;
}

interface SessionCount {
  child_id: string;
  completed: number;
  total: number;
}

interface FormattedSession {
  id: string;
  child_id: string;
  child_name: string;
  child_age: number;
  parent_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  session_number: number | null;
  session_title: string | null;
  status: string;
  google_meet_link: string | null;
  has_notes: boolean;
  assessment_score: number | null;
  last_session_summary: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  favorite_topics: string[];
  learning_style: string | null;
  challenges: string[];
  motivators: string[];
  sessions_completed: number;
  total_sessions: number;
  duration_minutes: number | null;
  is_diagnostic: boolean;
  session_mode: string;
  offline_request_status: string | null;
  report_submitted_at: string | null;
  report_deadline: string | null;
  enrollment_id: string | null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(
  url, key);
}

function safeString(value: string | null | undefined, fallback: string = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: number | null | undefined, fallback: number = 0): number {
  return typeof value === 'number' && !isNaN(value) ? value : fallback;
}

function safeArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function logError(context: string, error: unknown): void {
  console.error(`[${API_NAME}] ${context}:`, error instanceof Error ? error.message : error);
}

// ============================================================
// DATABASE FUNCTIONS
// ============================================================

async function getCoachData(supabase: SupabaseClient, coachId: string) {
  const { data, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', coachId)
    .single();

  if (error) {
    logError('getCoachData', error);
    return null;
  }

  return data;
}

async function getSessionsWithChildren(
  supabase: SupabaseClient,
  coachId: string
): Promise<SessionData[]> {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      child_id,
      scheduled_date,
      scheduled_time,
      session_type,
      session_number,
      session_title,
      duration_minutes,
      is_diagnostic,
      status,
      google_meet_link,
      coach_notes,
      session_mode,
      offline_request_status,
      report_submitted_at,
      report_deadline,
      enrollment_id,
      children!scheduled_sessions_child_id_fkey (
        id,
        child_name,
        parent_name,
        age,
        latest_assessment_score,
        last_session_summary,
        last_session_date,
        last_session_focus,
        favorite_topics,
        learning_style,
        challenges,
        motivators
      )
    `)
    .eq('coach_id', coachId)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });


  if (error) {
    logError('getSessionsWithChildren', error);
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return (data || []) as unknown as SessionData[];
}

/**
 * Get session counts for multiple children in a single query (avoid N+1)
 * Source of truth: scheduled_sessions table
 */
async function getSessionCountsBatch(
  supabase: SupabaseClient,
  childIds: string[]
): Promise<Map<string, { completed: number; total: number }>> {
  const countsMap = new Map<string, { completed: number; total: number }>();

  if (childIds.length === 0) {
    return countsMap;
  }

  // Single query to get all sessions for all children
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select('child_id, status')
    .in('child_id', childIds);

  if (error) {
    logError('getSessionCountsBatch', error);
    // Return empty map on error - will use defaults
    return countsMap;
  }

  // Aggregate counts per child
  const childSessions = new Map<string, { completed: number; total: number }>();

  for (const session of data || []) {
    const childId = session.child_id;
    if (!childId) continue;

    const current = childSessions.get(childId) || { completed: 0, total: 0 };
    current.total += 1;
    if (session.status === 'completed') {
      current.completed += 1;
    }
    childSessions.set(childId, current);
  }

  return childSessions;
}

// ============================================================
// FORMATTING FUNCTIONS
// ============================================================

function formatSession(
  session: SessionData,
  hasNotes: boolean,
  sessionCounts: { completed: number; total: number } | undefined
): FormattedSession {
  const child = session.children;

  return {
    id: session.id,
    child_id: session.child_id,
    child_name: safeString(child?.child_name, 'Unknown'),
    child_age: safeNumber(child?.age, 0),
    parent_name: safeString(child?.parent_name),
    scheduled_date: session.scheduled_date,
    scheduled_time: session.scheduled_time,
    session_type: safeString(session.session_type, 'coaching'),
    session_number: session.session_number,
    session_title: session.session_title,
    status: safeString(session.status, 'pending'),
    google_meet_link: session.google_meet_link,
    has_notes: hasNotes,
    // Pre-Session Brief data
    assessment_score: child?.latest_assessment_score ?? null,
    last_session_summary: child?.last_session_summary ?? null,
    last_session_date: child?.last_session_date ?? null,
    last_session_focus: child?.last_session_focus ?? null,
    favorite_topics: safeArray(child?.favorite_topics),
    learning_style: child?.learning_style ?? null,
    challenges: safeArray(child?.challenges),
    motivators: safeArray(child?.motivators),
    // Real-time calculated values (source of truth)
    sessions_completed: sessionCounts?.completed ?? 0,
    total_sessions: sessionCounts?.total || DEFAULT_TOTAL_SESSIONS,
    duration_minutes: session.duration_minutes,
    is_diagnostic: session.is_diagnostic || false,
    session_mode: safeString(session.session_mode, 'online'),
    offline_request_status: session.offline_request_status,
    report_submitted_at: session.report_submitted_at,
    report_deadline: session.report_deadline,
    enrollment_id: session.enrollment_id,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const coachId = auth.coachId;
    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID not found in auth context' },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase
    const supabase = getSupabaseClient();

    // 3. Get coach data
    const coachData = await getCoachData(supabase, coachId);
    if (!coachData) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // 4. Get sessions with child details
    const sessionsData = await getSessionsWithChildren(supabase, coachId);

    // 5. Get unique child IDs
    const childIds = Array.from(new Set(sessionsData.map((s) => s.child_id).filter((id): id is string => typeof id === 'string' && id.length > 0)));

    // 6. Batch fetch session counts (single query, avoid N+1)
    const sessionCountsMap = await getSessionCountsBatch(supabase, childIds);

    // 7. Identify sessions with notes
    const sessionsWithNotes = new Set(
      sessionsData
        .filter((s) => s.coach_notes && s.coach_notes.trim() !== '')
        .map((s) => s.id)
    );

    // 8. Format sessions for frontend
    const formattedSessions = sessionsData.map((session) =>
      formatSession(
        session,
        sessionsWithNotes.has(session.id),
        sessionCountsMap.get(session.child_id)
      )
    );

    // 9. Return response
    return NextResponse.json({
      coach: coachData,
      sessions: formattedSessions,
    });

  } catch (error) {
    logError('GET handler', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
