// file: app/admin/tds/page.tsx
// TDS Compliance Dashboard with quarterly tracking
// Access: /admin/tds

'use client';

import { useState, useEffect } from 'react';
import { 
  FileText,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronDown,
  Shield,
  User,
  AlertTriangle,
  Info,
  ExternalLink,
} from 'lucide-react';

interface QuarterlySummary {
  quarter: string;
  deducted: number;
  deposited: number;
  pending: number;
  due_date: string;
  status: 'complete' | 'pending' | 'n/a';
}

interface CoachTds {
  coach_id: string;
  coach_name: string;
  coach_pan: string | null;
  total_paid: number;
  tds_deducted: number;
  tds_rate: string;
  pan_status: 'verified' | 'pending';
}

interface TdsData {
  financial_year: string;
  quarterly_summary: QuarterlySummary[];
  coach_wise: CoachTds[];
  alerts: {
    coaches_needing_pan: { id: string; name: string; earnings_ytd: number }[];
  };
  totals: {
    total_deducted: number;
    total_deposited: number;
    total_pending: number;
  };
}

export default function TdsPage() {
  const [data, setData] = useState<TdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositQuarter, setDepositQuarter] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [processing, setProcessing] = useState(false);

  // Generate FY options
  const fyOptions = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const options = [];
    for (let i = 0; i < 3; i++) {
      const startYear = currentYear - i;
      options.push(`${startYear}-${(startYear + 1).toString().slice(-2)}`);
    }
    return options;
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = selectedFY 
        ? `/api/admin/tds?fy=${selectedFY}`
        : '/api/admin/tds';
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setData(result);
        if (!selectedFY) {
          setSelectedFY(result.financial_year);
        }
      }
    } catch (error) {
      console.error('Failed to fetch TDS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDeposited = async () => {
    if (!depositQuarter || !challanNumber) return;
    
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/tds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_deposited',
          quarter: depositQuarter,
          financial_year: selectedFY,
          challan_number: challanNumber,
          deposit_date: depositDate || new Date().toISOString().split('T')[0],
        }),
      });
      
      const result = await res.json();
      if (result.success) {
        setShowDepositModal(false);
        setChallanNumber('');
        setDepositDate('');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to mark deposited:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getQuarterStatus = (q: QuarterlySummary) => {
    if (q.status === 'n/a') return { color: 'slate', icon: null, text: 'N/A' };
    if (q.status === 'complete') return { color: 'emerald', icon: CheckCircle, text: 'Complete' };
    return { color: 'amber', icon: Clock, text: 'Pending' };
  };

  if (loading && !data) {
    return (
      <div className="bg-surface-0 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-surface-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-[#121217] border border-white/[0.08] rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">TDS Compliance</h1>
              <p className="text-xs sm:text-sm text-text-tertiary">Section 194J</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-border rounded-lg sm:rounded-xl text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10] focus:border-transparent"
            >
              {fyOptions().map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
            <button
              onClick={() => window.open('https://www.incometax.gov.in/iec/foportal/', '_blank')}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-surface-1 border border-border rounded-lg sm:rounded-xl text-text-secondary hover:bg-surface-2 transition-colors text-xs sm:text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">TRACES</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {data?.alerts.coaches_needing_pan && data.alerts.coaches_needing_pan.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-400">PAN Required</p>
                <p className="text-sm text-amber-400/80 mt-1">
                  {data.alerts.coaches_needing_pan.map(c => c.name).join(', ')} -
                  Please collect PAN before next payout to ensure TDS compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quarterly Summary */}
        <div className="bg-surface-1 rounded-xl sm:rounded-2xl border border-border overflow-hidden">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-border">
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white">Quarterly Summary</h2>
            <p className="text-xs text-text-tertiary mt-0.5">TDS deducted and deposit status</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Quarter</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">TDS Deducted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Deposited</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Pending</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.quarterly_summary.map((q) => {
                  const status = getQuarterStatus(q);
                  return (
                    <tr key={q.quarter} className="hover:bg-surface-2 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#121217] border border-white/[0.08] rounded-xl flex items-center justify-center text-white font-bold text-sm">
                            {q.quarter}
                          </div>
                          <span className="font-medium text-white">
                            {q.quarter === 'Q1' && 'Apr - Jun'}
                            {q.quarter === 'Q2' && 'Jul - Sep'}
                            {q.quarter === 'Q3' && 'Oct - Dec'}
                            {q.quarter === 'Q4' && 'Jan - Mar'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">
                        ₹{q.deducted.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                        ₹{q.deposited.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {q.pending > 0 ? (
                          <span className="font-bold text-amber-400">₹{q.pending.toLocaleString()}</span>
                        ) : (
                          <span className="text-text-muted">₹0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-tertiary text-sm">
                        {q.due_date}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          status.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                          status.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-surface-2 text-text-tertiary'
                        }`}>
                          {status.icon && <status.icon className="w-3.5 h-3.5" />}
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {q.pending > 0 && (
                          <button
                            onClick={() => {
                              setDepositQuarter(q.quarter);
                              setShowDepositModal(true);
                            }}
                            className="px-3 py-1.5 bg-white/[0.08] text-gray-400 rounded-lg text-sm font-medium hover:bg-white/[0.12] transition-colors"
                          >
                            Mark Deposited
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-2 border-t-2 border-border">
                <tr>
                  <td className="px-6 py-4 font-semibold text-text-secondary">Total FY {selectedFY}</td>
                  <td className="px-6 py-4 text-right font-bold text-white">
                    ₹{data?.totals.total_deducted.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-400">
                    ₹{data?.totals.total_deposited.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-amber-400">
                    ₹{data?.totals.total_pending.toLocaleString() || 0}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Coach-wise TDS */}
        <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Coach-wise TDS</h2>
              <p className="text-sm text-text-tertiary mt-1">Individual coach TDS deductions for Form 26Q</p>
            </div>
            <button
              onClick={() => {
                // Generate 26Q format CSV
                if (!data?.coach_wise) return;
                const headers = ['PAN', 'Name', 'Section', 'Total Paid', 'TDS Deducted', 'TDS Rate'];
                const rows = data.coach_wise.map(c => [
                  c.coach_pan || 'PENDING',
                  c.coach_name,
                  '194J',
                  c.total_paid,
                  c.tds_deducted,
                  `${c.tds_rate}%`,
                ]);
                const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `26Q-${selectedFY}.csv`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-xl text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download 26Q Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">Coach</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">PAN</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">Total Paid</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">TDS Deducted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wider">TDS Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.coach_wise.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                      <FileText className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
                      No TDS deductions recorded yet
                    </td>
                  </tr>
                ) : (
                  data?.coach_wise.map((coach) => (
                    <tr key={coach.coach_id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#121217] border border-white/[0.08] rounded-xl flex items-center justify-center text-white font-bold">
                            {coach.coach_name.charAt(0)}
                          </div>
                          <span className="font-medium text-white">{coach.coach_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {coach.coach_pan ? (
                          <span className="font-mono text-text-secondary">{coach.coach_pan}</span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">
                        ₹{coach.total_paid.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-300">
                        ₹{coach.tds_deducted.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-text-tertiary">
                        {coach.tds_rate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        {/* TODO: Move TDS threshold (₹30,000/year) to site_settings */}
        <div className="mt-8 p-6 bg-white/[0.08] rounded-2xl border border-white/[0.08]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/[0.08] rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-300">TDS Compliance Reminder</h3>
              <ul className="mt-2 text-sm text-gray-400 space-y-1">
                <li>• TDS must be deposited by 7th of following month (30th April for Q4)</li>
                <li>• Form 26Q must be filed quarterly on TRACES portal</li>
                <li>• Issue Form 16A to coaches after filing 26Q</li>
                <li>• Threshold of ₹30,000/year per coach applies</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Deposit Modal */}
        {showDepositModal && (
          <div className="fixed inset-0 bg-surface-0/80 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-1 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-white">Mark TDS Deposited</h3>
                <p className="text-sm text-text-tertiary mt-1">
                  Recording deposit for {depositQuarter} FY {selectedFY}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Challan Number *
                  </label>
                  <input
                    type="text"
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    placeholder="e.g., 12345678901"
                    className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 placeholder:text-text-muted focus:ring-2 focus:ring-white/[0.10] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Deposit Date
                  </label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10] focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 px-4 py-3 border border-border rounded-xl text-text-secondary font-medium hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkDeposited}
                    disabled={processing || !challanNumber}
                    className="flex-1 px-4 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
