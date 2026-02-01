// ============================================================
// POST /api/admin/payouts/reconcile — Mark payouts as bank-transferred
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

const ReconcileSchema = z.object({
  payoutIds: z.array(z.string().uuid()).min(1).max(50),
  utrNumber: z.string().min(1).max(100),
  proofUrl: z.string().url().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  let body;
  try {
    body = ReconcileSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { payoutIds, utrNumber, proofUrl, notes } = body;
  const supabase = getServiceSupabase();

  // Verify all payouts exist and are in 'paid' status
  const { data: payouts, error: fetchError } = await supabase
    .from('coach_payouts')
    .select('id, status, bank_transfer_status, coach_id, net_amount')
    .in('id', payoutIds);

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }

  if (!payouts || payouts.length !== payoutIds.length) {
    return NextResponse.json({ error: 'Some payout IDs not found' }, { status: 404 });
  }

  const notPaid = payouts.filter((p) => p.status !== 'paid');
  if (notPaid.length > 0) {
    return NextResponse.json({
      error: 'All payouts must be in "paid" status before reconciliation',
      notPaidIds: notPaid.map((p) => p.id),
    }, { status: 422 });
  }

  const alreadyReconciled = payouts.filter((p) => p.bank_transfer_status === 'completed');
  if (alreadyReconciled.length > 0) {
    return NextResponse.json({
      error: 'Some payouts already reconciled',
      reconciledIds: alreadyReconciled.map((p) => p.id),
    }, { status: 409 });
  }

  // Update all payouts
  const { error: updateError } = await supabase
    .from('coach_payouts')
    .update({
      bank_transfer_status: 'completed',
      utr_number: utrNumber,
      proof_url: proofUrl || null,
      reconciled_at: new Date().toISOString(),
      reconciled_by: auth.email,
    })
    .in('id', payoutIds);

  if (updateError) {
    console.error(JSON.stringify({ requestId, event: 'reconcile_update_error', error: updateError.message }));
    return NextResponse.json({ error: 'Failed to update payouts' }, { status: 500 });
  }

  const totalAmount = payouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);

  console.log(JSON.stringify({
    requestId,
    event: 'payouts_reconciled',
    count: payoutIds.length,
    totalAmount,
    utrNumber,
    reconciledBy: auth.email,
  }));

  return NextResponse.json({
    success: true,
    reconciled: payoutIds.length,
    totalAmount,
    utrNumber,
  });
}
