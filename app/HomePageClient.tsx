'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Users,
  Menu,
  X,
  CheckCircle,
  ArrowRight,
  Zap,
  LogIn,
  Award,
  BookOpen,
  Heart,
  Lightbulb,
  MessageCircle,
  Play,
  Star,
  Clock,
  Shield,
  TrendingUp,
  GraduationCap,
  Brain,
  Mic,
  BarChart3,
  Eye,
  Bell,
  AlertTriangle,
  CreditCard,
  Calendar,
} from 'lucide-react';

// ==================== TYPES ====================
interface StatsData {
  totalAssessments: string;
  happyParents: string;
  successRate: string;
  avgImprovement: string;
}

interface PricingData {
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string;
  freeAssessmentWorth: string;
}

interface ProductData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string | null;
  sessionsIncluded: number;
  coachingSessions: number;
  skillBuildingSessions: number;
  checkinSessions: number;
  durationMonths: number;
  features: string[];
  isFeatured: boolean;
  badgeText: string | null;
  displayOrder: number;
}

interface ContactData {
  whatsappNumber: string;
}

interface VideoData {
  homepageStoryVideoUrl: string;
}

interface TestimonialData {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
}

interface ABTestConfig {
  enabled: boolean;
  testName: string;
  split: number; // 0.5 = 50/50
}

interface HomePageClientProps {
  stats: StatsData;
  pricing: PricingData;
  products: ProductData[];
  contact: ContactData;
  videos: VideoData;
  testimonials: TestimonialData[];
  showTestimonials: boolean;
  abTestConfig?: ABTestConfig;
}

// ==================== A/B TEST UTILITIES ====================
type ABVariant = 'curiosity' | 'validation';

const getOrSetABVariant = (testName: string, split: number = 0.5): ABVariant => {
  if (typeof window === 'undefined') return 'validation'; // SSR default
  
  const cookieName = `yestoryd_ab_${testName}`;
  const existingCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith(cookieName));
  
  if (existingCookie) {
    const value = existingCookie.split('=')[1];
    return value as ABVariant;
  }
  
  // Assign new variant
  const variant: ABVariant = Math.random() < split ? 'curiosity' : 'validation';
  
  // Set cookie for 30 days
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `${cookieName}=${variant}; expires=${expires.toUTCString()}; path=/`;
  
  return variant;
};

const trackABEvent = async (testName: string, variant: string, eventType: string) => {
  try {
    await fetch('/api/ab-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_name: testName,
        variant,
        event_type: eventType,
        device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
        referrer: document.referrer || null,
      }),
    });
  } catch (error) {
    console.error('AB tracking error:', error);
  }
};

// ==================== STATIC DATA ====================
const triangleNodes = {
  rai: {
    id: 'rai',
    title: 'rAI',
    subtitle: 'The Brain',
    icon: Brain,
    color: '#00ABFF',
    description: 'Our AI engine that powers personalized learning',
    features: [
      'Analyzes reading in real-time',
      'Identifies exact gaps & struggles',
      'Builds personalized curriculum',
      'Tracks progress every session',
    ],
  },
  coach: {
    id: 'coach',
    title: 'Coach',
    subtitle: 'The Heart',
    icon: Heart,
    color: '#FF0099',
    description: 'Certified experts who deliver with warmth',
    features: [
      '1-on-1 personalized sessions',
      'Jolly Phonics certified',
      'Patient, encouraging, warm',
      'Celebrates every small win',
    ],
  },
  parent: {
    id: 'parent',
    title: 'Parent',
    subtitle: 'The Eyes',
    icon: Eye,
    color: '#7B008B',
    description: 'Full transparency — you see everything',
    features: [
      'Progress reports after every session',
      'Real-time updates on WhatsApp',
      'Visual dashboard of improvement',
      'Direct chat with coach',
    ],
  },
};

// ==================== HERO VARIANTS ====================

// Design 2: Curiosity-Led Hero
const HeroCuriosity = ({ 
  testimonial, 
  stats, 
  onCTAClick 
}: { 
  testimonial: TestimonialData; 
  stats: StatsData;
  onCTAClick: () => void;
}) => (
  <div className="text-center lg:text-left">
    {/* Badge */}
    <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
      <Brain className="w-3 h-3 text-[#00abff]" />
      <span className="text-xs font-bold text-gray-600 tracking-wide uppercase">
        rAI-Powered Reading Analysis
      </span>
    </div>

    {/* Main Headline */}
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] mb-6">
      There's a Reason Your Child{' '}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
        Avoids Reading
      </span>
    </h1>

    {/* Subheadline - The Reframe */}
    <p className="text-lg sm:text-xl text-gray-600 mb-4 leading-relaxed max-w-xl mx-auto lg:mx-0">
      <strong className="text-gray-900">It's not laziness. It's not attitude.</strong>
    </p>
    <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
      It's usually a small gap in how they process sounds — something schools rarely identify. 
      Our <span className="font-black text-[#00ABFF]">rAI</span> finds it in 5 minutes. <span className="text-green-600 font-bold">Free.</span>
    </p>

    {/* CTA Buttons */}
    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-6">
      <Link
        href="/assessment"
        onClick={onCTAClick}
        className="w-full sm:w-auto h-14 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 transition-all shadow-xl shadow-[#ff0099]/20 whitespace-nowrap"
      >
        <Zap className="w-5 h-5" />
        See Why — 5 Minutes
      </Link>
      <a
        href="#rucha-story"
        className="flex items-center gap-2 text-gray-700 font-semibold hover:text-[#ff0099] transition-colors"
      >
        <Play className="w-5 h-5" />
        Watch Our Story
      </a>
    </div>

    {/* Testimonial with Score */}
    {testimonial && (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 max-w-xl mx-auto lg:mx-0 shadow-sm">
        <div className="flex gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
          ))}
        </div>
        <p className="text-gray-600 text-sm mb-2">"{testimonial.testimonial_text}"</p>
        <p className="text-xs text-gray-500">
          — {testimonial.parent_name}, {testimonial.parent_location}
        </p>
      </div>
    )}

    {/* Trust Badges */}
    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-gray-500 mb-4">
      <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
        <Shield className="w-4 h-4" />
        100% Free
      </span>
      <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
        <Clock className="w-4 h-4" />
        5 Minutes
      </span>
      <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200">
        <TrendingUp className="w-4 h-4" />
        Instant Results
      </span>
    </div>

    {/* Sharp Stat + Urgency */}
    <div className="space-y-2">
      <p className="text-sm text-gray-600 flex items-center justify-center lg:justify-start gap-2">
        <span className="text-[#00abff] font-bold">87%</span> of parents finally understood WHY their child struggled
      </p>
      <p className="text-xs text-amber-600 flex items-center justify-center lg:justify-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Reading gaps widen every month. Early identification matters.
      </p>
    </div>
  </div>
);

// Design 4: Validation-Led Hero (Hybrid - includes "not laziness" reframe)
const HeroValidation = ({
  testimonial,
  stats,
  onCTAClick
}: {
  testimonial: TestimonialData;
  stats: StatsData;
  onCTAClick: () => void;
}) => (
  <div className="text-center lg:text-left">
    {/* Badge */}
    <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
      <Heart className="w-3 h-3 text-[#ff0099] fill-[#ff0099]" />
      <span className="text-xs font-bold text-gray-600 tracking-wide uppercase">
        For Ages 4-12 • AI + Expert Coaches
      </span>
    </div>

    {/* Main Headline */}
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] mb-6">
      You've Noticed Something{' '}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
        Isn't Clicking
      </span>
      <br />
      <span className="text-3xl sm:text-4xl lg:text-5xl">With Your Child's Reading</span>
    </h1>

    {/* Subheadline - Validation + Reframe */}
    <p className="text-lg sm:text-xl text-gray-600 mb-4 leading-relaxed max-w-xl mx-auto lg:mx-0">
      <strong className="text-gray-900">It's not laziness. It's not attitude.</strong>
    </p>
    <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
      It's usually a small gap that schools don't catch — but <span className="font-black text-[#00ABFF]">rAI</span> does. In 5 minutes. <span className="text-green-600 font-bold">Free.</span>
    </p>

    {/* CTA Buttons */}
    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-6">
      <Link
        href="/assessment"
        onClick={onCTAClick}
        className="w-full sm:w-auto h-14 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 transition-all shadow-xl shadow-[#ff0099]/20 whitespace-nowrap"
      >
        <Zap className="w-5 h-5" />
        See Why — 5 Minutes
      </Link>
      <a 
        href="#rucha-story" 
        className="flex items-center gap-2 text-gray-700 font-semibold hover:text-[#ff0099] transition-colors"
      >
        <Play className="w-5 h-5" />
        Watch Our Story
      </a>
    </div>

    {/* Testimonial with Score */}
    {testimonial && (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 max-w-xl mx-auto lg:mx-0 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
            ))}
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            4/10 → 8/10
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-2">"{testimonial.testimonial_text}"</p>
        <p className="text-xs text-gray-500">
          — {testimonial.parent_name}, {testimonial.parent_location}
        </p>
      </div>
    )}

    {/* Trust Badges */}
    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-gray-500 mb-4">
      <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
        <Shield className="w-4 h-4" />
        100% Free
      </span>
      <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
        <Clock className="w-4 h-4" />
        5 Minutes
      </span>
      <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200">
        <TrendingUp className="w-4 h-4" />
        Instant Results
      </span>
    </div>

    {/* Sharp Stat + Urgency */}
    <div className="space-y-2">
      <p className="text-sm text-gray-600 flex items-center justify-center lg:justify-start gap-2">
        <span className="text-[#00abff] font-bold">87%</span> of parents finally understood WHY their child struggled
      </p>
      <p className="text-xs text-amber-600 flex items-center justify-center lg:justify-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Reading gaps widen every month. Early identification matters.
      </p>
    </div>
  </div>
);

// ==================== TRANSFORMATION VISUAL (Replaces Triangulation) ====================
const TransformationVisual = () => {
  const beforeItems = [
    '"I hate reading"',
    'Avoids books',
    'Reads slowly',
    'Losing confidence',
  ];

  const afterItems = [
    '"Can I read more?"',
    'Picks up books',
    'Reads fluently',
    'Speaks confidently',
  ];

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white text-center py-3 px-4">
          <p className="font-bold text-sm sm:text-base">The 90-Day Transformation</p>
        </div>

        {/* Before/After Grid */}
        <div className="grid grid-cols-2 divide-x divide-gray-100">

          {/* BEFORE Column */}
          <div className="p-4 sm:p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Before</p>
            <div className="space-y-2.5">
              {beforeItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2 border border-red-100"
                >
                  <span className="w-2 h-2 rounded-full bg-red-300 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-500 leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AFTER Column */}
          <div className="p-4 sm:p-5 bg-green-50/30">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3 text-center">After 90 Days</p>
            <div className="space-y-2.5">
              {afterItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2 border border-green-200"
                >
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700 font-medium leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
        
        {/* Bottom CTA hint */}
        <div className="bg-gradient-to-r from-[#00ABFF]/10 to-[#ff0099]/10 px-4 py-3 text-center border-t border-gray-100">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-[#00ABFF]">rAI finds the gaps</span> • <span className="font-bold text-[#ff0099]">Coach fills them</span> • <span className="font-bold text-[#7b008b]">You see progress</span>
          </p>
        </div>
        
      </div>
    </div>
  );
};

// ==================== YOUTUBE FACADE (Performance Optimization) ====================
const VideoFacade = ({ videoUrl }: { videoUrl: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <iframe
        src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0&modestbranding=1`}
        title="Rucha's Story - Yestoryd"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    );
  }

  return (
    <button 
      onClick={() => setIsPlaying(true)} 
      className="absolute inset-0 w-full h-full group cursor-pointer bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center"
      aria-label="Play video"
    >
      {/* Thumbnail placeholder with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ff0099]/20 to-[#00ABFF]/20"></div>
      
      {/* Yestoryd branding on thumbnail */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#ff0099]" />
        </div>
        <span className="text-white font-bold text-lg">Yestoryd Story</span>
      </div>
      
      {/* Video title */}
      <div className="absolute bottom-6 left-6 right-6">
        <p className="text-white/80 text-sm mb-1">Watch</p>
        <p className="text-white font-bold text-lg">How Rucha Started Yestoryd</p>
      </div>
      
      {/* Play button */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-white/95 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-300">
          <Play className="w-8 h-8 text-[#ff0099] ml-1" fill="#ff0099" />
        </div>
        <p className="text-white/80 text-sm mt-4 group-hover:text-white transition-colors">Click to play</p>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-[#ff0099]/10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-[#00ABFF]/10 rounded-full blur-2xl"></div>
    </button>
  );
};

// ==================== FAQ DATA ====================
const faqData = [
  {
    question: "What device do I need for the assessment?",
    answer: "Any smartphone, tablet, or laptop with a microphone works! The assessment runs in your browser — no app download needed. 80% of our parents use their phone."
  },
  {
    question: "How long is each coaching session?",
    answer: "Coaching sessions are 45 minutes each, with parent check-ins being 30 minutes. Sessions are scheduled at times convenient for you — weekdays or weekends. The Full Program includes 12 sessions over 3 months."
  },
  {
    question: "Is this a subscription? Will I be charged monthly?",
    answer: "No subscriptions! It's a one-time payment. Choose from Starter Pack, Continuation, or Full Program based on your needs. No hidden fees, no recurring charges."
  },
  {
    question: "What if my child doesn't improve?",
    answer: "We offer a 100% satisfaction guarantee. If you don't see improvement after completing the program, we'll either continue working with you at no extra cost or provide a full refund."
  },
  {
    question: "Is the AI safe for my child?",
    answer: "Absolutely. Unlike ChatGPT which guesses, rAI (our Reading Intelligence) only references our expert-verified knowledge base built on 7+ years of phonics expertise. It never makes things up. Your child's data is private and secure."
  },
  {
    question: "What age group is this for?",
    answer: "Yestoryd is designed for children aged 4-12 years. Our AI adapts the assessment based on your child's age, and coaches personalize sessions accordingly."
  }
];

// ==================== FAQ COMPONENT ====================
const FAQSection = ({ whatsappNumber }: { whatsappNumber: string }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#00ABFF] uppercase tracking-wider mb-4">
            Common Questions
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to know before getting started
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
              >
                <span className="font-semibold text-gray-900 text-base sm:text-lg">
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  openIndex === index 
                    ? 'bg-[#ff0099] text-white rotate-180' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-10 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I have a question about Yestoryd.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#25d366] font-semibold hover:underline"
          >
            <MessageCircle className="w-5 h-5" />
            Chat with us on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

// ==================== MAIN COMPONENT ====================
export default function HomePageClient({
  stats,
  pricing,
  products,
  contact,
  videos,
  testimonials,
  showTestimonials,
  abTestConfig = { enabled: true, testName: 'homepage_hero_jan2026', split: 0.5 },
}: HomePageClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [abVariant, setABVariant] = useState<ABVariant>('validation');
  const [isClient, setIsClient] = useState(false);
  const [showStickyMobileCTA, setShowStickyMobileCTA] = useState(false);

  const whatsappNumber = contact.whatsappNumber;
  const whatsappMessage = encodeURIComponent("Hi! I'd like to know more about the reading program for my child.");
  const storyVideoUrl = videos?.homepageStoryVideoUrl || 'https://www.youtube.com/embed/Dz94bVuWH_A';

  // Client-side only: Set variant after mount to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
    
    if (abTestConfig.enabled) {
      const variant = getOrSetABVariant(abTestConfig.testName, abTestConfig.split);
      setABVariant(variant);
      trackABEvent(abTestConfig.testName, variant, 'view');
    }
  }, [abTestConfig.enabled, abTestConfig.testName, abTestConfig.split]);

  // Throttled scroll handler
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          setShowStickyMobileCTA(window.scrollY > 600);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCTAClick = () => {
    if (abTestConfig.enabled) {
      trackABEvent(abTestConfig.testName, abVariant, 'cta_click');
    }
  };

  // Default testimonials if none provided - WITH SCORES
  const displayTestimonials = testimonials.length > 0 ? testimonials : [
    { id: '1', testimonial_text: 'Finally understood WHY my son struggled. The AI found gaps we never knew existed. In 3 months, his reading score went from 4/10 to 8/10.', parent_name: 'Priya S.', parent_location: 'Mumbai', child_name: 'Aarav', child_age: 6, rating: 5 },
    { id: '2', testimonial_text: 'My daughter now picks up books on her own. She went from avoiding reading completely to asking "Can I read more?" Her fluency improved 2x.', parent_name: 'Rahul G.', parent_location: 'Delhi', child_name: 'Ananya', child_age: 7, rating: 5 },
    { id: '3', testimonial_text: 'The AI assessment showed us exactly where Arjun was stuck — it was blending sounds. After 2 months, he reads sentences smoothly. Clarity score: 5→9.', parent_name: 'Sneha P.', parent_location: 'Bangalore', child_name: 'Arjun', child_age: 5, rating: 5 },
    { id: '4', testimonial_text: 'Ishaan was 2 grades behind in reading. After 3 months, his teacher asked what changed. Speed improved from 15 WPM to 40 WPM. Worth every rupee.', parent_name: 'Meera K.', parent_location: 'Pune', child_name: 'Ishaan', child_age: 8, rating: 5 },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ==================== HEADER ==================== */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        {/* Top Bar */}
        <div className="bg-[#1a1a2e] text-white py-2 px-4 text-xs sm:text-sm">
          <div className="max-w-7xl mx-auto flex justify-center items-center">
            <p className="opacity-90 flex items-center gap-2">
              <GraduationCap className="w-3 h-3 text-[#00abff]" />
              <span className="hidden sm:inline">Jolly Phonics Certified • 7 Years Experience</span>
              <span className="sm:hidden">Certified Phonics Expert</span>
            </p>
          </div>
        </div>

        {/* Main Nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link href="/" className="flex items-center">
              <Image src="/images/logo.png" alt="Yestoryd" width={140} height={40} className="h-8 lg:h-10 w-auto" />
            </Link>

            <nav className="hidden lg:flex items-center gap-6">
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">The ARC Method</a>
              <a href="#rucha-story" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Our Story</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</a>
              
              <div className="h-6 w-px bg-gray-200 mx-2"></div>
              
              <Link href="/parent/login" className="flex items-center gap-2 text-gray-900 font-bold hover:text-[#00abff] text-sm transition-colors">
                <LogIn className="w-4 h-4" /> Login
              </Link>
              <Link
                href="/assessment"
                onClick={handleCTAClick}
                className="h-11 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white px-6 rounded-full font-bold hover:bg-[#e6008a] hover:shadow-lg hover:shadow-[#ff0099]/20 hover:-translate-y-0.5 transition-all duration-200 text-sm"
              >
                Reading Test - Free
              </Link>
            </nav>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-900"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-xl absolute w-full">
            <div className="px-4 py-6 space-y-4">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">The ARC Method</a>
              <a href="#rucha-story" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">Our Story</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">Pricing</a>
              <hr className="border-gray-100" />
              <Link href="/parent/login" onClick={() => setMobileMenuOpen(false)} className="block text-gray-600 py-2">Parent Login</Link>
              <Link href="/assessment" onClick={() => { setMobileMenuOpen(false); handleCTAClick(); }} className="h-12 flex items-center justify-center gap-2 bg-[#FF0099] text-white rounded-full font-bold w-full mt-4 hover:bg-[#e6008a]">
                Reading Test - Free
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ==================== HERO SECTION (A/B TESTED) ==================== */}
      <section className="pt-28 lg:pt-40 pb-16 lg:pb-24 bg-gradient-to-b from-[#FFF5F9] to-white relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#00abff]/5 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#ff0099]/5 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left Content - A/B Tested */}
            {abVariant === 'curiosity' ? (
              <HeroCuriosity 
                testimonial={displayTestimonials[0]} 
                stats={stats}
                onCTAClick={handleCTAClick}
              />
            ) : (
              <HeroValidation 
                testimonial={displayTestimonials[0]} 
                stats={stats}
                onCTAClick={handleCTAClick}
              />
            )}

            {/* Right - Transformation Visual (Before/After) */}
            <div className="relative">
              <TransformationVisual />
            </div>

          </div>
        </div>
      </section>

      {/* ==================== PROBLEM AWARENESS SECTION ==================== */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              What Schools Don't <span className="text-[#ff0099]">Tell You</span>
            </h2>
            <p className="text-lg text-gray-600">
              About why your child struggles with reading
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* The Core Insight */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
              <div className="w-14 h-14 bg-[#ff0099]/10 rounded-2xl flex items-center justify-center mb-6">
                <Lightbulb className="w-7 h-7 text-[#ff0099]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Reading is a Skill — Like Swimming
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Schools teach children <strong className="text-gray-900">WHAT to read</strong>, 
                but rarely <strong className="text-gray-900">HOW to read</strong>. 
                The science of reading — how sounds form words, how words form meaning — is often skipped.
              </p>
              
              {/* ASER Stat */}
              <div className="bg-[#ff0099]/5 border border-[#ff0099]/20 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-[#ff0099]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#ff0099] mb-1">50%</p>
                    <p className="text-sm text-gray-600">
                      of Grade 5 students in India cannot read a Grade 2 level text
                    </p>
                    <p className="text-xs text-gray-400 mt-1">— ASER 2023 Report</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signs List */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#7b008b] uppercase tracking-wider mb-4">
                Signs you might notice
              </p>
              
              {[
                'Reads slowly, word by word',
                'Guesses words instead of reading them',
                'Understands when YOU read, struggles when THEY read',
                'Avoids reading aloud',
                'Says "I hate reading"',
              ].map((text, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-[#ff0099]/30 hover:shadow-md transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-[#ff0099] flex-shrink-0" />
                  <p className="text-gray-700 font-medium">{text}</p>
                </div>
              ))}

              <div className="pt-4">
                <p className="text-gray-600 text-center md:text-left mb-4">
                  These are <strong className="text-gray-900">symptoms</strong>. 
                  The cause is usually a gap in phonemic awareness.
                </p>
                <p className="text-[#00abff] font-semibold text-center md:text-left">
                  Good news: Once identified, these gaps can be filled in weeks, not years.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== THE YESTORYD ARC™ ==================== */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-[#ff0099]" />
              <span className="text-sm font-bold text-[#7b008b]">THE YESTORYD ARC™</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Your Child's <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">90-Day Transformation</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A clear path from struggling reader to confident communicator
            </p>
          </div>

          {/* ARC Visual - Mobile */}
          <div className="lg:hidden mb-12">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00ABFF] via-[#FF0099] to-[#7B008B] rounded-full"></div>
              
              {/* A - Assess */}
              <div className="relative pl-20 pb-12">
                <div className="absolute left-4 w-9 h-9 bg-[#00ABFF] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#00ABFF]/30">
                  A
                </div>
                <div className="bg-[#00ABFF]/5 border border-[#00ABFF]/20 rounded-2xl p-5">
                  <p className="text-xs font-bold text-[#00ABFF] uppercase tracking-wider mb-1">Week 1-4</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Assess</h3>
                  <p className="text-sm text-gray-600 mb-3">AI finds exact gaps in phonics, fluency & comprehension</p>
                  <div className="flex items-center gap-2 text-xs text-[#00ABFF]">
                    <Brain className="w-4 h-4" />
                    <span className="font-semibold">Foundation Arc</span>
                  </div>
                </div>
              </div>

              {/* R - Remediate */}
              <div className="relative pl-20 pb-12">
                <div className="absolute left-4 w-9 h-9 bg-[#FF0099] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#FF0099]/30">
                  R
                </div>
                <div className="bg-[#FF0099]/5 border border-[#FF0099]/20 rounded-2xl p-5">
                  <p className="text-xs font-bold text-[#FF0099] uppercase tracking-wider mb-1">Week 5-8</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Remediate</h3>
                  <p className="text-sm text-gray-600 mb-3">Coach fills gaps with personalized 1:1 sessions</p>
                  <div className="flex items-center gap-2 text-xs text-[#FF0099]">
                    <Heart className="w-4 h-4" />
                    <span className="font-semibold">Building Arc</span>
                  </div>
                </div>
              </div>

              {/* C - Celebrate */}
              <div className="relative pl-20">
                <div className="absolute left-4 w-9 h-9 bg-[#7B008B] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#7B008B]/30">
                  C
                </div>
                <div className="bg-[#7B008B]/5 border border-[#7B008B]/20 rounded-2xl p-5">
                  <p className="text-xs font-bold text-[#7B008B] uppercase tracking-wider mb-1">Week 9-12</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Celebrate</h3>
                  <p className="text-sm text-gray-600 mb-3">Child reads confidently with measurable improvement</p>
                  <div className="flex items-center gap-2 text-xs text-[#7B008B]">
                    <Award className="w-4 h-4" />
                    <span className="font-semibold">Confidence Arc</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ARC Visual - Desktop */}
          <div className="hidden lg:block mb-16">
            <div className="relative">
              {/* The Arc Curve Background */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 800 200" className="w-full max-w-4xl h-auto opacity-10">
                  <path
                    d="M 50 150 Q 400 -50 750 150"
                    fill="none"
                    stroke="url(#arcGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00ABFF" />
                      <stop offset="50%" stopColor="#FF0099" />
                      <stop offset="100%" stopColor="#7B008B" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* ARC Cards */}
              <div className="grid grid-cols-3 gap-8 relative z-10">
                {/* A - Assess */}
                <div className="group">
                  <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-[#00ABFF]/20 hover:border-[#00ABFF] hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-[#00ABFF] to-[#0090d9] rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-[#00ABFF]/30 group-hover:scale-110 transition-transform">
                      A
                    </div>
                    
                    <div className="pt-6">
                      <p className="text-xs font-bold text-[#00ABFF] uppercase tracking-wider mb-1 text-center">Week 1-4</p>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 text-center">Assess</h3>
                      <p className="text-sm text-[#00ABFF] font-semibold mb-4 text-center">Foundation Arc</p>
                      
                      <div className="w-14 h-14 bg-[#00ABFF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-7 h-7 text-[#00ABFF]" />
                      </div>
                      
                      <p className="text-gray-600 text-center mb-6">
                        AI listens to your child read and identifies <strong className="text-gray-900">exact gaps</strong> in 40+ sound patterns.
                      </p>
                      
                      <ul className="space-y-2 text-sm text-gray-500">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#00ABFF] flex-shrink-0" />
                          5-minute AI assessment
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#00ABFF] flex-shrink-0" />
                          Detailed gap report
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#00ABFF] flex-shrink-0" />
                          Personalized learning path
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* R - Remediate */}
                <div className="group -mt-4">
                  <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-[#FF0099]/30 hover:border-[#FF0099] hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-[#FF0099] to-[#d10080] rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-[#FF0099]/30 group-hover:scale-110 transition-transform">
                      R
                    </div>
                    
                    <div className="pt-8">
                      <p className="text-xs font-bold text-[#FF0099] uppercase tracking-wider mb-1 text-center">Week 5-8</p>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 text-center">Remediate</h3>
                      <p className="text-sm text-[#FF0099] font-semibold mb-4 text-center">Building Arc</p>
                      
                      <div className="w-14 h-14 bg-[#FF0099]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Heart className="w-7 h-7 text-[#FF0099]" />
                      </div>
                      
                      <p className="text-gray-600 text-center mb-6">
                        Expert coaches fill gaps with <strong className="text-gray-900">personalized 1:1 sessions</strong> using Jolly Phonics.
                      </p>
                      
                      <ul className="space-y-2 text-sm text-gray-500">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
                          6 coaching sessions (1:1)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
                          Practice activities at home
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
                          Weekly WhatsApp updates
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* C - Celebrate */}
                <div className="group">
                  <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-[#7B008B]/20 hover:border-[#7B008B] hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-[#7B008B] to-[#5a0066] rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-[#7B008B]/30 group-hover:scale-110 transition-transform">
                      C
                    </div>
                    
                    <div className="pt-6">
                      <p className="text-xs font-bold text-[#7B008B] uppercase tracking-wider mb-1 text-center">Week 9-12</p>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 text-center">Celebrate</h3>
                      <p className="text-sm text-[#7B008B] font-semibold mb-4 text-center">Confidence Arc</p>
                      
                      <div className="w-14 h-14 bg-[#7B008B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Award className="w-7 h-7 text-[#7B008B]" />
                      </div>
                      
                      <p className="text-gray-600 text-center mb-6">
                        Your child reads with <strong className="text-gray-900">confidence</strong>. Measurable improvement you can see.
                      </p>
                      
                      <ul className="space-y-2 text-sm text-gray-500">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#7B008B] flex-shrink-0" />
                          Before/after comparison
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#7B008B] flex-shrink-0" />
                          Progress certificate
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#7B008B] flex-shrink-0" />
                          Continuation roadmap
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Promise */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 sm:p-8 lg:p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff0099]/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00ABFF]/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
                <div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4">
                    The <span className="text-[#ffde00]">90-Day Promise</span>
                  </h3>
                  <p className="text-gray-300 text-base sm:text-lg mb-6">
                    In 90 days, your child reads more fluently. This becomes the foundation for grammar, comprehension, writing, and confident English communication.
                  </p>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#00ABFF]/20 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00ABFF]" />
                      </div>
                      <span>Measurable Growth</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#FF0099]/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF0099]" />
                      </div>
                      <span>100% Refund Guarantee</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#7B008B]/20 rounded-lg flex items-center justify-center">
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7B008B]" />
                      </div>
                      <span>Full Transparency</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 lg:justify-end">
                  <Link
                    href="/assessment"
                    onClick={handleCTAClick}
                    className="inline-flex items-center justify-center gap-2 bg-[#ff0099] hover:bg-[#e6008a] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-sm sm:text-lg transition-all hover:scale-105 shadow-xl shadow-[#ff0099]/30 whitespace-nowrap"
                  >
                    See Why — Free
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#00ABFF]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Mic className="w-6 h-6 text-[#00ABFF]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">5 min</p>
              <p className="text-sm text-gray-500">Assessment Time</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#FF0099]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-[#FF0099]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">1:1</p>
              <p className="text-sm text-gray-500">Personal Coaching</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#7B008B]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-[#7B008B]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">90 days</p>
              <p className="text-sm text-gray-500">Transformation</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#ffde00]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-[#e6b800]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.happyParents}</p>
              <p className="text-sm text-gray-500">Parent Satisfaction</p>
            </div>
          </div>

        </div>
      </section>

      {/* ==================== RUCHA'S STORY ==================== */}
      <section id="rucha-story" className="py-16 lg:py-24 bg-[#1a1a2e] text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#ff0099] blur-[100px] opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#00abff] blur-[100px] opacity-20"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Video Side - Using Facade for Performance */}
            <div className="order-2 lg:order-1">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
                <VideoFacade videoUrl={storyVideoUrl} />
              </div>
            </div>

            {/* Story Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-block bg-[#ff0099] text-white text-xs font-bold px-3 py-1 rounded-full mb-6">
                THE YESTORYD STORY
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
                "I realized that <span className="text-[#ffde00]">love for stories</span> wasn't enough. Kids needed the <span className="text-[#00abff]">science of reading</span>."
              </h2>

              <div className="space-y-5 text-gray-300 leading-relaxed">
                <p>
                  Yestoryd started simply — I wanted to share the joy of storytelling with kids. 
                  But in my classes, I noticed a pattern. Kids loved the stories, but many couldn't 
                  <em> read</em> them.
                </p>
                <p>
                  They struggled with sounds, blending, and word composition. I realized that 
                  <strong className="text-white"> reading is not natural — it's an acquired skill</strong>.
                </p>
                <p>
                  I spent 7 years mastering <strong className="text-white">Jolly Phonics</strong> and 
                  <strong className="text-white"> Jolly Grammar</strong>. Now, with AI technology, we can 
                  diagnose reading gaps instantly — so coaches can focus purely on the child.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                  <GraduationCap className="w-4 h-4 text-[#00abff]" />
                  Jolly Phonics Certified
                </span>
                <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                  <Award className="w-4 h-4 text-[#ffde00]" />
                  7 Years Experience
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== THE TECH SECTION ==================== */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#00abff] uppercase tracking-wider mb-4">
              Meet rAI
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why <span className="text-[#00ABFF]">rAI</span> is <span className="text-[#ff0099]">Different</span> (and Safer)
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              rAI = <strong>Reading Intelligence</strong> — our AI that never guesses
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {/* Generic AI Card */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 relative">
              <div className="absolute -top-3 left-6 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                ❌ Generic AI
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">ChatGPT, etc.</p>
                    <p className="text-sm text-gray-500">General Purpose AI</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-600 text-base leading-relaxed">
                    <span className="font-semibold text-gray-700">Guesses</span> based on the internet. 
                    No reading expertise. No understanding of phonics rules. 
                    May give incorrect or generic advice.
                  </p>
                </div>
              </div>
            </div>

            {/* Yestoryd Safe AI Card */}
            <div className="bg-gradient-to-br from-[#00abff]/5 to-[#ff0099]/5 rounded-2xl p-6 border-2 border-[#00abff] relative">
              <div className="absolute -top-3 left-6 bg-[#00abff] text-white px-3 py-1 rounded-full text-xs font-bold">
                ✓ Safe, Expert-Verified AI
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#00abff]/10 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-[#00abff]" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">rAI Knowledge Engine</p>
                    <p className="text-sm text-[#00abff]">Expert-Verified AI</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-[#00abff]/20">
                  <p className="text-gray-600 text-base leading-relaxed">
                    <span className="font-semibold text-[#00abff]">Consults our Expert Knowledge Base first.</span>{' '}
                    Built on 7+ years of Rucha's phonics expertise. 
                    Never guesses — always references proven methods.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Process Flow */}
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
              The Process
            </p>
            {/* Desktop: Horizontal */}
            <div className="hidden sm:flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-8">
              <div className="bg-[#ff0099]/10 text-[#ff0099] px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap">
                Child Error
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
              <div className="bg-[#00abff]/10 text-[#00abff] px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap">
                Check Expert DB
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap">
                Perfect Fix ✓
              </div>
            </div>
            {/* Mobile: Compact horizontal with smaller text */}
            <div className="flex sm:hidden items-center justify-center gap-1.5 mb-8 px-2">
              <div className="bg-[#ff0099]/10 text-[#ff0099] px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">
                Child Error
              </div>
              <span className="text-gray-300 text-xs">→</span>
              <div className="bg-[#00abff]/10 text-[#00abff] px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">
                Expert DB
              </div>
              <span className="text-gray-300 text-xs">→</span>
              <div className="bg-green-100 text-green-700 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">
                Fix ✓
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[#ff0099]" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    <strong className="text-gray-900">Most AI makes things up.</strong> We couldn't risk that with your child's education.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    Imagine <strong className="text-[#00abff]">rAI</strong> as a <strong className="text-[#00abff]">librarian with a manual written by Rucha</strong>. 
                    Built on <strong className="text-[#ff0099]">7+ years of phonics expertise</strong>.
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    When your child makes a mistake, <strong className="text-[#00abff]">rAI</strong> doesn't guess. It looks up the 
                    <strong className="text-gray-900"> exact page in our "Expert Manual"</strong> and tells the coach 
                    precisely which Phonics rule to practice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              Real Results
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Parents See the Difference
            </h2>
            <p className="text-lg text-gray-600">
              <span className="text-[#00abff] font-bold">87%</span> of parents finally understood WHY their child struggled
            </p>
          </div>

          {/* Testimonial Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayTestimonials.slice(0, 4).map((testimonial, index) => {
              // Extract scores from testimonial text for display
              const scoreMatches = [
                { before: '4/10', after: '8/10' },
                { before: '—', after: '2x fluency' },
                { before: '5', after: '9', label: 'Clarity' },
                { before: '15 WPM', after: '40 WPM' },
              ];
              const score = scoreMatches[index] || null;
              
              return (
                <div
                  key={testimonial.id || index}
                  className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all ${
                    activeTestimonial === index
                      ? 'border-[#ff0099] shadow-[#ff0099]/10'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {/* Score Badge */}
                  {score && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-1">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 text-[#ffde00] fill-[#ffde00]" />
                        ))}
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                        {score.before} → {score.after}
                      </span>
                    </div>
                  )}

                  {/* Quote */}
                  <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                    "{testimonial.testimonial_text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {testimonial.parent_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{testimonial.parent_name}</p>
                      <p className="text-xs text-gray-500">
                        {testimonial.parent_location && `${testimonial.parent_location} • `}
                        Parent of {testimonial.child_name}, {testimonial.child_age}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust Stats - Updated */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#ff0099]">{stats.totalAssessments}</p>
              <p className="text-sm text-gray-500">Assessments Done</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#00abff]">87%</p>
              <p className="text-sm text-gray-500">Found the Real Issue</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#7b008b]">2x</p>
              <p className="text-sm text-gray-500">Avg. Improvement</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== THE JOURNEY: READING TO ENGLISH CONFIDENCE ==================== */}
      <section className="py-16 lg:py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#7b008b] uppercase tracking-wider mb-4">
              The Complete Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              From Reading Mastery to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                English Confidence
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Reading is the foundation. Everything else builds on top.
            </p>
          </div>

          {/* Journey Flow - Desktop */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Connection Line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#00ABFF] via-[#FF0099] to-[#7B008B] -translate-y-1/2 rounded-full"></div>
              
              {/* Journey Steps */}
              <div className="grid grid-cols-6 gap-4 relative z-10">
                {[
                  { stage: 'INTEREST', skill: 'Generate love for reading', icon: Heart, color: '#00ABFF' },
                  { stage: 'READ', skill: 'Phonics mastery', icon: BookOpen, color: '#0090d9' },
                  { stage: 'UNDERSTAND', skill: 'Grammar rules', icon: Brain, color: '#9333ea' },
                  { stage: 'COMPREHEND', skill: 'Reading comprehension', icon: Lightbulb, color: '#FF0099' },
                  { stage: 'EXPRESS', skill: 'Writing skills', icon: MessageCircle, color: '#d10080' },
                  { stage: 'CONFIDENCE', skill: 'English fluency', icon: Award, color: '#7B008B' },
                ].map((step, index) => (
                  <div key={step.stage} className="flex flex-col items-center">
                    {/* Icon Circle */}
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 bg-white border-4"
                      style={{ borderColor: step.color }}
                    >
                      <step.icon className="w-7 h-7" style={{ color: step.color }} />
                    </div>
                    
                    {/* Stage Name */}
                    <p className="font-bold text-gray-900 text-sm mb-1">{step.stage}</p>
                    
                    {/* Arrow */}
                    <div className="text-gray-300 my-2">↓</div>
                    
                    {/* Skill Description */}
                    <p className="text-xs text-gray-500 text-center leading-tight">{step.skill}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Journey Flow - Mobile */}
          <div className="lg:hidden">
            <div className="space-y-4">
              {[
                { stage: 'INTEREST', skill: 'Generate love for reading', icon: Heart, color: '#00ABFF' },
                { stage: 'READ', skill: 'Phonics mastery', icon: BookOpen, color: '#0090d9' },
                { stage: 'UNDERSTAND', skill: 'Grammar rules', icon: Brain, color: '#9333ea' },
                { stage: 'COMPREHEND', skill: 'Reading comprehension', icon: Lightbulb, color: '#FF0099' },
                { stage: 'EXPRESS', skill: 'Writing skills', icon: MessageCircle, color: '#d10080' },
                { stage: 'CONFIDENCE', skill: 'English fluency', icon: Award, color: '#7B008B' },
              ].map((step, index) => (
                <div key={step.stage} className="flex items-center gap-4">
                  {/* Icon */}
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-white border-2 shadow-md"
                    style={{ borderColor: step.color }}
                  >
                    <step.icon className="w-5 h-5" style={{ color: step.color }} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-grow">
                    <p className="font-bold text-gray-900 text-sm">{step.stage}</p>
                    <p className="text-xs text-gray-500">{step.skill}</p>
                  </div>
                  
                  {/* Arrow (except last) */}
                  {index < 5 && (
                    <div className="text-gray-300 text-xl">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Key Insight */}
          <div className="mt-12 bg-gradient-to-r from-[#00ABFF]/5 via-[#FF0099]/5 to-[#7B008B]/5 rounded-3xl p-8 border border-gray-100">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-gray-700 mb-4">
                <strong className="text-gray-900">In 90 days, your child masters reading fluency.</strong>
              </p>
              <p className="text-gray-600">
                This becomes the foundation for grammar, comprehension, writing, and eventually — 
                confident English communication. The journey starts with the first step: 
                <strong className="text-[#ff0099]"> understanding exactly where they are today.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="pricing" className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              Start Your ARC Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start free. See your child's reading profile. Choose the program that fits your family.
            </p>
          </div>

          {/* Free Assessment Card */}
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-200">
              <div className="mb-6">
                <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Step 1 — Start Here
                </span>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free AI Assessment</h3>
                <p className="text-gray-600">See rAI in action — understand your child's reading level</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹0</span>
                <span className="text-gray-500 ml-2">forever free</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'rAI analyzes reading in real-time',
                  'Clarity, Fluency & Speed scores',
                  'Personalized improvement tips',
                  { text: 'Detailed Diagnosis Report', highlight: '(Worth ₹999)' },
                  'Instant shareable certificate',
                  'No credit card required',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {typeof item === 'string' ? item : (
                      <span>
                        {item.text} <span className="text-[#ff0099] font-semibold">{item.highlight}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <Link
                href="/assessment"
                onClick={handleCTAClick}
                className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-semibold transition-colors"
              >
                See Why — 5 Min Test
              </Link>
            </div>
          </div>

          {/* Step 2 Label */}
          <div className="text-center mb-6">
            <span className="inline-block bg-[#ff0099]/10 text-[#ff0099] px-4 py-2 rounded-full text-sm font-semibold">
              Step 2 — Choose Your Program
            </span>
          </div>

          {/* Pricing Cards - 3 columns on desktop, stack on mobile */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {products.length > 0 ? products.map((product) => {
              const isFullProgram = product.slug === 'full';
              const isContinuation = product.slug === 'continuation';
              const savings = product.originalPrice - product.discountedPrice;

              return (
                <div
                  key={product.id}
                  className={`rounded-3xl p-6 relative overflow-hidden transition-all ${
                    isFullProgram
                      ? 'bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white ring-4 ring-[#ff0099]/30 scale-[1.02]'
                      : 'bg-white border-2 border-gray-200'
                  }`}
                >
                  {/* Badge */}
                  {isFullProgram && (
                    <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-bl-xl text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Best Value
                    </div>
                  )}
                  {isContinuation && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1.5 rounded-bl-xl text-xs font-bold">
                      After Starter
                    </div>
                  )}

                  {/* Product Name */}
                  <div className="mb-4 mt-2">
                    <h3 className={`text-xl font-bold mb-1 ${isFullProgram ? 'text-white' : 'text-gray-900'}`}>
                      {product.name}
                    </h3>
                    <p className={`text-sm ${isFullProgram ? 'text-white/80' : 'text-gray-500'}`}>
                      {product.description || `${product.durationMonths} month${product.durationMonths > 1 ? 's' : ''} program`}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className={`text-3xl font-bold ${isFullProgram ? 'text-white' : 'text-gray-900'}`}>
                      ₹{product.discountedPrice.toLocaleString('en-IN')}
                    </span>
                    {savings > 0 && (
                      <span className={`ml-2 line-through text-sm ${isFullProgram ? 'text-white/50' : 'text-gray-400'}`}>
                        ₹{product.originalPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                    {isFullProgram && savings > 0 && (
                      <p className="text-yellow-300 text-sm font-semibold mt-1">
                        Save ₹{savings.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  {/* Sessions Breakdown */}
                  <div className={`rounded-xl p-3 mb-4 ${isFullProgram ? 'bg-white/10' : 'bg-gray-50'}`}>
                    <p className={`text-sm font-semibold mb-2 ${isFullProgram ? 'text-white' : 'text-gray-700'}`}>
                      {product.sessionsIncluded} sessions included:
                    </p>
                    <ul className={`text-xs space-y-1 ${isFullProgram ? 'text-white/80' : 'text-gray-600'}`}>
                      {product.coachingSessions > 0 && (
                        <li>• {product.coachingSessions} Coaching sessions (45 min)</li>
                      )}
                      {product.skillBuildingSessions > 0 && (
                        <li>• {product.skillBuildingSessions} Skill Building sessions (45 min)</li>
                      )}
                      {product.checkinSessions > 0 && (
                        <li>• {product.checkinSessions} Parent Check-ins (30 min)</li>
                      )}
                    </ul>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6">
                    {(product.features.length > 0 ? product.features : [
                      'Everything in Free Assessment',
                      'Expert 1:1 coaching',
                      'WhatsApp support',
                      'Progress tracking',
                    ]).slice(0, 4).map((feature, idx) => (
                      <li key={idx} className={`flex items-center gap-2 text-sm ${isFullProgram ? 'text-white/90' : 'text-gray-600'}`}>
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isFullProgram ? 'text-yellow-300' : 'text-green-500'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link
                    href={`/enroll?product=${product.slug}`}
                    className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                      isFullProgram
                        ? 'bg-white text-[#ff0099] hover:bg-gray-100'
                        : isContinuation
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-[#ff0099] text-white hover:bg-[#e6008a]'
                    }`}
                  >
                    {isContinuation ? 'Continue Journey' : 'Enroll Now'}
                  </Link>

                  {isContinuation && (
                    <p className={`text-center text-xs mt-2 ${isFullProgram ? 'text-white/60' : 'text-gray-400'}`}>
                      Requires completed Starter Pack
                    </p>
                  )}
                </div>
              );
            }) : (
              // Fallback if no products loaded
              <div className="md:col-span-3 text-center py-8 text-gray-500">
                <p>Programs loading...</p>
              </div>
            )}
          </div>

          <p className="text-center text-gray-500 text-sm mt-8 flex items-center justify-center gap-1.5">
            <Shield className="w-4 h-4 text-green-500" />
            100% satisfaction guarantee on all programs. Flexible scheduling included.
          </p>
        </div>
      </section>

      {/* ==================== FAQ SECTION ==================== */}
      <FAQSection whatsappNumber={whatsappNumber} />

      {/* ==================== FINAL CTA ==================== */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-[#e6008a] to-[#7b008b] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Reading Gaps Widen Every Month.
            <br />
            <span className="text-[#ffde00]">Find Yours in 5 Minutes.</span>
          </h2>

          <p className="text-lg sm:text-xl text-white/80 mb-4 max-w-2xl mx-auto">
            <span className="text-white font-bold">87% of parents</span> finally understood WHY their child struggled — after just one 5-minute assessment.
          </p>
          
          <p className="text-base text-white/60 mb-10 max-w-xl mx-auto">
            Free. No card required. Instant results.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/assessment"
              onClick={handleCTAClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#e6008a] px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
            >
              See Why — 5 Minutes
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25d366] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Us
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-white/60 text-sm">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              100% Free
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              5 Minutes Only
            </span>
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Instant Results
            </span>
          </div>
          
          {/* Urgency note */}
          <p className="mt-8 text-xs text-white/50">
            Early identification leads to faster improvement. Don't wait for report cards.
          </p>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-[#111111] text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Image src="/images/logo.png" alt="Yestoryd" width={120} height={36} className="h-8 w-auto mb-4 opacity-90" />
              <p className="text-gray-500 text-sm max-w-sm mb-4">
                AI-powered reading assessment and expert coaching for children aged 4-12. 
                The Yestoryd ARC™ — Assess, Remediate, Celebrate.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <GraduationCap className="w-4 h-4 text-[#00abff]" />
                Jolly Phonics & Grammar Certified
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/assessment" className="hover:text-[#ff0099] transition-colors">Free 5-Min Test</Link></li>
                <li><a href="#how-it-works" className="hover:text-[#ff0099] transition-colors">The ARC Method</a></li>
                <li><a href="#pricing" className="hover:text-[#ff0099] transition-colors">Pricing</a></li>
                <li><Link href="/lets-talk" className="hover:text-[#ff0099] transition-colors">Talk to Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Access</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/parent/login" className="hover:text-[#ff0099] transition-colors">Parent Login</Link></li>
                <li><Link href="/coach/login" className="hover:text-[#ff0099] transition-colors">Coach Login</Link></li>
                <li><Link href="/yestoryd-academy" className="hover:text-[#ff0099] transition-colors">Become a Coach</Link></li>
              </ul>
              <h4 className="font-bold text-sm mb-4 mt-6 text-gray-300">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/privacy" className="hover:text-[#ff0099] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-[#ff0099] transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} Yestoryd. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> for young readers in India
            </p>
          </div>
        </div>
      </footer>

      {/* ==================== FLOATING WHATSAPP ==================== */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 bg-[#25d366] p-3 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-2 group"
      >
        <Image src="/images/rai-mascot.png" alt="Chat" width={40} height={40} className="w-8 h-8 rounded-full" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-white font-bold whitespace-nowrap text-sm">
          Chat with Us
        </span>
      </a>

      {/* ==================== STICKY MOBILE CTA (Shows after hero) ==================== */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:hidden z-30 transition-transform duration-300 ${
        showStickyMobileCTA ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <Link
          href="/assessment"
          onClick={handleCTAClick}
          className="block w-full text-center bg-[#FF0099] text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:bg-[#e6008a]"
        >
          See Why — Free 5 Min Test
        </Link>
      </div>
    </div>
  );
}