// app/yestoryd-academy/page.tsx
// Yestoryd Academy - Coach Recruitment Landing Page
// Partnership-focused, passion-driven messaging

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Heart, 
  Brain, 
  Users, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Clock,
  Shield,
  Star,
  ChevronDown,
  Play
} from 'lucide-react';

export default function YestorydAcademyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [childCount, setChildCount] = useState(10);

  const [leadSource, setLeadSource] = useState<'yestoryd' | 'coach'>('yestoryd');
  
  const calculateEarnings = (children: number, source: 'yestoryd' | 'coach') => {
    // 3-Component Model:
    // Lead Cost (20%): ₹1,200 - goes to whoever brought lead
    // Coach Cost (50%): ₹3,000 - always to coach
    // Platform Fee (30%): ₹1,799 - always to Yestoryd
    
    if (source === 'coach') {
      // Coach brought the lead: Coach gets Lead Cost + Coach Cost = 70%
      return children * 4200; // ₹1,200 + ₹3,000
    } else {
      // Yestoryd brought the lead: Coach gets only Coach Cost = 50%
      return children * 3000; // ₹3,000
    }
  };

  const tiers = [
    {
      name: 'Rising Coach',
      icon: '🌱',
      criteria: 'New coaches, first 3 months',
      benefits: 'Full training, mentorship support',
      color: 'from-green-400 to-emerald-500'
    },
    {
      name: 'Expert Coach',
      icon: '⭐',
      criteria: '30+ children coached, strong NPS',
      benefits: 'Priority assignments, featured profile',
      color: 'from-amber-400 to-orange-500'
    },
    {
      name: 'Master Coach',
      icon: '👑',
      criteria: '75+ children, exceptional results',
      benefits: 'Train new coaches, leadership role',
      color: 'from-purple-400 to-pink-500'
    }
  ];

  // 3-Component Revenue Model
  const revenueModel = {
    leadCost: 20,      // Goes to whoever brought the lead
    coachCost: 50,     // Always goes to coach
    platformFee: 30    // Always retained by Yestoryd
  };

  const journeySteps = [
    {
      step: 1,
      title: 'Share Your Story',
      description: 'Tell us about yourself, your passion for teaching, and upload your credentials.',
      icon: Heart,
      time: '10 minutes'
    },
    {
      step: 2,
      title: 'AI Conversation',
      description: 'Have a thoughtful conversation with Vedant AI about teaching scenarios and child psychology.',
      icon: Brain,
      time: '15 minutes'
    },
    {
      step: 3,
      title: 'Meet Our Team',
      description: 'A friendly conversation with our founders to align on values and answer your questions.',
      icon: Users,
      time: '30 minutes'
    },
    {
      step: 4,
      title: 'Begin Your Journey',
      description: 'Complete orientation, sign the partnership agreement, and receive your first student.',
      icon: Sparkles,
      time: 'Welcome aboard!'
    }
  ];

  const whatWeLookFor = [
    {
      trait: 'Patience That Inspires',
      description: 'You believe every child learns at their own pace. You explain the same concept five different ways until it clicks.',
      icon: Clock
    },
    {
      trait: 'Genuine Empathy',
      description: "A child's emotional wellbeing matters more than completing a lesson plan. You notice when something is off.",
      icon: Heart
    },
    {
      trait: 'Ownership Mindset',
      description: "When a child struggles, you look at your methods first. You're committed to their 3-month journey.",
      icon: Shield
    },
    {
      trait: 'Honest Communication',
      description: "You'd rather be truthful with parents about challenges than oversell progress. Trust is everything.",
      icon: Target
    },
    {
      trait: 'Growth Orientation',
      description: "You're always learning. Feedback makes you better. You celebrate small wins along the way.",
      icon: TrendingUp
    },
    {
      trait: 'Professional Reliability',
      description: 'You honor commitments. When you say you\'ll be there at 5 PM, you\'re there at 4:55 PM.',
      icon: CheckCircle2
    }
  ];

  const faqs = [
    {
      q: 'What qualifications do I need?',
      a: 'We value mindset over certificates. However, if you have phonics training (Jolly Phonics, Cambridge, Montessori), you\'ll go through an accelerated path. Others complete our Yestoryd Academy certification with partner institutes.'
    },
    {
      q: 'How much time do I need to commit?',
      a: 'Minimum 5 children, which translates to about 15-20 hours per month. Each child requires 2 coaching sessions, 1 parent check-in, and occasional remedial support. Most coaches work with 10-15 children.'
    },
    {
      q: 'How does the revenue sharing work?',
      a: 'We use a transparent 3-component model: Lead Cost (20%) goes to whoever brought the student, Coach Cost (50%) always goes to you, and Platform Fee (30%) covers Yestoryd\'s tech and support. If Yestoryd assigns you a student, you earn ₹3,000 (50%). If you bring your own student, you earn ₹4,200 (70%).'
    },
    {
      q: 'How does the partnership work?',
      a: 'You focus on nurturing children. We handle everything else - curriculum, scheduling, payments, parent communication tools, progress tracking. You bring the human touch; we bring the science and technology.'
    },
    {
      q: 'What about training?',
      a: 'Certified coaches complete a 1-2 hour crash course on Yestoryd methodology, child psychology essentials, and conflict management. Non-certified coaches go through our comprehensive academy program with partner institutes.'
    },
    {
      q: 'How do I grow as a coach?',
      a: 'We track your impact through parent feedback, child progress, and session quality. High performers progress from Rising to Expert to Master coach, unlocking priority assignments and mentorship opportunities.'
    },
    {
      q: 'What if I bring students but can\'t coach them?',
      a: 'You still earn! If you refer a student but are at capacity, we assign them to another coach. You get the Lead Cost (₹1,200 / 20%) as a referral bonus, the teaching coach gets Coach Cost (₹3,000 / 50%), and Yestoryd gets the Platform Fee (₹1,799 / 30%). Keep referring even when busy!'
    },
    {
      q: 'What if I bring my own students?',
      a: 'If you bring AND coach the student, you earn 70% (₹4,200 per child) — that\'s Lead Cost + Coach Cost. The extra 20% is your reward for bringing the student to our platform.'
    },
    {
      q: 'Is there a joining fee?',
      a: 'No joining fee. For non-certified coaches, there\'s a training investment with our partner institutes. This ensures quality and commitment.'
    },
    {
      q: 'What tools will I use?',
      a: 'Your personalized coach dashboard shows student progress, AI-generated insights, session schedules, earnings tracker, and parent communication templates. Vedant AI assists you before every session with child-specific preparation notes.'
    },
    {
      q: 'What\'s the commitment period?',
      a: 'Each child is a 3-month program. You commit to completing the full program for each child. If you need to exit, provide 1-month notice via the platform so we can ensure continuity for the child.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/images/logo.png" 
              alt="Yestoryd" 
              width={140} 
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <Link 
            href="/yestoryd-academy/apply"
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:shadow-lg hover:shadow-pink-500/25 transition-all"
          >
            Begin Your Journey
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-full px-4 py-2 mb-6">
              <span className="text-2xl">🎓</span>
              <span className="text-sm font-semibold text-purple-700">Yestoryd Academy</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Partner With Us to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                Transform Young Readers
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
              You bring the warmth, patience, and human connection.<br className="hidden md:block" />
              We bring the science, technology, and support system.<br className="hidden md:block" />
              Together, we help children fall in love with reading.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/yestoryd-academy/apply"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-pink-500/25 transition-all hover:-translate-y-1"
              >
                Begin Your Journey
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-slate-600 px-6 py-4 font-medium hover:text-pink-600 transition-colors"
              >
                Learn More
                <ChevronDown className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 flex flex-wrap justify-center gap-8 text-center">
            <div className="px-6">
              <div className="text-3xl font-bold text-slate-900">100+</div>
              <div className="text-sm text-slate-500">Children Transformed</div>
            </div>
            <div className="px-6 border-l border-slate-200">
              <div className="text-3xl font-bold text-slate-900">4.9★</div>
              <div className="text-sm text-slate-500">Parent Satisfaction</div>
            </div>
            <div className="px-6 border-l border-slate-200">
              <div className="text-3xl font-bold text-slate-900">AI-Powered</div>
              <div className="text-sm text-slate-500">Progress Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Model Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              A True <span className="text-pink-500">Partnership</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              You focus on what you do best — nurturing children. We handle everything else.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* You Provide - Keep it SHORT (low effort perception) */}
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 border border-pink-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">You Provide</h3>
                  <p className="text-sm text-slate-500">Just 3-4 hours per child/month</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  'Your warmth and patience',
                  'Encouraging presence in sessions',
                  'Honest feedback to parents',
                  'Commitment to 3-month child journeys'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-pink-200">
                <p className="text-sm text-pink-700 font-medium">
                  That's it. Just be present and caring.
                </p>
              </div>
            </div>

            {/* Yestoryd Provides - Make it LONG (high value perception) */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-8 border border-blue-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Yestoryd Handles</h3>
                  <p className="text-sm text-slate-500">Everything else — so you don't have to</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'AI-powered reading assessments',
                  'Scientific, age-appropriate curriculum',
                  'Session-by-session lesson plans',
                  'Pre-session child insights via Vedant AI',
                  'Automated scheduling & reminders',
                  'Video session recording & transcription',
                  'Real-time progress tracking dashboard',
                  'Parent communication tools & templates',
                  'Payment collection & monthly payouts',
                  'Admin support for any issues',
                  'Continuous training & resources'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Result - Emphasize the imbalance in coach's favor */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-8 py-4">
              <Sparkles className="w-8 h-8 text-green-500" />
              <div className="text-left">
                <div className="font-bold text-slate-900">You nurture. We handle the rest.</div>
                <div className="text-green-700 text-sm">Minimum effort, maximum impact.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Look For Section */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What We <span className="text-pink-500">Look For</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Skills can be taught. These qualities cannot. Do you recognize yourself?
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whatWeLookFor.map((item, i) => (
              <div 
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-100"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-pink-100 to-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{item.trait}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Your Journey to <span className="text-pink-500">Partnership</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A thoughtful process to ensure we're the right fit for each other.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {journeySteps.map((step, i) => (
              <div key={i} className="flex gap-6 mb-8 last:mb-0">
                {/* Step Number */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {step.step}
                  </div>
                  {i < journeySteps.length - 1 && (
                    <div className="w-0.5 h-full bg-gradient-to-b from-pink-300 to-purple-300 mt-2"></div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <div className="bg-slate-50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <step.icon className="w-5 h-5 text-pink-500" />
                      <h3 className="font-bold text-slate-900">{step.title}</h3>
                    </div>
                    <p className="text-slate-600 mb-3">{step.description}</p>
                    <span className="inline-block text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                      {step.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coach Tiers Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Grow With <span className="text-pink-400">Yestoryd</span>
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Your journey from new coach to master mentor.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {tiers.map((tier, i) => (
              <div 
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition-colors"
              >
                <div className="text-4xl mb-4">{tier.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-slate-300 text-sm mb-3">{tier.criteria}</p>
                <p className="text-pink-300 text-sm">{tier.benefits}</p>
              </div>
            ))}
          </div>

          {/* Revenue Model - 3 Component Explanation */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-white text-center">
                How You Earn
              </h3>
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">
                INTRODUCTORY OFFER
              </span>
            </div>
            <p className="text-center text-slate-400 text-sm mb-6">
              Lock in these rates by joining now — percentages may change for future coaches.
            </p>
            
            {/* 3 Component Visual */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-pink-500/20 border border-pink-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-pink-400">20%</div>
                <div className="text-sm text-white font-medium">Lead Cost</div>
                <div className="text-xs text-slate-400 mt-1">₹1,200</div>
                <div className="text-xs text-slate-300 mt-2">Goes to whoever<br/>brought the student</div>
              </div>
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">50%</div>
                <div className="text-sm text-white font-medium">Coach Cost</div>
                <div className="text-xs text-slate-400 mt-1">₹3,000</div>
                <div className="text-xs text-slate-300 mt-2">Goes to coach<br/>who teaches</div>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">30%</div>
                <div className="text-sm text-white font-medium">Platform Fee</div>
                <div className="text-xs text-slate-400 mt-1">₹1,799</div>
                <div className="text-xs text-slate-300 mt-2">Yestoryd<br/>(tech, content, support)</div>
              </div>
            </div>

            {/* Three Scenarios */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Scenario 1: Yestoryd assigns */}
              <div className="bg-slate-800/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="font-medium text-white text-sm">Yestoryd Assigns</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">We bring the student, you coach them.</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>You earn:</span>
                    <span className="font-semibold text-white">₹3,000</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Yestoryd:</span>
                    <span>₹2,999</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className="text-lg font-bold text-white">50%</span>
                </div>
              </div>
              
              {/* Scenario 2: You bring & coach */}
              <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-xl p-5 border border-pink-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-pink-400 rounded-full"></div>
                  <span className="font-medium text-white text-sm">You Bring & Coach</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Your student, you coach them.</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>You earn:</span>
                    <span className="font-semibold text-pink-400">₹4,200</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Yestoryd:</span>
                    <span>₹1,799</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className="text-lg font-bold text-pink-400">70%</span>
                </div>
              </div>
              
              {/* Scenario 3: You refer, another coaches */}
              <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                  <span className="font-medium text-white text-sm">You Refer Only</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Your lead, another coach teaches.</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Referral bonus:</span>
                    <span className="font-semibold text-amber-400">₹1,200</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Teaching coach:</span>
                    <span>₹3,000</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Yestoryd:</span>
                    <span>₹1,799</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className="text-lg font-bold text-amber-400">20%</span>
                </div>
              </div>
            </div>
            
            <p className="text-center text-xs text-slate-500 mt-6">
              Even at full capacity, keep referring — you earn ₹1,200 for every student you bring!
            </p>
          </div>

          {/* Earnings Calculator */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h4 className="text-lg font-semibold text-white text-center mb-6">Earnings Calculator</h4>
            
            {/* Lead Source Toggle */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setLeadSource('yestoryd')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  leadSource === 'yestoryd' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Yestoryd assigns (50%)
              </button>
              <button
                onClick={() => setLeadSource('coach')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  leadSource === 'coach' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                You bring students (70%)
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-4 mb-4">
              <label className="text-slate-300 text-sm">
                Children you coach:
              </label>
              <input
                type="range"
                min="5"
                max="25"
                value={childCount}
                onChange={(e) => setChildCount(parseInt(e.target.value))}
                className="w-32 accent-pink-500"
              />
              <span className="text-white font-bold w-8">{childCount}</span>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">
                Monthly earnings potential
              </div>
              <span className={`text-3xl font-bold ${leadSource === 'coach' ? 'text-pink-400' : 'text-white'}`}>
                ₹{calculateEarnings(childCount, leadSource).toLocaleString('en-IN')}
              </span>
              <span className="text-slate-500 text-sm ml-2">
                ({leadSource === 'coach' ? '70%' : '50%'} share)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Common <span className="text-pink-500">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i}
                className="bg-slate-50 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                >
                  <span className="font-semibold text-slate-900">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-pink-500 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-lg text-pink-100 mb-8 max-w-2xl mx-auto">
            If you believe every child deserves patient, personalized guidance on their reading journey, we'd love to hear from you.
          </p>
          <Link
            href="/yestoryd-academy/apply"
            className="inline-flex items-center gap-2 bg-white text-pink-600 px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
          >
            Begin Your Journey
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-6 text-pink-200 text-sm">
            Application takes about 10 minutes. We review within 48 hours.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Image 
            src="/images/logo.png" 
            alt="Yestoryd" 
            width={120} 
            height={35}
            className="h-8 w-auto mx-auto mb-4 opacity-80"
          />
          <p className="text-slate-500 text-sm">
            © 2025 Yestoryd. Transforming young readers, one child at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}