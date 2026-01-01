// file: app/coach/dashboard/MyReferralsTab.tsx
// Coach Referrals Tab - FIXED to use database values
// Shows referral code, link, stats, and earnings

'use client';

import { useState, useEffect } from 'react';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle,
  Target,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface CoachInfo {
  id: string;
  name: string;
  referral_code: string;
  referral_link: string;
}

interface Referral {
  id: string;
  name: string;
  parent_name: string;
  parent_phone: string;
  lead_status: string;
  created_at: string;
  expected_earning: number;
}

interface Stats {
  total_referrals: number;
  enrolled: number;
  in_progress: number;
  conversion_rate: number;
}

interface Earnings {
  total_earned: number;
  pending: number;
  paid: number;
}

interface MyReferralsTabProps {
  coachEmail: string;
}

export default function MyReferralsTab({ coachEmail }: MyReferralsTabProps) {
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (coachEmail) {
      fetchReferrals();
    }
  }, [coachEmail]);

  const fetchReferrals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/my-referrals?email=${encodeURIComponent(coachEmail)}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCoach(data.coach);
        setReferrals(data.referrals || []);
        setStats(data.stats);
        setEarnings(data.earnings);
      } else {
        setError(data.error || 'Failed to fetch referrals');
      }
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const copyCode = async () => {
    if (!coach?.referral_code) return;
    await navigator.clipboard.writeText(coach.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = async () => {
    if (!coach?.referral_link) return;
    await navigator.clipboard.writeText(coach.referral_link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareOnWhatsApp = () => {
    if (!coach?.referral_link) return;
    const message = encodeURIComponent(
      `🎯 Get a FREE AI Reading Assessment for your child!\n\n` +
      `Yestoryd uses AI to analyze your child's reading and provides personalized coaching.\n\n` +
      `✨ Click here to start: ${coach.referral_link}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-[#00abff] animate-spin" />
        <span className="ml-2 text-gray-500">Loading your referrals...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchReferrals}
          className="px-4 py-2 bg-[#00abff] text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card - Referral Link */}
      <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-6 h-6" />
              <h2 className="text-xl font-bold">Earn ₹1,200 Per Referral</h2>
            </div>
            <p className="text-pink-100">Share & earn when parents enroll!</p>
          </div>
          <button
            onClick={fetchReferrals}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Referral Code - FROM DATABASE */}
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-pink-200 text-xs uppercase tracking-wide mb-2">Your Referral Code</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-wider">
              {coach?.referral_code || 'Loading...'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyCode}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                title="Copy code"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#ff0099] rounded-lg font-medium hover:bg-pink-50 transition"
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Referral Link - FROM DATABASE */}
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-pink-200 text-xs uppercase tracking-wide mb-2">Your Referral Link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/10 rounded-lg px-4 py-2 font-mono text-sm truncate">
              {coach?.referral_link || 'Loading...'}
            </div>
            <button
              onClick={copyLink}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition flex-shrink-0"
              title="Copy link"
            >
              {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_referrals || 0}</p>
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-xs text-gray-400">Referrals</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.enrolled || 0}</p>
          <p className="text-sm text-gray-500">Enrolled</p>
          <p className="text-xs text-gray-400">Converted</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats?.in_progress || 0}</p>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-xs text-gray-400">Following up</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats?.conversion_rate || 0}%</p>
          <p className="text-sm text-gray-500">Conversion</p>
          <p className="text-xs text-gray-400">Success rate</p>
        </div>
      </div>

      {/* Earnings Card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-bold text-gray-900">Your Referral Earnings</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <p className="text-sm text-emerald-600 mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-emerald-700">
              ₹{(earnings?.total_earned || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <p className="text-sm text-amber-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-700">
              ₹{(earnings?.pending || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-600 mb-1">Paid</p>
            <p className="text-2xl font-bold text-blue-700">
              ₹{(earnings?.paid || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
          <span className="text-amber-500">✨</span>
          <span>₹1,200 (20% lead bonus) per enrollment • Paid monthly on 7th</span>
        </div>
      </div>

      {/* Referrals List */}
      {referrals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-900">Your Referred Leads</h3>
          </div>
          <div className="divide-y">
            {referrals.map((referral) => (
              <div key={referral.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{referral.name}</p>
                    <p className="text-sm text-gray-500">{referral.parent_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(referral.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      referral.lead_status === 'enrolled' || referral.lead_status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : referral.lead_status === 'lost'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {referral.lead_status || 'Pending'}
                    </span>
                    {(referral.lead_status === 'enrolled' || referral.lead_status === 'active') && (
                      <p className="text-sm text-emerald-600 font-medium mt-1">
                        +₹{referral.expected_earning?.toLocaleString('en-IN') || '1,200'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {referrals.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Gift className="w-12 h-12 text-pink-300 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 mb-2">No Referrals Yet</h3>
          <p className="text-gray-500 mb-4">
            Share your referral link to start earning ₹1,200 per enrollment!
          </p>
          <button
            onClick={shareOnWhatsApp}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#22c35e] transition"
          >
            <Share2 className="w-5 h-5" />
            Share on WhatsApp
          </button>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-gray-900 mb-3">💡 How Referral Earnings Work</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">1.</span>
            <span>Share your unique referral link with parents</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">2.</span>
            <span>Parents complete the free AI reading assessment</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">3.</span>
            <span>When they enroll, you earn ₹1,200 lead bonus</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">4.</span>
            <span>Bonus is added to your monthly payout on the 7th</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
