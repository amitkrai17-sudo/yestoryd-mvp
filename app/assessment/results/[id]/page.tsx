'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  Volume2, 
  MessageSquare, 
  Calendar,
  BookOpen,
  Share2,
  Download,
  Mail,
  CheckCircle,
  Loader2,
  Sparkles,
  MessageCircle
} from 'lucide-react';

function getScoreColor(score: number) {
  if (score >= 8) return { bg: 'bg-green-500', text: 'text-green-400', ring: 'stroke-green-500', label: 'Excellent!', emoji: '🌟' };
  if (score >= 6) return { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'stroke-yellow-500', label: 'Good Progress!', emoji: '⭐' };
  if (score >= 4) return { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'stroke-orange-500', label: 'Keep Practicing!', emoji: '💪' };
  return { bg: 'bg-red-500', text: 'text-red-400', ring: 'stroke-red-500', label: 'Needs Practice', emoji: '📚' };
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const score = parseInt(searchParams.get('score') || '0');
  const wpm = parseInt(searchParams.get('wpm') || '0');
  const fluency = searchParams.get('fluency') || 'N/A';
  const pronunciation = searchParams.get('pronunciation') || 'N/A';
  const feedback = searchParams.get('feedback') || '';
  const childName = searchParams.get('childName') || 'Student';
  const childAge = searchParams.get('childAge') || '';
  const parentEmail = searchParams.get('parentEmail') || '';

  const scoreInfo = getScoreColor(score);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getWhatsAppMessage = useCallback(() => {
    const message = `🐘 *Yestoryd Reading Report for ${childName}:*

${scoreInfo.emoji} *Score: ${score}/10*
⚡ *Speed:* ${wpm} WPM
🎯 *Fluency:* ${fluency}
🗣️ *Pronunciation:* ${pronunciation}

📝 *Feedback:* ${feedback}

✉️ Check your email for the full certificate!

━━━━━━━━━━━━━━━
📅 *Book a FREE Coach Call:*
https://yestoryd-mvp.vercel.app/book?childName=${encodeURIComponent(childName)}

🚀 *Get FREE Assessment:*
https://yestoryd-mvp.vercel.app/assessment
━━━━━━━━━━━━━━━
Powered by *Yestoryd* - AI Reading Coach for Kids 📚`;
    return encodeURIComponent(message);
  }, [childName, score, scoreInfo.emoji, wpm, fluency, pronunciation, feedback]);

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${getWhatsAppMessage()}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${childName}'s Reading Assessment`,
          text: `${childName} scored ${score}/10 on Yestoryd!`,
          url: window.location.href,
        });
      } catch (err) {}
    }
  };

  const sendCertificateEmail = useCallback(async () => {
    if (!parentEmail || emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const response = await fetch('/api/certificate/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parentEmail, childName, childAge, score, wpm, fluency, pronunciation, feedback }),
      });
      if (response.ok) setEmailSent(true);
    } catch (error) {
      console.error('Email error:', error);
    } finally {
      setSendingEmail(false);
    }
  }, [parentEmail, emailSent, sendingEmail, childName, childAge, score, wpm, fluency, pronunciation, feedback]);

  useEffect(() => {
    sendCertificateEmail();
  }, [sendCertificateEmail]);

  return (
    <div className="min-h-screen bg-gray-900 font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-white">or</span>
              <span className="text-yellow-400">yd</span>
            </span>
          </Link>
          <button onClick={shareOnWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Certificate */}
        <div id="certificate" className="bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700 print:shadow-none">
          {/* Header with Mascot */}
          <div className="bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 p-5 text-center border-b border-gray-600">
            {/* Mascot - No crop, transparent background */}
            <div className="w-24 h-24 mx-auto mb-3">
              <img 
                src="/images/vedant-mascot.png" 
                alt="Vedant - Yestoryd Mascot" 
                className="w-full h-full object-contain drop-shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="60">🐘</text></svg>';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Yestoryd</h1>
            <p className="text-gray-400 text-sm uppercase tracking-widest mt-1">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            {/* Child Info */}
            <p className="text-blue-400 text-base font-semibold">Certificate of Achievement</p>
            <p className="text-gray-400 text-sm mt-1">Proudly presented to</p>
            <h2 className="text-3xl font-bold text-white mt-2">{childName}</h2>
            {childAge && <p className="text-gray-500 text-sm mt-1">Age {childAge}</p>}

            {/* Score Circle */}
            <div className="relative w-36 h-36 mx-auto my-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r={radius} stroke="#374151" strokeWidth="10" fill="none" />
                <circle
                  cx="72" cy="72" r={radius}
                  className={scoreInfo.ring}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-5xl font-black ${scoreInfo.text}`}>{score}</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-2 ${scoreInfo.bg} text-white px-6 py-2 rounded-full text-base mb-5`}>
              <span className="text-xl">{scoreInfo.emoji}</span>
              <span className="font-bold">{scoreInfo.label}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Zap className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Speed</p>
                <p className="font-bold text-white text-lg">{wpm}</p>
                <p className="text-[10px] text-gray-500">WPM</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Volume2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Fluency</p>
                <p className="font-bold text-white text-base">{fluency}</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <MessageSquare className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Clarity</p>
                <p className="font-bold text-white text-base">{pronunciation}</p>
              </div>
            </div>

            {/* Feedback - 100 words */}
            {feedback && (
              <div className="bg-gray-700/30 rounded-xl p-4 mb-5 text-left border border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-white text-base">Coach Feedback</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Email Status - Hide in Print */}
            <div className="print:hidden">
              {parentEmail && (
                <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${emailSent ? 'text-green-400' : 'text-gray-500'}`}>
                  {sendingEmail ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending certificate...</>
                  ) : emailSent ? (
                    <><CheckCircle className="w-4 h-4" /> Certificate sent to {parentEmail}</>
                  ) : (
                    <><Mail className="w-4 h-4" /> Sending certificate...</>
                  )}
                </div>
              )}

              {/* WhatsApp Share */}
              <button onClick={shareOnWhatsApp} className="w-full py-3 bg-green-500 text-white font-bold rounded-full text-base mb-3 flex items-center justify-center gap-2 hover:bg-green-600 transition-all active:scale-95">
                <MessageCircle className="w-5 h-5" /> Share on WhatsApp
              </button>

              {/* CTAs */}
              <Link href="/book" className="block mb-3">
                <button className="w-full py-3.5 bg-pink-500 text-white font-bold rounded-full text-base flex items-center justify-center gap-2 hover:bg-pink-600 transition-all active:scale-95">
                  <Calendar className="w-5 h-5" /> Book Free Coach Call
                </button>
              </Link>
              <Link href="/" className="block">
                <button className="w-full py-2.5 bg-gray-700 text-gray-300 font-semibold rounded-full text-sm hover:bg-gray-600 transition-all">
                  Explore Our Services
                </button>
              </Link>
            </div>

            {/* Footer */}
            <p className="text-gray-500 text-xs mt-5 print:mt-3">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* Share Bar - Hide in Print */}
        <div className="mt-5 grid grid-cols-3 gap-3 print:hidden">
          <button onClick={shareOnWhatsApp} className="flex flex-col items-center gap-1.5 p-3 bg-green-500 text-white rounded-2xl text-sm font-medium hover:bg-green-600 transition-all active:scale-95">
            <MessageCircle className="w-6 h-6" /> WhatsApp
          </button>
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-2xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Download className="w-6 h-6" /> Download
          </button>
          <button onClick={handleNativeShare} className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-2xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Share2 className="w-6 h-6" /> Share
          </button>
        </div>

        {/* Retake - Hide in Print */}
        <div className="mt-5 text-center print:hidden">
          <Link href="/assessment" className="text-blue-400 font-semibold text-base hover:underline">
            🔄 Take Another Assessment
          </Link>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A5;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #1f2937 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #certificate {
            width: 100%;
            max-width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-gray-400">Loading results...</p>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResultsContent />
    </Suspense>
  );
}
