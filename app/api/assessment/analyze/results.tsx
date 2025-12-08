'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Zap, 
  Volume2, 
  MessageSquare, 
  ArrowRight,
  Calendar,
  BookOpen,
  Share2,
  Download,
  Mail,
  CheckCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

function getScoreColor(score: number) {
  if (score >= 8) return { bg: 'bg-green-500', text: 'text-green-500', label: 'Excellent!', emoji: '🌟' };
  if (score >= 6) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Good Progress!', emoji: '⭐' };
  if (score >= 4) return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Keep Practicing!', emoji: '💪' };
  return { bg: 'bg-red-500', text: 'text-red-500', label: 'Needs Improvement', emoji: '📚' };
}

function getScoreRingColor(score: number) {
  if (score >= 8) return 'stroke-green-500';
  if (score >= 6) return 'stroke-yellow-500';
  if (score >= 4) return 'stroke-orange-500';
  return 'stroke-red-500';
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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

  // Calculate circumference for the progress ring
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  // Send certificate email
  const sendCertificateEmail = async () => {
    if (!parentEmail) return;
    
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
  };

  // Auto-send email on mount
  useEffect(() => {
    if (parentEmail && !emailSent) {
      sendCertificateEmail();
    }
  }, [parentEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FBBF24]/10 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#FF6B6B] rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-[#FF2D92]">Yest</span>
              <span className="text-gray-900">or</span>
              <span className="text-[#FBBF24]">yd</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Certificate Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-[#FBBF24]">
          {/* Certificate Header */}
          <div className="bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-5xl">🐨</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Yestoryd</h1>
            <p className="text-gray-700 text-sm">READING ASSESSMENT REPORT</p>
          </div>

          {/* Certificate Body */}
          <div className="p-6 text-center">
            <div className="mb-6">
              <h2 className="text-[#3B82F6] text-xl font-bold mb-2">Certificate of Achievement</h2>
              <p className="text-gray-500 text-sm">Proudly presented to</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{childName}</h3>
              <p className="text-gray-500 text-sm mt-1">for completing the reading assessment</p>
              {childAge && <p className="text-gray-400 text-xs">Age {childAge} Level</p>}
            </div>

            {/* Score Circle */}
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#E5E7EB"
                  strokeWidth="12"
                  fill="none"
                />
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
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black ${scoreInfo.text}`}>{score}</span>
                <span className="text-gray-400 text-sm">/10</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-2 ${scoreInfo.bg} text-white px-6 py-2 rounded-full mb-6`}>
              <span className="text-xl">{scoreInfo.emoji}</span>
              <span className="font-bold">{scoreInfo.label}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <Zap className="w-6 h-6 text-[#3B82F6] mx-auto mb-2" />
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

            {/* Feedback */}
            {feedback && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-[#FBBF24]" />
                  <h4 className="font-bold text-gray-900">Coach's Feedback</h4>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Email Status */}
            {parentEmail && (
              <div className={`flex items-center justify-center gap-2 text-sm mb-6 ${emailSent ? 'text-green-600' : 'text-gray-500'}`}>
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending certificate to {parentEmail}...</span>
                  </>
                ) : emailSent ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Certificate sent to {parentEmail}</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Certificate will be sent to {parentEmail}</span>
                  </>
                )}
              </div>
            )}

            {/* CTA Section */}
            <div className="border-t pt-6">
              <p className="text-gray-600 mb-4 flex items-center justify-center gap-2">
                🚀 Take Your Reading to the Next Level!
              </p>
              
              <div className="space-y-3">
                <Link href="/book">
                  <button className="w-full py-4 bg-[#FF2D92] text-white font-bold rounded-full hover:bg-[#E91E63] transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Book a Free Coach Call
                  </button>
                </Link>
                
                <Link href="/">
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

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 text-center text-xs text-gray-400">
            <p>This assessment was conducted on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p>Questions? Reply to this email or visit our website.</p>
          </div>
        </div>

        {/* Share Options */}
        <div className="mt-6 flex justify-center gap-4">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${childName}'s Reading Assessment`,
                  text: `${childName} scored ${score}/10 on their Yestoryd Reading Assessment!`,
                  url: window.location.href,
                });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share Result
          </button>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FBBF24]/10 to-white">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#3B82F6] mx-auto mb-4" />
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
