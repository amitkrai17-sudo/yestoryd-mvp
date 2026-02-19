// =============================================================================
// FILE: app/completion/[enrollmentId]/page.tsx
// PURPOSE: Program completion page - certificate, referral, re-enrollment
// DESIGN: Yestoryd dark theme, celebration, mobile-first
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Award, Download, Share2, Gift, RefreshCw, Loader2,
  CheckCircle, Star, MessageCircle, ChevronRight,
  BookOpen, Trophy, Sparkles, ArrowRight, Copy, Check, PartyPopper
} from 'lucide-react';

interface CompletionData {
  enrollmentId: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  coachName: string;
  certificateNumber: string;
  completedAt: string;
  programStart: string;
  programEnd: string;
  sessionsCompleted: number;
}

export default function CompletionPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.enrollmentId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompletionData | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    fetchCompletionData();
  }, [enrollmentId]);

  async function fetchCompletionData() {
    try {
      const res = await fetch(`/api/completion/check/${enrollmentId}`);
      const result = await res.json();

      if (!res.ok || !result.success) {
        setError(result.error || 'Failed to load completion data');
        setLoading(false);
        return;
      }

      // Check if actually completed
      if (!result.eligible && result.reason !== 'already_completed') {
        setError(`Program not yet complete. ${result.progress?.completed || 0}/${result.progress?.total || 9 /* V1 fallback */} sessions done.`);
        setLoading(false);
        return;
      }

      // Fetch enrollment details
      const enrollRes = await fetch(`/api/enrollment/${enrollmentId}`);
      const enrollData = await enrollRes.json();

      setData({
        enrollmentId,
        childName: result.enrollment?.childName || 'Student',
        parentName: result.enrollment?.parentName || 'Parent',
        parentEmail: result.enrollment?.parentEmail || '',
        coachName: result.enrollment?.coachName || 'Coach',
        certificateNumber: enrollData.data?.certificate_number || 'YC-2026-00001',
        completedAt: enrollData.data?.completed_at || new Date().toISOString(),
        programStart: result.enrollment?.programStart || '',
        programEnd: result.enrollment?.programEnd || '',
        sessionsCompleted: result.progress?.completed || 9, /* V1 fallback */
      });

      // Check for existing referral code
      if (result.enrollment?.parentEmail) {
        try {
          const refRes = await fetch(`/api/parent/referral?email=${encodeURIComponent(result.enrollment.parentEmail)}`);
          const refData = await refRes.json();
          if (refData.success && refData.data?.referralCode) {
            setReferralCode(refData.data.referralCode);
          }
        } catch (e) {
          // No referral code yet
        }
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load completion data');
    }
    setLoading(false);
  }

  async function handleDownloadCertificate() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/certificate/generate?enrollment=${enrollmentId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Yestoryd-Certificate-${data?.childName || 'Student'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to generate certificate. Please try again.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download certificate');
    }
    setDownloading(false);
  }

  async function handleGenerateReferralCode() {
    if (!data?.parentEmail) return;

    setGeneratingCode(true);
    try {
      const res = await fetch('/api/parent/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.parentEmail }),
      });
      const result = await res.json();
      if (result.success && result.data?.referralCode) {
        setReferralCode(result.data.referralCode);
      }
    } catch (err) {
      console.error('Referral code error:', err);
    }
    setGeneratingCode(false);
  }

  function handleShareWhatsApp() {
    const message = encodeURIComponent(
      `${data?.childName} just completed Yestoryd's 12-week reading program!\n\n` +
      `Use my referral code *${referralCode}* to get 10% OFF when you enroll.\n\n` +
      `Take the FREE reading assessment: https://yestoryd.com/assessment?ref=${referralCode}\n\n` +
      `Trust me, it's worth it!`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  }

  function copyReferralCode() {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff0099] mx-auto mb-4" />
          <p className="text-text-secondary">Loading your achievement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-1 rounded-2xl shadow-xl shadow-black/30 border border-border p-8 text-center">
          <div className="w-16 h-16 bg-[#ffde00]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-[#ffde00]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Almost There!</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff0099] text-white font-semibold rounded-xl hover:bg-[#ff0099]/90 transition-all min-h-[44px]"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="bg-surface-1/95 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
          </Link>
          <Link
            href="/parent/dashboard"
            className="text-sm font-medium text-text-secondary hover:text-[#ff0099] min-h-[44px] flex items-center"
          >
            Dashboard <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Celebration Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#ffde00]/20 text-[#ffde00] rounded-full text-sm font-medium mb-4 border border-[#ffde00]/30">
            <Trophy className="w-4 h-4" />
            Program Completed!
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <PartyPopper className="w-8 h-8 text-[#ffde00]" />
            Congratulations, {data?.childName}!
          </h1>
          <p className="text-lg text-text-secondary">
            You&apos;ve successfully completed the 12-week reading program
          </p>
        </div>

        {/* Certificate Card */}
        <div className="bg-surface-1 rounded-2xl shadow-xl shadow-black/30 border border-border overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#ffde00] via-[#ff0099] to-[#7b008b] p-1">
            <div className="bg-surface-1 p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Certificate Preview - Light background for readability */}
                <div className="w-full md:w-1/2 bg-[#FDFBF7] rounded-xl p-6 border-2 border-dashed border-[#ffde00]">
                  <div className="text-center">
                    <Award className="w-16 h-16 text-[#ffde00] mx-auto mb-4" />
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Certificate of Completion</p>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{data?.childName}</p>
                    <p className="text-sm text-gray-600 mb-4">
                      has successfully completed the Yestoryd Reading Program
                    </p>
                    <div className="flex justify-center gap-4 text-xs text-gray-500">
                      <span>Coach: {data?.coachName}</span>
                      <span>•</span>
                      <span>{data?.sessionsCompleted} Sessions</span>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">
                      Certificate #{data?.certificateNumber}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="w-full md:w-1/2 space-y-4">
                  <h2 className="text-xl font-bold text-white">Your Certificate</h2>
                  <p className="text-text-secondary text-sm">
                    Download and share {data?.childName}&apos;s achievement with family and friends!
                  </p>

                  <button
                    onClick={handleDownloadCertificate}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#ffde00] to-[#ffc107] text-gray-900 font-bold rounded-xl hover:shadow-lg hover:shadow-[#ffde00]/30 transition-all disabled:opacity-50 min-h-[56px]"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Download Certificate
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-text-tertiary">Started</p>
                      <p className="font-semibold text-white">
                        {data?.programStart ? new Date(data.programStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}
                      </p>
                    </div>
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-text-tertiary">Completed</p>
                      <p className="font-semibold text-white">
                        {data?.completedAt ? new Date(data.completedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NPS Prompt */}
        <div className="bg-surface-1 rounded-2xl shadow-lg shadow-black/25 border border-border p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#ff0099]/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Star className="w-6 h-6 text-[#ff0099]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">Share Your Experience</h3>
              <p className="text-text-secondary text-sm mb-3">
                Your feedback helps us improve the program for other families
              </p>
              <Link
                href={`/nps/${enrollmentId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff0099] text-white text-sm font-semibold rounded-lg hover:bg-[#ff0099]/90 transition-all min-h-[44px]"
              >
                Rate Your Experience
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/30 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">Refer a Friend, Earn ₹600!</h3>
              <p className="text-text-secondary text-sm mb-4">
                Share your success! Friends get 10% off, you get ₹600 credit.
              </p>

              {referralCode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-2 border border-green-500/30 rounded-lg px-4 py-2 font-mono font-bold text-green-400">
                      {referralCode}
                    </div>
                    <button
                      onClick={copyReferralCode}
                      className="px-4 py-2 bg-surface-2 border border-green-500/30 rounded-lg hover:bg-surface-1 transition-all min-h-[44px]"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-text-secondary" />}
                    </button>
                  </div>
                  <button
                    onClick={handleShareWhatsApp}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all min-h-[44px]"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Share on WhatsApp
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateReferralCode}
                  disabled={generatingCode}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 min-h-[44px]"
                >
                  {generatingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Get My Referral Code
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Re-enrollment CTA */}
        <div className="bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-2xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm mb-3">
                <Sparkles className="w-4 h-4" />
                Continue the Journey
              </div>
              <h3 className="text-2xl font-bold mb-2">Keep {data?.childName}&apos;s Progress Going!</h3>
              <p className="text-white/80 mb-4">
                Re-enroll now and get 10% early renewal discount. Use your referral credits too!
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/enroll"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#7b008b] font-bold rounded-xl hover:shadow-lg transition-all min-h-[44px]"
                >
                  <RefreshCw className="w-5 h-5" />
                  Re-enroll Now
                </Link>
                <Link
                  href="/parent/dashboard#elearning"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all min-h-[44px]"
                >
                  <BookOpen className="w-5 h-5" />
                  Explore E-Learning
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
                <Trophy className="w-16 h-16 text-[#ffde00]" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-text-tertiary">
        <p>Questions? Contact us at engage@yestoryd.com or WhatsApp 8976287997</p>
      </footer>
    </div>
  );
}
