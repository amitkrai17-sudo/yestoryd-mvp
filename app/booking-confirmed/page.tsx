// app/booking-confirmed/page.tsx
// Booking Confirmation - LIGHT THEME + LIFT Framework
// Fixes: Theme consistency, "100+ families", trust signals, anxiety reducers

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  Calendar,
  MessageCircle,
  Mail,
  Clock,
  ArrowRight,
  Loader2,
  Video,
  Star,
  Sparkles,
  Bell,
  Heart,
  Shield,
} from 'lucide-react';

function BookingConfirmedContent() {
  const searchParams = useSearchParams();

  // Get params from Cal.com redirect or URL
  const childName = searchParams.get('childName') || searchParams.get('name') || '';
  const parentEmail = searchParams.get('email') || '';

  // WhatsApp
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi Rucha! I just booked a discovery call${childName ? ` for ${childName}` : ''}. Looking forward to speaking with you!`
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
      {/* Header - LIGHT THEME */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 lg:py-12">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200 animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            You&apos;re All Set! 🎉
          </h1>
          <p className="text-gray-600 text-lg">
            {childName ? (
              <>Your discovery call for <span className="font-semibold text-pink-600">{childName}</span> is confirmed!</>
            ) : (
              <>Your discovery call has been booked successfully</>
            )}
          </p>
        </div>

        {/* Confirmation Card - LIGHT THEME */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-lg">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
                R
              </div>
              <div>
                <h3 className="text-white font-bold">Discovery Call with Coach Rucha</h3>
                <p className="text-white/80 text-sm">Founder &amp; Lead Reading Coach • 7 years exp.</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span>30 minutes • Check your email for exact time</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-green-600" />
              </div>
              <span>Google Meet link will be in your calendar invite</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-pink-600" />
              </div>
              <span>Confirmation sent to <span className="font-medium">{parentEmail || 'your email'}</span></span>
            </div>
          </div>
        </div>

        {/* What Happens Next - LIFT: Clarity */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            What Happens Next?
          </h2>

          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Check Your Email',
                description: 'You\'ll receive a calendar invite with the Google Meet link. Add it to your calendar!',
                icon: Mail,
                color: 'text-pink-600',
                bgColor: 'bg-pink-100',
              },
              {
                step: '2',
                title: 'Prepare for the Call',
                description: childName
                  ? `Think about ${childName}'s reading journey - what challenges they face and your goals.`
                  : 'Think about your child\'s reading journey - what challenges they face and your goals.',
                icon: Calendar,
                color: 'text-blue-600',
                bgColor: 'bg-blue-100',
              },
              {
                step: '3',
                title: 'Join the Call',
                description: 'Click the Google Meet link at the scheduled time. Rucha will guide the conversation!',
                icon: Video,
                color: 'text-green-600',
                bgColor: 'bg-green-100',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-semibold">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reminder Box - LIFT: Reduce Anxiety */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-800 font-semibold text-sm">Don&apos;t see the email?</h3>
              <p className="text-amber-700 text-sm mt-1">
                Check your spam/junk folder. The email comes from Cal.com. If you still don&apos;t see it, message us on WhatsApp!
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-200"
          >
            <MessageCircle className="w-5 h-5" />
            Message Rucha on WhatsApp
          </a>

          <Link
            href="/"
            className="w-full h-12 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            Back to Homepage
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Trust Signals - LIFT: Reduce Anxiety */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Shield className="w-4 h-4 text-green-500" />
            100% Free Call
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-blue-500" />
            No Obligation
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-pink-500" />
            Certified Coach
          </span>
        </div>

        {/* Social Proof - FIXED: "100+ families" */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <p className="text-gray-600 text-sm">
            Join <span className="text-gray-900 font-semibold">100+ families</span> who transformed their child&apos;s reading
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
      </div>
    }>
      <BookingConfirmedContent />
    </Suspense>
  );
}