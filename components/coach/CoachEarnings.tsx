// file: components/coach/CoachEarnings.tsx
// Earnings section for coach dashboard - shows referral link, earnings, payout history
// Add this component to your existing coach dashboard page

'use client';

import { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  Share2,
  Copy,
  CheckCircle,
  Clock,
  IndianRupee,
  ChevronRight,
} from 'lucide-react';

interface EarningsSummary {
  total_earned: number;
  pending_amount: number;
  this_month_earned: number;
  coaching_earnings: number;
  referral_earnings: number;
  successful_referrals: number;
}

interface Payout {
  id: string;
  payout_type: 'coach_cost' | 'lead_bonus';
  gross_amount: number;
  tds_amount: number;
  net_amount: number;
  scheduled_date: string;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  child_name: string;
}

interface CoachEarningsProps {
  coachId: string;
  referralCode: string;
  referralLink: string;
}

export default function CoachEarnings({ coachId, referralCode, referralLink }: CoachEarningsProps) {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

  useEffect(() => {
    fetchEarnings();
  }, [coachId]);

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`/api/coach/earnings?coach_id=${coachId}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingPayouts = payouts.filter(p => p.status === 'scheduled');
  const paidPayouts = payouts.filter(p => p.status === 'paid');

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-700 rounded-xl"></div>
        <div className="h-48 bg-gray-700 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-6 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Your Referral Link</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Earn 20% commission on every enrollment from your referrals!
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm truncate"
          />
          <button
            onClick={copyReferralLink}
            className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              copied 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <span className="text-sm text-gray-400">
            Code: <span className="font-mono text-blue-400">{referralCode}</span>
          </span>
          <span className="text-sm text-gray-400">
            {summary?.successful_referrals || 0} successful referrals
          </span>
        </div>
      </div>

      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-white">₹{(summary?.total_earned || 0).toLocaleString()}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400">Pending</span>
          </div>
          <p className="text-2xl font-bold text-white">₹{(summary?.pending_amount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">This Month</span>
          </div>
          <p className="text-2xl font-bold text-white">₹{(summary?.this_month_earned || 0).toLocaleString()}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Referral Earnings</span>
          </div>
          <p className="text-2xl font-bold text-white">₹{(summary?.referral_earnings || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Payout History */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-white">Payout History</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              Pending ({pendingPayouts.length})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              Paid ({paidPayouts.length})
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-700">
          {(activeTab === 'pending' ? pendingPayouts : paidPayouts).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {activeTab} payouts
            </div>
          ) : (
            (activeTab === 'pending' ? pendingPayouts : paidPayouts).map((payout) => (
              <div key={payout.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    payout.payout_type === 'lead_bonus' 
                      ? 'bg-blue-500/20' 
                      : 'bg-blue-500/20'
                  }`}>
                    {payout.payout_type === 'lead_bonus' ? (
                      <Share2 className="w-5 h-5 text-blue-400" />
                    ) : (
                      <IndianRupee className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {payout.payout_type === 'lead_bonus' ? 'Referral Bonus' : 'Coaching Fee'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {payout.child_name || 'Student'} • {new Date(payout.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">₹{payout.net_amount.toLocaleString()}</p>
                  {payout.tds_amount > 0 && (
                    <p className="text-xs text-gray-500">TDS: ₹{payout.tds_amount}</p>
                  )}
                  {payout.payment_reference && (
                    <p className="text-xs text-emerald-400 font-mono">{payout.payment_reference}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Update Bank Details Link */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <a 
            href="/coach/onboarding" 
            className="flex items-center justify-between text-sm text-gray-400 hover:text-blue-400 transition-colors"
          >
            <span>Update Bank Details</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
