'use client';

import { useState, Suspense } from 'react';
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
  MessageCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// ==================== TYPES ====================
interface PricingData {
  name: string;
  originalPrice: number;
  discountedPrice: number;
  sessions: number;
  duration: string;
  discountLabel: string;
  features: string[];
}

interface CoachData {
  id: string;
  name: string;
  title: string;
  experience: string;
  rating: string;
  students: string;
  bio: string;
  phone: string;
  email: string;
}

interface ContactData {
  whatsapp: string;
  calUsername: string;
  calSlug: string;
}

interface TestimonialData {
  id: string;
  parent_name: string;
  parent_location: string;
  child_name: string;
  child_age: number;
  testimonial_text: string;
  rating: number;
}

interface BookPageClientProps {
  pricing: PricingData;
  coach: CoachData;
  contact: ContactData;
  freeSessionEnabled: boolean;
  testimonial: TestimonialData | null;
}

// ==================== FEATURE ICONS MAP ====================
const FEATURE_ICONS: Record<string, any> = {
  'sessions': Users,
  'coaching': Users,
  'parent': Calendar,
  'meeting': Calendar,
  'e-learning': BookOpen,
  'library': BookOpen,
  'ai': Sparkles,
  'progress': Sparkles,
  'tracking': Sparkles,
  'whatsapp': MessageCircle,
  'support': MessageCircle,
  'guarantee': Shield,
  'refund': Shield,
  'satisfaction': Shield,
};

function getFeatureIcon(text: string) {
  const lowerText = text.toLowerCase();
  for (const [keyword, icon] of Object.entries(FEATURE_ICONS)) {
    if (lowerText.includes(keyword)) {
      return icon;
    }
  }
  return CheckCircle2;
}

// ==================== MAIN COMPONENT ====================
function BookPageContent({ pricing, coach, contact, freeSessionEnabled, testimonial }: BookPageClientProps) {
  const searchParams = useSearchParams();

  // Get child info from URL params (passed from assessment results)
  const childName = searchParams.get('childName') || '';
  const childAge = searchParams.get('childAge') || '';
  const parentName = searchParams.get('parentName') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const score = searchParams.get('score') || '';
  const type = searchParams.get('type') || 'enrollment';

  const [selectedOption, setSelectedOption] = useState<'free' | 'paid'>(
    type === 'consultation' ? 'free' : 'paid'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Build dynamic Cal.com URL
  const calBookingUrl = `https://cal.com/${contact.calUsername}/${contact.calSlug}?name=${encodeURIComponent(parentName)}&email=${encodeURIComponent(parentEmail)}&guests=${encodeURIComponent(coach.email)}`;

  // Build dynamic WhatsApp URL
  const whatsappUrl = `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I have questions about the reading program for my child ${childName || ''}`)}`;

  const handleFreeSession = () => {
    setIsLoading(true);
    // Redirect to /enroll with free trial flag - will collect info then redirect to Cal.com
    const enrollUrl = `/enroll?source=free-trial&type=free&childName=${encodeURIComponent(childName)}&childAge=${encodeURIComponent(childAge)}&parentName=${encodeURIComponent(parentName)}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}`;
    window.location.href = enrollUrl;
  };

  const handlePaidEnrollment = () => {
    setIsLoading(true);
    // Redirect to /enroll with prefilled data
    const enrollUrl = `/enroll?source=book&childName=${encodeURIComponent(childName)}&childAge=${encodeURIComponent(childAge)}&parentName=${encodeURIComponent(parentName)}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}`;
    window.location.href = enrollUrl;
  };

  // Calculate discount percentage
  const discountPercent = Math.round(((pricing.originalPrice - pricing.discountedPrice) / pricing.originalPrice) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ff0099]/10 via-surface-0 to-surface-0">
      {/* Header */}
      <header className="bg-surface-1/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-white min-h-[44px]">
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
          <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-pink-200 text-sm">Enrolling</p>
              <p className="text-xl font-bold break-words">{childName}</p>
              {score && <p className="text-pink-200 text-sm">Assessment Score: {score}</p>}
            </div>
            <div className="text-right">
              <p className="text-pink-200 text-sm">Age</p>
              <p className="text-xl font-bold">{childAge} years</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Coach & Program Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Coach Card - DYNAMIC */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-md shadow-black/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ffde00]" />
                Your Reading Coach
              </h2>

              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {coach.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white break-words">{coach.name}</h3>
                  <p className="text-[#ff0099] font-medium">{coach.title}</p>
                  <p className="text-text-secondary text-sm mt-1 break-words">{coach.bio}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                    <span className="flex items-center gap-1 text-[#ffde00]">
                      <Star className="w-4 h-4 fill-[#ffde00] text-[#ffde00]" />
                      {coach.rating}
                    </span>
                    <span className="text-text-tertiary">{coach.experience} experience</span>
                    <span className="text-text-tertiary">{coach.students} students</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Program Features - DYNAMIC */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-md shadow-black/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00abff]" />
                What&apos;s Included
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {pricing.features.map((feature, idx) => {
                  const IconComponent = getFeatureIcon(feature);
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#ff0099]/20 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-[#ff0099]" />
                      </div>
                      <span className="text-text-secondary text-sm break-words">{feature}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Testimonial - DYNAMIC */}
            {testimonial ? (
              <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 rounded-2xl border border-[#ff0099]/30 p-6">
                <div className="flex gap-1 mb-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#ffde00] text-[#ffde00]" />
                  ))}
                </div>
                <p className="text-text-secondary italic break-words">
                  &quot;{testimonial.testimonial_text}&quot;
                </p>
                <p className="text-[#ff0099] font-medium mt-2">
                  — {testimonial.parent_name}, {testimonial.parent_location}
                </p>
                <p className="text-text-tertiary text-sm">
                  Parent of {testimonial.child_name}, {testimonial.child_age} years
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 rounded-2xl border border-[#ff0099]/30 p-6">
                <p className="text-text-secondary italic break-words">
                  &quot;My daughter&apos;s reading improved dramatically in just 6 weeks. Coach {coach.name} is amazing with kids!&quot;
                </p>
                <p className="text-[#ff0099] font-medium mt-2">— Priya M., Parent</p>
              </div>
            )}
          </div>

          {/* Right Column - Pricing & CTA */}
          <div className="space-y-4">
            {/* Free Session Option - CONDITIONAL based on feature flag */}
            {freeSessionEnabled && (
              <div
                className={`bg-surface-1 rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                  selectedOption === 'free'
                    ? 'border-green-500 shadow-lg shadow-green-500/20'
                    : 'border-border hover:border-green-500/50'
                }`}
                onClick={() => setSelectedOption('free')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-500" />
                    <span className="font-bold text-white">Free Trial Session</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === 'free' ? 'border-green-500 bg-green-500' : 'border-border'
                  }`}>
                    {selectedOption === 'free' && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </div>

                <p className="text-text-secondary text-sm mb-3 break-words">
                  Try before you commit! Book a free 30-min session with Coach {coach.name}.
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-500">FREE</span>
                  <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">No card required</span>
                </div>
              </div>
            )}

            {/* Paid Enrollment Option - DYNAMIC PRICING */}
            <div
              className={`bg-surface-1 rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedOption === 'paid'
                  ? 'border-[#ff0099] shadow-lg shadow-[#ff0099]/20'
                  : 'border-border hover:border-[#ff0099]/50'
              }`}
              onClick={() => setSelectedOption('paid')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ff0099]" />
                  <span className="font-bold text-white">{pricing.name}</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === 'paid' ? 'border-[#ff0099] bg-[#ff0099]' : 'border-border'
                }`}>
                  {selectedOption === 'paid' && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
              </div>

              <p className="text-text-secondary text-sm mb-3">
                {pricing.sessions} sessions over {pricing.duration}. Everything included.
              </p>

              <div className="flex items-center gap-3">
                <span className="text-text-tertiary line-through">₹{pricing.originalPrice.toLocaleString('en-IN')}</span>
                <span className="text-2xl font-bold text-[#ff0099]">₹{pricing.discountedPrice.toLocaleString('en-IN')}</span>
                <span className="text-xs text-white bg-red-500 px-2 py-1 rounded-full">{pricing.discountLabel}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={selectedOption === 'free' ? handleFreeSession : handlePaidEnrollment}
              disabled={isLoading}
              className={`w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all min-h-[56px] ${
                selectedOption === 'free'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-to-r from-[#ff0099] to-[#ff6b6b] hover:opacity-90 text-white'
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
              <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
                <Shield className="w-4 h-4 text-green-500" />
                <span>100% Refund if not satisfied</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
                <Clock className="w-4 h-4 text-[#00abff]" />
                <span>Flexible scheduling</span>
              </div>
            </div>

            {/* Help - DYNAMIC WHATSAPP */}
            <div className="bg-surface-2 rounded-xl p-4 text-center border border-border">
              <p className="text-text-secondary text-sm mb-2">Need help deciding?</p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-green-500 font-medium text-sm hover:text-green-400 min-h-[44px]"
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

// ==================== EXPORT WITH SUSPENSE ====================
export default function BookPageClient(props: BookPageClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    }>
      <BookPageContent {...props} />
    </Suspense>
  );
}
