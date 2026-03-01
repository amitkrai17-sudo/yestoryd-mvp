// =============================================================================
// FILE: components/parent/ReferralCard.tsx
// PURPOSE: CRO - Compact referral teaser card for dashboard
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Gift, Copy, Check, MessageCircle, Users } from 'lucide-react';

interface ReferralCardProps {
  parentEmail: string;
  childName: string;
  croSettings: Record<string, string>;
}

export default function ReferralCard({ parentEmail, childName, croSettings }: ReferralCardProps) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`/api/parent/referral?email=${encodeURIComponent(parentEmail)}`);
        const result = await res.json();
        if (res.ok && result.success && result.data) {
          setReferralCode(result.data.referralCode);
          setReferralCount(result.data.successfulReferrals || 0);
        }
      } catch {}
      setLoading(false);
    };
    if (parentEmail) loadData();
  }, [parentEmail]);

  if (loading) return null;

  const benefitText = croSettings['referral_benefit'] || 'Get \u20B9500 off your next plan';
  const referralUrl = referralCode
    ? `https://yestoryd.com/assessment?ref=${referralCode}`
    : '';

  const handleCopy = () => {
    if (referralUrl) {
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (referralCode) {
      const msg = encodeURIComponent(
        `Hey! My child ${childName} has been doing great with Yestoryd's reading program!\n\n` +
        `Take the free AI reading assessment here: ${referralUrl}\n\n` +
        `Use code ${referralCode} for a discount!`
      );
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
  };

  const handleGenerate = async () => {
    try {
      const res = await fetch('/api/parent/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parentEmail }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setReferralCode(result.data.referralCode);
      }
    } catch {}
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
          <Gift className="w-5 h-5 text-[#FF0099]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">Share Yestoryd with friends</h3>
          <p className="text-xs text-gray-500 mt-0.5">{benefitText}</p>
        </div>
      </div>

      {referralCode ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 bg-pink-50 text-[#FF0099] border border-pink-200 rounded-xl h-10 px-4 text-sm font-medium hover:bg-pink-100 transition-all duration-200"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Referral Link'}
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl h-10 px-4 text-sm font-medium hover:bg-[#1da851] transition-all duration-200"
            >
              <MessageCircle className="w-4 h-4" />
              Share
            </button>
          </div>
          {referralCount > 0 && (
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              You&apos;ve referred {referralCount} {referralCount === 1 ? 'family' : 'families'}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          className="mt-3 flex items-center justify-center gap-2 bg-pink-50 text-[#FF0099] border border-pink-200 rounded-xl h-10 px-4 text-sm font-medium hover:bg-pink-100 transition-all duration-200 w-full"
        >
          <Gift className="w-4 h-4" />
          Get Your Referral Code
        </button>
      )}
    </div>
  );
}
