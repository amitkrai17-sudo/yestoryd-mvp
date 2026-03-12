// ============================================================
// FILE: lib/api/get-coach-session.ts
// PURPOSE: Shared coach session lookup + ownership verification
// Used by 6+ coach/sessions/[id]/* routes
// ============================================================

import { NextResponse } from 'next/server';
import type { AuthResult } from '@/lib/api-auth';

// Return type of getServiceSupabase()
import { createAdminClient } from '@/lib/supabase/admin';
type ServiceSupabase = ReturnType<typeof createAdminClient>;

/** The standard columns fetched for session lookup */
const SESSION_SELECT = `
  id, child_id, coach_id, enrollment_id,
  session_type, session_number, session_title,
  is_diagnostic, session_template_id, duration_minutes,
  scheduled_date, scheduled_time, status,
  google_meet_link
` as const;

export interface CoachSessionResult {
  session: {
    id: string;
    child_id: string;
    coach_id: string | null;
    enrollment_id: string | null;
    session_type: string | null;
    session_number: number | null;
    session_title: string | null;
    is_diagnostic: boolean | null;
    session_template_id: string | null;
    duration_minutes: number | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    status: string | null;
    google_meet_link: string | null;
  };
}

export interface CoachSessionError {
  response: NextResponse;
}

/**
 * Look up a session by ID and verify the requesting coach owns it.
 * Returns the session data or an error NextResponse ready to return.
 *
 * Usage:
 * ```ts
 * const result = await getCoachSession(supabase, auth, sessionId);
 * if ('response' in result) return result.response;
 * const { session } = result;
 * ```
 *
 * @param extraSelect - Additional columns to select beyond the standard set
 */
export async function getCoachSession(
  supabase: ServiceSupabase,
  auth: AuthResult,
  sessionId: string,
  extraSelect?: string,
): Promise<CoachSessionResult | CoachSessionError> {
  const selectCols = extraSelect
    ? `${SESSION_SELECT}, ${extraSelect}`
    : SESSION_SELECT;

  const { data: sessionData, error: sessionError } = await supabase
    .from('scheduled_sessions')
    .select(selectCols)
    .eq('id', sessionId)
    .single();

  if (sessionError || !sessionData) {
    return {
      response: NextResponse.json({ error: 'Session not found' }, { status: 404 }),
    };
  }

  // Cast to any for dynamic select access, then to typed result
  const session = sessionData as unknown as CoachSessionResult['session'];

  if (!session.child_id) {
    return {
      response: NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 }),
    };
  }

  // Ownership: coach must own the session, admins can access any session
  if (auth.role !== 'admin' && session.coach_id !== auth.coachId) {
    return {
      response: NextResponse.json(
        { error: 'Session does not belong to this coach' },
        { status: 403 },
      ),
    };
  }

  return { session };
}
