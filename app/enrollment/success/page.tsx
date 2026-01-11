// app/enrollment/success/page.tsx
// Post-Payment Success Page - With Referral CTA
// Fixes: Dynamic coach name, referral sharing, improved engagement

'use client';

import { Suspense, useEffect, useState } from 'react';
import Confetti from '@/components/Confetti';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  const coachName = searchParams.get('coachName') || 'Your assigned coach'; // Dynamic coach name
  
  const [showContent, setShowContent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Show content after short delay for animation
    setTimeout(() => setShowContent(true), 300);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 flex flex-col">
      <Confetti duration={5000} />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-green-100 py-4">
        <div className="container mx-auto px-4 flex justify-center">
          <Link href="/"><Image src="/images/logo.png" alt="Yestoryd" width={140} height={45} className="h-10 w-auto cursor-pointer" /></Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className={`transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200 animate-bounce">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper className="w-8 h-8 text-amber-500" />
              <h1 className="text-3xl font-bold text-gray-800">Welcome to Yestoryd!</h1>
              <PartyPopper className="w-8 h-8 text-amber-500 transform scale-x-[-1]" />
            </div>
            
            <p className="text-xl text-gray-600">
              {childName ? `${childName}'s` : "Your child's"} reading journey begins now!
            </p>
          </div>

          {/* Enrollment Details Card */}
          <div className="bg-white rounded-3xl border border-green-100 shadow-xl overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Enrollment Confirmed
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {enrollmentId && (
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-gray-500">Enrollment ID</span>
                  <span className="font-mono text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg">
                    {enrollmentId.slice(0, 8)}...
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-500">Student</span>
                <span className="font-semibold text-gray-800">{childName || 'Your Child'}</span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-500">Program</span>
                <span className="font-semibold text-gray-800">3-Month Reading Coaching</span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-500">Coach</span>
                {/* FIXED: Dynamic coach name */}
                <span className="font-semibold text-gray-800">{coachName}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Sessions</span>
                <span className="font-semibold text-gray-800">9 Sessions (6 Coaching + 3 Parent)</span>
              </div>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
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
                  desc: 'Calendar invites for all 9 sessions sent automatically',
                  time: 'Within 24 hours',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                    <p className="text-amber-600 text-xs mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* REFERRAL CTA - NEW */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Know Another Parent?</h3>
                <p className="text-gray-500 text-sm">Share Yestoryd with them!</p>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
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
                className="h-11 px-4 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
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
              href={`https://wa.me/918976287997?text=${encodeURIComponent(`Hi! I just enrolled ${childName || 'my child'} in the reading program (ID: ${enrollmentId?.slice(0,8) || 'N/A'}). Looking forward to starting!`)}`}
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
            <p className="text-gray-500 text-sm">
              Questions? Email us at{' '}
              <a href="mailto:engage@yestoryd.com" className="text-amber-600 hover:underline">
                engage@yestoryd.com
              </a>{' '}
              or WhatsApp{' '}
              <a href="https://wa.me/918976287997" className="text-green-600 hover:underline">
                +91 89762 87997
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
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}



