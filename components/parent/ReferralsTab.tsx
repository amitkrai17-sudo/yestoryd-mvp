// =============================================================================
// FILE: components/parent/ReferralsTab.tsx
// PURPOSE: Parent referral dashboard - view code, track referrals, share
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  Gift, Copy, Check, Share2, Users, IndianRupee,
  Loader2, ChevronRight, MessageCircle, Clock, Sparkles
} from 'lucide-react';

interface ReferralData {
  referralCode: string;
  creditBalance: number;
  creditExpiry: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
}

interface ReferralConfig {
  creditAmount: number;
  discountPercent: number;
}

interface ReferralsTabProps {
  parentEmail: string;
  parentName: string;
  childName: string;
}

export default function ReferralsTab({ parentEmail, parentName, childName }: ReferralsTabProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<ReferralData | null>(null);
  const [config, setConfig] = useState<ReferralConfig>({ creditAmount: 600, discountPercent: 10 });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReferralData();
    fetchReferralConfig();
  }, [parentEmail]);

  async function fetchReferralConfig() {
    try {
      // Fetch program price and referral percentage
      const res = await fetch('/api/coupons/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType: 'coaching' }),
      });
      const result = await res.json();

      if (result.success) {
        const programPrice = result.breakdown.originalAmount;

        // Fetch referral percentage from settings
        const settingsRes = await fetch('/api/admin/settings?categories=referral');
        const settingsData = await settingsRes.json();

        let creditPercent = 10;
        let discountPercent = 10;

        settingsData.settings?.forEach((s: { key: string; value: string }) => {
          const val = String(s.value).replace(/"/g, '');
          if (s.key === 'parent_referral_credit_percent' || s.key === 'referral_credit_percent') {
            creditPercent = parseInt(val) || 10;
          }
          if (s.key === 'parent_referral_discount_percent' || s.key === 'referral_discount_percent') {
            discountPercent = parseInt(val) || 10;
          }
        });

        const creditAmount = Math.round((programPrice * creditPercent) / 100);
        setConfig({ creditAmount, discountPercent });
      }
    } catch (err) {
      console.error('Error fetching referral config:', err);
    }
  }

  async function fetchReferralData() {
    try {
      const res = await fetch(`/api/parent/referral?email=${encodeURIComponent(parentEmail)}`);
      const result = await res.json();

      if (res.ok && result.success) {
        setData(result.data);
      } else {
        // No referral code yet - show generate option
        setData(null);
      }
    } catch (err) {
      console.error('Error fetching referral data:', err);
      setError('Failed to load referral data');
    }
    setLoading(false);
  }

  async function generateReferralCode() {
    setGenerating(true);
    setError('');

    try {
      const res = await fetch('/api/parent/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parentEmail }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to generate code');
      }
    } catch (err) {
      setError('Failed to generate referral code');
    }
    setGenerating(false);
  }

  function copyToClipboard() {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function shareOnWhatsApp() {
    if (data?.referralCode) {
      const message = encodeURIComponent(
        `Hey! 👋\n\n` +
        `My child ${childName} has been doing amazing with Yestoryd's reading program! 📚\n\n` +
        `Use my referral code *${data.referralCode}* to get ${config.discountPercent}% OFF your enrollment.\n\n` +
        `Take the free AI reading assessment here: https://yestoryd.com/assessment?ref=${data.referralCode}\n\n` +
        `Trust me, it's worth it! 🌟`
      );
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  }

  function copyShareLink() {
    if (data?.referralCode) {
      const link = `https://yestoryd.com/assessment?ref=${data.referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Format credit amount for display
  const formatCredit = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#7b008b] mx-auto mb-4" />
          <p className="text-text-tertiary">Loading referral data...</p>
        </div>
      </div>
    );
  }

  // No referral code yet - show generate UI
  if (!data) {
    return (
      <div className="space-y-6">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-[#ff0099]/10 to-[#7b008b]/10 rounded-2xl p-8 text-center border border-[#ff0099]/20">
          <div className="w-20 h-20 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Refer Friends, Earn {formatCredit(config.creditAmount)}!
          </h2>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            Share your love for Yestoryd! When your friends enroll using your code,
            you get {formatCredit(config.creditAmount)} credit and they get {config.discountPercent}% off.
          </p>

          <button
            onClick={generateReferralCode}
            disabled={generating}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Get My Referral Code
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-surface-2 rounded-2xl border border-[#7b008b]/20 p-6">
          <h3 className="font-bold text-white mb-4">How It Works</h3>
          <div className="grid gap-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-pink-500/20 text-pink-400 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-white">Get Your Code</p>
                <p className="text-sm text-text-tertiary">Generate your unique referral code</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-white">Share With Friends</p>
                <p className="text-sm text-text-tertiary">They get {config.discountPercent}% off on enrollment</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-white">Earn {formatCredit(config.creditAmount)} Credit</p>
                <p className="text-sm text-text-tertiary">Use for e-learning or re-enrollment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Has referral code - show full dashboard
  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <div className="bg-gradient-to-br from-[#ff0099]/10 to-[#7b008b]/10 rounded-2xl p-6 border border-[#ff0099]/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-xl flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-tertiary">Your Referral Code</p>
            <p className="text-lg sm:text-xl font-bold text-white font-mono tracking-wider break-all">{data.referralCode}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-2 border border-white/[0.08] rounded-xl font-medium text-text-secondary hover:bg-surface-1 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button
            onClick={shareOnWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Share on WhatsApp
          </button>
        </div>

        <button
          onClick={copyShareLink}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-[#ff0099] text-sm font-medium hover:bg-white/5 rounded-lg transition-all"
        >
          <Share2 className="w-4 h-4" />
          Copy Share Link
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Credit Balance */}
        <div className="bg-surface-2 rounded-xl border border-[#7b008b]/20 p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <IndianRupee className="w-4 h-4" />
            <span className="text-sm font-medium">Credit Balance</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCredit(data.creditBalance)}</p>
          {data.creditExpiry && (
            <p className="text-xs text-text-tertiary mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires: {new Date(data.creditExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>

        {/* Successful Referrals */}
        <div className="bg-surface-2 rounded-xl border border-[#7b008b]/20 p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Referrals</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.successfulReferrals}</p>
          <p className="text-xs text-text-tertiary mt-1">
            {data.pendingReferrals > 0 ? `${data.pendingReferrals} pending` : 'Successful enrollments'}
          </p>
        </div>
      </div>

      {/* Total Earned Card */}
      {data.totalEarned > 0 && (
        <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400 font-medium">Total Earned</p>
              <p className="text-3xl font-bold text-green-400">{formatCredit(data.totalEarned)}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* How to Use Credit */}
      <div className="bg-surface-2 rounded-xl border border-[#7b008b]/20 p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#ff0099]" />
          Use Your Credit
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-surface-1 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white">Re-enrollment</p>
                <p className="text-xs text-text-tertiary">Apply to next coaching program</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-tertiary" />
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-1 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">E-Learning</p>
                <p className="text-xs text-text-tertiary">Subscribe to video library</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-tertiary" />
          </div>
        </div>
      </div>

      {/* Share Prompt */}
      <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/30 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-base text-yellow-300">
          <strong>Tip:</strong> The more you share, the more you earn!
          Each successful referral = {formatCredit(config.creditAmount)} credit.
        </p>
      </div>
    </div>
  );
}
