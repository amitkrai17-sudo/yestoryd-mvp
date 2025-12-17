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
  Phone,
  Video,
  Star,
  Sparkles,
  Bell,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-900/95 border-b border-gray-800">
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
          <div className="w-20 h-20 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            You're All Set! 🎉
          </h1>
          <p className="text-gray-400 text-lg">
            Your discovery call has been booked successfully
          </p>
        </div>

        {/* Confirmation Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden mb-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                R
              </div>
              <div>
                <h3 className="text-white font-bold">Discovery Call with Rucha</h3>
                <p className="text-gray-400 text-sm">Founder & Lead Reading Coach</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-gray-300">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>30 minutes • Check your email for exact time</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Video className="w-5 h-5 text-green-400" />
              <span>Google Meet link will be in your calendar invite</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Mail className="w-5 h-5 text-pink-400" />
              <span>Confirmation sent to your email</span>
            </div>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            What Happens Next?
          </h2>
          
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Check Your Email',
                description: 'You\'ll receive a calendar invite with the Google Meet link. Add it to your calendar!',
                icon: Mail,
                color: 'text-pink-400',
                bgColor: 'bg-pink-500/20',
              },
              {
                step: '2',
                title: 'Prepare for the Call',
                description: childName 
                  ? `Think about ${childName}'s reading journey - what challenges they face and your goals.`
                  : 'Think about your child\'s reading journey - what challenges they face and your goals.',
                icon: Calendar,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/20',
              },
              {
                step: '3',
                title: 'Join the Call',
                description: 'Click the Google Meet link at the scheduled time. Rucha will guide the conversation!',
                icon: Video,
                color: 'text-green-400',
                bgColor: 'bg-green-500/20',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reminder Box */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-400 font-semibold text-sm">Don't see the email?</h3>
              <p className="text-gray-400 text-sm mt-1">
                Check your spam/junk folder. The email comes from Cal.com. If you still don't see it, message us on WhatsApp!
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
            className="w-full h-12 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Message Rucha on WhatsApp
          </a>
          
          <Link
            href="/"
            className="w-full h-12 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            Back to Homepage
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Social Proof */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <p className="text-gray-400 text-sm">
            Join <span className="text-white font-semibold">500+ parents</span> who transformed their child's reading
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
      </div>
    }>
      <BookingConfirmedContent />
    </Suspense>
  );
}
