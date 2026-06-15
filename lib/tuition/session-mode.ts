// ============================================================
// FILE: lib/tuition/session-mode.ts
// PURPOSE: The SOLE standing-mode writer — sets a tuition enrollment's default
//   session mode by updating the SSOT column tuition_onboarding.default_session_mode.
//
//   The onboarding-creation paths (create-onboarding.ts, admin/tuition/create,
//   coach/onboard-student) INSERT this column at birth; this helper is the FIRST
//   and only UPDATE-writer of it — for mid-life renewal/top-up mode changes.
//
//   Scope boundary: this writes ONLY the standing default (tuition_onboarding).
//   It MUST NOT touch scheduled_sessions.session_mode — per-row mode is owned by
//   the scheduler at session birth (reads default_session_mode) and by
//   setSessionMode / the enrollment-complete relabel. Governs NEW sessions only.
//
//   Only-when-differs: no write when the requested mode equals the current value.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

export async function setEnrollmentSessionMode(
  enrollmentId: string,
  mode: 'online' | 'offline',
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ changed: boolean }> {
  const { data: onboarding } = await supabase
    .from('tuition_onboarding')
    .select('default_session_mode')
    .eq('enrollment_id', enrollmentId)
    .single();

  // Only-when-differs: skip the write if the standing mode is already correct.
  if (onboarding?.default_session_mode === mode) {
    return { changed: false };
  }

  await supabase
    .from('tuition_onboarding')
    .update({ default_session_mode: mode })
    .eq('enrollment_id', enrollmentId);

  return { changed: true };
}
