// ============================================================
// FILE: lib/tuition/archive-onboarding.ts
// PURPOSE: Single source of truth for soft-dismissing a tuition
//   onboarding (status='archived'). Used by BOTH the admin archive
//   route and the coach archive route so the idempotency check +
//   ARCHIVABLE guard + status flip + activity_log block is never
//   duplicated. NEVER deletes the row (audit trail preserved).
//
//   The caller is responsible for auth + ownership (admin: any;
//   coach: own coach_id) and for fetching the onboarding row. This
//   helper does the idempotency check, status validation, the
//   single-row by-id update, and the activity_log write, then
//   returns a {status, body} envelope the route hands straight to
//   NextResponse.json (mirrors lib/tuition/resend-onboarding-link.ts).
// ============================================================

// Only non-completed, non-enrolled lifecycle states may be dismissed.
export const ARCHIVABLE_STATUSES = ['draft', 'parent_pending', 'expired'];

/** Minimal onboarding shape the archive needs (caller fetches with auth/ownership). */
export interface OnboardingForArchive {
  id: string;
  child_name: string | null;
  parent_phone: string | null;
  status: string | null;
  enrollment_id: string | null;
}

export interface ArchiveOnboardingResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ArchiveOnboardingArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  onboarding: OnboardingForArchive;
  actorEmail: string;
  actorType: 'admin' | 'coach';
  /** Optional dismiss reason (audit only). */
  reason?: string | null;
  requestId: string;
}

export async function archiveOnboarding(
  args: ArchiveOnboardingArgs,
): Promise<ArchiveOnboardingResult> {
  const { supabase, onboarding, actorEmail, actorType, reason, requestId } = args;
  const id = onboarding.id;

  // 2a. Idempotent: already archived → no-op success (re-clicking dismiss).
  if (onboarding.status === 'archived') {
    return { status: 200, body: { success: true, id, status: 'archived', alreadyArchived: true } };
  }

  // 2b. Guard: never archive a completed/enrolled record (preserve the live student).
  if (onboarding.enrollment_id || !ARCHIVABLE_STATUSES.includes(onboarding.status as string)) {
    return {
      status: 400,
      body: { error: `Cannot archive — status is '${onboarding.status}'${onboarding.enrollment_id ? ' (enrolled)' : ''}. Only draft/parent_pending/expired are dismissible.` },
    };
  }

  // 3. Soft-dismiss: status flip only. NEVER delete (audit trail). Single-row by-id
  //    update on a non-protected table; no counter/balance write.
  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_archive_error', onboardingId: id, error: updateErr.message }));
    return { status: 500, body: { error: 'Failed to archive record' } };
  }

  // 4. Activity log (reversible-in-principle; records who + why)
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_archived',
    user_email: actorEmail,
    user_type: actorType,
    metadata: {
      onboarding_id: id,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
      previous_status: onboarding.status,
      reason: reason ?? null,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'tuition_onboarding_archived', onboardingId: id, previousStatus: onboarding.status }));

  return { status: 200, body: { success: true, id, status: 'archived' } };
}
