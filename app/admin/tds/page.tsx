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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">TDS Compliance</h1>
              <p className="text-slate-500">Section 194J - Professional Fees</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {fyOptions().map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
            <button
              onClick={() => window.open('https://www.incometax.gov.in/iec/foportal/', '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              TRACES Portal
            </button>
          </div>
        </div>

        {/* Alerts */}
        {data?.alerts.coaches_needing_pan && data.alerts.coaches_needing_pan.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">PAN Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  {data.alerts.coaches_needing_pan.map(c => c.name).join(', ')} - 
                  Please collect PAN before next payout to ensure TDS compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quarterly Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Quarterly Summary</h2>
            <p className="text-sm text-slate-500 mt-1">TDS deducted and deposit status by quarter</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quarter</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">TDS Deducted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Deposited</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.quarterly_summary.map((q) => {
                  const status = getQuarterStatus(q);
                  return (
                    <tr key={q.quarter} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                            {q.quarter}
                          </div>
                          <span className="font-medium text-slate-900">
                            {q.quarter === 'Q1' && 'Apr - Jun'}
                            {q.quarter === 'Q2' && 'Jul - Sep'}
                            {q.quarter === 'Q3' && 'Oct - Dec'}
                            {q.quarter === 'Q4' && 'Jan - Mar'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">
                        ₹{q.deducted.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                        ₹{q.deposited.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {q.pending > 0 ? (
                          <span className="font-bold text-amber-600">₹{q.pending.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">₹0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {q.due_date}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          status.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                          status.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
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
                            className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200 transition-colors"
                          >
                            Mark Deposited
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 font-semibold text-slate-700">Total FY {selectedFY}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    ₹{data?.totals.total_deducted.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
                    ₹{data?.totals.total_deposited.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-amber-600">
                    ₹{data?.totals.total_pending.toLocaleString() || 0}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Coach-wise TDS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Coach-wise TDS</h2>
              <p className="text-sm text-slate-500 mt-1">Individual coach TDS deductions for Form 26Q</p>
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
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download 26Q Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Coach</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">PAN</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">TDS Deducted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">TDS Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.coach_wise.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      No TDS deductions recorded yet
                    </td>
                  </tr>
                ) : (
                  data?.coach_wise.map((coach) => (
                    <tr key={coach.coach_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center text-white font-bold">
                            {coach.coach_name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900">{coach.coach_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {coach.coach_pan ? (
                          <span className="font-mono text-slate-700">{coach.coach_pan}</span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">
                        ₹{coach.total_paid.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-violet-600">
                        ₹{coach.tds_deducted.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
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
        <div className="mt-8 p-6 bg-violet-50 rounded-2xl border border-violet-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-violet-900">TDS Compliance Reminder</h3>
              <ul className="mt-2 text-sm text-violet-700 space-y-1">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Mark TDS Deposited</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Recording deposit for {depositQuarter} FY {selectedFY}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Challan Number *
                  </label>
                  <input
                    type="text"
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    placeholder="e.g., 12345678901"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Deposit Date
                  </label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkDeposited}
                    disabled={processing || !challanNumber}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
