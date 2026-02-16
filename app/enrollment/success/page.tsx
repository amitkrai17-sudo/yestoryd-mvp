// app/enrollment/success/page.tsx
// Post-Payment Success Page - With Referral CTA
// THEME: Premium Dark UI
// DYNAMIC: WhatsApp number from site_settings

'use client';

import { Suspense, useEffect, useState } from 'react';
import Confetti from '@/components/Confetti';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import {
  CheckCircle2,
  Calendar,
  Mail,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  PartyPopper,
  Gift,
  Share2,
  Copy,
  Check,
} from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get('enrollmentId') || '';
  const childName = searchParams.get('childName') || '';
  const coachName = searchParams.get('coachName') || 'Your assigned coach';
  const sessionsCount = parseInt(searchParams.get('sessions') || '12', 10);
  const productName = searchParams.get('product') || 'Full Program';

  const [showContent, setShowContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('918976287997');

  useEffect(() => {
    setTimeout(() => setShowContent(true), 300);
  }, []);

  // Fetch WhatsApp number from site_settings
  useEffect(() => {
    async function fetchWhatsApp() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'whatsapp_number')
          .single();
        if (!error && data?.value) {
          setWhatsappNumber(data.value.replace('+', ''));
        }
      } catch (err) {
        console.error('Failed to fetch WhatsApp number:', err);
      }
    }
    fetchWhatsApp();
  }, []);

  // Referral message
  const referralMessage = `🎉 I just enrolled ${childName || 'my child'} in Yestoryd's AI-powered reading program! They help kids aged 4-12 become confident readers with personalized coaching.\n\n✨ Take their FREE 5-minute reading assessment: https://yestoryd.com/assessment`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(referralMessage)}`;
    window.open(url, '_blank');
  };

  const formatWhatsAppDisplay = (num: string) => {
    if (num.startsWith('91') && num.length === 12) {
      return `+91 ${num.slice(2, 7)} ${num.slice(7)}`;
    }
    return `+${num}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-0 to-surface-1 flex flex-col">
      <Confetti duration={5000} />
      {/* Header */}
      <header className="bg-surface-1/80 backdrop-blur-md border-b border-border py-4">
        <div className="container mx-auto px-4 flex justify-center">
          <Link href="/"><Image src="/images/logo.png" alt="Yestoryd" width={140} height={45} className="h-10 w-auto cursor-pointer" /></Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className={`transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30 animate-bounce">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper className="w-8 h-8 text-amber-500" />
              <h1 className="text-3xl font-bold text-white">Welcome to Yestoryd!</h1>
              <PartyPopper className="w-8 h-8 text-amber-500 transform scale-x-[-1]" />
            </div>

            <p className="text-xl text-text-secondary">
              {childName ? `${childName}'s` : "Your child's"} reading journey begins now!
            </p>
          </div>

          {/* Enrollment Details Card */}
          <div className="bg-surface-1 rounded-3xl border border-border shadow-xl overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Enrollment Confirmed
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {enrollmentId && (
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <span className="text-text-tertiary">Enrollment ID</span>
                  <span className="font-mono text-sm bg-surface-2 text-text-secondary px-3 py-1 rounded-lg">
                    {enrollmentId.slice(0, 8)}...
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-text-tertiary">Student</span>
                <span className="font-semibold text-white">{childName || 'Your Child'}</span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-text-tertiary">Program</span>
                <span className="font-semibold text-white">3-Month Reading Coaching</span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-text-tertiary">Coach</span>
                <span className="font-semibold text-white">{coachName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-tertiary">Program</span>
                <span className="font-semibold text-white">{productName} ({sessionsCount} Sessions)</span>
              </div>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-6 mb-8">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-amber-500" />
              What Happens Next
            </h3>

            <div className="space-y-4">
              {[
                {
                  icon: Mail,
                  title: 'Check Your Email',
                  desc: 'Confirmation email with receipt sent to your inbox',
                  time: 'Within 5 minutes',
                },
                {
                  icon: MessageCircle,
                  title: 'Coach Introduction',
                  desc: `${coachName} will WhatsApp you to say hello`,
                  time: 'Within 24 hours',
                },
                {
                  icon: Calendar,
                  title: 'Sessions Scheduled',
                  desc: `Calendar invites for all ${sessionsCount} sessions sent automatically`,
                  time: 'Within 24 hours',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-text-tertiary text-sm">{item.desc}</p>
                    <p className="text-amber-400 text-xs mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* REFERRAL CTA */}
          <div className="bg-gradient-to-r from-[#FF0099]/10 to-purple-500/10 rounded-2xl border border-[#FF0099]/20 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#FF0099] to-purple-500 rounded-xl flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Know Another Parent?</h3>
                <p className="text-text-tertiary text-sm">Share Yestoryd with them!</p>
              </div>
            </div>

            <p className="text-text-secondary text-sm mb-4">
              Help another child discover the joy of reading. Share our free assessment with friends!
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 h-11 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </button>
              <button
                onClick={handleCopyReferral}
                className="h-11 px-4 flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-secondary font-medium rounded-xl transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/parent/dashboard"
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
            >
              Go to Parent Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>

            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi! I just enrolled ${childName || 'my child'} in the reading program (ID: ${enrollmentId?.slice(0,8) || 'N/A'}). Looking forward to starting!`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              Say Hi on WhatsApp
            </a>
          </div>

          {/* Support */}
          <div className="text-center mt-8">
            <p className="text-text-tertiary text-sm">
              Questions? Email us at{' '}
              <a href="mailto:engage@yestoryd.com" className="text-amber-400 hover:underline">
                engage@yestoryd.com
              </a>{' '}
              or WhatsApp{' '}
              <a href={`https://wa.me/${whatsappNumber}`} className="text-green-400 hover:underline">
                {formatWhatsAppDisplay(whatsappNumber)}
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EnrollmentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
