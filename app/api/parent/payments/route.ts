// ============================================================
// FILE: app/api/parent/payments/route.ts
// PURPOSE: Parent-scoped, ownership-checked payment history for the
//          calling parent's tuition enrollment(s), built off the
//          tuition_session_ledger -> payments join (PARENT-PAY.0 Q3).
//          Also returns a per-enrollment pay_state so the Home banner
//          and the history list come from ONE fetch (PARENT-PAY.2).
//
// READ-ONLY. No INSERT/UPDATE/RPC-write. No schema change.
// Ownership: enrollment ids are resolved SERVER-SIDE from the caller's
//   parent_id — the route never trusts a client-supplied enrollment_id.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sumLifetimeCredited } from '@/lib/tuition/admin-list-enrichment';

export const dynamic = 'force-dynamic';

// 'low' threshold mirrors the dashboard banner (dashboard:486).
// 2I config follow-up: source from site_settings; do not change here.
const LOW_BALANCE_THRESHOLD = 2;
const LOW_PAYABLE_STATUSES = ['active', 'paused', 'tuition_paused'];

// History shows real purchases only — manual_adjustment / enrollment_created excluded.
// (lifetime_credited still sums ALL positive ledger, matching the admin SSOT denominator.)
const HISTORY_REASONS = new Set(['initial_purchase', 'renewal', 'top_up']);

// ledger.payment_id is TEXT and holds TWO kinds of value:
//   - a payments.id UUID            (top_up rows)        → resolve via payments.id
//   - a Razorpay id 'pay_xxx'       (renewal/initial)    → resolve via payments.razorpay_payment_id
// payments.id is UUID-typed, so '.in(id, …)' must NOT receive 'pay_xxx' (invalid-uuid error) —
// partition the keys first.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface HistoryRow {
  date: string | null;
  reason: string;
  sessions_added: number;
  amount: number | null;
  currency: string | null;
  status: string | null;
  method: string | null;
  coupon_code: string | null;
  has_payment_detail: boolean;
}

interface PayState {
  enrollment_id: string;
  status: string;
  sessions_remaining: number;
  lifetime_credited: number;
  pay_due: 'initial' | 'low' | null;
  pay_url: string;
}

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // ── OWNERSHIP (1): resolve the CALLING parent from their session email ──
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', auth.email ?? '')
      .maybeSingle();

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // ── OWNERSHIP (2): the parent's OWN tuition enrollments only. Ids come
    //    from parent_id server-side — never from the client. ──
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, status, sessions_remaining')
      .eq('parent_id', parent.id)
      .eq('enrollment_type', 'tuition');

    const ownedEnrollmentIds = (enrollments || []).map(e => e.id);

    if (ownedEnrollmentIds.length === 0) {
      return NextResponse.json({ enrollments: [], history: {} });
    }

    // ── Positive ledger rows = the purchase history (initial_purchase | renewal
    //    | top_up | admin top-ups). session_completed deducts (change_amount < 0)
    //    are excluded by design. Scoped to OWNED enrollment ids only. ──
    const { data: ledgerRows } = await supabase
      .from('tuition_session_ledger')
      .select('enrollment_id, change_amount, reason, payment_id, created_at')
      .in('enrollment_id', ownedEnrollmentIds)
      .gt('change_amount', 0)
      .order('created_at', { ascending: false });

    // LEFT JOIN payments by EITHER key (may be null → graceful "recorded" row).
    type PaymentDetail = {
      amount: number; currency: string | null; status: string | null;
      payment_method: string | null; coupon_code: string | null;
    };
    const toDetail = (p: {
      amount: number; currency: string | null; status: string | null;
      payment_method: string | null; coupon_code: string | null;
    }): PaymentDetail => ({
      amount: p.amount, currency: p.currency, status: p.status,
      payment_method: p.payment_method, coupon_code: p.coupon_code,
    });

    const paymentIds = Array.from(
      new Set((ledgerRows || []).map(r => r.payment_id).filter((p): p is string => !!p)),
    );
    const uuidKeys = paymentIds.filter(id => UUID_RE.test(id));      // → payments.id
    const rzpKeys = paymentIds.filter(id => id.startsWith('pay_'));  // → payments.razorpay_payment_id
    const PAY_COLS = 'id, razorpay_payment_id, amount, currency, status, payment_method, coupon_code';

    const detailById: Record<string, PaymentDetail> = {};
    if (uuidKeys.length > 0) {
      const { data } = await supabase.from('payments').select(PAY_COLS).in('id', uuidKeys);
      for (const p of data || []) detailById[p.id] = toDetail(p);
    }
    const detailByRzp: Record<string, PaymentDetail> = {};
    if (rzpKeys.length > 0) {
      const { data } = await supabase.from('payments').select(PAY_COLS).in('razorpay_payment_id', rzpKeys);
      for (const p of data || []) {
        if (p.razorpay_payment_id) detailByRzp[p.razorpay_payment_id] = toDetail(p);
      }
    }
    // Resolve a ledger payment_id against either key (UUID first, then 'pay_xxx').
    const resolvePayment = (paymentId: string | null): PaymentDetail | undefined =>
      paymentId ? (detailById[paymentId] ?? detailByRzp[paymentId]) : undefined;

    // lifetime_credited per enrollment (positive ledger sum) — SSOT denominator.
    const lifetimeMap = sumLifetimeCredited(ledgerRows || []);

    // ── Build history grouped by enrollment_id ──
    const history: Record<string, HistoryRow[]> = {};
    for (const id of ownedEnrollmentIds) history[id] = [];
    for (const r of ledgerRows || []) {
      // BUG 3: real purchases only — manual_adjustment / enrollment_created excluded.
      if (!HISTORY_REASONS.has(r.reason)) continue;
      const pay = resolvePayment(r.payment_id);
      const row: HistoryRow = {
        date: r.created_at,
        reason: r.reason,
        sessions_added: r.change_amount,
        amount: pay ? pay.amount : null,
        currency: pay ? pay.currency : null,
        status: pay ? pay.status : null,
        method: pay ? pay.payment_method : null,
        coupon_code: pay ? pay.coupon_code : null,
        has_payment_detail: !!pay,
      };
      (history[r.enrollment_id] ||= []).push(row);
    }

    // ── pay_state per enrollment (drives the Home banner) ──
    const payStates: PayState[] = (enrollments || []).map(e => {
      const status = e.status ?? '';
      const remaining = e.sessions_remaining ?? 0;
      let pay_due: 'initial' | 'low' | null = null;
      if (status === 'payment_pending') {
        pay_due = 'initial';
      } else if (LOW_PAYABLE_STATUSES.includes(status) && remaining <= LOW_BALANCE_THRESHOLD) {
        pay_due = 'low';
      }
      const pay_url = `/tuition/pay/${e.id}${pay_due === 'low' ? '?renewal=true' : ''}`;
      return {
        enrollment_id: e.id,
        status,
        sessions_remaining: remaining,
        lifetime_credited: lifetimeMap[e.id] ?? 0,
        pay_due,
        pay_url,
      };
    });

    return NextResponse.json({ enrollments: payStates, history });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'parent_payments_error',
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
