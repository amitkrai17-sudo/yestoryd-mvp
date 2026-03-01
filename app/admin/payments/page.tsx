'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, Search, Filter, Download, RefreshCw,
  TrendingUp, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight,
  Loader2, Calendar, X, ExternalLink, ShieldAlert,
} from 'lucide-react';

interface Payment {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  status: string;
  captured_at: string | null;
  coupon_code: string | null;
  source: string | null;
  created_at: string;
  parent: { id: string; name: string; email: string; phone: string } | null;
  child: { id: string; child_name: string; age: number } | null;
}

interface Stats {
  today: { revenue: number; count: number };
  month: { revenue: number; count: number };
  failed: { count: number };
  refunds: { total: number; pending: number; count: number };
  allTime: { revenue: number; count: number };
}

interface OrphanedPayment {
  id: string;
  detected_at: string;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  captured_at: string;
  has_booking: boolean;
  has_payment_record: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  captured: 'bg-green-500/20 text-green-400 border border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  refunded: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orphans, setOrphans] = useState<OrphanedPayment[]>([]);
  const [orphansLoading, setOrphansLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments/stats');
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchOrphans = useCallback(async () => {
    setOrphansLoading(true);
    try {
      const res = await fetch('/api/admin/orphaned-payments?days=7');
      if (res.ok) {
        const data = await res.json();
        setOrphans(data.orphans || []);
      }
    } catch {}
    setOrphansLoading(false);
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25', status: statusFilter });
      if (search) params.set('search', search);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/admin/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch {
      setPayments([]);
    }
    setLoading(false);
  }, [page, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); fetchOrphans(); }, [fetchStats, fetchOrphans]);
  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleExport = () => {
    const params = new URLSearchParams({ status: statusFilter });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.open(`/api/admin/payments/export?${params}`, '_blank');
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Payments</h1>
            <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">Payment history and transaction management</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchStats(); fetchPayments(); fetchOrphans(); }} className="p-2 rounded-xl bg-surface-2 text-text-secondary hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-2 text-text-secondary hover:text-white text-sm transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <StatCard label="Today" value={formatINR(stats.today.revenue)} sub={`${stats.today.count} payments`} icon={<IndianRupee className="w-5 h-5 text-green-400" />} />
            <StatCard label="This Month" value={formatINR(stats.month.revenue)} sub={`${stats.month.count} payments`} icon={<TrendingUp className="w-5 h-5 text-gray-300" />} />
            <StatCard label="All Time" value={formatINR(stats.allTime.revenue)} sub={`${stats.allTime.count} total`} icon={<IndianRupee className="w-5 h-5 text-gray-300" />} />
            <StatCard label="Failed (30d)" value={String(stats.failed.count)} sub="payment attempts" icon={<AlertTriangle className="w-5 h-5 text-red-400" />} />
            <StatCard label="Refunds" value={formatINR(stats.refunds.total)} sub={`${stats.refunds.count} refunds`} icon={<ArrowUpDown className="w-5 h-5 text-yellow-400" />} />
          </div>
        )}

        {/* Orphaned Payments Alert */}
        {!orphansLoading && orphans.length > 0 && (
          <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-red-300">
                {orphans.length} Orphaned Payment{orphans.length > 1 ? 's' : ''} — Parents paid but have no enrollment
              </h3>
            </div>
            <div className="space-y-2">
              {orphans.map((o) => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-1/50 rounded-lg p-3 border border-red-500/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white font-medium">{formatINR(o.amount)}</span>
                      <span className="text-text-tertiary">—</span>
                      <span className="text-text-secondary truncate">{o.contact_name || o.email || o.phone || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-tertiary mt-1">
                      <span className="font-mono">{o.razorpay_payment_id}</span>
                      <span>{o.captured_at ? new Date(o.captured_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      <span className="text-yellow-400">
                        {o.has_booking && o.has_payment_record ? 'Booking + Payment record, no enrollment' :
                         o.has_booking ? 'Booking found, no payment record or enrollment' :
                         o.has_payment_record ? 'Payment record, no booking or enrollment' :
                         'No records in DB'}
                      </span>
                    </div>
                  </div>
                  <a
                    href={`https://dashboard.razorpay.com/app/payments/${o.razorpay_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Investigate
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface-1 rounded-xl border border-border p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search by payment/order ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-8 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-text-tertiary" />
                </button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="flex-shrink-0 px-2.5 py-1.5 text-sm border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
              >
                <option value="all">All Status</option>
                <option value="captured">Captured</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Calendar className="w-4 h-4 text-text-tertiary" />
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-2 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:ring-2 focus:ring-white/[0.10]" />
                <span className="text-text-tertiary text-xs">to</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-2 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:ring-2 focus:ring-white/[0.10]" />
              </div>

              {(statusFilter !== 'all' || search || dateFrom || dateTo) && (
                <button
                  onClick={() => { setStatusFilter('all'); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                  className="flex-shrink-0 text-sm text-gray-300 hover:underline whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payments List */}
        {loading ? (
          <div className="bg-surface-1 rounded-xl border border-border p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-surface-1 rounded-xl border border-border p-8 text-center text-text-tertiary">No payments found</div>
        ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="sm:hidden space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="bg-surface-1 border border-border rounded-xl p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">{p.parent?.name || '-'}</div>
                    <div className="text-xs text-text-tertiary truncate">{p.child?.child_name || '-'}</div>
                  </div>
                  <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[p.status] || 'bg-surface-2 text-text-secondary border border-border'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-semibold">{formatINR(p.amount)}</span>
                  <div className="flex items-center gap-3 text-text-tertiary">
                    {p.coupon_code && <span className="text-gray-300">{p.coupon_code}</span>}
                    <span>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden sm:block bg-surface-1 rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-0 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Parent</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Child</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Payment ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Coupon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-2">
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm">{p.parent?.name || '-'}</div>
                        <div className="text-text-tertiary text-xs">{p.parent?.email || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{p.child?.child_name || '-'}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{formatINR(p.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-surface-2 text-text-secondary'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary text-xs font-mono">{p.razorpay_payment_id?.slice(-12) || '-'}</td>
                      <td className="px-4 py-3 text-text-tertiary text-xs">{p.coupon_code || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-text-tertiary">{total} total payments</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-xs text-text-secondary">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>
          )}
        </div>

          {/* Pagination for mobile */}
          {totalPages > 1 && (
            <div className="sm:hidden flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-text-tertiary">{total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-xs text-text-secondary">{page}/{totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-tertiary">{label}</span>
        {icon}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}
