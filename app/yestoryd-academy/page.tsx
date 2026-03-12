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
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
  Zap,
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
  BookOpen,
  Scale,
  TrendingUp,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useSessionDurations } from '@/contexts/SiteSettingsContext';
import { supabase } from '@/lib/supabase/client';

// Static FAQ items (no pricing data)
const STATIC_FAQ_DATA = [
  {
    question: "What qualifications do I need?",
    answer: "No specific teaching degree required. We look for patience, empathy, and genuine care for children. Experience with children (as a parent, tutor, or caregiver) is helpful but not mandatory. We provide all the training you need."
  },
  {
    question: "How much time do I need to commit?",
    answer: "Minimum 15-20 hours per month. Each child requires about 3-4 hours monthly (sessions spread over 12 weeks, tailored to age band). You can start with just 5 children and grow from there."
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

// ── Tier display type (visual layer only — rates come from API) ──
interface TierDisplay {
  name: string;
  displayName: string;
  perSessionRate: number;
  sbRate: number;
  monthlyEstimate: number;
  exampleStudents: number;
  coachPercent: number;
  minChildren: number;
  color: string;
  borderColor: string;
  bgGradient: string;
  icon: typeof Sprout;
}

// Tier visual config (client-side only — no business logic)
const TIER_VISUALS: Record<string, { color: string; borderColor: string; bgGradient: string; icon: typeof Sprout; exampleStudents: number }> = {
  rising:  { color: 'text-green-400',   borderColor: 'border-green-500/30',   bgGradient: 'from-green-500/20 to-green-500/5',       icon: Sprout, exampleStudents: 10 },
  expert:  { color: 'text-[#ffde00]',   borderColor: 'border-[#ffde00]/30',   bgGradient: 'from-[#ffde00]/20 to-[#ffde00]/5',       icon: Star,   exampleStudents: 15 },
  master:  { color: 'text-[#c847f4]',   borderColor: 'border-[#c847f4]/30',   bgGradient: 'from-[#c847f4]/20 to-[#c847f4]/5',       icon: Crown,  exampleStudents: 20 },
};
const DEFAULT_VISUAL = { color: 'text-[#00abff]', borderColor: 'border-[#00abff]/30', bgGradient: 'from-[#00abff]/20 to-[#00abff]/5', icon: Award, exampleStudents: 10 };

export default function YestorydAcademyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState(0); // index into tiers
  const [childrenCount, setChildrenCount] = useState(10);
  const [includeReferral, setIncludeReferral] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  // Tier + pricing data from API
  const [tiers, setTiers] = useState<TierDisplay[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tiersError, setTiersError] = useState(false);
  const [referralBonusPerStudent, setReferralBonusPerStudent] = useState(0);
  const [referralPercent, setReferralPercent] = useState(0);
  const [programPrice, setProgramPrice] = useState(0);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [payoutDay, setPayoutDay] = useState(7);
  const [coachingSessions, setCoachingSessions] = useState(12);
  const [sbSessions, setSbSessions] = useState(4);

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
          const parsed = JSON.parse(String(data.value));
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

  // Fetch tier data from earnings-calculator API (single source of truth: payout-config.ts)
  useEffect(() => {
    async function fetchTiers() {
      try {
        const res = await fetch('/api/coach/earnings-calculator?mode=tiers&age_band=building');
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load earnings data');
        }

        setProgramPrice(data.pricing.program_price);
        setReferralBonusPerStudent(data.referral.bonus_per_enrollment);
        setReferralPercent(data.referral.coach_referral_percent);
        setPayoutDay(data.payout_day);
        setSessionsPerWeek(data.age_band.sessions_per_week);
        setCoachingSessions(data.age_band.coaching_sessions);
        setSbSessions(data.age_band.skill_building_sessions);

        // Map API tier rates to display tiers (add visual config)
        const sessPerMonth = data.age_band.sessions_per_week * 4;
        const sbPerMonth = data.age_band.coaching_sessions > 0
          ? Math.round(data.age_band.skill_building_sessions * sessPerMonth / data.age_band.coaching_sessions)
          : 0;

        const computed: TierDisplay[] = data.tiers.map((t: any) => {
          const visual = TIER_VISUALS[t.name.toLowerCase()] ?? DEFAULT_VISUAL;
          const perStudentMonthly = (t.coaching_rate * sessPerMonth) + (t.skill_building_rate * sbPerMonth);

          return {
            name: t.name,
            displayName: t.display_name,
            perSessionRate: t.coaching_rate,
            sbRate: t.skill_building_rate,
            monthlyEstimate: perStudentMonthly * visual.exampleStudents,
            exampleStudents: visual.exampleStudents,
            coachPercent: t.coach_cost_percent,
            minChildren: t.min_children_threshold,
            color: visual.color,
            borderColor: visual.borderColor,
            bgGradient: visual.bgGradient,
            icon: visual.icon,
          };
        });

        setTiers(computed);
        setTiersLoading(false);
      } catch (err) {
        console.error('[Academy] Failed to load tier data:', err);
        setTiersError(true);
        setTiersLoading(false);
      }
    }
    fetchTiers();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Calculator: compute monthly earnings for selected tier + student count
  // Uses rates from API (calculated by payout-config.ts) — no local math on rates
  const calcMonthlyEarnings = () => {
    const tier = tiers[selectedTier];
    if (!tier) return { sessions: 0, base: 0, referral: 0, total: 0, perSession: 0 };
    const sessionsPerStudent = Math.round(sessionsPerWeek * 4);
    const totalSessions = childrenCount * sessionsPerStudent;
    const base = totalSessions * tier.perSessionRate;
    const referral = includeReferral ? childrenCount * referralBonusPerStudent : 0;
    return { sessions: totalSessions, base, referral, total: base + referral, perSession: tier.perSessionRate };
  };

  // Build FAQ data — only include pricing entries when tier data is loaded
  const earningsFaqEntries = tiers.length > 0 ? [
    {
      question: "How does the earnings model work?",
      answer: `You earn per session completed, not a percentage of the enrollment fee. As a ${tiers[0]?.displayName} coach, you earn ₹${tiers[0]?.perSessionRate.toLocaleString('en-IN')} per coaching session. As you progress to ${tiers[tiers.length - 1]?.displayName}, you earn ₹${tiers[tiers.length - 1]?.perSessionRate.toLocaleString('en-IN')} per coaching session. Skill building sessions pay 50% of your coaching rate. Payouts happen monthly on the ${payoutDay}th.`
    },
  ] : [];
  const referralFaqEntries = (tiers.length > 0 && referralBonusPerStudent > 0) ? [
    {
      question: "What if I bring my own students?",
      answer: `When you refer a student, you earn an additional ₹${referralBonusPerStudent.toLocaleString('en-IN')} referral bonus per enrollment on top of your per-session earnings. Even if you're at full capacity, you can refer students for other coaches and still earn the referral bonus.`
    },
  ] : [];
  const faqData = [
    ...STATIC_FAQ_DATA.slice(0, 2),
    ...earningsFaqEntries,
    ...STATIC_FAQ_DATA.slice(2, 4),
    ...referralFaqEntries,
    ...STATIC_FAQ_DATA.slice(4),
  ];

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

      {/* Earnings Section — V2 Tier Progression */}
      <section className="py-20 bg-surface-0 border-t border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#ff0099]/20 text-[#ff0099] rounded-full px-4 py-2 mb-4">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">GROW YOUR EARNINGS</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How You Earn
            </h2>
            <p className="text-text-tertiary">
              Earn per session completed. Grow your rate as you grow with us.
            </p>
          </div>

          {/* Loading / Error / Content */}
          {tiersLoading ? (
            <div className="flex items-center justify-center gap-3 py-12">
              <Spinner />
              <span className="text-text-tertiary">Loading earnings data...</span>
            </div>
          ) : tiersError || tiers.length === 0 ? (
            <div className="bg-surface-1 border border-border rounded-2xl p-8 text-center">
              <AlertCircle className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary mb-1">Unable to load current earnings rates.</p>
              <p className="text-sm text-text-tertiary">Please refresh the page or try again later.</p>
            </div>
          ) : (<>

          {/* Tier Progression Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            {tiers.map((tier, i) => {
              const TierIcon = tier.icon;
              const baseTotal =
                (coachingSessions * tier.perSessionRate) + (sbSessions * tier.sbRate);
              const basePercent = programPrice > 0 ? Math.round(baseTotal / programPrice * 100) : 0;
              const withReferralTotal = baseTotal + referralBonusPerStudent;
              const withReferralPercent = programPrice > 0 ? Math.round(withReferralTotal / programPrice * 100) : 0;

              return (
                <div
                  key={tier.name}
                  className={`bg-gradient-to-br ${tier.bgGradient} rounded-2xl p-6 border ${tier.borderColor} relative`}
                >
                  {/* Arrow connector (desktop only) */}
                  {i < tiers.length - 1 && (
                    <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-5 h-5 text-text-tertiary" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-0/50 flex items-center justify-center">
                      <TierIcon className={`w-5 h-5 ${tier.color}`} />
                    </div>
                    <div>
                      <h3 className={`font-bold ${tier.color}`}>{tier.displayName}</h3>
                      {tier.minChildren > 0 ? (
                        <p className="text-xs text-text-tertiary">{tier.minChildren}+ children coached</p>
                      ) : (
                        <p className="text-xs text-text-tertiary">Entry level</p>
                      )}
                    </div>
                  </div>

                  {/* Session breakdown */}
                  <div className="space-y-1 mb-4 text-sm text-text-secondary">
                    <div className="flex justify-between">
                      <span>{coachingSessions} coaching sessions</span>
                      <span className="text-text-tertiary">× ₹{tier.perSessionRate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{sbSessions} skill building sessions</span>
                      <span className="text-text-tertiary">× ₹{tier.sbRate.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Earnings per enrollment: assigned vs own student */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    {/* Yestoryd assigns */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-tertiary">Yestoryd assigns</span>
                      <span className="text-white font-medium">
                        {basePercent}% · ₹{baseTotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* You bring — highlighted */}
                    {referralBonusPerStudent > 0 && (
                      <div className="flex items-center justify-between text-sm bg-[#ffde00]/10 -mx-2 px-2 py-1.5 rounded-xl">
                        <span className="text-[#ffde00]">You bring student</span>
                        <span className="text-[#ffde00] font-bold">
                          {withReferralPercent}% · ₹{withReferralTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Monthly estimate */}
                  <div className="pt-3 mt-2 border-t border-white/10 flex justify-between text-sm">
                    <span className="text-text-tertiary">Monthly est.</span>
                    <span className="text-text-secondary">
                      ~₹{tier.monthlyEstimate.toLocaleString('en-IN')}
                      <span className="text-text-tertiary"> ({tier.exampleStudents} kids)</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {programPrice > 0 && (
            <p className="text-center text-xs text-text-tertiary mb-10">
              Based on Full Course (₹{programPrice.toLocaleString('en-IN')}) · Building band (age 7-9) · Rates vary by age band and plan
            </p>
          )}

          {/* Interactive Earnings Calculator */}
          <div className="bg-surface-1 rounded-2xl p-8 border border-border">
            <h3 className="text-xl font-bold text-white text-center mb-6">Earnings Calculator</h3>

            {/* Tier Selector */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {tiers.map((tier, i) => {
                const TierIcon = tier.icon;
                return (
                  <button
                    key={tier.name}
                    onClick={() => setSelectedTier(i)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium transition-all min-h-[44px] ${
                      selectedTier === i
                        ? 'bg-[#ff0099] text-white'
                        : 'bg-surface-2 text-text-tertiary hover:bg-surface-0 border border-border'
                    }`}
                  >
                    <TierIcon className="w-4 h-4" />
                    {tier.displayName}
                  </button>
                );
              })}
            </div>

            {/* Students Slider */}
            <div className="text-center mb-6">
              <label className="text-text-tertiary block mb-2">Children you coach:</label>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(parseInt(e.target.value))}
                  className="w-48 accent-[#ff0099]"
                />
                <span className="text-2xl font-bold text-white w-12">{childrenCount}</span>
              </div>
            </div>

            {/* Referral Toggle */}
            {referralBonusPerStudent > 0 && (
              <div className="flex items-center justify-center gap-3 mb-6">
                <button
                  onClick={() => setIncludeReferral(!includeReferral)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    includeReferral ? 'bg-[#ff0099]' : 'bg-surface-2'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      includeReferral ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                <span className="text-sm text-text-secondary">Include referral bonus (you bring students)</span>
              </div>
            )}

            {/* Results */}
            {(() => {
              const calc = calcMonthlyEarnings();
              return (
                <div className="text-center">
                  <p className="text-text-tertiary mb-2">Monthly earnings potential</p>
                  <div className="text-4xl md:text-5xl font-bold text-white">
                    ₹{calc.total.toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-3 text-sm text-text-tertiary">
                    <span>₹{calc.perSession.toLocaleString('en-IN')}/session</span>
                    <span className="text-border">|</span>
                    <span>~{calc.sessions} sessions/month</span>
                  </div>
                  {includeReferral && calc.referral > 0 && (
                    <p className="text-sm text-[#ffde00] mt-2">
                      Includes ₹{calc.referral.toLocaleString('en-IN')} referral bonuses
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary mt-4">
                    Annual potential: ₹{(calc.total * 12).toLocaleString('en-IN')}
                  </p>
                </div>
              );
            })()}
          </div>

          <p className="text-center text-xs text-text-tertiary mt-4">
            Payouts processed monthly on the 7th via UPI transfer.
          </p>

          </>)}
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
            {faqData.map((faq, i) => (
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
