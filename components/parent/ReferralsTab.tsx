// =============================================================================
// FILE: components/parent/ReferralsTab.tsx
// PURPOSE: Parent referral program tab with share functionality
// UI/UX: AIDA + LIFT framework, mobile-first, CRO optimized
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { 
  Gift, Copy, CheckCircle, Share2, MessageCircle, 
  Mail, Users, TrendingUp, Clock, Sparkles,
  ChevronRight, AlertCircle, Wallet
} from 'lucide-react';

interface ReferralData {
  code: string;
  discountPercent: number;
  creditPercent: number;
  creditAmount: number;
}

interface CreditBalance {
  balance: number;
  expiresAt: string | null;
  totalEarned: number;
  totalReferrals: number;
}

interface ReferralHistory {
  id: string;
  childName: string;
  status: 'pending' | 'enrolled';
  creditAwarded: number;
  date: string;
}

interface Props {
  parentId: string;
  parentName: string;
}

export default function ReferralsTab({ parentId, parentName }: Props) {
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [referralHistory, setReferralHistory] = useState<ReferralHistory[]>([]);
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, [parentId]);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/parent/referral?parentId=${parentId}`);
      const data = await response.json();
      
      setReferralData(data.referral);
      setCreditBalance(data.credit);
      setReferralHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    setGeneratingCode(true);
    try {
      const response = await fetch('/api/parent/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, parentName }),
      });
      
      if (response.ok) {
        fetchReferralData();
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyCode = () => {
    if (referralData?.code) {
      navigator.clipboard.writeText(referralData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnWhatsApp = () => {
    if (!referralData) return;
    
    const message = encodeURIComponent(
      `🎓 Hi! I want to share something that's really helping my child become a confident reader.\n\n` +
      `Yestoryd provides personalized AI-powered reading coaching for children aged 4-12.\n\n` +
      `Use my code *${referralData.code}* to get ${referralData.discountPercent}% off! ✨\n\n` +
      `Start with a FREE reading assessment: https://yestoryd.com/assess?ref=${referralData.code}`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    if (!referralData) return;
    
    const subject = encodeURIComponent('Help your child become a confident reader 📚');
    const body = encodeURIComponent(
      `Hi,\n\n` +
      `I wanted to share something that's been really helpful for my child's reading journey.\n\n` +
      `Yestoryd provides personalized AI-powered reading coaching for children aged 4-12. ` +
      `Their expert coaches work one-on-one with kids to improve their reading confidence, fluency, and comprehension.\n\n` +
      `I have a special referral code for you: ${referralData.code}\n` +
      `This will give you ${referralData.discountPercent}% off the program!\n\n` +
      `You can start with a FREE 5-minute reading assessment here:\n` +
      `https://yestoryd.com/assess?ref=${referralData.code}\n\n` +
      `Hope this helps!\n`
    );
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Value Proposition */}
      <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-purple-600 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-medium text-pink-100">Referral Program</span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Share the Gift of Reading
          </h2>
          
          <p className="text-pink-100 mb-6 max-w-md">
            Help other families discover confident reading. You earn credits, they get a discount!
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-300">
                {referralData?.discountPercent || 10}%
              </div>
              <div className="text-sm text-pink-100">Their discount</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-300">
                ₹{referralData?.creditAmount || 600}
              </div>
              <div className="text-sm text-pink-100">Your credit</div>
            </div>
          </div>

          {/* Referral Code */}
          {referralData?.code ? (
            <div className="bg-white rounded-2xl p-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">Your Referral Code</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 tracking-wider">
                  {referralData.code}
                </div>
                <button
                  onClick={copyCode}
                  className={`p-3 rounded-xl transition-all ${
                    copied 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                  }`}
                >
                  {copied ? <CheckCircle className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                </button>
              </div>
              {copied && (
                <div className="text-green-600 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Copied to clipboard!
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={generateReferralCode}
              disabled={generatingCode}
              className="w-full bg-white text-pink-600 font-semibold py-4 px-6 rounded-xl hover:bg-pink-50 transition-colors disabled:opacity-50"
            >
              {generatingCode ? 'Generating...' : 'Get Your Referral Code'}
            </button>
          )}
        </div>
      </div>

      {/* Share Buttons */}
      {referralData?.code && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center justify-center gap-3 bg-[#25D366] text-white font-semibold py-4 px-6 rounded-xl hover:scale-[1.02] transition-all shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            Share on WhatsApp
          </button>
          <button
            onClick={shareViaEmail}
            className="flex items-center justify-center gap-3 bg-gray-900 text-white font-semibold py-4 px-6 rounded-xl hover:scale-[1.02] transition-all shadow-lg"
          >
            <Mail className="w-5 h-5" />
            Share via Email
          </button>
        </div>
      )}

      {/* Credit Balance Card */}
      {creditBalance && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-pink-500" />
                Your Credits
              </h3>
              {creditBalance.expiresAt && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Expires {new Date(creditBalance.expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>

            <div className="text-4xl font-bold text-pink-600 mb-2">
              ₹{creditBalance.balance.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500">
              Available to use on e-learning, re-enrollment, or group classes
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50">
            <div className="p-4 text-center">
              <div className="text-xl font-bold text-gray-900">{creditBalance.totalReferrals}</div>
              <div className="text-xs text-gray-500">Total Referrals</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xl font-bold text-gray-900">₹{creditBalance.totalEarned.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Total Earned</div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-500" />
          How It Works
        </h3>
        
        <div className="space-y-4">
          {[
            { step: 1, title: 'Share your code', desc: 'Send your referral code to friends & family' },
            { step: 2, title: 'They get a discount', desc: `${referralData?.discountPercent || 10}% off when they enroll` },
            { step: 3, title: 'You earn credits', desc: `₹${referralData?.creditAmount || 600} added to your balance` },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {item.step}
              </div>
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-sm text-gray-500">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      {referralHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Referral History
            </h3>
          </div>
          
          <div className="divide-y divide-gray-100">
            {referralHistory.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{item.childName}'s Family</div>
                    <div className="text-sm text-gray-500">
                      {new Date(item.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {item.status === 'enrolled' ? (
                    <>
                      <div className="text-green-600 font-semibold">+₹{item.creditAwarded}</div>
                      <div className="text-xs text-gray-500">Enrolled</div>
                    </>
                  ) : (
                    <>
                      <div className="text-orange-500 font-medium">Pending</div>
                      <div className="text-xs text-gray-500">Awaiting enrollment</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {referralHistory.length === 0 && referralData?.code && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-purple-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No referrals yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Share your code and start earning credits when families enroll!
          </p>
          <button
            onClick={shareOnWhatsApp}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:scale-105 transition-all"
          >
            <Share2 className="w-5 h-5" />
            Share Now
          </button>
        </div>
      )}

      {/* Use Credits CTA */}
      {creditBalance && creditBalance.balance > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                You have ₹{creditBalance.balance.toLocaleString()} in credits!
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Use them for e-learning subscription, re-enrollment, or group classes.
              </p>
              <div className="flex flex-wrap gap-3">
                <a 
                  href="/parent/elearning" 
                  className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 hover:text-pink-700"
                >
                  E-Learning <ChevronRight className="w-4 h-4" />
                </a>
                <a 
                  href="/classes" 
                  className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 hover:text-pink-700"
                >
                  Group Classes <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
