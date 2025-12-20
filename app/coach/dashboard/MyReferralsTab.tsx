// file: app/coach/dashboard/MyReferralsTab.tsx
// Professional Coach Referrals Component with Yestoryd Brand Colors
// Mobile-responsive, CRO-optimized design
// Brand Colors: Hot Pink #FF0099, Electric Blue #00ABFF, Yellow #FFDE00

'use client';

import { useState, useEffect } from 'react';
import { 
  Users, TrendingUp, CheckCircle, Clock, 
  Copy, Check, Share2, IndianRupee,
  RefreshCw, Gift, Zap, ArrowRight,
  Sparkles, Target, Wallet
} from 'lucide-react';

interface Referral {
  id: string;
  name: string;
  age: number;
  parent_name: string;
  parent_email: string;
  lead_status: string;
  created_at: string;
  enrolled_at: string | null;
  latest_assessment_score: number | null;
  expected_earning: number;
  status_display: {
    label: string;
    color: string;
  };
}

interface Stats {
  total_referrals: number;
  assessed: number;
  in_progress: number;
  enrolled: number;
  lost: number;
  conversion_rate: number;
}

interface Earnings {
  total_earned: number;
  pending: number;
  paid: number;
}

interface CoachInfo {
  id: string;
  name: string;
  referral_code: string;
  referral_link: string;
}

interface MyReferralsTabProps {
  coachEmail: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  assessed: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '📝' },
  contacted: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '📞' },
  call_scheduled: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '📅' },
  call_done: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: '✅' },
  enrolled: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '🎉' },
  active: { bg: 'bg-green-50', text: 'text-green-700', icon: '⭐' },
  lost: { bg: 'bg-red-50', text: 'text-red-700', icon: '❌' },
};

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

  const shareLink = async () => {
    if (!coach?.referral_link) return;
    
    const shareText = `🎯 Free AI Reading Assessment for your child!\n\nKnow your child's reading level in just 5 minutes with Yestoryd's AI-powered assessment.\n\n✨ Completely FREE\n📊 Instant detailed report\n🎓 Personalized recommendations\n\n👉 ${coach.referral_link}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Free Reading Assessment - Yestoryd',
          text: shareText,
          url: coach.referral_link,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        copyLink();
      }
    } else {
      // Fallback: Open WhatsApp share
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF0099] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your referrals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchReferrals}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Referral Card - Yestoryd Brand Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF0099] via-[#FF0099] to-[#7B008B] p-6 md:p-8 text-white shadow-2xl">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00ABFF]/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur rounded-2xl">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Earn ₹1,200 Per Referral</h2>
                <p className="text-pink-100 text-sm md:text-base">Share & earn when parents enroll!</p>
              </div>
            </div>
            <button 
              onClick={fetchReferrals}
              className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition backdrop-blur"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Referral Code - Large & Prominent */}
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 md:p-5 mb-4 border border-white/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-pink-100 text-xs uppercase tracking-wider mb-1 font-medium">Your Referral Code</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl md:text-3xl font-mono font-black tracking-wider">
                    {coach?.referral_code || 'Loading...'}
                  </span>
                  <button
                    onClick={copyCode}
                    disabled={!coach?.referral_code}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition disabled:opacity-50"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                {copied && <p className="text-xs text-pink-100 mt-1">Code copied! ✓</p>}
              </div>
              
              {/* Quick Share Button - Mobile CTA */}
              <button
                onClick={shareLink}
                disabled={!coach?.referral_link}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#FF0099] rounded-xl font-bold hover:bg-pink-50 transition shadow-lg disabled:opacity-50 w-full md:w-auto"
              >
                <Share2 className="w-5 h-5" />
                <span>Share on WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Referral Link */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <p className="text-pink-100 text-xs uppercase tracking-wider mb-2 font-medium">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-lg px-3 py-2.5 overflow-hidden">
                <p className="text-sm font-medium truncate">
                  {coach?.referral_link || 'Loading...'}
                </p>
              </div>
              <button
                onClick={copyLink}
                disabled={!coach?.referral_link}
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition flex-shrink-0 disabled:opacity-50"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            {copiedLink && <p className="text-xs text-pink-100 mt-2 text-center">Link copied! Share it now 🚀</p>}
          </div>
        </div>
      </div>

      {/* Stats Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <Users className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-gray-900">{stats?.total_referrals || 0}</p>
          <p className="text-xs text-gray-400 mt-1">Referrals</p>
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-emerald-600 font-medium">Enrolled</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-emerald-600">{stats?.enrolled || 0}</p>
          <p className="text-xs text-emerald-400 mt-1">Converted</p>
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs text-amber-600 font-medium">In Progress</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-amber-600">{stats?.in_progress || 0}</p>
          <p className="text-xs text-amber-400 mt-1">Following up</p>
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-[#00ABFF]/20 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-[#00ABFF]/10 rounded-lg">
              <Target className="w-4 h-4 text-[#00ABFF]" />
            </div>
            <span className="text-xs text-[#00ABFF] font-medium">Conversion</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-[#00ABFF]">{stats?.conversion_rate || 0}%</p>
          <p className="text-xs text-[#00ABFF]/60 mt-1">Success rate</p>
        </div>
      </div>

      {/* Earnings Card - Prominent CTA */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-500 rounded-xl">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Your Referral Earnings</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-emerald-600 font-medium mb-1">Total Earned</p>
              <p className="text-xl md:text-2xl font-black text-emerald-600">
                ₹{(earnings?.total_earned || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-amber-600 font-medium mb-1">Pending</p>
              <p className="text-xl md:text-2xl font-black text-amber-600">
                ₹{(earnings?.pending || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-[#00ABFF] font-medium mb-1">Paid</p>
              <p className="text-xl md:text-2xl font-black text-[#00ABFF]">
                ₹{(earnings?.paid || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          
          <p className="text-center text-sm text-gray-500 mt-4 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FFDE00]" />
            <span>₹1,200 (20% lead bonus) per enrollment • Paid monthly on 7th</span>
          </p>
        </div>
      </div>

      {/* Referrals List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FF0099]" />
            Your Referred Leads
          </h3>
          <span className="text-sm text-gray-500">{referrals.length} total</span>
        </div>

        {referrals.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF0099]/10 to-[#00ABFF]/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Gift className="w-10 h-10 text-[#FF0099]" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">No referrals yet</h4>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Share your referral link with parents to start earning ₹1,200 for every enrollment!
            </p>
            <button
              onClick={shareLink}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-xl font-bold hover:bg-[#E6008A] transition shadow-lg shadow-[#FF0099]/25"
            >
              <Share2 className="w-5 h-5" />
              Share Your Link Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {referrals.map((referral) => {
              const statusConfig = STATUS_CONFIG[referral.lead_status] || STATUS_CONFIG.assessed;
              return (
                <div key={referral.id} className="p-4 md:p-5 hover:bg-gray-50/50 transition">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Lead Info */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        {referral.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{referral.name}</p>
                          <span className="text-xs text-gray-400">Age {referral.age}</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{referral.parent_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(referral.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Status & Earnings */}
                    <div className="flex items-center gap-3 md:gap-4">
                      {/* Assessment Score */}
                      {referral.latest_assessment_score !== null && (
                        <div className="text-center px-3">
                          <span className={`text-lg font-bold ${
                            referral.latest_assessment_score >= 7 ? 'text-emerald-600' :
                            referral.latest_assessment_score >= 5 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {referral.latest_assessment_score}/10
                          </span>
                          <p className="text-[10px] text-gray-400 uppercase">Score</p>
                        </div>
                      )}

                      {/* Status Badge */}
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.icon} {referral.status_display?.label || referral.lead_status}
                      </span>

                      {/* Earning */}
                      {referral.expected_earning > 0 && (
                        <div className="text-right min-w-[80px]">
                          <p className="text-lg font-bold text-emerald-600">
                            +₹{referral.expected_earning.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-emerald-500 uppercase">Earned</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How It Works - Clear CTA Flow */}
      <div className="bg-gradient-to-br from-[#00ABFF]/5 via-white to-[#FF0099]/5 rounded-2xl border border-gray-100 p-5 md:p-6">
        <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#FFDE00]" />
          How Referral Earnings Work
        </h3>
        
        <div className="grid md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm relative">
            <div className="absolute -top-3 -left-2 w-8 h-8 bg-[#FF0099] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              1
            </div>
            <div className="pt-2">
              <h4 className="font-semibold text-gray-900 mb-1">Share Your Link</h4>
              <p className="text-sm text-gray-500">Parent takes the free AI reading assessment via your unique link</p>
            </div>
            <ArrowRight className="hidden md:block absolute -right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 z-10" />
          </div>
          
          {/* Step 2 */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm relative">
            <div className="absolute -top-3 -left-2 w-8 h-8 bg-[#00ABFF] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              2
            </div>
            <div className="pt-2">
              <h4 className="font-semibold text-gray-900 mb-1">Parent Enrolls</h4>
              <p className="text-sm text-gray-500">When they pay ₹5,999 for the 3-month coaching program</p>
            </div>
            <ArrowRight className="hidden md:block absolute -right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 z-10" />
          </div>
          
          {/* Step 3 */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200 shadow-sm relative">
            <div className="absolute -top-3 -left-2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              3
            </div>
            <div className="pt-2">
              <h4 className="font-semibold text-emerald-700 mb-1">You Earn ₹1,200! 🎉</h4>
              <p className="text-sm text-emerald-600">Paid directly to your bank on the 7th of each month</p>
            </div>
          </div>
        </div>
        
        {/* Motivational CTA */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-3">
            💡 <span className="font-medium">Pro tip:</span> Share in parent WhatsApp groups for best results!
          </p>
          <button
            onClick={shareLink}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-[#FF0099]/25"
          >
            <Share2 className="w-5 h-5" />
            Start Earning Now
          </button>
        </div>
      </div>
    </div>
  );
}
