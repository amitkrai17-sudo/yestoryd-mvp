'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  BookOpen,
  Users,
  TrendingUp,
  ChevronRight,
  Play,
  Star,
  MessageCircle,
  Menu,
  X,
  Brain,
  Heart,
  Target,
  Award,
  CheckCircle,
  ArrowRight,
  Zap,
  Clock,
  Shield,
  Phone,
  LogIn,
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

interface ContactData {
  whatsappNumber: string;
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

interface HomePageClientProps {
  stats: StatsData;
  pricing: PricingData;
  contact: ContactData;
  testimonials: TestimonialData[];
  showTestimonials: boolean;
}

export default function HomePageClient({
  stats,
  pricing,
  contact,
  testimonials,
  showTestimonials,
}: HomePageClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // DYNAMIC WhatsApp - from props
  const whatsappNumber = contact.whatsappNumber;
  const whatsappMessage = encodeURIComponent("Hi! I'm interested in Yestoryd's reading program for my child.");

  // Track scroll for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#FFFFFF] shadow-lg' : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo - New colorful text logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Yestoryd"
                width={140}
                height={40}
                className="h-8 lg:h-10 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-5">
              <a
                href="#programs"
                className="text-gray-700 hover:text-[#ff0099] transition-colors font-medium"
              >
                Programs
              </a>
              <a
                href="#how-it-works"
                className="text-gray-700 hover:text-[#ff0099] transition-colors font-medium"
              >
                How It Works
              </a>
              {/* Uniform height buttons - all h-10 with consistent padding */}
              <Link
                href="/parent/login"
                className="h-10 inline-flex items-center justify-center gap-2 bg-[#00abff] text-white px-5 rounded-full font-semibold hover:bg-[#0095e6] hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                <LogIn className="w-4 h-4" />
                Parent Login
              </Link>
              <Link
                href="/coach/login"
                className="h-10 inline-flex items-center justify-center gap-2 bg-[#7b008b] text-white px-5 rounded-full font-semibold hover:bg-[#6a0078] hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                <LogIn className="w-4 h-4" />
                Coach Login
              </Link>
              <Link
                href="/assessment"
                className="h-10 inline-flex items-center justify-center gap-2 bg-[#ff0099] text-white px-5 rounded-full font-bold hover:bg-[#e6008a] hover:scale-105 hover:shadow-lg hover:shadow-[#ff0099]/30 transition-all duration-200"
              >
                <Zap className="w-4 h-4" />
                Free Assessment
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFFFF] border-t border-gray-100 shadow-xl">
            <div className="px-4 py-6 space-y-3">
              <a
                href="#programs"
                className="block text-gray-800 font-semibold py-2 hover:text-[#ff0099]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Programs
              </a>
              <a
                href="#how-it-works"
                className="block text-gray-800 font-semibold py-2 hover:text-[#ff0099]"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              {/* Uniform height buttons h-12 */}
              <Link
                href="/parent/login"
                className="h-12 flex items-center justify-center gap-2 bg-[#00abff] text-white rounded-full font-bold hover:scale-105 transition-all duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="w-4 h-4" />
                Parent Login
              </Link>
              <Link
                href="/coach/login"
                className="h-12 flex items-center justify-center gap-2 bg-[#7b008b] text-white rounded-full font-bold hover:scale-105 transition-all duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="w-4 h-4" />
                Coach Login
              </Link>
              <Link
                href="/assessment"
                className="h-12 flex items-center justify-center gap-2 bg-[#ff0099] text-white rounded-full font-bold hover:scale-105 transition-all duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Zap className="w-4 h-4" />
                Take Free Assessment
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-20 lg:pt-24 bg-gradient-to-b from-[#f5f5f5] to-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              {/* Urgency Badge - DYNAMIC */}
              <div className="inline-flex items-center gap-2 bg-[#ffde00] text-gray-900 px-4 py-2 rounded-full text-sm font-bold mb-6 animate-pulse">
                <Zap className="w-4 h-4 flex-shrink-0" />
                <span className="text-center">Limited Time:<br className="sm:hidden" /> FREE AI Assessment Worth ₹{pricing.freeAssessmentWorth}</span>
              </div>

              {/* Vedant AI Introduction */}
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-4">
                <Image
                  src="/images/vedant-mascot.png"
                  alt="Vedant AI"
                  width={48}
                  height={48}
                  className="w-12 h-12"
                />
                <div className="text-left">
                  <p className="text-sm text-gray-500">Meet</p>
                  <p className="font-bold text-[#7b008b]">Vedant AI <span className="text-xs bg-[#7b008b]/10 px-2 py-0.5 rounded-full">Your Reading Coach</span></p>
                </div>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
                Your Child Can Read{' '}
                <span className="relative inline-block">
                  <span className="text-[#ff0099]">3X Better</span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                    <path d="M2 10C50 4 150 4 198 10" stroke="#ff0099" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
                {' '}in 90 Days
              </h1>

              {/* Subheadline with Pain Points */}
              <p className="text-xl text-gray-600 mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Is your child <span className="text-[#7b008b] font-semibold">struggling with reading?</span> Our AI-powered assessment identifies exactly where they need help — in just 5 minutes.
              </p>

              {/* Social Proof - DYNAMIC */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-8">
                <div className="flex items-center gap-1 bg-white px-4 py-2 rounded-full shadow-md">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-[#ffde00] text-[#ffde00]" />
                  ))}
                  <span className="ml-2 font-bold text-gray-900">4.9/5</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span className="font-semibold text-gray-700">{stats.happyParents} Kids Transformed</span>
                </div>
              </div>

              {/* CTA Buttons - Uniform height h-14, full width on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch gap-4 justify-center lg:justify-start mb-8">
                <Link
                  href="/assessment"
                  className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#ff0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 hover:shadow-2xl hover:shadow-[#ff0099]/40 transition-all duration-200 text-base shadow-xl shadow-[#ff0099]/30"
                >
                  <Zap className="w-5 h-5" />
                  <span>Take Free Assessment</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/lets-talk"
                  className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#7b008b] text-white font-bold px-8 rounded-full hover:bg-[#6a0078] hover:scale-105 hover:shadow-lg transition-all duration-200 text-base"
                >
                  <Phone className="w-5 h-5" />
                  <span>Talk to Expert</span>
                </Link>
              </div>

              {/* Trust Signals */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center lg:justify-start text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-5 h-5 text-[#00abff]" />
                  <span>100% Safe & Private</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5 text-[#00abff]" />
                  <span>Results in 5 mins</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Award className="w-5 h-5 text-[#00abff]" />
                  <span>Free Certificate</span>
                </div>
              </div>
            </div>

            {/* Right - Vedant AI Assessment Card */}
            <div className="relative">
              {/* Testimonial - Positioned above the card */}
              <div className="hidden lg:block absolute -top-16 -left-4 bg-white rounded-2xl shadow-xl p-4 max-w-[220px] border-l-4 border-[#ff0099] z-20">
                <p className="text-gray-600 text-sm italic">"My son improved 2 grade levels in 3 months!"</p>
                <p className="text-[#ff0099] font-bold text-sm mt-2">— Priya M.</p>
              </div>

              <div className="relative z-10">
                {/* Main Assessment Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-6 lg:p-8 border-4 border-[#00abff]/20">
                  {/* Vedant AI Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center overflow-hidden">
                        <Image
                          src="/images/vedant-mascot.png"
                          alt="Vedant AI"
                          width={48}
                          height={48}
                          className="w-12 h-12 object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">Vedant AI</h3>
                        <p className="text-gray-500 text-sm">Your Reading Coach</p>
                      </div>
                    </div>
                    <div className="bg-[#ffde00] text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                      LIVE
                    </div>
                  </div>

                  {/* Score Circle - Without /10 */}
                  <div className="flex justify-center mb-6">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="#f3f4f6" strokeWidth="12" fill="none" />
                        <circle
                          cx="80" cy="80" r="70"
                          stroke="url(#gradient)"
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray="440"
                          strokeDashoffset="88"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ff0099" />
                            <stop offset="100%" stopColor="#00abff" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-6xl font-black text-gray-900">8.5</span>
                        <span className="text-gray-500 text-sm font-medium">Reading Score</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bars - Clarity, Fluency, Speed */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-700">Clarity</span>
                        <span className="font-bold text-[#ff0099]">85%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-[85%] bg-gradient-to-r from-[#ff0099] to-[#ff0099]/70 rounded-full" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-700">Fluency</span>
                        <span className="font-bold text-[#00abff]">78%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-[78%] bg-gradient-to-r from-[#00abff] to-[#00abff]/70 rounded-full" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-700">Speed</span>
                        <span className="font-bold text-[#7b008b]">92%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-[92%] bg-gradient-to-r from-[#7b008b] to-[#7b008b]/70 rounded-full" />
                      </div>
                    </div>
                  </div>

                  {/* CTA inside card */}
                  <Link
                    href="/assessment"
                    className="mt-6 w-full h-14 inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 hover:scale-105 transition-all duration-200"
                  >
                    Get Your Child's Score FREE
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>

                {/* Floating Badge */}
                <div className="absolute -top-4 -right-4 bg-[#ffde00] text-gray-900 px-4 py-2 rounded-full font-black text-sm shadow-lg animate-bounce">
                  100% FREE!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem-Agitation Section */}
      <section className="py-16 lg:py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Is Your Child Facing These <span className="text-[#ffde00]">Reading Challenges?</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '😰', text: 'Reads slowly and hesitantly' },
              { icon: '😕', text: 'Struggles to understand what they read' },
              { icon: '😤', text: 'Avoids reading altogether' },
              { icon: '😔', text: 'Falls behind classmates' },
            ].map((item, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/20 transition-all">
                <div className="text-5xl mb-4">{item.icon}</div>
                <p className="text-lg font-medium">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-xl text-gray-300 mb-6">
              You're not alone. As per <span className="text-[#ffde00] font-bold">ASER 2023 Report</span>, over 50% of children in Grade 5 cannot read a Grade 2 level text.
            </p>
            <Link
              href="/assessment"
              className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#ff0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 hover:shadow-lg transition-all duration-200 text-base shadow-xl"
            >
              <Zap className="w-5 h-5" />
              Check Your Child's Level
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#00abff]/10 text-[#00abff] px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Sparkles className="w-4 h-4" />
              WHY YESTORYD WORKS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              The Science Behind <span className="text-[#00abff]">3X Faster</span> Reading Growth
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Analysis',
                description: 'Vedant AI listens to your child read and identifies exactly where they struggle',
                color: '#ff0099',
                bgColor: 'bg-[#ff0099]/10',
              },
              {
                icon: Users,
                title: 'Expert 1-on-1 Coaching',
                description: 'Certified reading specialists create personalized improvement plans',
                color: '#00abff',
                bgColor: 'bg-[#00abff]/10',
              },
              {
                icon: Target,
                title: 'Personalized Curriculum',
                description: 'Every lesson is tailored to your child\'s specific needs and pace',
                color: '#7b008b',
                bgColor: 'bg-[#7b008b]/10',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Progress',
                description: 'Track improvement with detailed reports after every session',
                color: '#ffde00',
                bgColor: 'bg-[#ffde00]/20',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-gray-200 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-8 h-8" style={{ color: feature.color }} />
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#7b008b]/10 text-[#7b008b] px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Zap className="w-4 h-4" />
              <span>SIMPLE 3-STEP PROCESS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Start Your Child's <span className="text-[#7b008b]">Reading Transformation</span> Today
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '1',
                title: 'Take Free Assessment',
                description: 'Your child reads for 2-3 minutes while Vedant AI analyzes their reading abilities',
                color: '#ff0099',
                emoji: '📊',
              },
              {
                step: '2',
                title: 'Get Instant Results',
                description: 'Receive detailed report with Clarity, Fluency & Speed scores plus personalized recommendations',
                color: '#00abff',
                emoji: '📋',
              },
              {
                step: '3',
                title: 'Start Improving',
                description: 'Join our coaching program and watch your child become a confident reader',
                color: '#7b008b',
                emoji: '🚀',
              },
            ].map((item, index) => (
              <div key={index} className="relative flex">
                {/* Card with equal height */}
                <div
                  className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-t-4 flex flex-col w-full"
                  style={{ borderTopColor: item.color }}
                >
                  {/* Centered icon and step number */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="text-5xl mb-3">{item.emoji}</div>
                    <div
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.step}
                    </div>
                  </div>
                  {/* Left-aligned title and description */}
                  <h3 className="font-bold text-gray-900 text-xl mb-3 text-left">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-left flex-grow">{item.description}</p>
                </div>

                {/* Arrow between cards */}
                {index < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 lg:-right-5 transform -translate-y-1/2 z-10 items-center justify-center w-8 h-8 bg-white rounded-full shadow-md">
                    <ArrowRight className="w-5 h-5 text-[#ff0099]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12 px-4 sm:px-0">
            <Link
              href="/assessment"
              className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#ff0099] text-white font-bold px-10 rounded-full hover:bg-[#e6008a] hover:scale-105 hover:shadow-2xl hover:shadow-[#ff0099]/40 transition-all duration-200 text-base shadow-xl shadow-[#ff0099]/30"
            >
              <Zap className="w-5 h-5" />
              <span>Take Free Assessment</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-gray-500">Takes only 5 minutes • No credit card required</p>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-16 lg:py-24 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#ffde00]/20 text-gray-900 px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Award className="w-4 h-4" />
              CHOOSE YOUR PROGRAM
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Invest in Your Child's <span className="text-[#ff0099]">Reading Future</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Free Assessment Card */}
            <div className="bg-white rounded-3xl p-8 border-2 border-gray-200 hover:border-[#00abff] hover:shadow-xl transition-all flex flex-col">
              <div className="inline-flex items-center gap-2 bg-[#00abff]/10 text-[#00abff] px-4 py-2 rounded-full text-sm font-bold mb-6 self-start">
                <Sparkles className="w-4 h-4" />
                FREE
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">AI Reading Assessment</h3>
              <p className="text-gray-600 mb-6">
                Get Vedant AI's comprehensive analysis of your child's reading abilities instantly.
              </p>

              <div className="text-4xl font-black text-gray-900 mb-6">
                ₹0 <span className="text-lg font-medium text-gray-400 line-through">₹{pricing.freeAssessmentWorth}</span>
              </div>

              <ul className="space-y-4 flex-grow">
                {['2-minute AI reading test', 'Clarity, Fluency & Speed scores', 'Areas of improvement', 'Personalized tips', 'Instant certificate'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#00abff] flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Button wrapper to match height with right card */}
              <div className="mt-8">
                <Link
                  href="/assessment"
                  className="w-full h-14 inline-flex items-center justify-center gap-2 bg-[#00abff] text-white font-bold rounded-full hover:bg-[#0095e6] hover:scale-105 hover:shadow-lg transition-all duration-200 text-base"
                >
                  <Zap className="w-5 h-5" />
                  Take Free Assessment
                  <ArrowRight className="w-5 h-5" />
                </Link>
                {/* Invisible spacer to match right card's text */}
                <p className="text-center text-transparent text-sm mt-3 select-none">
                  Spacer text
                </p>
              </div>
            </div>

            {/* Coaching Program Card */}
            <div className="bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-3xl p-8 text-white relative overflow-hidden flex flex-col">
              {/* Popular Badge */}
              <div className="absolute top-4 right-4 bg-[#ffde00] text-gray-900 px-4 py-1 rounded-full text-sm font-black">
                ⭐ MOST POPULAR
              </div>

              <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-bold mb-6 self-start">
                <Award className="w-4 h-4" />
                COMPLETE TRANSFORMATION
              </div>
              <h3 className="text-2xl font-black mb-2">3-Month Coaching Program</h3>
              <p className="text-white/80 mb-6">
                The complete reading transformation system with expert coaching.
              </p>

              <div className="mb-6">
                <span className="text-5xl font-black">₹{pricing.discountedPrice.toLocaleString('en-IN')}</span>
                <span className="text-xl font-medium text-white/60 line-through ml-2">₹{pricing.originalPrice.toLocaleString('en-IN')}</span>
                <div className="inline-block bg-[#ffde00] text-gray-900 px-3 py-1 rounded-full text-sm font-bold ml-3">
                  {pricing.discountLabel}
                </div>
              </div>

              <ul className="space-y-4 flex-grow">
                {['6 expert coaching sessions', '3 parent check-ins', 'AI progress tracking', 'Personalized homework', 'WhatsApp support', 'Free e-learning access'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#ffde00] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Button wrapper to match height with left card */}
              <div className="mt-8">
                <Link
                  href="/lets-talk"
                  className="w-full h-14 inline-flex items-center justify-center gap-2 bg-white text-[#ff0099] font-bold rounded-full hover:bg-gray-100 hover:scale-105 hover:shadow-lg transition-all duration-200 text-base"
                >
                  <Phone className="w-5 h-5" />
                  Book Discovery Call
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-center text-white/60 text-sm mt-3">
                  Free consultation with our reading expert
                </p>
                <Link
                  href="/lets-talk"
                  className="block text-center text-white/80 hover:text-white text-sm mt-2 underline underline-offset-2 transition-colors"
                >
                  Not sure yet? Let's just talk →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - DYNAMIC */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-16 lg:py-24 bg-[#f5f5f5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
                Parents <span className="text-[#ff0099]">Love</span> Yestoryd
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-[#ffde00] text-[#ffde00]" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.testimonial_text}"</p>
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.parent_name}</p>
                    <p className="text-gray-500 text-sm">
                      {testimonial.parent_location ? `${testimonial.parent_location} • ` : ''}
                      Parent of {testimonial.child_name}, {testimonial.child_age}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA Section */}
      <section className="py-16 lg:py-24 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Vedant AI CTA */}
          <div className="flex justify-center mb-6">
            <Image
              src="/images/vedant-mascot.png"
              alt="Vedant AI"
              width={80}
              height={80}
              className="w-20 h-20"
            />
          </div>
          <p className="text-[#ffde00] font-bold text-lg mb-2">Vedant AI says:</p>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6">
            Don't Let Your Child <span className="text-[#ffde00]">Fall Behind</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Every day without proper reading support is a day of lost potential. Take the free assessment now and see exactly where your child needs help.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch gap-4 justify-center mb-8 px-4 sm:px-0">
            <Link
              href="/assessment"
              className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#ff0099] text-white font-bold px-10 rounded-full hover:bg-[#e6008a] hover:scale-105 hover:shadow-2xl hover:shadow-[#ff0099]/40 transition-all duration-200 text-base shadow-xl shadow-[#ff0099]/30"
            >
              <Zap className="w-5 h-5" />
              <span>Take Free Assessment</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#25d366] text-white font-bold px-10 rounded-full hover:bg-[#20bd5a] hover:scale-105 hover:shadow-lg transition-all duration-200 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp Us</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#00abff]" />
              <span>100% Free</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#00abff]" />
              <span>5 Minutes Only</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#00abff]" />
              <span>Instant Results</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#00abff]" />
              <span>Free Certificate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 lg:gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/images/logo.png"
                  alt="Yestoryd"
                  width={120}
                  height={36}
                  className="h-8 w-auto"
                />
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                AI-powered reading intelligence transforming how children aged 4-12 learn to read.
                Personalized assessment by Vedant AI and expert coaching for lasting results.
              </p>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25d366] text-white font-bold py-3 px-6 rounded-full hover:bg-[#20bd5a] transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Chat on WhatsApp
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/assessment" className="text-gray-400 hover:text-[#ff0099] transition-colors">
                    Free Assessment
                  </Link>
                </li>
                <li>
                  <a href="#programs" className="text-gray-400 hover:text-[#ff0099] transition-colors">
                    Programs
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-gray-400 hover:text-[#ff0099] transition-colors">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>

            {/* Access */}
            <div>
              <h4 className="font-bold text-lg mb-4">Access</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/parent/login" className="text-gray-400 hover:text-[#00abff] transition-colors">
                    Parent Login
                  </Link>
                </li>
                <li>
                  <Link href="/coach/login" className="text-gray-400 hover:text-[#7b008b] transition-colors">
                    Coach Login
                  </Link>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-[#ff0099] transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Yestoryd. All rights reserved. Made with ❤️ for young readers in India.</p>
          </div>
        </div>
      </footer>

      {/* Floating Vedant AI WhatsApp Button */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 lg:bottom-6 right-6 z-50 bg-[#25d366] p-2 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-2"
        aria-label="Chat on WhatsApp"
      >
        <Image
          src="/images/vedant-mascot.png"
          alt="Chat with Vedant"
          width={40}
          height={40}
          className="w-10 h-10 rounded-full"
        />
        <span className="hidden lg:block text-white font-bold pr-3">Chat Now</span>
      </a>

      {/* Sticky Bottom CTA on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#FFFFFF] border-t border-gray-200 p-3 shadow-2xl">
        <Link
          href="/assessment"
          className="w-full h-12 inline-flex items-center justify-center gap-2 bg-[#ff0099] text-white font-bold rounded-full hover:scale-[1.02] transition-all duration-200"
        >
          <Zap className="w-5 h-5" />
          <span>Take Free Assessment</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Spacer for sticky CTA on mobile */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}