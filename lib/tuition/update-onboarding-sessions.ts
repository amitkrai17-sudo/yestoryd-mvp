// ============================================================
// FILE: lib/tuition/update-onboarding-sessions.ts
// PURPOSE: Single source of truth for editing sessions_purchased on a
//   PENDING tuition onboarding. Hard-gated to status='parent_pending'
//   (a completed/archived/draft/expired row is never editable). Touches
//   ONLY sessions_purchased — the sessions count is independent of
//   session_rate and all derived fields (hourly_rate_calculated /
//   rate_flag / coach_split_snapshot), so NO derivation runs here.
//
//   The caller is responsible for auth + ownership (admin: any; coach:
//   own coach_id). This helper validates the count, enforces the status
//   gate, does the single-row by-id update, and writes activity_log,
//   then returns a {status, body} envelope the route hands straight to
//   NextResponse.json (mirrors lib/tuition/archive-onboarding.ts).
// ============================================================

// Valid sessions_purchased range — mirrors app/api/admin/tuition/create
// route's zod (z.number().int().min(1).max(50)). SSOT for the bound.
const MIN_SESSIONS_PURCHASED = 1;
const MAX_SESSIONS_PURCHASED = 50;

/** Minimal onboarding shape the sessions edit needs (caller fetches with auth/ownership). */
export interface OnboardingForSessionsEdit {
  id: string;
  status: string | null;
  child_name: string | null;
  parent_phone: string | null;
  sessions_purchased: number | null;
}

export interface UpdateSessionsResult {
  status: number;
  body: Record<string, unknown>;
}

export interface UpdateSessionsArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  onboardingId: string;
  sessionsPurchased: number;
  actorEmail: string;
  actorType: 'admin' | 'coach';
  /** Optional edit reason (audit only). */
  reason?: string | null;
  requestId: string;
}

export async function updateOnboardingSessions(
  args: UpdateSessionsArgs,
): Promise<UpdateSessionsResult> {
  const { supabase, onboardingId, sessionsPurchased, actorEmail, actorType, reason, requestId } = args;

  // 1. Validate count — integer within the create-route bound.
  if (
    !Number.isInteger(sessionsPurchased) ||
    sessionsPurchased < MIN_SESSIONS_PURCHASED ||
    sessionsPurchased > MAX_SESSIONS_PURCHASED
  ) {
    return {
      status: 400,
      body: { error: `sessionsPurchased must be an integer between ${MIN_SESSIONS_PURCHASED} and ${MAX_SESSIONS_PURCHASED}` },
    };
  }

  // 2. Fetch current row.
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('id, status, child_name, parent_phone, sessions_purchased')
    .eq('id', onboardingId)
    .single();

  if (fetchErr || !onboarding) {
    return { status: 404, body: { error: 'Onboarding record not found' } };
  }

  // 3. HARD GATE: only a parent_pending onboarding is editable. This alone blocks
  //    parent_completed / archived / draft / expired.
  if (onboarding.status !== 'parent_pending') {
    return {
      status: 400,
      body: { error: `Cannot edit sessions — status is '${onboarding.status}'. Only parent_pending onboardings are editable.` },
    };
  }

  const previousSessions = onboarding.sessions_purchased;

  // 4. Update sessions_purchased ONLY (+ updated_at). No other column touched.
  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({ sessions_purchased: sessionsPurchased, updated_at: new Date().toISOString() })
    .eq('id', onboardingId);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_sessions_edit_error', onboardingId, error: updateErr.message }));
    return { status: 500, body: { error: 'Failed to update sessions' } };
  }

  // 5. Activity log (records who + before/after).
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_sessions_edited',
    user_email: actorEmail,
    user_type: actorType,
    metadata: {
      onboarding_id: onboardingId,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
      previous_sessions: previousSessions,
      new_sessions: sessionsPurchased,
      reason: reason ?? null,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'tuition_onboarding_sessions_edited', onboardingId, previousSessions, newSessions: sessionsPurchased }));

  return { status: 200, body: { success: true, id: onboardingId, sessionsPurchased } };
}
