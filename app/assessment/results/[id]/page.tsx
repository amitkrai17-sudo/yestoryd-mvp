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
  if (score >= 8) return { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', label: 'Excellent!', emoji: '🌟' };
  if (score >= 6) return { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', label: 'Good Progress!', emoji: '⭐' };
  if (score >= 4) return { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', label: 'Keep Practicing!', emoji: '💪' };
  return { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', label: 'Needs Improvement', emoji: '📚' };
}

function getScoreRingColor(score: number) {
  if (score >= 8) return 'stroke-green-500';
  if (score >= 6) return 'stroke-yellow-500';
  if (score >= 4) return 'stroke-orange-500';
  return 'stroke-red-500';
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
  const ringColor = getScoreRingColor(score);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const getWhatsAppMessage = useCallback(() => {
    const message = `🎉 *${childName}'s Reading Assessment Results*

📊 *Overall Score: ${score}/10* ${scoreInfo.emoji}

📈 *Performance:*
• Reading Speed: ${wpm} words/min
• Fluency: ${fluency}
• Pronunciation: ${pronunciation}

💬 *Feedback:*
${feedback}

🚀 Want to improve your child's reading? Get a FREE assessment at:
https://yestoryd-mvp.vercel.app/assessment

Powered by *Yestoryd* - AI Reading Coach for Kids 📚`;
    return encodeURIComponent(message);
  }, [childName, score, scoreInfo.emoji, wpm, fluency, pronunciation, feedback]);

  const shareOnWhatsApp = () => {
    const message = getWhatsAppMessage();
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${childName}'s Reading Assessment`,
          text: `${childName} scored ${score}/10 on their Yestoryd Reading Assessment! 🎉`,
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-gray-900">or</span>
              <span className="text-amber-500">yd</span>
            </span>
          </Link>
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all active:scale-95 text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Share on WhatsApp</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className={`bg-white rounded-3xl shadow-xl overflow-hidden border-4 ${scoreInfo.border}`}>
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-5xl">🐨</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Yestoryd</h1>
            <p className="text-gray-700 text-sm">READING ASSESSMENT REPORT</p>
          </div>

          <div className="p-6 text-center">
            <div className="mb-6">
              <h2 className="text-blue-500 text-xl font-bold mb-2">Certificate of Achievement</h2>
              <p className="text-gray-500 text-sm">Proudly presented to</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{childName}</h3>
              <p className="text-gray-500 text-sm mt-1">for completing the reading assessment</p>
              {childAge && <p className="text-gray-400 text-xs">Age {childAge} Level</p>}
            </div>

            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r={radius} stroke="#E5E7EB" strokeWidth="12" fill="none" />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className={ringColor}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black ${scoreInfo.text}`}>{score}</span>
                <span className="text-gray-400 text-sm">/10</span>
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 ${scoreInfo.bg} text-white px-6 py-2 rounded-full mb-6`}>
              <span className="text-xl">{scoreInfo.emoji}</span>
              <span className="font-bold">{scoreInfo.label}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <Zap className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Reading Speed</p>
                <p className="font-bold text-gray-900">{wpm} words/min</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <Volume2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Fluency Level</p>
                <p className="font-bold text-gray-900">{fluency}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <MessageSquare className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Pronunciation</p>
                <p className="font-bold text-gray-900">{pronunciation}</p>
              </div>
            </div>

            {feedback && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h4 className="font-bold text-gray-900">Coach&#39;s Feedback</h4>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{feedback}</p>
              </div>
            )}

            {parentEmail && (
              <div className={`flex items-center justify-center gap-2 text-sm mb-6 ${emailSent ? 'text-green-600' : 'text-gray-500'}`}>
                {sendingEmail ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending certificate to {parentEmail}...
                  </span>
                ) : emailSent ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Certificate sent to {parentEmail}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Certificate will be sent to {parentEmail}
                  </span>
                )}
              </div>
            )}

            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <p className="text-gray-700 font-medium mb-3">📲 Share this achievement!</p>
              <button
                onClick={shareOnWhatsApp}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Share on WhatsApp
              </button>
            </div>

            <div className="border-t pt-6">
              <p className="text-gray-600 mb-4 flex items-center justify-center gap-2">
                🚀 Take Your Reading to the Next Level!
              </p>
              <div className="space-y-3">
                <Link href="/book" className="block">
                  <button className="w-full py-4 bg-pink-500 text-white font-bold rounded-full hover:bg-pink-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Book a Free Coach Call
                  </button>
                </Link>
                <Link href="/" className="block">
                  <button className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2">
                    👋 Explore Our Services
                  </button>
                </Link>
              </div>
              <p className="text-gray-400 text-xs mt-6">
                Keep reading and growing! 📚✨
                <br />
                — The Yestoryd Team
              </p>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 text-center text-xs text-gray-400">
            <p>This assessment was conducted on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p>Questions? Reply to this email or visit our website.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <button 
            onClick={shareOnWhatsApp}
            className="flex flex-col items-center gap-2 p-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all active:scale-95"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs font-medium">WhatsApp</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
          >
            <Download className="w-6 h-6" />
            <span className="text-xs font-medium">Download</span>
          </button>
          <button 
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
          >
            <Share2 className="w-6 h-6" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/assessment" className="text-blue-500 font-medium hover:underline">
            🔄 Take Another Assessment
          </Link>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading your results...</p>
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
