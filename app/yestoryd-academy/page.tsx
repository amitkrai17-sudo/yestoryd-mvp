// app/yestoryd-academy/page.tsx
// Yestoryd Academy - Coach Recruitment Landing Page
// Matches the deployed version exactly
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  CheckCircle2,
  Clock,
  Users,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
  Zap,
  Shield,
  Target,
  Award,
  Crown,
  Sprout,
  GraduationCap,
  Brain,
  Calendar,
  Video,
  FileText,
  Headphones,
  CreditCard,
  BarChart3,
  Settings,
  BookOpen,
  Lightbulb,
  HandHeart,
  Scale,
  TrendingUp,
  UserCheck
} from 'lucide-react';

// FAQ Data
const FAQ_DATA = [
  {
    question: "What qualifications do I need?",
    answer: "No specific teaching degree required. We look for patience, empathy, and genuine care for children. Experience with children (as a parent, tutor, or caregiver) is helpful but not mandatory. We provide all the training you need."
  },
  {
    question: "How much time do I need to commit?",
    answer: "Minimum 15-20 hours per month. Each child requires about 3-4 hours monthly (9 sessions over 3 months). You can start with just 5 children and grow from there."
  },
  {
    question: "How does the revenue sharing work?",
    answer: "For every ₹5,999 enrollment: 20% goes to lead cost (whoever brought the student), 50% goes to the coach (you), and 30% is the platform fee. If Yestoryd assigns you a student, you earn ₹3,000. If you bring the student yourself, you earn ₹4,200."
  },
  {
    question: "How does the partnership work?",
    answer: "You're not an employee — you're a partner. You set your own schedule, choose how many children to coach, and can work from anywhere. We handle all the technology, curriculum, scheduling, and payment collection."
  },
  {
    question: "What about training?",
    answer: "All new coaches go through our orientation program covering the Yestoryd methodology, platform tools, and child psychology basics. Ongoing support and resources are always available."
  },
  {
    question: "How do I grow as a coach?",
    answer: "Start as a Rising Coach, progress to Expert Coach (after 30+ children with strong NPS), and eventually Master Coach (75+ children). Higher tiers get priority assignments, featured profiles, and leadership opportunities."
  },
  {
    question: "What if I bring students but can't coach them?",
    answer: "You can refer students and earn ₹1,200 per enrollment even if another coach teaches them. Great for those at full capacity or building a network."
  },
  {
    question: "What if I bring my own students?",
    answer: "You keep 70% (₹4,200) for students you bring and coach yourself. The 20% lead cost goes to you since you sourced the student."
  },
  {
    question: "Is there a joining fee?",
    answer: "No. There's no deposit, no joining fee, and no upfront cost. We believe in removing barriers for talented coaches."
  },
  {
    question: "What tools will I use?",
    answer: "Google Meet for sessions, our coach dashboard for tracking, WhatsApp for parent communication, and Vedant AI for session preparation. All simple, no complex software."
  },
  {
    question: "What's the commitment period?",
    answer: "We ask for a 1-month notice before leaving to ensure smooth transitions for children mid-program. Beyond that, you're free to adjust your involvement anytime."
  }
];

export default function YestorydAcademyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [earningsMode, setEarningsMode] = useState<'assigned' | 'bring'>('assigned');
  const [childrenCount, setChildrenCount] = useState(10);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculateEarnings = () => {
    const perChild = earningsMode === 'assigned' ? 3000 : 4200;
    return childrenCount * perChild;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={140}
              height={40}
              className="h-9 w-auto"
            />
          </Link>
          <Link
            href="/yestoryd-academy/apply"
            className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:shadow-lg transition-all"
          >
            Begin Your Journey
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-pink-50/30 to-purple-50/30" />
        
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 mb-8 shadow-sm">
            <GraduationCap className="w-5 h-5 text-[#ff0099]" />
            <span className="text-sm font-medium text-slate-700">Yestoryd Academy</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Partner With Us to{' '}
            <span className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] bg-clip-text text-transparent">
              Transform Young Readers
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            You bring the warmth, patience, and human connection.
            We bring the science, technology, and support system.
            Together, we help children fall in love with reading.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/yestoryd-academy/apply"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-all"
            >
              Begin Your Journey
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button
              onClick={() => document.getElementById('partnership')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              Learn More
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">100+</div>
              <div className="text-sm text-slate-500 mt-1">Children Transformed</div>
            </div>
            <div className="text-center border-x border-slate-200">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">4.9★</div>
              <div className="text-sm text-slate-500 mt-1">Parent Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">AI-Powered</div>
              <div className="text-sm text-slate-500 mt-1">Progress Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section id="partnership" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              A True <span className="text-[#ff0099]">Partnership</span>
            </h2>
            <p className="text-lg text-slate-600">
              You focus on what you do best — nurturing children. We handle everything else.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* You Provide */}
            <div className="bg-gradient-to-br from-pink-50 to-white rounded-2xl p-8 border border-pink-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#ff0099] rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">You Provide</h3>
                  <p className="text-sm text-slate-500">Just 3-4 hours per child/month</p>
                </div>
              </div>

              <ul className="space-y-4">
                {[
                  "Warmth and genuine care for children",
                  "Patience to nurture at each child's pace",
                  "Encouraging presence in every session",
                  "Honest communication with parents",
                  "Commitment to 3-month child journeys"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#ff0099] flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm text-slate-500 italic">
                That's it. Just be present and caring.
              </p>
            </div>

            {/* Yestoryd Handles */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#ff0099]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Yestoryd Handles</h3>
                  <p className="text-sm text-slate-400">Everything else — so you don't have to</p>
                </div>
              </div>

              <ul className="space-y-3">
                {[
                  { icon: Brain, text: "AI-powered reading assessments" },
                  { icon: BookOpen, text: "Scientific, age-appropriate curriculum" },
                  { icon: FileText, text: "Session-by-session lesson plans" },
                  { icon: Sparkles, text: "Pre-session child insights via Vedant AI" },
                  { icon: Calendar, text: "Automated scheduling & reminders" },
                  { icon: Video, text: "Video session recording & transcription" },
                  { icon: BarChart3, text: "Real-time progress tracking dashboard" },
                  { icon: MessageCircle, text: "Parent communication tools & templates" },
                  { icon: CreditCard, text: "Payment collection & monthly payouts" },
                  { icon: Headphones, text: "Admin support for any issues" },
                  { icon: GraduationCap, text: "Continuous training & resources" }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-[#ff0099] flex-shrink-0" />
                    <span className="text-sm text-slate-300">{item.text}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm text-[#ff0099] font-medium">
                You nurture. We handle the rest.
              </p>
            </div>
          </div>

          <p className="text-center mt-8 text-slate-500">
            Minimum effort, maximum impact.
          </p>
        </div>
      </section>

      {/* What We Look For */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What We Look For
            </h2>
            <p className="text-lg text-slate-600">
              Skills can be taught. These qualities cannot. Do you recognize yourself?
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Clock,
                title: "Patience That Inspires",
                description: "You believe every child learns at their own pace. You explain the same concept five different ways until it clicks."
              },
              {
                icon: Heart,
                title: "Genuine Empathy",
                description: "A child's emotional wellbeing matters more than completing a lesson plan. You notice when something is off."
              },
              {
                icon: Target,
                title: "Ownership Mindset",
                description: "When a child struggles, you look at your methods first. You're committed to their 3-month journey."
              },
              {
                icon: Scale,
                title: "Honest Communication",
                description: "You'd rather be truthful with parents about challenges than oversell progress. Trust is everything."
              },
              {
                icon: TrendingUp,
                title: "Growth Orientation",
                description: "You're always learning. Feedback makes you better. You celebrate small wins along the way."
              },
              {
                icon: UserCheck,
                title: "Professional Reliability",
                description: "You honor commitments. When you say you'll be there at 5 PM, you're there at 4:55 PM."
              }
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-[#ff0099]/30 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#ff0099]" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Steps */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Your Journey to Partnership
            </h2>
            <p className="text-lg text-slate-600">
              A thoughtful process to ensure we're the right fit for each other.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                step: 1,
                title: "Share Your Story",
                description: "Tell us about yourself, your passion for teaching, and upload your credentials.",
                time: "10 minutes"
              },
              {
                step: 2,
                title: "AI Conversation",
                description: "Have a thoughtful conversation with Vedant AI about teaching scenarios and child psychology.",
                time: "15 minutes"
              },
              {
                step: 3,
                title: "Meet Our Team",
                description: "A friendly conversation with our founders to align on values and answer your questions.",
                time: "30 minutes"
              },
              {
                step: 4,
                title: "Begin Your Journey",
                description: "Complete orientation, sign the partnership agreement, and receive your first student.",
                time: "Welcome aboard!"
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    i === 3 ? 'bg-gradient-to-r from-[#ff0099] to-[#7b008b]' : 'bg-gradient-to-r from-[#ff0099] to-[#7b008b]'
                  }`}>
                    {item.step}
                  </div>
                  {i < 3 && (
                    <div className="w-0.5 h-16 bg-gradient-to-b from-[#ff0099] to-transparent mx-auto mt-2" />
                  )}
                </div>
                <div className="flex-grow bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    {i === 3 && <Sparkles className="w-5 h-5 text-[#ff0099]" />}
                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <p className="text-slate-600 mb-3">{item.description}</p>
                  <span className={`text-sm ${i === 3 ? 'text-[#ff0099] font-medium' : 'text-slate-400'}`}>
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coach Tiers */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Grow With <span className="text-[#ff0099]">Yestoryd</span>
            </h2>
            <p className="text-lg text-slate-400">
              Your journey from new coach to master mentor.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Sprout,
                emoji: "🌱",
                title: "Rising Coach",
                description: "New coaches, first 3 months",
                perk: "Full training, mentorship support",
                bg: "from-green-900/50 to-green-800/30"
              },
              {
                icon: Star,
                emoji: "⭐",
                title: "Expert Coach",
                description: "30+ children coached, strong NPS",
                perk: "Priority assignments, featured profile",
                bg: "from-yellow-900/50 to-yellow-800/30"
              },
              {
                icon: Crown,
                emoji: "👑",
                title: "Master Coach",
                description: "75+ children, exceptional results",
                perk: "Train new coaches, leadership role",
                bg: "from-purple-900/50 to-purple-800/30"
              }
            ].map((tier, i) => (
              <div key={i} className={`bg-gradient-to-br ${tier.bg} rounded-2xl p-6 border border-white/10`}>
                <div className="text-4xl mb-4">{tier.emoji}</div>
                <h3 className="text-xl font-bold mb-2">{tier.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{tier.description}</p>
                <p className="text-sm text-[#ff0099]">{tier.perk}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Section */}
      <section className="py-20 bg-slate-900 text-white border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#ff0099]/20 text-[#ff0099] rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">INTRODUCTORY OFFER</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How You Earn
            </h2>
            <p className="text-slate-400">
              Lock in these rates by joining now — percentages may change for future coaches.
            </p>
          </div>

          {/* 3-Component Split */}
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <div className="bg-gradient-to-br from-purple-600/30 to-purple-500/20 rounded-2xl p-6 text-center border border-purple-500/30">
              <div className="text-3xl font-bold text-purple-400 mb-2">20%</div>
              <div className="font-semibold mb-1">Lead Cost</div>
              <div className="text-sm text-slate-400 mb-2">₹1,200</div>
              <div className="text-xs text-slate-500">Goes to whoever<br />brought the student</div>
            </div>
            <div className="bg-gradient-to-br from-green-600/30 to-green-500/20 rounded-2xl p-6 text-center border border-green-500/30">
              <div className="text-3xl font-bold text-green-400 mb-2">50%</div>
              <div className="font-semibold mb-1">Coach Cost</div>
              <div className="text-sm text-slate-400 mb-2">₹3,000</div>
              <div className="text-xs text-slate-500">Goes to coach<br />who teaches</div>
            </div>
            <div className="bg-gradient-to-br from-blue-600/30 to-blue-500/20 rounded-2xl p-6 text-center border border-blue-500/30">
              <div className="text-3xl font-bold text-blue-400 mb-2">30%</div>
              <div className="font-semibold mb-1">Platform Fee</div>
              <div className="text-sm text-slate-400 mb-2">₹1,799</div>
              <div className="text-xs text-slate-500">Yestoryd<br />(tech, content, support)</div>
            </div>
          </div>

          {/* Scenarios */}
          <div className="space-y-4 mb-10">
            {/* Yestoryd Assigns */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-semibold">Yestoryd Assigns</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">We bring the student, you coach them.</p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-slate-400">You earn:</span>
                  <span className="text-2xl font-bold text-white ml-2">₹3,000</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Yestoryd:</span>
                  <span className="text-slate-400 ml-2">₹2,999</span>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-blue-400">50%</div>
            </div>

            {/* You Bring & Coach */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <h3 className="font-semibold">You Bring & Coach</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">Your student, you coach them.</p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-slate-400">You earn:</span>
                  <span className="text-2xl font-bold text-white ml-2">₹4,200</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Yestoryd:</span>
                  <span className="text-slate-400 ml-2">₹1,799</span>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-orange-400">70%</div>
            </div>

            {/* You Refer Only */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <h3 className="font-semibold">You Refer Only</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">Your lead, another coach teaches.</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Referral bonus:</span>
                  <div className="font-bold text-yellow-400">₹1,200</div>
                </div>
                <div>
                  <span className="text-slate-500">Teaching coach:</span>
                  <div className="text-slate-400">₹3,000</div>
                </div>
                <div>
                  <span className="text-slate-500">Yestoryd:</span>
                  <div className="text-slate-400">₹1,799</div>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-yellow-400">20%</div>
            </div>
          </div>

          <p className="text-center text-sm text-[#ff0099]">
            Even at full capacity, keep referring — you earn ₹1,200 for every student you bring!
          </p>

          {/* Earnings Calculator */}
          <div className="mt-12 bg-white/5 rounded-2xl p-8 border border-white/10">
            <h3 className="text-xl font-bold text-center mb-6">Earnings Calculator</h3>
            
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setEarningsMode('assigned')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  earningsMode === 'assigned' 
                    ? 'bg-[#ff0099] text-white' 
                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                Yestoryd assigns (50%)
              </button>
              <button
                onClick={() => setEarningsMode('bring')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  earningsMode === 'bring' 
                    ? 'bg-[#ff0099] text-white' 
                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                You bring students (70%)
              </button>
            </div>

            <div className="text-center mb-6">
              <label className="text-slate-400 block mb-2">Children you coach:</label>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(parseInt(e.target.value))}
                  className="w-48 accent-[#ff0099]"
                />
                <span className="text-2xl font-bold w-12">{childrenCount}</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-400 mb-2">Monthly earnings potential</p>
              <div className="text-4xl md:text-5xl font-bold">
                ₹{calculateEarnings().toLocaleString()}
              </div>
              <p className="text-slate-500 text-sm mt-2">
                ({earningsMode === 'assigned' ? '50%' : '70%'} share)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Common <span className="text-[#ff0099]">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {FAQ_DATA.map((faq, i) => (
              <div
                key={i}
                className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-100 transition-colors"
                >
                  <span className="font-semibold text-slate-900 pr-8">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-[#ff0099] via-[#7b008b] to-purple-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Make a Difference?
          </h2>
          <p className="text-xl text-white/80 mb-10 leading-relaxed">
            If you believe every child deserves patient, personalized guidance on their
            reading journey, we'd love to hear from you.
          </p>
          <Link
            href="/yestoryd-academy/apply"
            className="inline-flex items-center gap-2 bg-white text-[#ff0099] px-10 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all"
          >
            Begin Your Journey
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-6 text-white/60 text-sm">
            Application takes about 10 minutes. We review within 48 hours.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Image
            src="/images/logo.png"
            alt="Yestoryd"
            width={120}
            height={35}
            className="h-8 w-auto mx-auto mb-6 brightness-0 invert opacity-80"
          />
          <p className="text-slate-500">
            © 2025 Yestoryd. Transforming young readers, one child at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}