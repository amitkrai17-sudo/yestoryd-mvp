// ============================================================
// FILE: app/api/admin/tuition/[id]/archive/route.ts
// PURPOSE: Soft-dismiss a tuition onboarding from the admin board
//          (UI-1.2 "Remove from queue"). Sets status='archived' —
//          NEVER deletes the row (audit trail preserved). Reversible
//          in principle via a future "Archived" filter (status flip).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withParamsHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

// Only non-completed, non-enrolled lifecycle states may be dismissed.
const ARCHIVABLE_STATUSES = ['draft', 'parent_pending', 'expired'];

const ArchiveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const POST = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  // Body is optional; tolerate empty/no JSON.
  let reason: string | undefined;
  try {
    const body = await req.json();
    const parsed = ArchiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    reason = parsed.data.reason;
  } catch {
    // no body — fine
  }

  // 1. Fetch the onboarding (status + enrollment link for the guard)
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('id, child_name, parent_phone, status, enrollment_id')
    .eq('id', id)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  // 2a. Idempotent: already archived → no-op success (re-clicking dismiss).
  if (onboarding.status === 'archived') {
    return NextResponse.json({ success: true, id, status: 'archived', alreadyArchived: true });
  }

  // 2b. Guard: never archive a completed/enrolled record (preserve the live student).
  if (onboarding.enrollment_id || !ARCHIVABLE_STATUSES.includes(onboarding.status)) {
    return NextResponse.json(
      { error: `Cannot archive — status is '${onboarding.status}'${onboarding.enrollment_id ? ' (enrolled)' : ''}. Only draft/parent_pending/expired are dismissible.` },
      { status: 400 },
    );
  }

  // 3. Soft-dismiss: status flip only. NEVER delete (audit trail). Single-row by-id
  //    update on a non-protected table; no counter/balance write.
  const { error: updateErr } = await supabase
    .from('tuition_onboarding')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_archive_error', onboardingId: id, error: updateErr.message }));
    return NextResponse.json({ error: 'Failed to archive record' }, { status: 500 });
  }

  // 4. Activity log (reversible-in-principle; records who + why)
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_archived',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      onboarding_id: id,
      child_name: onboarding.child_name,
      parent_phone: onboarding.parent_phone,
      previous_status: onboarding.status,
      reason: reason ?? null,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'tuition_onboarding_archived', onboardingId: id, previousStatus: onboarding.status }));

  return NextResponse.json({ success: true, id, status: 'archived' });
}, { auth: 'admin' });
