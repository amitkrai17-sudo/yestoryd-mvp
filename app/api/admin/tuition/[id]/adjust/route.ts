// ============================================================
// FILE: app/api/admin/tuition/[id]/adjust/route.ts
// PURPOSE: Admin manually adjusts tuition session balance.
//          Writes to ledger with reason.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { addTuitionBalance } from '@/lib/tuition/add-balance';

export const dynamic = 'force-dynamic';

const AdjustSchema = z.object({
  amount: z.number().int().min(-50).max(50),
  reason: z.string().min(1).max(500),
});

export const POST = withParamsHandler<{ id: string }>(async (req: NextRequest, { id: enrollmentId }, { auth, supabase, requestId }) => {
  const body = await req.json();
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { amount, reason } = parsed.data;

  // Fetch enrollment
  const { data: enrollment, error: fetchErr } = await supabase
    .from('enrollments')
    .select('id, sessions_remaining, enrollment_type')
    .eq('id', enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  if (enrollment.enrollment_type !== 'tuition') {
    return NextResponse.json({ error: 'Not a tuition enrollment' }, { status: 400 });
  }

  // Ledger entry + sessions_remaining update (centralized helper)
  const { previousBalance, newBalance } = await addTuitionBalance({
    enrollmentId,
    changeAmount: amount,
    reason: `admin_adjustment: ${reason}`,
    createdBy: auth.email ?? 'admin',
  });

  // Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_balance_adjusted',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      enrollment_id: enrollmentId,
      amount,
      previous_balance: previousBalance,
      new_balance: newBalance,
      reason,
    },
  });

  console.log(JSON.stringify({ requestId, event: 'tuition_balance_adjusted', enrollmentId, amount, newBalance }));

  return NextResponse.json({ success: true, previousBalance, newBalance, amount });
}, { auth: 'admin' });
