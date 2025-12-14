'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  BookOpen,
  Sparkles,
  Gift,
  Shield,
  Star,
  Phone,
  MessageCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// ==================== PRICING CONFIG ====================
const PRICING = {
  program: {
    name: '3-Month Reading Coaching',
    originalPrice: 8999,
    discountedPrice: 5999,
    sessions: 9, // 6 coaching + 3 parent meetings
    duration: '3 months',
  },
  freeSessionOffer: {
    enabled: true,
    text: 'Book your FREE trial session first!',
    validUntil: '2025-01-31', // Offer expiry
  },
};

// ==================== COACH CONFIG (Auto-assign to Rucha) ====================
const COACH = {
  id: 'rucha',
  name: 'Rucha',
  title: 'Founder & Lead Reading Coach',
  image: '/images/coach-rucha.jpg',
  experience: '10+ years',
  specialization: 'Phonics & Early Reading',
  rating: 4.9,
  students: 500,
  bio: 'Passionate about helping children discover the joy of reading through personalized coaching.',
};

// ==================== PROGRAM FEATURES ====================
const FEATURES = [
  { icon: Users, text: '6 One-on-One Coaching Sessions' },
  { icon: Calendar, text: '3 Parent Progress Meetings' },
  { icon: BookOpen, text: 'FREE Access to E-Learning Library' },
  { icon: Sparkles, text: 'AI-Powered Progress Tracking' },
  { icon: MessageCircle, text: 'WhatsApp Support from Coach' },
  { icon: Shield, text: '100% Satisfaction Guarantee' },
];

function BookPageContent() {
  const searchParams = useSearchParams();
  
  // Get child info from URL params (passed from assessment results)
  const childName = searchParams.get('childName') || '';
  const childAge = searchParams.get('childAge') || '';
  const parentName = searchParams.get('parentName') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const score = searchParams.get('score') || '';
  const type = searchParams.get('type') || 'enrollment'; // 'enrollment' or 'consultation'
  
  const [selectedOption, setSelectedOption] = useState<'free' | 'paid'>(
    type === 'consultation' ? 'free' : 'paid'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Check if free session offer is valid
  const isFreeOfferValid = new Date() < new Date(PRICING.freeSessionOffer.validUntil);

  const handleFreeSession = () => {
    // Redirect to Cal.com or Google Calendar booking for free session
    const bookingUrl = `https://cal.com/yestoryd/free-trial?name=${encodeURIComponent(parentName)}&email=${encodeURIComponent(parentEmail)}&childName=${encodeURIComponent(childName)}`;
    window.open(bookingUrl, '_blank');
  };

  const handlePaidEnrollment = () => {
    setIsLoading(true);
    // Redirect to checkout page with all params
    const checkoutUrl = `/checkout?childName=${encodeURIComponent(childName)}&childAge=${encodeURIComponent(childAge)}&parentName=${encodeURIComponent(parentName)}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}&coachId=${COACH.id}&amount=${PRICING.program.discountedPrice}`;
    window.location.href = checkoutUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-amber-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </Link>
            <Image src="/images/logo.png" alt="Yestoryd" width={120} height={40} className="h-8 w-auto" />
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Child Info Banner */}
        {childName && (
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-pink-100 text-sm">Enrolling</p>
              <p className="text-xl font-bold">{childName}</p>
              {score && <p className="text-pink-200 text-sm">Assessment Score: {score}/10</p>}
            </div>
            <div className="text-right">
              <p className="text-pink-100 text-sm">Age</p>
              <p className="text-xl font-bold">{childAge} years</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Coach & Program Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Coach Card */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Your Reading Coach
              </h2>
              
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                  {COACH.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800">{COACH.name}</h3>
                  <p className="text-amber-600 font-medium">{COACH.title}</p>
                  <p className="text-gray-600 text-sm mt-1">{COACH.bio}</p>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="flex items-center gap-1 text-amber-600">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {COACH.rating}
                    </span>
                    <span className="text-gray-500">{COACH.experience} experience</span>
                    <span className="text-gray-500">{COACH.students}+ students</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Program Features */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                What's Included
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                {FEATURES.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-gray-700 text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
              <p className="text-gray-700 italic">
                "My daughter's reading improved dramatically in just 6 weeks. Coach Rucha is amazing with kids!"
              </p>
              <p className="text-amber-600 font-medium mt-2">— Priya M., Parent</p>
            </div>
          </div>

          {/* Right Column - Pricing & CTA */}
          <div className="space-y-4">
            {/* Free Session Option */}
            {isFreeOfferValid && PRICING.freeSessionOffer.enabled && (
              <div 
                className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                  selectedOption === 'free' 
                    ? 'border-green-500 shadow-lg shadow-green-100' 
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => setSelectedOption('free')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-500" />
                    <span className="font-bold text-gray-800">Free Trial Session</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === 'free' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {selectedOption === 'free' && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-3">
                  Try before you commit! Book a free 30-min session with Coach {COACH.name}.
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-600">FREE</span>
                  <span className="text-xs text-gray-500 bg-green-100 px-2 py-1 rounded-full">No card required</span>
                </div>
              </div>
            )}

            {/* Paid Enrollment Option */}
            <div 
              className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedOption === 'paid' 
                  ? 'border-amber-500 shadow-lg shadow-amber-100' 
                  : 'border-gray-200 hover:border-amber-300'
              }`}
              onClick={() => setSelectedOption('paid')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-gray-800">Full Program</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === 'paid' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                }`}>
                  {selectedOption === 'paid' && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-3">
                {PRICING.program.sessions} sessions over {PRICING.program.duration}. Everything included.
              </p>
              
              <div className="flex items-center gap-3">
                <span className="text-gray-400 line-through">₹{PRICING.program.originalPrice.toLocaleString()}</span>
                <span className="text-2xl font-bold text-amber-600">₹{PRICING.program.discountedPrice.toLocaleString()}</span>
                <span className="text-xs text-white bg-red-500 px-2 py-1 rounded-full">33% OFF</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={selectedOption === 'free' ? handleFreeSession : handlePaidEnrollment}
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                selectedOption === 'free'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : selectedOption === 'free' ? (
                <>
                  <Calendar className="w-5 h-5" />
                  Book Free Session
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  Proceed to Payment
                </>
              )}
            </button>

            {/* Trust Badges */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Shield className="w-4 h-4 text-green-500" />
                <span>100% Refund if not satisfied</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Flexible scheduling</span>
              </div>
            </div>

            {/* Help */}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-gray-600 text-sm mb-2">Need help deciding?</p>
              <a
                href="https://wa.me/918976287997?text=Hi, I have questions about the reading program"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-green-600 font-medium text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with us on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <BookPageContent />
    </Suspense>
  );
}