// ============================================================
// FILE: app/api/admin/tuition/[id]/remove-lapsed/route.ts
// PURPOSE: Admin soft-remove of a lapsed tuition member. Thin wrapper over the
//   shared SSOT helper removeLapsedMember (2C-3) — the helper owns the guard
//   (only a 2C-1-flagged lapse), the terminate write, and the batch-safe
//   session teardown. Admin may act on any enrollment; no extra ownership.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { removeLapsedMember } from '@/lib/tuition/remove-lapsed-member';

export const dynamic = 'force-dynamic';

const RemoveLapsedSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const POST = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  // Body optional; tolerate empty/no JSON.
  let reason = 'admin_lapse_removal';
  try {
    const body = await req.json();
    const parsed = RemoveLapsedSchema.safeParse(body);
    if (parsed.success && parsed.data.reason) reason = parsed.data.reason;
  } catch {
    // no body — keep the default reason
  }

  const result = await removeLapsedMember({
    supabase,
    enrollmentId: id,
    actorEmail: auth.email ?? 'admin',
    actorType: 'admin',
    reason,
    requestId,
  });

  return NextResponse.json(result.body, { status: result.status });
}, { auth: 'admin' });
