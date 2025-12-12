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
  MessageCircle,
  Shield,
  Users,
  Star,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

// Score-based configuration
function getScoreConfig(score: number, childName: string) {
  if (score >= 8) {
    return {
      color: { bg: 'bg-green-500', text: 'text-green-400', ring: 'stroke-green-500' },
      label: 'Excellent!',
      emoji: '🌟',
      headline: `${childName} is a reading star!`,
      subheadline: 'Take their skills to the advanced level',
      primaryCTA: `Take ${childName} to Advanced Level`,
      ctaStyle: 'from-green-500 to-emerald-600',
    };
  }
  if (score >= 6) {
    return {
      color: { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'stroke-yellow-500' },
      label: 'Good Progress!',
      emoji: '⭐',
      headline: `${childName} shows great potential!`,
      subheadline: 'Unlock their full reading abilities',
      primaryCTA: `Unlock ${childName}'s Full Potential`,
      ctaStyle: 'from-yellow-500 to-amber-600',
    };
  }
  if (score >= 4) {
    return {
      color: { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'stroke-orange-500' },
      label: 'Keep Practicing!',
      emoji: '💪',
      headline: `${childName} is ready to improve!`,
      subheadline: 'Accelerate their reading progress',
      primaryCTA: `Accelerate ${childName}'s Progress`,
      ctaStyle: 'from-orange-500 to-red-500',
    };
  }
  return {
    color: { bg: 'bg-red-500', text: 'text-red-400', ring: 'stroke-red-500' },
    label: 'Needs Support',
    emoji: '📚',
    headline: `${childName} needs expert guidance`,
    subheadline: 'Get personalized support from our coaches',
    primaryCTA: `Get ${childName} the Help They Need`,
    ctaStyle: 'from-red-500 to-pink-600',
  };
}

// Testimonials
const TESTIMONIALS = [
  {
    text: "My daughter's score improved from 4 to 8 in just 6 weeks! The personalized coaching made all the difference.",
    name: "Priya M.",
    child: "Mother of Ananya, Age 7",
    rating: 5,
  },
  {
    text: "The coaches understood exactly where my son was struggling. Now he actually enjoys reading!",
    name: "Rahul S.",
    child: "Father of Arjun, Age 9",
    rating: 5,
  },
  {
    text: "Best investment we made for our child's education. The progress reports helped us support her at home.",
    name: "Meera K.",
    child: "Mother of Diya, Age 6",
    rating: 5,
  },
];

function ResultsContent() {
  const searchParams = useSearchParams();
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const score = parseInt(searchParams.get('score') || '0');
  const wpm = parseInt(searchParams.get('wpm') || '0');
  const fluency = searchParams.get('fluency') || 'N/A';
  const pronunciation = searchParams.get('pronunciation') || 'N/A';
  const feedback = searchParams.get('feedback') || '';
  const childName = searchParams.get('childName') || 'Student';
  const childAge = searchParams.get('childAge') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';

  const config = getScoreConfig(score, childName);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  // Rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getWhatsAppMessage = useCallback(() => {
    const message = `🎉 *${childName}'s Reading Assessment Results*

${config.emoji} *Score: ${score}/10* - ${config.label}
⚡ *Speed:* ${wpm} WPM
🎯 *Fluency:* ${fluency}
🗣️ *Pronunciation:* ${pronunciation}

📝 *Feedback:* ${feedback}

✉️ Certificate sent to email!

━━━━━━━━━━━━━━━
🚀 *Get FREE Assessment:*
https://yestoryd.com/assessment
━━━━━━━━━━━━━━━
Powered by *Yestoryd* - AI Reading Coach 📚`;
    return encodeURIComponent(message);
  }, [childName, score, config.emoji, config.label, wpm, fluency, pronunciation, feedback]);

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${getWhatsAppMessage()}`, '_blank');
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

  // Build checkout URL with params
  const checkoutUrl = `/checkout?childId=new&childName=${encodeURIComponent(childName)}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}&package=coaching-6&source=assessment`;

  return (
    <div className="min-h-screen bg-gray-900">
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
        {/* Certificate Card */}
        <div id="certificate" className="bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700 print:shadow-none">
          {/* Header with Mascot */}
          <div className="bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 p-5 text-center border-b border-gray-600">
            <div className="w-24 h-24 mx-auto mb-3">
              <img 
                src="/images/vedant-mascot.png" 
                alt="Vedant - Yestoryd Mascot" 
                className="w-full h-full object-contain drop-shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="60">📚</text></svg>';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Yestoryd</h1>
            <p className="text-gray-400 text-sm uppercase tracking-widest mt-1">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
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
                  className={config.color.ring}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-5xl font-black ${config.color.text}`}>{score}</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-2 ${config.color.bg} text-white px-6 py-2 rounded-full text-base mb-5`}>
              <span className="text-xl">{config.emoji}</span>
              <span className="font-bold">{config.label}</span>
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

            {/* Feedback */}
            {feedback && (
              <div className="bg-gray-700/30 rounded-xl p-4 mb-5 text-left border border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-white text-base">Coach Feedback</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{feedback}</p>
              </div>
            )}

            {/* Email Status with Spam Notice */}
            <div className="print:hidden">
              {parentEmail && (
                <div className="mb-4">
                  <div className={`flex items-center justify-center gap-2 text-sm ${emailSent ? 'text-green-400' : 'text-gray-500'}`}>
                    {sendingEmail ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending certificate...</>
                    ) : emailSent ? (
                      <><CheckCircle className="w-4 h-4" /> Certificate sent to {parentEmail}</>
                    ) : (
                      <><Mail className="w-4 h-4" /> Sending certificate...</>
                    )}
                  </div>
                  {emailSent && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Check spam/junk folder if not in inbox</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <p className="text-gray-500 text-xs mt-3 print:mt-3">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* CTA Section - Score Based */}
        <div className="mt-6 print:hidden">
          {/* Headline */}
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-white">{config.headline}</h3>
            <p className="text-gray-400 text-sm mt-1">{config.subheadline}</p>
          </div>

          {/* Primary CTA - Enroll */}
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-4">
            <Link href={checkoutUrl}>
              <button className={`w-full py-4 bg-gradient-to-r ${config.ctaStyle} text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg`}>
                {config.primaryCTA}
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            
            {/* Features */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>6 personalized coaching sessions for {childName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>Dedicated reading coach assigned</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>FREE access to all learning resources</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-center gap-2 text-sm text-yellow-400">
              <Users className="w-4 h-4" />
              <span className="font-medium">🔥 12 parents enrolled today</span>
            </div>

            {/* Trust Badge */}
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Shield className="w-4 h-4 text-green-400" />
              <span>100% refund if not satisfied</span>
            </div>

            {/* Price */}
            <div className="mt-3 text-center">
              <span className="text-2xl font-bold text-white">₹5,999</span>
              <span className="text-gray-500 text-sm ml-2">one-time</span>
            </div>
          </div>

          {/* Secondary CTA - Talk to Coach */}
          <Link href="/book">
            <button className="w-full py-3.5 bg-gray-700 text-white font-semibold rounded-xl text-base flex items-center justify-center gap-2 hover:bg-gray-600 transition-all border border-gray-600 mb-4">
              <Calendar className="w-5 h-5" />
              Talk to {childName}&apos;s Coach First
            </button>
          </Link>
          <p className="text-center text-xs text-gray-500 -mt-2 mb-4">Free 15-min call • No obligation</p>

          {/* Tertiary CTA - Share Results */}
          <button 
            onClick={shareOnWhatsApp}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-base flex items-center justify-center gap-2 hover:bg-green-500 transition-all mb-6"
          >
            <MessageCircle className="w-5 h-5" />
            Share {childName}&apos;s Results
          </button>

          {/* Testimonial */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-gray-300 text-sm italic mb-3">
              &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {TESTIMONIALS[currentTestimonial].name.charAt(0)}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{TESTIMONIALS[currentTestimonial].name}</p>
                <p className="text-gray-500 text-xs">{TESTIMONIALS[currentTestimonial].child}</p>
              </div>
            </div>
            {/* Dots indicator */}
            <div className="flex justify-center gap-1 mt-3">
              {TESTIMONIALS.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full transition-all ${i === currentTestimonial ? 'bg-pink-500 w-4' : 'bg-gray-600'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-5 grid grid-cols-2 gap-3 print:hidden">
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Download className="w-5 h-5" /> Download
          </button>
          <Link href="/assessment" className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Share2 className="w-5 h-5" /> Try Again
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
