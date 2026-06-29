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
import { archiveOnboarding } from '@/lib/tuition/archive-onboarding';

export const dynamic = 'force-dynamic';

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

  // 2-4. Idempotency + ARCHIVABLE guard + status flip + activity_log via shared SSOT helper.
  const result = await archiveOnboarding({
    supabase,
    onboarding,
    actorEmail: auth.email ?? 'admin',
    actorType: 'admin',
    reason,
    requestId,
  });

  return NextResponse.json(result.body, { status: result.status });
}, { auth: 'admin' });
