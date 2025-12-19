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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Coach Payouts</h1>
              <p className="text-slate-500">
                {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-slate-500">Due This Month</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">₹{summary.due_this_month.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{summary.due_this_month.count} payouts</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-500">Pending Approval</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">₹{summary.pending_approval.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{summary.pending_approval.count} payouts</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-slate-500">Paid This Month</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">₹{summary.paid_this_month.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{summary.paid_this_month.count} payouts</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm text-slate-500">TDS to Deposit</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">₹{summary.tds_to_deposit.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{summary.tds_to_deposit.quarter} FY{summary.tds_to_deposit.fy}</p>
            </div>
          </div>
        )}

        {/* Tabs & Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b border-slate-100">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Pending Payouts
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Payout History
              </button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search coach or child..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

          {/* Payouts Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No payouts found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {activeTab === 'pending' && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedPayouts.length === filteredPayouts.length && filteredPayouts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Coach</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Child</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">TDS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Net</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due</th>
                    {activeTab === 'history' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">UTR</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-slate-50 transition-colors">
                      {activeTab === 'pending' && (
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => toggleSelection(payout.id)}
                            className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {payout.coaches?.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{payout.coaches?.name || 'Unknown'}</p>
                            {!payout.coaches?.pan_number && (
                              <span className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                PAN missing
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{payout.child_name || '-'}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                          {payout.payout_month}/3
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          payout.payout_type === 'lead_bonus' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-pink-100 text-pink-700'
                        }`}>
                          {payout.payout_type === 'lead_bonus' ? 'Lead' : 'Coach'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-700">
                        ₹{payout.gross_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500">
                        {payout.tds_amount > 0 ? `₹${payout.tds_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600">
                        ₹{payout.net_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-sm">
                        {new Date(payout.scheduled_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      {activeTab === 'history' && (
                        <td className="px-4 py-4 text-slate-500 text-sm font-mono">
                          {payout.payment_reference || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {activeTab === 'pending' && selectedPayouts.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-right font-semibold text-slate-700">
                        Total Selected ({selectedPayouts.length}):
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                        ₹{filteredPayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + p.gross_amount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        ₹{filteredPayouts
                          .filter(p => selectedPayouts.includes(p.id))
                          .reduce((sum, p) => sum + p.tds_amount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600">
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
            )}
          </div>
        </div>

        {/* Payment Modal */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Process Payouts</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Marking {selectedPayouts.length} payouts as paid
                </p>
              </div>
              <div className="p-6">
                <div className="bg-emerald-50 rounded-xl p-4 mb-6 border border-emerald-100">
                  <p className="text-sm text-emerald-600 mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-emerald-700">
                    ₹{filteredPayouts
                      .filter(p => selectedPayouts.includes(p.id))
                      .reduce((sum, p) => sum + p.net_amount, 0)
                      .toLocaleString()}
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Reference (UTR/Transaction ID)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g., UTR123456789"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPayModal(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
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
