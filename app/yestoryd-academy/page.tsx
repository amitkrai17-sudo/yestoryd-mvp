// app/yestoryd-academy/page.tsx
// Yestoryd Academy - Coach Recruitment Landing Page
// DARK THEME - Consistent with Yestoryd design system

'use client';

import { useState, useEffect } from 'react';
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
  UserCheck,
  Play,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useEarningsCalculator } from '@/hooks/useEarningsCalculator';
import { useSessionDurations } from '@/contexts/SiteSettingsContext';
import { supabase } from '@/lib/supabase/client';

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
    answer: "Google Meet for sessions, our coach dashboard for tracking, WhatsApp for parent communication, and rAI for session preparation. All simple, no complex software."
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
  const [videoUrl, setVideoUrl] = useState('');

  // Dynamic earnings data from database
  const { data: earningsData, isLoading: earningsLoading } = useEarningsCalculator();

  // Session durations from site_settings
  const durations = useSessionDurations();

  // Fetch video URL from site_settings
  useEffect(() => {
    async function fetchVideoUrl() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'yestoryd_academy_video_url')
          .single();

        if (data?.value) {
          const parsed = JSON.parse(data.value);
          if (parsed && parsed.startsWith('http')) {
            setVideoUrl(parsed);
          }
        }
      } catch (err) {
        console.log('No video configured for yestoryd academy');
      }
    }
    fetchVideoUrl();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const calculateEarnings = () => {
    // Get earnings from database or use fallback
    const fullProgram = earningsData?.products.find(p => p.slug === 'full');
    const ownLeadEarnings = fullProgram?.coach_earnings_own_lead || 4200;
    const platformLeadEarnings = fullProgram?.coach_earnings_platform_lead || 3000;

    const perChild = earningsMode === 'assigned' ? platformLeadEarnings : ownLeadEarnings;
    return childrenCount * perChild;
  };

  // Get dynamic values from earnings data
  const splitConfig = earningsData?.split_config;
  const fullProgram = earningsData?.products.find(p => p.slug === 'full');
  const programPrice = fullProgram?.price || 5999;
  const leadCostPercent = splitConfig?.lead_cost_percent || 20;
  const coachCostPercent = splitConfig?.coach_cost_percent || 50;
  const platformFeePercent = splitConfig?.platform_fee_percent || 30;
  const ownLeadTotalPercent = splitConfig?.own_lead_total_percent || 70;

  // Calculate amounts from percentages
  const leadCostAmount = Math.round(programPrice * leadCostPercent / 100);
  const coachCostAmount = Math.round(programPrice * coachCostPercent / 100);
  const platformFeeAmount = Math.round(programPrice * platformFeePercent / 100);
  const ownLeadTotal = fullProgram?.coach_earnings_own_lead || Math.round(programPrice * ownLeadTotalPercent / 100);
  const platformLeadTotal = fullProgram?.coach_earnings_platform_lead || coachCostAmount;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-surface-1/95 backdrop-blur-sm border-b border-border">
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
            className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:shadow-lg transition-all min-h-[44px] flex items-center"
          >
            Apply Now
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff0099]/10 via-surface-0 to-[#7b008b]/10" />

        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-surface-1 border border-border rounded-full px-4 py-2 mb-8 shadow-md shadow-black/20">
            <GraduationCap className="w-5 h-5 text-[#ff0099]" />
            <span className="text-sm font-medium text-text-secondary">Yestoryd Academy</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Partner With Us to{' '}
            <span className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] bg-clip-text text-transparent">
              Transform Young Readers
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            You bring the warmth, patience, and human connection.
            We bring the science, technology, and support system.
            Together, we help children fall in love with reading.
          </p>

          {/* URGENCY BADGE */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-8">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-400">January 2026 Batch • Limited Spots</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/yestoryd-academy/apply"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-4 rounded-full font-semibold text-lg hover:shadow-xl transition-all min-h-[56px]"
            >
              Apply Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button
              onClick={() => document.getElementById('partnership')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 text-text-secondary hover:text-white font-medium min-h-[44px]"
            >
              Learn More
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mb-12">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">100+</div>
              <div className="text-sm text-text-tertiary mt-1">Families Helped</div>
            </div>
            <div className="text-center border-x border-border">
              <div className="text-3xl md:text-4xl font-bold text-white">4.9★</div>
              <div className="text-sm text-text-tertiary mt-1">Parent Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">AI-Powered</div>
              <div className="text-sm text-text-tertiary mt-1">Progress Tracking</div>
            </div>
          </div>

          {/* Video Section - Shows if video URL is configured */}
          {videoUrl && (
            <div className="max-w-2xl mx-auto">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border-4 border-surface-1">
                <iframe
                  src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
                  title="Join Yestoryd Academy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <p className="text-sm text-text-tertiary mt-4">
                Watch: Why coaches love working with Yestoryd
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Partnership Section */}
      <section id="partnership" className="py-20 bg-surface-0">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              A True <span className="text-[#ff0099]">Partnership</span>
            </h2>
            <p className="text-lg text-text-secondary">
              You focus on what you do best — nurturing children. We handle everything else.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* You Provide */}
            <div className="bg-gradient-to-br from-[#ff0099]/10 to-surface-1 rounded-2xl p-8 border border-[#ff0099]/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#ff0099] rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">You Provide</h3>
                  <p className="text-sm text-text-tertiary">Just 3-4 hours per child/month</p>
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
                    <span className="text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm text-text-tertiary italic">
                That's it. Just be present and caring.
              </p>
            </div>

            {/* Yestoryd Handles */}
            <div className="bg-gradient-to-br from-surface-2 to-surface-1 rounded-2xl p-8 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#00abff]/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#00abff]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Yestoryd Handles</h3>
                  <p className="text-sm text-text-tertiary">Everything else — so you don't have to</p>
                </div>
              </div>

              <ul className="space-y-3">
                {[
                  { icon: Brain, text: "AI-powered reading assessments" },
                  { icon: BookOpen, text: "Scientific, age-appropriate curriculum" },
                  { icon: FileText, text: "Session-by-session lesson plans" },
                  { icon: Sparkles, text: "Pre-session child insights via rAI" },
                  { icon: Calendar, text: "Automated scheduling & reminders" },
                  { icon: Video, text: "Video session recording & transcription" },
                  { icon: BarChart3, text: "Real-time progress tracking dashboard" },
                  { icon: MessageCircle, text: "Parent communication tools & templates" },
                  { icon: CreditCard, text: "Payment collection & monthly payouts" },
                  { icon: Headphones, text: "Admin support for any issues" },
                  { icon: GraduationCap, text: "Continuous training & resources" }
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-[#00abff] flex-shrink-0" />
                    <span className="text-sm text-text-secondary">{item.text}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm text-[#00abff] font-medium">
                You nurture. We handle the rest.
              </p>
            </div>
          </div>

          <p className="text-center mt-8 text-text-tertiary">
            Minimum effort, maximum impact.
          </p>
        </div>
      </section>

      {/* What We Look For */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What We Look For
            </h2>
            <p className="text-lg text-text-secondary">
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
              <div key={i} className="bg-surface-0 rounded-2xl p-6 border border-border hover:border-[#ff0099]/30 hover:shadow-lg hover:shadow-[#ff0099]/10 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-[#ff0099]/20 to-[#7b008b]/20 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#ff0099]" />
                </div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Steps */}
      <section className="py-20 bg-surface-0">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Your Journey to Partnership
            </h2>
            <p className="text-lg text-text-secondary">
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
                description: "Have a thoughtful conversation with rAI about teaching scenarios and child psychology.",
                time: "15 minutes"
              },
              {
                step: 3,
                title: "Meet Our Team",
                description: "A friendly conversation with our founders to align on values and answer your questions.",
                time: `${durations.discovery} minutes`
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                    {item.step}
                  </div>
                  {i < 3 && (
                    <div className="w-0.5 h-16 bg-gradient-to-b from-[#ff0099] to-transparent mx-auto mt-2" />
                  )}
                </div>
                <div className="flex-grow bg-surface-1 rounded-2xl p-6 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    {i === 3 && <Sparkles className="w-5 h-5 text-[#ff0099]" />}
                    <h3 className="font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-text-secondary mb-3">{item.description}</p>
                  <span className={`text-sm ${i === 3 ? 'text-[#ff0099] font-medium' : 'text-text-tertiary'}`}>
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coach Tiers */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Grow With <span className="text-[#ff0099]">Yestoryd</span>
            </h2>
            <p className="text-lg text-text-tertiary">
              Your journey from new coach to master mentor.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Sprout,
                title: "Rising Coach",
                description: "New coaches, first 3 months",
                perk: "Full training, mentorship support",
                bg: "from-green-500/20 to-green-500/10",
                iconColor: "text-green-400",
                borderColor: "border-green-500/30"
              },
              {
                icon: Star,
                title: "Expert Coach",
                description: "30+ children coached, strong NPS",
                perk: "Priority assignments, featured profile",
                bg: "from-[#ffde00]/20 to-[#ffde00]/10",
                iconColor: "text-[#ffde00]",
                borderColor: "border-[#ffde00]/30"
              },
              {
                icon: Crown,
                title: "Master Coach",
                description: "75+ children, exceptional results",
                perk: "Train new coaches, leadership role",
                bg: "from-[#c847f4]/20 to-[#c847f4]/10",
                iconColor: "text-[#c847f4]",
                borderColor: "border-[#c847f4]/30"
              }
            ].map((tier, i) => (
              <div key={i} className={`bg-gradient-to-br ${tier.bg} rounded-2xl p-6 border ${tier.borderColor}`}>
                <div className="w-12 h-12 rounded-xl bg-surface-0/50 flex items-center justify-center mb-4">
                  <tier.icon className={`w-6 h-6 ${tier.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{tier.title}</h3>
                <p className="text-sm text-text-tertiary mb-4">{tier.description}</p>
                <p className="text-sm text-[#ff0099]">{tier.perk}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Section */}
      <section className="py-20 bg-surface-0 border-t border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#ff0099]/20 text-[#ff0099] rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">INTRODUCTORY OFFER</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How You Earn
            </h2>
            <p className="text-text-tertiary">
              Lock in these rates by joining now — percentages may change for future coaches.
            </p>
          </div>

          {/* 3-Component Split */}
          {earningsLoading ? (
            <div className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="w-6 h-6 text-[#ff0099] animate-spin" />
              <span className="text-text-tertiary">Loading earnings data...</span>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mb-10">
              <div className="bg-gradient-to-br from-[#c847f4]/20 to-[#c847f4]/10 rounded-2xl p-6 text-center border border-[#c847f4]/30">
                <div className="text-3xl font-bold text-[#c847f4] mb-2">{leadCostPercent}%</div>
                <div className="font-semibold text-white mb-1">Lead Cost</div>
                <div className="text-sm text-text-secondary mb-2">₹{leadCostAmount.toLocaleString()}</div>
                <div className="text-xs text-text-tertiary">Goes to whoever<br />brought the student</div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-2xl p-6 text-center border border-green-500/30">
                <div className="text-3xl font-bold text-green-400 mb-2">{coachCostPercent}%</div>
                <div className="font-semibold text-white mb-1">Coach Cost</div>
                <div className="text-sm text-text-secondary mb-2">₹{coachCostAmount.toLocaleString()}</div>
                <div className="text-xs text-text-tertiary">Goes to coach<br />who teaches</div>
              </div>
              <div className="bg-gradient-to-br from-[#00abff]/20 to-[#00abff]/10 rounded-2xl p-6 text-center border border-[#00abff]/30">
                <div className="text-3xl font-bold text-[#00abff] mb-2">{platformFeePercent}%</div>
                <div className="font-semibold text-white mb-1">Platform Fee</div>
                <div className="text-sm text-text-secondary mb-2">₹{platformFeeAmount.toLocaleString()}</div>
                <div className="text-xs text-text-tertiary">Yestoryd<br />(tech, content, support)</div>
              </div>
            </div>
          )}

          {/* Scenarios */}
          <div className="space-y-4 mb-10">
            {/* Yestoryd Assigns */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-[#00abff]" />
                <h3 className="font-semibold text-white">Yestoryd Assigns</h3>
              </div>
              <p className="text-sm text-text-tertiary mb-4">We bring the student, you coach them.</p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-text-tertiary">You earn:</span>
                  <span className="text-2xl font-bold text-white ml-2">₹{platformLeadTotal.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-text-tertiary">Yestoryd:</span>
                  <span className="text-text-secondary ml-2">₹{(programPrice - platformLeadTotal).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-[#00abff]">{coachCostPercent}%</div>
            </div>

            {/* You Bring & Coach */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <h3 className="font-semibold text-white">You Bring & Coach</h3>
              </div>
              <p className="text-sm text-text-tertiary mb-4">Your student, you coach them.</p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-text-tertiary">You earn:</span>
                  <span className="text-2xl font-bold text-white ml-2">₹{ownLeadTotal.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-text-tertiary">Yestoryd:</span>
                  <span className="text-text-secondary ml-2">₹{platformFeeAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-orange-400">{ownLeadTotalPercent}%</div>
            </div>

            {/* You Refer Only */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-[#ffde00]" />
                <h3 className="font-semibold text-white">You Refer Only</h3>
              </div>
              <p className="text-sm text-text-tertiary mb-4">Your lead, another coach teaches.</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-text-tertiary">Referral bonus:</span>
                  <div className="font-bold text-[#ffde00]">₹{leadCostAmount.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-text-tertiary">Teaching coach:</span>
                  <div className="text-text-secondary">₹{coachCostAmount.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-text-tertiary">Yestoryd:</span>
                  <div className="text-text-secondary">₹{platformFeeAmount.toLocaleString()}</div>
                </div>
              </div>
              <div className="text-center mt-4 text-2xl font-bold text-[#ffde00]">{leadCostPercent}%</div>
            </div>
          </div>

          <p className="text-center text-sm text-[#ff0099]">
            Even at full capacity, keep referring — you earn ₹{leadCostAmount.toLocaleString()} for every student you bring!
          </p>

          {/* Earnings Calculator */}
          <div className="mt-12 bg-surface-1 rounded-2xl p-8 border border-border">
            <h3 className="text-xl font-bold text-white text-center mb-6">Earnings Calculator</h3>

            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <button
                onClick={() => setEarningsMode('assigned')}
                className={`px-6 py-2 rounded-full font-medium transition-all min-h-[44px] ${
                  earningsMode === 'assigned'
                    ? 'bg-[#ff0099] text-white'
                    : 'bg-surface-2 text-text-tertiary hover:bg-surface-0 border border-border'
                }`}
              >
                Yestoryd assigns ({coachCostPercent}%)
              </button>
              <button
                onClick={() => setEarningsMode('bring')}
                className={`px-6 py-2 rounded-full font-medium transition-all min-h-[44px] ${
                  earningsMode === 'bring'
                    ? 'bg-[#ff0099] text-white'
                    : 'bg-surface-2 text-text-tertiary hover:bg-surface-0 border border-border'
                }`}
              >
                You bring students ({ownLeadTotalPercent}%)
              </button>
            </div>

            <div className="text-center mb-6">
              <label className="text-text-tertiary block mb-2">Children you coach:</label>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(parseInt(e.target.value))}
                  className="w-48 accent-[#ff0099]"
                />
                <span className="text-2xl font-bold text-white w-12">{childrenCount}</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-text-tertiary mb-2">Monthly earnings potential</p>
              <div className="text-4xl md:text-5xl font-bold text-white">
                ₹{calculateEarnings().toLocaleString()}
              </div>
              <p className="text-text-tertiary text-sm mt-2">
                ({earningsMode === 'assigned' ? `${coachCostPercent}%` : `${ownLeadTotalPercent}%`} share)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Common <span className="text-[#ff0099]">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {FAQ_DATA.map((faq, i) => (
              <div
                key={i}
                className="bg-surface-0 rounded-2xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-2 transition-colors min-h-[44px]"
                >
                  <span className="font-semibold text-white pr-8">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="text-text-secondary leading-relaxed">{faq.answer}</p>
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
          <p className="text-xl text-white/80 mb-6 leading-relaxed">
            If you believe every child deserves patient, personalized guidance on their
            reading journey, we'd love to hear from you.
          </p>

          {/* Urgency reminder */}
          <p className="text-white/60 text-sm mb-8 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            January 2026 batch applications closing soon
          </p>

          <Link
            href="/yestoryd-academy/apply"
            className="inline-flex items-center gap-2 bg-white text-[#ff0099] px-10 py-4 rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all min-h-[56px]"
          >
            Apply Now
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-6 text-white/60 text-sm">
            Application takes about 10 minutes. We review within 48 hours.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-surface-1 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Image
            src="/images/logo.png"
            alt="Yestoryd"
            width={120}
            height={35}
            className="h-8 w-auto mx-auto mb-6"
          />
          <p className="text-text-tertiary">
            © 2026 Yestoryd. Transforming young readers, one child at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}
