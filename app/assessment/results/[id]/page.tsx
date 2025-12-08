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

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getWhatsAppMessage = useCallback(() => {
    const message = `🎉 *${childName}'s Reading Assessment Results*

📊 *Score: ${score}* ${scoreInfo.emoji}

📈 *Performance:*
• Reading Speed: ${wpm} words/min
• Fluency: ${fluency}
• Pronunciation: ${pronunciation}

💬 *Feedback:*
${feedback}

🚀 Get a FREE reading assessment for your child:
https://yestoryd-mvp.vercel.app/assessment

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
          text: `${childName} scored ${score} on their Yestoryd Reading Assessment!`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const sendCertificateEmail = useCallback(async () => {
    if (!parentEmail || emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const response = await fetch('/api/certificate/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: parentEmail,
          childName,
          childAge,
          score,
          wpm,
          fluency,
          pronunciation,
          feedback,
        }),
      });
      if (response.ok) {
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
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
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-white">or</span>
              <span className="text-yellow-400">yd</span>
            </span>
          </Link>
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all active:scale-95 text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-xl">
        {/* Certificate Card */}
        <div className="bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700">
          {/* Dark Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-6 text-center border-b border-gray-600">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-yellow-400 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
              <span className="text-3xl">🐨</span>
            </div>
            <h1 className="text-xl font-bold text-white">Yestoryd</h1>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            {/* Child Info */}
            <div className="mb-6">
              <p className="text-blue-400 text-sm font-semibold mb-1">Certificate of Achievement</p>
              <p className="text-gray-500 text-xs">Proudly presented to</p>
              <h2 className="text-2xl font-bold text-white mt-1">{childName}</h2>
              <p className="text-gray-500 text-xs mt-1">for completing the reading assessment</p>
              {childAge && <p className="text-gray-600 text-xs">Age {childAge}</p>}
            </div>

            {/* Score Circle - No /10 */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r={radius} stroke="#374151" strokeWidth="10" fill="none" />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className={scoreInfo.ring}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black ${scoreInfo.text}`}>{score}</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-2 ${scoreInfo.bg} text-white px-5 py-2 rounded-full mb-6 text-sm`}>
              <span>{scoreInfo.emoji}</span>
              <span className="font-bold">{scoreInfo.label}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Zap className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase">Speed</p>
                <p className="font-bold text-white text-sm">{wpm} wpm</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Volume2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase">Fluency</p>
                <p className="font-bold text-white text-sm">{fluency}</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <MessageSquare className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase">Clarity</p>
                <p className="font-bold text-white text-sm">{pronunciation}</p>
              </div>
            </div>

            {/* Coach Feedback - 90 words */}
            {feedback && (
              <div className="bg-gray-700/30 rounded-xl p-4 mb-6 text-left border border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <h4 className="font-bold text-white text-sm">Coach&#39;s Feedback</h4>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Email Status */}
            {parentEmail && (
              <div className={`flex items-center justify-center gap-2 text-xs mb-4 ${emailSent ? 'text-green-400' : 'text-gray-500'}`}>
                {sendingEmail ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sending certificate...
                  </span>
                ) : emailSent ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Certificate sent to {parentEmail}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Sending to {parentEmail}
                  </span>
                )}
              </div>
            )}

            {/* WhatsApp Share */}
            <div className="bg-green-500/10 rounded-xl p-4 mb-6 border border-green-500/30">
              <p className="text-white font-medium text-sm mb-3">📲 Share this achievement!</p>
              <button
                onClick={shareOnWhatsApp}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Share on WhatsApp
              </button>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <Link href="/book" className="block">
                <button className="w-full py-4 bg-pink-500 text-white font-bold rounded-full hover:bg-pink-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Book a Free Coach Call
                </button>
              </Link>
              <Link href="/" className="block">
                <button className="w-full py-3 bg-gray-700 text-gray-300 font-semibold rounded-full hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                  👋 Explore Our Services
                </button>
              </Link>
            </div>

            <p className="text-gray-600 text-xs mt-6">
              Keep reading and growing! 📚✨
              <br />
              — The Yestoryd Team
            </p>
          </div>
        </div>

        {/* Share Bar */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <button 
            onClick={shareOnWhatsApp}
            className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">WhatsApp</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex flex-col items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-2xl text-gray-400 hover:bg-gray-700 transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span className="text-xs font-medium">Download</span>
          </button>
          <button 
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-2xl text-gray-400 hover:bg-gray-700 transition-all active:scale-95"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>

        {/* Retake */}
        <div className="mt-6 text-center">
          <Link href="/assessment" className="text-blue-400 font-medium hover:underline text-sm">
            🔄 Take Another Assessment
          </Link>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-gray-400">Loading your results...</p>
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
