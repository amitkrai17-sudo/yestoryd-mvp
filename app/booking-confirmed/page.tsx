// app/booking-confirmed/page.tsx
// Booking Confirmation - DARK THEME + LIFT Framework
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
import { useSessionDurations } from '@/contexts/SiteSettingsContext';

function BookingConfirmedContent() {
  const searchParams = useSearchParams();
  const durations = useSessionDurations();

  // Get params from Cal.com redirect or URL
  const childName = searchParams.get('childName') || searchParams.get('name') || '';
  const parentEmail = searchParams.get('email') || '';

  // WhatsApp
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi Rucha! I just booked a discovery call${childName ? ` for ${childName}` : ''}. Looking forward to speaking with you!`
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500/10 via-surface-0 to-surface-0">
      {/* Header - DARK THEME */}
      <header className="bg-surface-1/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
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
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 flex items-center justify-center gap-2">
            You&apos;re All Set! <Sparkles className="w-7 h-7 text-[#ffde00]" />
          </h1>
          <p className="text-text-secondary text-lg">
            {childName ? (
              <>Your discovery call for <span className="font-semibold text-[#ff0099]">{childName}</span> is confirmed!</>
            ) : (
              <>Your discovery call has been booked successfully</>
            )}
          </p>
        </div>

        {/* Confirmation Card - DARK THEME */}
        <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden mb-6 shadow-lg shadow-black/20">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] p-4">
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
            <div className="flex items-center gap-3 text-text-secondary">
              <div className="w-10 h-10 bg-[#00abff]/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#00abff]" />
              </div>
              <span>{durations.discovery} minutes • Check your email for exact time</span>
            </div>
            <div className="flex items-center gap-3 text-text-secondary">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-green-500" />
              </div>
              <span>Google Meet link will be in your calendar invite</span>
            </div>
            <div className="flex items-center gap-3 text-text-secondary">
              <div className="w-10 h-10 bg-[#ff0099]/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#ff0099]" />
              </div>
              <span>Confirmation sent to <span className="font-medium text-white">{parentEmail || 'your email'}</span></span>
            </div>
          </div>
        </div>

        {/* What Happens Next - LIFT: Clarity */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5 mb-6 shadow-md shadow-black/20">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#ffde00]" />
            What Happens Next?
          </h2>

          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Check Your Email',
                description: 'You\'ll receive a calendar invite with the Google Meet link. Add it to your calendar!',
                icon: Mail,
                color: 'text-[#ff0099]',
                bgColor: 'bg-[#ff0099]/20',
              },
              {
                step: '2',
                title: 'Prepare for the Call',
                description: childName
                  ? `Think about ${childName}'s reading journey - what challenges they face and your goals.`
                  : 'Think about your child\'s reading journey - what challenges they face and your goals.',
                icon: Calendar,
                color: 'text-[#00abff]',
                bgColor: 'bg-[#00abff]/20',
              },
              {
                step: '3',
                title: 'Join the Call',
                description: 'Click the Google Meet link at the scheduled time. Rucha will guide the conversation!',
                icon: Video,
                color: 'text-green-500',
                bgColor: 'bg-green-500/20',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{item.title}</h3>
                  <p className="text-text-secondary text-sm break-words">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reminder Box - LIFT: Reduce Anxiety */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-500 font-semibold text-sm">Don&apos;t see the email?</h3>
              <p className="text-amber-400/80 text-sm mt-1">
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
            className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full transition-colors shadow-lg shadow-green-500/30"
          >
            <MessageCircle className="w-5 h-5" />
            Message Rucha on WhatsApp
          </a>

          <Link
            href="/"
            className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-1 text-text-secondary font-semibold rounded-full transition-colors border border-border"
          >
            Back to Homepage
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Trust Signals - LIFT: Reduce Anxiety */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-text-tertiary">
          <span className="flex items-center gap-1">
            <Shield className="w-4 h-4 text-green-500" />
            100% Free Call
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-[#00abff]" />
            No Obligation
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-[#ff0099]" />
            Certified Coach
          </span>
        </div>

        {/* Social Proof - FIXED: "100+ families" */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 text-[#ffde00] fill-[#ffde00]" />
            ))}
          </div>
          <p className="text-text-secondary text-sm">
            Join <span className="text-white font-semibold">100+ families</span> who transformed their child&apos;s reading
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff0099]" />
      </div>
    }>
      <BookingConfirmedContent />
    </Suspense>
  );
}
