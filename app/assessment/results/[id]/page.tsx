'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  if (score >= 8) return { bg: 'bg-green-500', text: 'text-green-400', ring: 'stroke-green-500', label: 'Excellent Reader!', emoji: '🌟' };
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

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getWhatsAppMessage = useCallback(() => {
    const message = `🎉 *${childName}'s Reading Assessment*

📊 *Score: ${score}* ${scoreInfo.emoji}

📈 Speed: ${wpm} wpm | Fluency: ${fluency} | Clarity: ${pronunciation}

💬 ${feedback.slice(0, 150)}...

🚀 Free assessment: https://yestoryd-mvp.vercel.app/assessment

*Yestoryd* - AI Reading Coach 📚`;
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
          text: `${childName} scored ${score} on Yestoryd!`,
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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-white">or</span>
              <span className="text-yellow-400">yd</span>
            </span>
          </Link>
          <button onClick={shareOnWhatsApp} className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-full text-sm font-medium">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-3 py-6 max-w-md">
        {/* Certificate - Single Page Print */}
        <div id="certificate" className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 print:shadow-none print:border-2">
          {/* Header with Mascot */}
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-4 text-center border-b border-gray-600">
            <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-white">
              <img 
                src="/images/vedant-mascot.png" 
                alt="Vedant" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="50">🐘</text></svg>';
                }}
              />
            </div>
            <h1 className="text-lg font-bold text-white">Yestoryd</h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-4 text-center">
            {/* Child Info */}
            <p className="text-blue-400 text-xs font-semibold">Certificate of Achievement</p>
            <p className="text-gray-500 text-[10px]">Presented to</p>
            <h2 className="text-xl font-bold text-white">{childName}</h2>
            {childAge && <p className="text-gray-500 text-[10px]">Age {childAge}</p>}

            {/* Score Circle */}
            <div className="relative w-28 h-28 mx-auto my-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r={radius} stroke="#374151" strokeWidth="8" fill="none" />
                <circle
                  cx="56" cy="56" r={radius}
                  className={scoreInfo.ring}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-4xl font-black ${scoreInfo.text}`}>{score}</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-1 ${scoreInfo.bg} text-white px-4 py-1.5 rounded-full text-sm mb-4`}>
              <span>{scoreInfo.emoji}</span>
              <span className="font-bold">{scoreInfo.label}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-2">
                <Zap className="w-4 h-4 text-blue-400 mx-auto" />
                <p className="text-[9px] text-gray-500">Speed</p>
                <p className="font-bold text-white text-sm">{wpm}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2">
                <Volume2 className="w-4 h-4 text-green-400 mx-auto" />
                <p className="text-[9px] text-gray-500">Fluency</p>
                <p className="font-bold text-white text-sm">{fluency}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2">
                <MessageSquare className="w-4 h-4 text-purple-400 mx-auto" />
                <p className="text-[9px] text-gray-500">Clarity</p>
                <p className="font-bold text-white text-sm">{pronunciation}</p>
              </div>
            </div>

            {/* Feedback - 90 words */}
            {feedback && (
              <div className="bg-gray-700/30 rounded-lg p-3 mb-4 text-left border border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  <span className="font-bold text-white text-xs">Coach Feedback</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Email Status - Hide in Print */}
            <div className="print:hidden">
              {parentEmail && (
                <div className={`flex items-center justify-center gap-1 text-[10px] mb-3 ${emailSent ? 'text-green-400' : 'text-gray-500'}`}>
                  {sendingEmail ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                  ) : emailSent ? (
                    <><CheckCircle className="w-3 h-3" /> Sent to {parentEmail}</>
                  ) : (
                    <><Mail className="w-3 h-3" /> Sending...</>
                  )}
                </div>
              )}

              {/* WhatsApp Share */}
              <button onClick={shareOnWhatsApp} className="w-full py-2.5 bg-green-500 text-white font-bold rounded-full text-sm mb-3 flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" /> Share on WhatsApp
              </button>

              {/* CTAs */}
              <Link href="/book" className="block mb-2">
                <button className="w-full py-3 bg-pink-500 text-white font-bold rounded-full text-sm flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" /> Book Free Coach Call
                </button>
              </Link>
              <Link href="/" className="block">
                <button className="w-full py-2 bg-gray-700 text-gray-300 font-medium rounded-full text-xs">
                  Explore Services
                </button>
              </Link>
            </div>

            {/* Footer */}
            <p className="text-gray-600 text-[9px] mt-3 print:mt-2">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* Share Bar - Hide in Print */}
        <div className="mt-4 grid grid-cols-3 gap-2 print:hidden">
          <button onClick={shareOnWhatsApp} className="flex flex-col items-center gap-1 p-3 bg-green-500 text-white rounded-xl text-xs">
            <MessageCircle className="w-5 h-5" /> WhatsApp
          </button>
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-xs">
            <Download className="w-5 h-5" /> Download
          </button>
          <button onClick={handleNativeShare} className="flex flex-col items-center gap-1 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-xs">
            <Share2 className="w-5 h-5" /> Share
          </button>
        </div>

        {/* Retake - Hide in Print */}
        <div className="mt-4 text-center print:hidden">
          <Link href="/assessment" className="text-blue-400 font-medium text-sm">
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
        <Loader2 className="w-10 h-10 animate-spin text-pink-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading results...</p>
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
