// =============================================================================
// FILE: app/parent/payments/page.tsx
// PURPOSE: Parent Payments tab — payment history + a "payment due" CTA.
//          Reads /api/parent/payments (PARENT-PAY.1): { enrollments[], history{} }.
//          Read-only, parent theme (light/pink), mobile-first.
// =============================================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { IndianRupee, Receipt, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface PayState {
  enrollment_id: string;
  status: string;
  sessions_remaining: number;
  lifetime_credited: number;
  pay_due: 'initial' | 'low' | null;
  pay_url: string;
}

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

const REASON_LABELS: Record<string, string> = {
  initial_purchase: 'Initial purchase',
  renewal: 'Renewal',
  top_up: 'Top-up',
};

function reasonLabel(reason: string): string {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  const cleaned = reason.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatAmount(amount: number | null, currency: string | null): string {
  // payments.amount is stored in RUPEES (numeric(x,2)) for all rows — no /100.
  if (amount === null) return 'Recorded';
  const symbol = (currency ?? 'INR') === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ParentPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payStates, setPayStates] = useState<PayState[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/parent/payments');
      if (!res.ok) throw new Error('Could not load payments');
      const data = await res.json();
      setPayStates(Array.isArray(data?.enrollments) ? data.enrollments : []);
      setHistory(data?.history ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const due = payStates.filter(p => p.pay_due);
  const totalRows = Object.values(history).reduce((n, rows) => n + rows.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center max-w-sm rounded-2xl bg-white border border-gray-100 p-6">
          <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#cc007a] transition-colors min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">Your purchases and balances</p>
      </div>

      {/* Payment-due CTA(s) — makes the tab actionable, not just historical */}
      {due.map(p => (
        <div key={p.enrollment_id} className="rounded-2xl bg-white border border-[#FFD6EC] p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {p.pay_due === 'initial' ? 'Payment due — start classes' : 'Payment due — top up sessions'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.pay_due === 'initial'
                ? 'Complete payment to begin'
                : (p.sessions_remaining <= 0 ? 'Sessions have run out' : `Only ${p.sessions_remaining} left`)}
            </p>
          </div>
          <a
            href={p.pay_url}
            className="flex-shrink-0 bg-[#FF0099] text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-[#cc007a] transition-colors min-h-[44px] flex items-center gap-1"
          >
            Pay now
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      ))}

      {/* History — grouped per enrollment */}
      {totalRows === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center">
          <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No payments yet</p>
        </div>
      ) : (
        payStates
          .filter(p => (history[p.enrollment_id]?.length ?? 0) > 0)
          .map(p => (
            <div key={p.enrollment_id} className="space-y-2">
              <div className="flex items-center justify-between gap-3 px-1">
                {payStates.length > 1 ? (
                  <p className="text-xs font-medium text-gray-400">
                    {p.lifetime_credited} sessions purchased &middot; {p.sessions_remaining} left
                  </p>
                ) : <span />}
                <Link
                  href={`/tuition/pay/${p.enrollment_id}?renewal=true`}
                  className="inline-flex items-center bg-[#FF0099] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#cc007a] transition-colors"
                >
                  Add sessions
                </Link>
              </div>
              <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {(history[p.enrollment_id] ?? []).map((row, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF5F9] flex items-center justify-center flex-shrink-0">
                        <IndianRupee className="w-4 h-4 text-[#FF0099]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{reasonLabel(row.reason)}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(row.date)}
                          {row.method ? ` · ${row.method}` : ''}
                          {row.coupon_code ? ` · ${row.coupon_code}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatAmount(row.amount, row.currency)}</p>
                      <p className="text-[11px] text-gray-500 flex items-center justify-end gap-1">
                        +{row.sessions_added}
                        {row.has_payment_detail && row.status === 'captured' && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
