// file: app/admin/payouts/page.tsx
// Coach Payouts Dashboard with processing and history
// Access: /admin/payouts

'use client';

import { useState, useEffect } from 'react';
import { 
  Wallet,
  IndianRupee,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Building2,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

interface PayoutSummary {
  due_this_month: { amount: number; count: number };
  pending_approval: { amount: number; count: number };
  paid_this_month: { amount: number; count: number };
  tds_to_deposit: { amount: number; quarter: string; fy: string };
}

interface Payout {
  id: string;
  coach_id: string;
  child_name: string;
  payout_month: number;
  payout_type: 'coach_cost' | 'lead_bonus';
  gross_amount: number;
  tds_amount: number;
  net_amount: number;
  scheduled_date: string;
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';
  paid_at: string | null;
  payment_reference: string | null;
  coaches: {
    name: string;
    email: string;
    pan_number: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
  };
}

export default function PayoutsPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch summary
      const summaryRes = await fetch('/api/admin/payouts?summary=true');
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setSummary(summaryData.summary);
      }

      // Fetch payouts based on tab
      const status = activeTab === 'pending' ? 'scheduled' : 'paid';
      const payoutsRes = await fetch(`/api/admin/payouts?status=${status}`);
      const payoutsData = await payoutsRes.json();
      if (payoutsData.success) {
        setPayouts(payoutsData.payouts);
      }
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedPayouts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Filter payouts
  const filteredPayouts = payouts.filter(p => 
    p.coaches?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.child_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Select all visible
  const toggleSelectAll = () => {
    if (selectedPayouts.length === filteredPayouts.length) {
      setSelectedPayouts([]);
    } else {
      setSelectedPayouts(filteredPayouts.map(p => p.id));
    }
  };

  // Process selected payouts
  const processPayouts = async () => {
    if (selectedPayouts.length === 0) return;
    
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          payout_ids: selectedPayouts,
          payment_method: 'manual',
          payment_reference: paymentRef,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSelectedPayouts([]);
        setPaymentRef('');
        setShowPayModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to process payouts:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Coach Name', 'Child', 'Month', 'Type', 'Gross', 'TDS', 'Net', 'Due Date'];
    const rows = filteredPayouts.map(p => [
      p.coaches?.name || '',
      p.child_name || '',
      `Month ${p.payout_month}/3`,
      p.payout_type,
      p.gross_amount,
      p.tds_amount,
      p.net_amount,
      p.scheduled_date,
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading && !summary) {
    return (
      <div className="min-h-[400px] bg-surface-0 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="bg-surface-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25 flex-shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Coach Payouts</h1>
              <p className="text-xs sm:text-sm text-text-tertiary">
                {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-surface-1 border border-border rounded-lg sm:rounded-xl text-text-secondary hover:bg-surface-2 transition-colors text-xs sm:text-sm flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export</span> CSV
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {[
              { icon: Clock, color: 'amber', label: 'Due This Month', amount: summary.due_this_month.amount, sub: `${summary.due_this_month.count} payouts` },
              { icon: FileText, color: 'blue', label: 'Pending', amount: summary.pending_approval.amount, sub: `${summary.pending_approval.count} payouts` },
              { icon: CheckCircle, color: 'emerald', label: 'Paid', amount: summary.paid_this_month.amount, sub: `${summary.paid_this_month.count} payouts` },
              { icon: Building2, color: 'violet', label: 'TDS', amount: summary.tds_to_deposit.amount, sub: `${summary.tds_to_deposit.quarter} FY${summary.tds_to_deposit.fy}` },
            ].map((card) => {
              const colorMap: Record<string, string> = { amber: 'bg-amber-500/20 text-amber-400', blue: 'bg-blue-500/20 text-blue-400', emerald: 'bg-emerald-500/20 text-emerald-400', violet: 'bg-violet-500/20 text-violet-400' };
              return (
                <div key={card.label} className="bg-surface-1 rounded-xl sm:rounded-2xl border border-border p-2.5 sm:p-3 lg:p-5 hover:border-border/80 transition-colors">
                  <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 mb-1.5 sm:mb-3">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[card.color]}`}>
                      <card.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm text-text-tertiary">{card.label}</span>
                  </div>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-white">₹{card.amount.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-text-muted mt-0.5">{card.sub}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs & Actions */}
        <div className="bg-surface-1 rounded-xl sm:rounded-2xl border border-border overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-border">
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-text-tertiary hover:bg-surface-2'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-text-tertiary hover:bg-surface-2'
                }`}
              >
                History
              </button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search coach or child..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 placeholder:text-text-muted focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Process Button */}
              {activeTab === 'pending' && selectedPayouts.length > 0 && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all whitespace-nowrap"
                >
                  <CheckCircle className="w-4 h-4" />
                  Process {selectedPayouts.length}
                </button>
              )}
            </div>
          </div>

          {/* Payouts */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
                <p className="text-text-secondary">No payouts found</p>
              </div>
            ) : (
              <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2">
                {filteredPayouts.map((payout) => (
                  <div key={payout.id} className="bg-surface-2 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {activeTab === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => toggleSelection(payout.id)}
                            className="rounded border-border text-emerald-500 focus:ring-emerald-500 flex-shrink-0"
                          />
                        )}
                        <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {payout.coaches?.name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{payout.coaches?.name || 'Unknown'}</p>
                          <p className="text-xs text-text-tertiary truncate">{payout.child_name || '-'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-emerald-400">₹{payout.net_amount.toLocaleString()}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          payout.payout_type === 'lead_bonus' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
                        }`}>
                          {payout.payout_type === 'lead_bonus' ? 'Lead' : 'Coach'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[10px] text-text-tertiary">
                      <span>Gross: ₹{payout.gross_amount.toLocaleString()}</span>
                      <span>TDS: {payout.tds_amount > 0 ? `₹${payout.tds_amount.toLocaleString()}` : '-'}</span>
                      <span>Due: {new Date(payout.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-2 border-b border-border">
                  <tr>
                    {activeTab === 'pending' && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedPayouts.length === filteredPayouts.length && filteredPayouts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-border text-emerald-500 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Coach</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Child</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">TDS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Net</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Due</th>
                    {activeTab === 'history' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">UTR</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-surface-2 transition-colors">
                      {activeTab === 'pending' && (
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => toggleSelection(payout.id)}
                            className="rounded border-border text-emerald-500 focus:ring-emerald-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {payout.coaches?.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{payout.coaches?.name || 'Unknown'}</p>
                            {!payout.coaches?.pan_number && (
                              <span className="text-xs text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                PAN missing
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-text-secondary">{payout.child_name || '-'}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-surface-2 text-text-secondary text-xs font-medium rounded">
                          {payout.payout_month}/3
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          payout.payout_type === 'lead_bonus'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-pink-500/20 text-pink-400'
                        }`}>
                          {payout.payout_type === 'lead_bonus' ? 'Lead' : 'Coach'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-text-secondary">
                        ₹{payout.gross_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-text-tertiary">
                        {payout.tds_amount > 0 ? `₹${payout.tds_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-400">
                        ₹{payout.net_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-text-tertiary text-sm">
                        {new Date(payout.scheduled_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      {activeTab === 'history' && (
                        <td className="px-4 py-4 text-text-tertiary text-sm font-mono">
                          {payout.payment_reference || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {activeTab === 'pending' && selectedPayouts.length > 0 && (
                  <tfoot className="bg-surface-2 border-t-2 border-border">
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-right font-semibold text-text-secondary">
                        Total Selected ({selectedPayouts.length}):
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-white">
                        ₹{filteredPayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + p.gross_amount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-text-secondary">
                        ₹{filteredPayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + p.tds_amount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-400">
                        ₹{filteredPayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + p.net_amount, 0)
                          .toLocaleString()}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Modal */}
        {showPayModal && (
          <div className="fixed inset-0 bg-surface-0/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-1 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-white">Process Payouts</h3>
                <p className="text-sm text-text-tertiary mt-1">
                  Marking {selectedPayouts.length} payouts as paid
                </p>
              </div>
              <div className="p-6">
                <div className="bg-emerald-500/20 rounded-xl p-4 mb-6 border border-emerald-500/30">
                  <p className="text-sm text-emerald-400 mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    ₹{filteredPayouts
                      .filter(p => selectedPayouts.includes(p.id))
                      .reduce((sum, p) => sum + p.net_amount, 0)
                      .toLocaleString()}
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Payment Reference (UTR/Transaction ID)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g., UTR123456789"
                    className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 placeholder:text-text-muted focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPayModal(false)}
                    className="flex-1 px-4 py-3 border border-border rounded-xl text-text-secondary font-medium hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processPayouts}
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
