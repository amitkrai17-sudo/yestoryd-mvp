// ============================================================
// FILE: lib/tuition/add-balance.ts
// PURPOSE: Centralized helper for tuition balance changes.
//          All 4 top-up paths (payment webhook, payment verify,
//          offline payment, admin adjust) route through this.
//
// On positive changeAmount (top-up), clears the parent-renewal
// intent-capture columns + the low-balance nudge cap so the
// next renewal cycle can re-fire both.
//
// Does NOT update context-specific enrollment fields (status,
// amount, payment_id, program_start). Callers retain their
// own UPDATE for those fields.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

export type AddBalanceParams = {
  enrollmentId: string;
  changeAmount: number;
  /**
   * Semantic ledger reason — passed verbatim into tuition_session_ledger.reason.
   * Existing convention:
   *   - 'initial_purchase'           (first-time enrollment)
   *   - 'renewal'                    (subsequent cohort)
   *   - 'top_up'                     (discretionary mid-cycle top-up)
   *   - 'admin_adjustment: <text>'   (admin correction; free text after colon)
   *
   * NOT a source label (e.g. 'razorpay_webhook'). Source info goes in createdBy.
   */
  reason: string;
  createdBy: string;
  paymentId?: string;
  notes?: string;
};

export type AddBalanceResult = {
  enrollmentId: string;
  previousBalance: number;
  newBalance: number;
  ledgerRowId: string;
};

export async function addTuitionBalance(params: AddBalanceParams): Promise<AddBalanceResult> {
  const supabase = createAdminClient();

  // 1. Read current balance
  const { data: enrollment, error: fetchErr } = await supabase
    .from('enrollments')
    .select('sessions_remaining')
    .eq('id', params.enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    throw new Error(`addTuitionBalance: enrollment not found (${params.enrollmentId})`);
  }

  const previousBalance = enrollment.sessions_remaining ?? 0;
  const newBalance = previousBalance + params.changeAmount;

  // 2. Update sessions_remaining + (on top-up) clear renewal + low-balance gates.
  //    Skip enrollment UPDATE entirely on zero-change rows — they exist only to
  //    record the ledger event (e.g. initial onboarding 'change_amount: 0' entry).
  if (params.changeAmount !== 0) {
    const enrollmentUpdate: Record<string, unknown> = {
      sessions_remaining: newBalance,
      updated_at: new Date().toISOString(),
    };
    if (params.changeAmount > 0) {
      enrollmentUpdate.parent_renewal_check_sent_at = null;
      enrollmentUpdate.parent_renewal_decision = null;
      enrollmentUpdate.parent_renewal_decision_at = null;
      enrollmentUpdate.last_low_balance_nudge_at = null;
      enrollmentUpdate.low_balance_nudges_sent = 0;
    }

    const { error: updateErr } = await supabase
      .from('enrollments')
      .update(enrollmentUpdate)
      .eq('id', params.enrollmentId);

    if (updateErr) {
      throw new Error(`addTuitionBalance: enrollment update failed: ${updateErr.message}`);
    }
  }

  // 3. Ledger insert (preserves existing shape)
  const { data: ledger, error: ledgerErr } = await supabase
    .from('tuition_session_ledger')
    .insert({
      enrollment_id: params.enrollmentId,
      change_amount: params.changeAmount,
      balance_after: newBalance,
      reason: params.reason,
      created_by: params.createdBy,
      payment_id: params.paymentId ?? null,
      notes: params.notes ?? null,
    })
    .select('id')
    .single();

  if (ledgerErr || !ledger) {
    throw new Error(`addTuitionBalance: ledger insert failed: ${ledgerErr?.message ?? 'unknown'}`);
  }

  return {
    enrollmentId: params.enrollmentId,
    previousBalance,
    newBalance,
    ledgerRowId: ledger.id,
  };
}
