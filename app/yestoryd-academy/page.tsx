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

// Truly-static FAQ items. Entries that reference dynamic values
// (time commitment, tier thresholds, earnings) are built at render
// time so they never lie when config changes.
const STATIC_FAQ_QUALIFICATIONS = {
  question: "What qualifications do I need?",
  answer: "No specific teaching degree required. We look for patience, empathy, and genuine care for children. Experience with children (as a parent, tutor, or caregiver) is helpful but not mandatory. We provide all the training you need."
};
const STATIC_FAQ_PARTNERSHIP = {
  question: "How does the partnership work?",
  answer: "You're not an employee — you're a partner. You set your own schedule, choose how many children to coach, and can work from anywhere. We handle all the technology, curriculum, scheduling, and payment collection."
};
const STATIC_FAQ_TRAINING = {
  question: "What about training?",
  answer: "All new coaches go through our orientation program covering the Yestoryd methodology, platform tools, and child psychology basics. Ongoing support and resources are always available."
};
const STATIC_FAQ_JOINING_FEE = {
  question: "Is there a joining fee?",
  answer: "No. There's no deposit, no joining fee, and no upfront cost. We believe in removing barriers for talented coaches."
};
const STATIC_FAQ_TOOLS = {
  question: "What tools will I use?",
  answer: "Google Meet for sessions, our coach dashboard for tracking, WhatsApp for parent communication, and rAI for session preparation. All simple, no complex software."
};
const STATIC_FAQ_COMMITMENT = {
  question: "What's the commitment period?",
  answer: "We ask for a 1-month notice before leaving to ensure smooth transitions for children mid-program. Beyond that, you're free to adjust your involvement anytime."
};

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

// ── Product data from ?mode=all-products ──
interface TuitionData {
  lead_cost_percent: number;
  default_session_duration_minutes: number;
  guardrails: {
    individual: { min: number; max: number; warn_low: number; warn_high: number; midpoint: number };
    batch:      { min: number; max: number; warn_low: number; warn_high: number; midpoint: number };
  };
  tiers: Array<{
    name: string;
    display_name: string;
    coach_cost_percent: number;
    min_children_threshold: number;
    individual_per_session: number;
    batch_per_session: number;
  }>;
  payout_trigger: string;
}

interface WorkshopData {
  default_coach_percent: number;
  lead_cost_percent: number;
  example_class_size: number;
  example_per_child_fee: number;
  example_session_fee: number;
  example_coach_earnings: number;
}

// Tier visual config (client-side only — no business logic)
const TIER_VISUALS: Record<string, { color: string; borderColor: string; bgGradient: string; icon: typeof Sprout; exampleStudents: number }> = {
  rising:  { color: 'text-green-400',   borderColor: 'border-green-500/30',   bgGradient: 'from-green-500/20 to-green-500/5',       icon: Sprout, exampleStudents: 10 },
  expert:  { color: 'text-[#ffde00]',   borderColor: 'border-[#ffde00]/30',   bgGradient: 'from-[#ffde00]/20 to-[#ffde00]/5',       icon: Star,   exampleStudents: 15 },
  master:  { color: 'text-[#c847f4]',   borderColor: 'border-[#c847f4]/30',   bgGradient: 'from-[#c847f4]/20 to-[#c847f4]/5',       icon: Crown,  exampleStudents: 20 },
};
const DEFAULT_VISUAL = { color: 'text-[#00abff]', borderColor: 'border-[#00abff]/30', bgGradient: 'from-[#00abff]/20 to-[#00abff]/5', icon: Award, exampleStudents: 10 };

// Copy for the "Grow With Yestoryd" cards — descriptions pull dynamic min-children
// from fetched tiers; perks stay editorial (not worth a settings key).
const GROW_COPY: Record<string, { descFn: (min: number) => string; perk: string }> = {
  rising: { descFn: () => 'New coaches, early journey', perk: 'Full training, mentorship support' },
  expert: { descFn: (min) => `${min}+ children coached, strong results`, perk: 'Priority assignments, featured profile' },
  master: { descFn: (min) => `${min}+ children, exceptional impact`, perk: 'Train new coaches, leadership role' },
};

// Render fallback when tier data hasn't loaded yet (e.g. API error).
const GROW_FALLBACK = [
  { icon: Sprout, title: 'Rising Coach',  description: 'New coaches, early journey',       perk: 'Full training, mentorship support',    bgGradient: 'from-green-500/20 to-green-500/5', iconColor: 'text-green-400',     borderColor: 'border-green-500/30' },
  { icon: Star,   title: 'Expert Coach',  description: 'Experienced coaches, strong results',perk: 'Priority assignments, featured profile',bgGradient: 'from-[#ffde00]/20 to-[#ffde00]/5', iconColor: 'text-[#ffde00]',      borderColor: 'border-[#ffde00]/30' },
  { icon: Crown,  title: 'Master Coach',  description: 'Top coaches, exceptional impact',   perk: 'Train new coaches, leadership role',   bgGradient: 'from-[#c847f4]/20 to-[#c847f4]/5', iconColor: 'text-[#c847f4]',      borderColor: 'border-[#c847f4]/30' },
];

type ProductKey = 'coaching' | 'tuition' | 'workshop';

// Product tab visual tokens — match components/shared/RevenueCalculator.tsx
// (blue=tuition, purple=coaching, teal=workshop) for cross-portal consistency.
const PRODUCT_TABS: { key: ProductKey; label: string; activeBg: string; activeText: string; activeBorder: string; accentText: string; dot: string }[] = [
  { key: 'coaching', label: '1:1 Coaching',   activeBg: 'bg-purple-500/15', activeText: 'text-purple-300', activeBorder: 'border-purple-500/40', accentText: 'text-purple-400', dot: 'bg-purple-500' },
  { key: 'tuition',  label: 'English Classes', activeBg: 'bg-blue-500/15',   activeText: 'text-blue-300',   activeBorder: 'border-blue-500/40',   accentText: 'text-blue-400',   dot: 'bg-blue-500' },
  { key: 'workshop', label: 'Workshops',      activeBg: 'bg-teal-500/15',   activeText: 'text-teal-300',   activeBorder: 'border-teal-500/40',   accentText: 'text-teal-400',   dot: 'bg-teal-500' },
];

export default function YestorydAcademyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState<ProductKey>('coaching');
  const [selectedTier, setSelectedTier] = useState(0); // index into tiers
  const [childrenCount, setChildrenCount] = useState(10);
  const [includeReferral, setIncludeReferral] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  // Tuition calculator state
  const [tuitionSessionType, setTuitionSessionType] = useState<'batch' | 'individual'>('batch');
  const [tuitionHourlyRate, setTuitionHourlyRate] = useState(0);
  const [tuitionSessionsPerWeek, setTuitionSessionsPerWeek] = useState(4);
  const [selectedTuitionTier, setSelectedTuitionTier] = useState(0);

  // Workshop calculator state
  const [workshopClassSize, setWorkshopClassSize] = useState(8);
  const [workshopPerChildFee, setWorkshopPerChildFee] = useState(0);
  const [workshopSessionsPerMonth, setWorkshopSessionsPerMonth] = useState(4);

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
  const [tuitionData, setTuitionData] = useState<TuitionData | null>(null);
  const [workshopData, setWorkshopData] = useState<WorkshopData | null>(null);

  // Academy content from site_settings (category='academy'). Empty string = hide element.
  const [academyContent, setAcademyContent] = useState<Record<string, string>>({
    academy_badge_text: 'Yestoryd Academy',
    academy_batch_text: '',
    academy_batch_urgency: '',
    academy_hero_stat_1_value: '100+',
    academy_hero_stat_1_label: 'Families Helped',
    academy_hero_stat_2_value: '4.9★',
    academy_hero_stat_2_label: 'Parent Satisfaction',
    academy_hero_stat_3_value: 'AI-Powered',
    academy_hero_stat_3_label: 'Progress Tracking',
    academy_coach_time_commitment: '3-4 hours per child/month',
  });

  // Session durations from site_settings
  const durations = useSessionDurations();

  // Fetch video URL + academy content from site_settings
  useEffect(() => {
    async function fetchSiteSettings() {
      try {
        const [videoRes, academyRes] = await Promise.all([
          supabase.from('site_settings').select('value').eq('key', 'yestoryd_academy_video_url').single(),
          supabase.from('site_settings').select('key, value').eq('category', 'academy'),
        ]);

        if (videoRes.data?.value) {
          try {
            const parsed = JSON.parse(String(videoRes.data.value));
            if (parsed && typeof parsed === 'string' && parsed.startsWith('http')) {
              setVideoUrl(parsed);
            }
          } catch {
            // value was plain string, not JSON — ignore
          }
        }

        if (academyRes.data?.length) {
          const merged: Record<string, string> = {};
          for (const row of academyRes.data) {
            let v: unknown = row.value;
            if (typeof v === 'string') {
              try { v = JSON.parse(v); } catch { /* keep as-is */ }
            }
            merged[row.key] = typeof v === 'string' ? v : String(v ?? '');
          }
          setAcademyContent((prev) => ({ ...prev, ...merged }));
        }
      } catch (err) {
        console.error('[Academy] Failed to load site_settings:', err);
      }
    }
    fetchSiteSettings();
  }, []);

  // Fetch tier data from earnings-calculator API (single source of truth: payout-config.ts)
  useEffect(() => {
    async function fetchTiers() {
      try {
        const res = await fetch('/api/coach/earnings-calculator?mode=all-products&age_band=building');
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load earnings data');
        }

        const coachingPayload = data.coaching;

        setProgramPrice(coachingPayload.pricing.program_price);
        setReferralBonusPerStudent(coachingPayload.referral.bonus_per_enrollment);
        setReferralPercent(coachingPayload.referral.coach_referral_percent);
        setPayoutDay(data.payout_day);
        setSessionsPerWeek(coachingPayload.age_band.sessions_per_week);
        setCoachingSessions(coachingPayload.age_band.coaching_sessions);
        setSbSessions(coachingPayload.age_band.skill_building_sessions);
        setTuitionData(data.tuition);
        setWorkshopData(data.workshop);

        // Map API tier rates to display tiers (add visual config)
        const sessPerMonth = coachingPayload.age_band.sessions_per_week * 4;
        const sbPerMonth = coachingPayload.age_band.coaching_sessions > 0
          ? Math.round(coachingPayload.age_band.skill_building_sessions * sessPerMonth / coachingPayload.age_band.coaching_sessions)
          : 0;

        const computed: TierDisplay[] = coachingPayload.tiers.map((t: any) => {
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
        // Surfaced to Sentry via console.error (Next.js client error boundary captures).
        console.error('[Academy] Failed to load earnings data:', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/coach/earnings-calculator?mode=all-products&age_band=building',
        });
        setTiersError(true);
        setTiersLoading(false);
      }
    }
    fetchTiers();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Seed tuition/workshop slider defaults from fetched data (midpoint of guardrails)
  useEffect(() => {
    if (tuitionData && tuitionHourlyRate === 0) {
      setTuitionHourlyRate(tuitionData.guardrails.batch.midpoint);
    }
  }, [tuitionData, tuitionHourlyRate]);

  useEffect(() => {
    if (workshopData && workshopPerChildFee === 0) {
      setWorkshopPerChildFee(workshopData.example_per_child_fee);
    }
  }, [workshopData, workshopPerChildFee]);

  // Switching session type resets the slider to the new range's midpoint
  const handleSessionTypeChange = (type: 'batch' | 'individual') => {
    setTuitionSessionType(type);
    if (tuitionData) {
      setTuitionHourlyRate(tuitionData.guardrails[type].midpoint);
    }
  };

  // ── Calculators (all formulas mirror Calculator B outputs) ─────
  const calcCoachingMonthly = () => {
    const tier = tiers[selectedTier];
    if (!tier) return { sessions: 0, base: 0, referral: 0, total: 0, perSession: 0 };
    const sessionsPerStudent = Math.round(sessionsPerWeek * 4);
    const totalSessions = childrenCount * sessionsPerStudent;
    const base = totalSessions * tier.perSessionRate;
    const referral = includeReferral ? childrenCount * referralBonusPerStudent : 0;
    return { sessions: totalSessions, base, referral, total: base + referral, perSession: tier.perSessionRate };
  };

  const calcTuitionMonthly = () => {
    if (!tuitionData) return null;
    const tier = tuitionData.tiers[selectedTuitionTier];
    if (!tier) return null;
    const perSession = Math.round(tuitionHourlyRate * tier.coach_cost_percent / 100);
    const totalSessions = tuitionSessionsPerWeek * 4;
    return {
      perSession,
      totalSessions,
      total: perSession * totalSessions,
      sessionFee: tuitionHourlyRate,
      coachPercent: tier.coach_cost_percent,
    };
  };

  const calcWorkshopMonthly = () => {
    if (!workshopData) return null;
    const sessionFee = workshopClassSize * workshopPerChildFee;
    const perSession = Math.round(sessionFee * workshopData.default_coach_percent / 100);
    return {
      sessionFee,
      perSession,
      total: perSession * workshopSessionsPerMonth,
      totalSessions: workshopSessionsPerMonth,
    };
  };

  // Combined Potential — realistic middle-tier coach running all 3 products.
  // Numbers deliberately conservative: NOT max-slider; a believable target.
  const calcCombinedPotential = () => {
    if (tiers.length < 2 || !tuitionData || !workshopData) return null;
    const mid = tiers[Math.min(1, tiers.length - 1)]; // Expert (or highest available)
    const sessPerMonth = Math.round(sessionsPerWeek * 4);
    const sbPerMonth = coachingSessions > 0 ? Math.round(sbSessions * sessPerMonth / coachingSessions) : 0;
    const COACHING_STUDENTS = 8;
    const coachingMonthly = COACHING_STUDENTS * ((mid.perSessionRate * sessPerMonth) + (mid.sbRate * sbPerMonth));

    const tuitionTier = tuitionData.tiers.find((t) => t.name === mid.name) ?? tuitionData.tiers[0];
    const batchMid = tuitionData.guardrails.batch.midpoint;
    const perTuitionSession = Math.round(batchMid * tuitionTier.coach_cost_percent / 100);
    const TUITION_BATCHES = 2;
    const TUITION_SESSIONS_PER_WEEK = 4;
    const tuitionMonthly = TUITION_BATCHES * TUITION_SESSIONS_PER_WEEK * 4 * perTuitionSession;

    const WORKSHOPS_PER_MONTH = 1;
    const workshopMonthly = workshopData.example_coach_earnings * WORKSHOPS_PER_MONTH;

    return {
      tier: mid,
      coachingStudents: COACHING_STUDENTS,
      coachingMonthly,
      tuitionBatches: TUITION_BATCHES,
      tuitionSessionsPerWeek: TUITION_SESSIONS_PER_WEEK,
      tuitionMonthly,
      workshopsPerMonth: WORKSHOPS_PER_MONTH,
      workshopMonthly,
      total: coachingMonthly + tuitionMonthly + workshopMonthly,
    };
  };

  // Time commitment — pulls the "3-4 hours per child/month" phrase from site_settings
  const timeCommitmentPhrase = academyContent.academy_coach_time_commitment || '3-4 hours per child/month';
  const timeFaq = {
    question: "How much time do I need to commit?",
    answer: `Minimum 15-20 hours per month. Each child takes about ${timeCommitmentPhrase} (sessions spread over 12 weeks, tailored to age band). You can start with just 5 children and grow from there.`,
  };

  // Growth path — derived from live tier data so thresholds never go stale
  const growthFaq = tiers.length >= 3
    ? {
        question: "How do I grow as a coach?",
        answer: `Start as a ${tiers[0].displayName}, progress to ${tiers[1].displayName} (after ${tiers[1].minChildren}+ children with strong NPS), and eventually ${tiers[2].displayName} (${tiers[2].minChildren}+ children). Higher tiers get priority assignments, featured profiles, and leadership opportunities.`,
      }
    : {
        question: "How do I grow as a coach?",
        answer: `Progress through our tier system as you coach more children. Higher tiers unlock priority assignments, featured profiles, and leadership opportunities.`,
      };

  // Build FAQ data — only include pricing entries when tier data is loaded
  const earningsFaqEntries = tiers.length > 0 ? [
    {
      question: "How does the earnings model work?",
      answer: `You earn per session completed, not a percentage of the enrollment fee. As a ${tiers[0]?.displayName} coach, you earn ₹${tiers[0]?.perSessionRate.toLocaleString('en-IN')} per coaching session. As you progress to ${tiers[tiers.length - 1]?.displayName}, you earn ₹${tiers[tiers.length - 1]?.perSessionRate.toLocaleString('en-IN')} per coaching session. Skill building sessions pay 50% of your coaching rate. Payouts happen monthly on the ${payoutDay}${payoutDay === 1 ? 'st' : payoutDay === 2 ? 'nd' : payoutDay === 3 ? 'rd' : 'th'}.`,
    },
  ] : [];
  const referralFaqEntries = (tiers.length > 0 && referralBonusPerStudent > 0) ? [
    {
      question: "What if I bring my own students?",
      answer: `When you refer a student, you earn an additional ₹${referralBonusPerStudent.toLocaleString('en-IN')} referral bonus per enrollment on top of your per-session earnings. Even if you're at full capacity, you can refer students for other coaches and still earn the referral bonus.`,
    },
  ] : [];

  const faqData = [
    STATIC_FAQ_QUALIFICATIONS,
    timeFaq,
    ...earningsFaqEntries,
    STATIC_FAQ_PARTNERSHIP,
    STATIC_FAQ_TRAINING,
    ...referralFaqEntries,
    growthFaq,
    STATIC_FAQ_JOINING_FEE,
    STATIC_FAQ_TOOLS,
    STATIC_FAQ_COMMITMENT,
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
          {academyContent.academy_badge_text && (
            <div className="inline-flex items-center gap-2 bg-surface-1 border border-border rounded-full px-4 py-2 mb-8 shadow-md shadow-black/20">
              <GraduationCap className="w-5 h-5 text-[#ff0099]" />
              <span className="text-sm font-medium text-text-secondary">{academyContent.academy_badge_text}</span>
            </div>
          )}

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

          {/* URGENCY BADGE — hidden when academy_batch_text is empty */}
          {academyContent.academy_batch_text && (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-8">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">{academyContent.academy_batch_text}</span>
            </div>
          )}

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

          {/* Stats — each hidden when its _value is empty */}
          {(academyContent.academy_hero_stat_1_value || academyContent.academy_hero_stat_2_value || academyContent.academy_hero_stat_3_value) && (
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mb-12">
              {academyContent.academy_hero_stat_1_value && (
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white">{academyContent.academy_hero_stat_1_value}</div>
                  <div className="text-sm text-text-tertiary mt-1">{academyContent.academy_hero_stat_1_label}</div>
                </div>
              )}
              {academyContent.academy_hero_stat_2_value && (
                <div className="text-center border-x border-border">
                  <div className="text-3xl md:text-4xl font-bold text-white">{academyContent.academy_hero_stat_2_value}</div>
                  <div className="text-sm text-text-tertiary mt-1">{academyContent.academy_hero_stat_2_label}</div>
                </div>
              )}
              {academyContent.academy_hero_stat_3_value && (
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white">{academyContent.academy_hero_stat_3_value}</div>
                  <div className="text-sm text-text-tertiary mt-1">{academyContent.academy_hero_stat_3_label}</div>
                </div>
              )}
            </div>
          )}

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
                  {academyContent.academy_coach_time_commitment && (
                    <p className="text-sm text-text-tertiary">Just {academyContent.academy_coach_time_commitment}</p>
                  )}
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
            {(tiers.length > 0 ? tiers.map((t) => {
              const visual = TIER_VISUALS[t.name.toLowerCase()] ?? DEFAULT_VISUAL;
              const copy = GROW_COPY[t.name.toLowerCase()] ?? { descFn: () => 'Keep coaching to grow', perk: '' };
              return {
                icon: visual.icon,
                title: t.displayName,
                description: copy.descFn(t.minChildren),
                perk: copy.perk,
                bgGradient: visual.bgGradient,
                iconColor: visual.color,
                borderColor: visual.borderColor,
              };
            }) : GROW_FALLBACK).map((tier, i) => {
              const TierIcon = tier.icon;
              return (
                <div key={i} className={`bg-gradient-to-br ${tier.bgGradient} rounded-2xl p-6 border ${tier.borderColor}`}>
                  <div className="w-12 h-12 rounded-xl bg-surface-0/50 flex items-center justify-center mb-4">
                    <TierIcon className={`w-6 h-6 ${tier.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{tier.title}</h3>
                  <p className="text-sm text-text-tertiary mb-4">{tier.description}</p>
                  {tier.perk && <p className="text-sm text-[#ff0099]">{tier.perk}</p>}
                </div>
              );
            })}
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

          {/* Product Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {PRODUCT_TABS.map((tab) => {
              const isActive = activeProduct === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveProduct(tab.key)}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all min-h-[44px] border ${
                    isActive
                      ? `${tab.activeBg} ${tab.activeText} ${tab.activeBorder}`
                      : 'bg-surface-1 text-text-tertiary border-border hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ═══════════ COACHING PANEL ═══════════ */}
          {activeProduct === 'coaching' && (
            <>
              {/* Tier Progression Cards */}
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {tiers.map((tier, i) => {
                  const TierIcon = tier.icon;
                  const baseTotal = (coachingSessions * tier.perSessionRate) + (sbSessions * tier.sbRate);
                  const basePercent = programPrice > 0 ? Math.round(baseTotal / programPrice * 100) : 0;
                  const withReferralTotal = baseTotal + referralBonusPerStudent;
                  const withReferralPercent = programPrice > 0 ? Math.round(withReferralTotal / programPrice * 100) : 0;

                  return (
                    <div key={tier.name} className={`bg-gradient-to-br ${tier.bgGradient} rounded-2xl p-6 border ${tier.borderColor} relative`}>
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
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-tertiary">Yestoryd assigns</span>
                          <span className="text-white font-medium">{basePercent}% · ₹{baseTotal.toLocaleString('en-IN')}</span>
                        </div>
                        {referralBonusPerStudent > 0 && (
                          <div className="flex items-center justify-between text-sm bg-[#ffde00]/10 -mx-2 px-2 py-1.5 rounded-xl">
                            <span className="text-[#ffde00]">You bring student</span>
                            <span className="text-[#ffde00] font-bold">{withReferralPercent}% · ₹{withReferralTotal.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
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

              {/* Coaching Calculator */}
              <div className="bg-surface-1 rounded-2xl p-8 border border-border">
                <h3 className="text-xl font-bold text-white text-center mb-6">1:1 Coaching Calculator</h3>
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {tiers.map((tier, i) => {
                    const TierIcon = tier.icon;
                    return (
                      <button
                        key={tier.name}
                        onClick={() => setSelectedTier(i)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium transition-all min-h-[44px] ${
                          selectedTier === i ? 'bg-[#ff0099] text-white' : 'bg-surface-2 text-text-tertiary hover:bg-surface-0 border border-border'
                        }`}
                      >
                        <TierIcon className="w-4 h-4" />
                        {tier.displayName}
                      </button>
                    );
                  })}
                </div>
                <div className="text-center mb-6">
                  <label className="text-text-tertiary block mb-2">Children you coach:</label>
                  <div className="flex items-center justify-center gap-4">
                    <input
                      type="range" min="1" max="20" value={childrenCount}
                      onChange={(e) => setChildrenCount(parseInt(e.target.value))}
                      className="w-48 accent-[#ff0099]"
                    />
                    <span className="text-2xl font-bold text-white w-12">{childrenCount}</span>
                  </div>
                </div>
                {referralBonusPerStudent > 0 && (
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <button
                      onClick={() => setIncludeReferral(!includeReferral)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${includeReferral ? 'bg-[#ff0099]' : 'bg-surface-2'}`}
                      aria-label="Toggle referral bonus"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${includeReferral ? 'translate-x-5' : ''}`} />
                    </button>
                    <span className="text-sm text-text-secondary">Include referral bonus (you bring students)</span>
                  </div>
                )}
                {(() => {
                  const calc = calcCoachingMonthly();
                  return (
                    <div className="text-center">
                      <p className="text-text-tertiary mb-2">Monthly earnings potential</p>
                      <div className="text-4xl md:text-5xl font-bold text-white">₹{calc.total.toLocaleString('en-IN')}</div>
                      <div className="flex items-center justify-center gap-4 mt-3 text-sm text-text-tertiary">
                        <span>₹{calc.perSession.toLocaleString('en-IN')}/session</span>
                        <span className="text-border">|</span>
                        <span>~{calc.sessions} sessions/month</span>
                      </div>
                      {includeReferral && calc.referral > 0 && (
                        <p className="text-sm text-[#ffde00] mt-2">Includes ₹{calc.referral.toLocaleString('en-IN')} referral bonuses</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-4">Annual potential: ₹{(calc.total * 12).toLocaleString('en-IN')}</p>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ═══════════ TUITION (ENGLISH CLASSES) PANEL ═══════════ */}
          {activeProduct === 'tuition' && tuitionData && (
            <>
              <div className="bg-gradient-to-br from-blue-500/10 to-surface-1 rounded-2xl p-6 border border-blue-500/20 mb-6 text-center">
                <p className="text-sm text-blue-400 font-medium mb-1">Higher per-session rate than coaching</p>
                <p className="text-xs text-text-tertiary">
                  Tuition coaches keep {tuitionData.tiers[0].coach_cost_percent}–{tuitionData.tiers[tuitionData.tiers.length - 1].coach_cost_percent}% of each session fee — paid per session.
                </p>
              </div>

              {/* Tuition tier cards */}
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {tuitionData.tiers.map((t) => {
                  const visual = TIER_VISUALS[t.name.toLowerCase()] ?? DEFAULT_VISUAL;
                  const TierIcon = visual.icon;
                  return (
                    <div key={t.name} className={`bg-gradient-to-br ${visual.bgGradient} rounded-2xl p-6 border ${visual.borderColor}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-0/50 flex items-center justify-center">
                          <TierIcon className={`w-5 h-5 ${visual.color}`} />
                        </div>
                        <div>
                          <h3 className={`font-bold ${visual.color}`}>{t.display_name}</h3>
                          <p className="text-xs text-text-tertiary">{t.coach_cost_percent}% coach share</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Batch session</span>
                          <span className="text-white font-medium">₹{t.batch_per_session.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">1:1 session</span>
                          <span className="text-white font-medium">₹{t.individual_per_session.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-xs text-text-tertiary mb-10">
                Batch samples at ₹{tuitionData.guardrails.batch.midpoint}/hr · 1:1 samples at ₹{tuitionData.guardrails.individual.midpoint}/hr · 60-min sessions
              </p>

              {/* Tuition Calculator */}
              <div className="bg-surface-1 rounded-2xl p-8 border border-border">
                <h3 className="text-xl font-bold text-white text-center mb-6">English Classes Calculator</h3>

                {/* Session type toggle */}
                <div className="flex justify-center gap-2 mb-6">
                  {(['batch', 'individual'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleSessionTypeChange(t)}
                      className={`px-5 py-2 rounded-xl font-medium text-sm transition-all min-h-[44px] border ${
                        tuitionSessionType === t
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-surface-2 text-text-tertiary border-border hover:text-white'
                      }`}
                    >
                      {t === 'batch' ? 'Batch (2+ students)' : '1:1 (individual)'}
                    </button>
                  ))}
                </div>

                {/* Tier selector */}
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {tuitionData.tiers.map((t, i) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTuitionTier(i)}
                      className={`px-4 py-2 rounded-xl font-medium text-sm transition-all min-h-[44px] ${
                        selectedTuitionTier === i
                          ? 'bg-blue-500 text-white'
                          : 'bg-surface-2 text-text-tertiary hover:bg-surface-0 border border-border'
                      }`}
                    >
                      {t.display_name} · {t.coach_cost_percent}%
                    </button>
                  ))}
                </div>

                {/* Hourly rate slider */}
                <div className="mb-6">
                  <label className="text-text-tertiary text-sm flex items-center justify-between mb-2">
                    <span>Hourly rate you charge:</span>
                    <span className="text-white font-bold text-lg">₹{tuitionHourlyRate.toLocaleString('en-IN')}/hr</span>
                  </label>
                  <input
                    type="range"
                    min={tuitionData.guardrails[tuitionSessionType].min}
                    max={tuitionData.guardrails[tuitionSessionType].max}
                    step="10"
                    value={tuitionHourlyRate || tuitionData.guardrails[tuitionSessionType].midpoint}
                    onChange={(e) => setTuitionHourlyRate(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-text-tertiary mt-1">
                    <span>₹{tuitionData.guardrails[tuitionSessionType].min}</span>
                    <span>Typical: ₹{tuitionData.guardrails[tuitionSessionType].warn_low}–{tuitionData.guardrails[tuitionSessionType].warn_high}</span>
                    <span>₹{tuitionData.guardrails[tuitionSessionType].max}</span>
                  </div>
                </div>

                {/* Sessions/week slider */}
                <div className="text-center mb-6">
                  <label className="text-text-tertiary block mb-2">Sessions per week:</label>
                  <div className="flex items-center justify-center gap-4">
                    <input
                      type="range" min="1" max="10" value={tuitionSessionsPerWeek}
                      onChange={(e) => setTuitionSessionsPerWeek(parseInt(e.target.value))}
                      className="w-48 accent-blue-500"
                    />
                    <span className="text-2xl font-bold text-white w-12">{tuitionSessionsPerWeek}</span>
                  </div>
                </div>

                {(() => {
                  const calc = calcTuitionMonthly();
                  if (!calc) return null;
                  return (
                    <div className="text-center">
                      <p className="text-text-tertiary mb-2">Monthly earnings potential</p>
                      <div className="text-4xl md:text-5xl font-bold text-white">₹{calc.total.toLocaleString('en-IN')}</div>
                      <div className="flex items-center justify-center gap-4 mt-3 text-sm text-text-tertiary">
                        <span>₹{calc.perSession.toLocaleString('en-IN')}/session</span>
                        <span className="text-border">|</span>
                        <span>~{calc.totalSessions} sessions/month</span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-4">Annual potential: ₹{(calc.total * 12).toLocaleString('en-IN')}</p>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ═══════════ WORKSHOP PANEL ═══════════ */}
          {activeProduct === 'workshop' && workshopData && (
            <>
              <div className="bg-gradient-to-br from-teal-500/10 to-surface-1 rounded-2xl p-6 border border-teal-500/20 mb-6 text-center">
                <p className="text-sm text-teal-400 font-medium mb-1">Group format — teach multiple children at once</p>
                <p className="text-xs text-text-tertiary">
                  Workshops pay a flat {workshopData.default_coach_percent}% of the session fee. Simple, fast, predictable.
                </p>
              </div>

              {/* Workshop sample card */}
              <div className="bg-gradient-to-br from-teal-500/10 to-teal-500/5 rounded-2xl p-6 border border-teal-500/20 mb-10">
                <h3 className="text-white font-bold mb-4">Sample workshop</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Class size</span>
                    <span className="text-white font-medium">{workshopData.example_class_size} children</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Per-child fee</span>
                    <span className="text-white font-medium">₹{workshopData.example_per_child_fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Session fee</span>
                    <span className="text-white font-medium">₹{workshopData.example_session_fee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Coach share</span>
                    <span className="text-teal-400 font-bold">₹{workshopData.example_coach_earnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Workshop Calculator */}
              <div className="bg-surface-1 rounded-2xl p-8 border border-border">
                <h3 className="text-xl font-bold text-white text-center mb-6">Workshop Calculator</h3>

                <div className="space-y-6 mb-6">
                  <div>
                    <label className="text-text-tertiary text-sm flex items-center justify-between mb-2">
                      <span>Class size:</span>
                      <span className="text-white font-bold">{workshopClassSize} children</span>
                    </label>
                    <input
                      type="range" min="4" max="20" value={workshopClassSize}
                      onChange={(e) => setWorkshopClassSize(parseInt(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-text-tertiary text-sm flex items-center justify-between mb-2">
                      <span>Per-child fee:</span>
                      <span className="text-white font-bold">₹{workshopPerChildFee}</span>
                    </label>
                    <input
                      type="range"
                      min={tuitionData?.guardrails.batch.min ?? 100}
                      max={tuitionData?.guardrails.batch.max ?? 500}
                      step="10"
                      value={workshopPerChildFee || workshopData.example_per_child_fee}
                      onChange={(e) => setWorkshopPerChildFee(parseInt(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-text-tertiary text-sm flex items-center justify-between mb-2">
                      <span>Workshops per month:</span>
                      <span className="text-white font-bold">{workshopSessionsPerMonth}</span>
                    </label>
                    <input
                      type="range" min="1" max="12" value={workshopSessionsPerMonth}
                      onChange={(e) => setWorkshopSessionsPerMonth(parseInt(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                  </div>
                </div>

                {(() => {
                  const calc = calcWorkshopMonthly();
                  if (!calc) return null;
                  return (
                    <div className="text-center">
                      <p className="text-text-tertiary mb-2">Monthly earnings potential</p>
                      <div className="text-4xl md:text-5xl font-bold text-white">₹{calc.total.toLocaleString('en-IN')}</div>
                      <div className="flex items-center justify-center gap-4 mt-3 text-sm text-text-tertiary">
                        <span>₹{calc.perSession.toLocaleString('en-IN')}/workshop</span>
                        <span className="text-border">|</span>
                        <span>₹{calc.sessionFee.toLocaleString('en-IN')} session fee</span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-4">Annual potential: ₹{(calc.total * 12).toLocaleString('en-IN')}</p>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ═══════════ COMBINED POTENTIAL ═══════════ */}
          {(() => {
            const combined = calcCombinedPotential();
            if (!combined) return null;
            return (
              <div className="mt-10 bg-gradient-to-br from-[#ff0099]/10 via-surface-1 to-[#7b008b]/10 rounded-2xl p-8 border border-[#ff0099]/30">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 bg-[#ff0099]/15 text-[#ff0099] rounded-full px-3 py-1 mb-3 text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    YOUR TOTAL POTENTIAL
                  </div>
                  <p className="text-text-secondary text-sm max-w-lg mx-auto">
                    A realistic month for a {combined.tier.displayName} running all three products
                  </p>
                </div>

                <div className="space-y-2 max-w-xl mx-auto mb-6">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm text-text-secondary">{combined.coachingStudents} coaching students</span>
                    </div>
                    <span className="text-white font-medium">₹{combined.coachingMonthly.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm text-text-secondary">{combined.tuitionBatches} English batches · {combined.tuitionSessionsPerWeek} sessions/week each</span>
                    </div>
                    <span className="text-white font-medium">₹{combined.tuitionMonthly.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-sm text-text-secondary">{combined.workshopsPerMonth} workshop/month</span>
                    </div>
                    <span className="text-white font-medium">₹{combined.workshopMonthly.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-[#ff0099]/20">
                  <p className="text-xs text-text-tertiary mb-1">Realistic monthly total</p>
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#ff0099] to-[#7b008b] bg-clip-text text-transparent">
                    ₹{combined.total.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    ~₹{(combined.total * 12).toLocaleString('en-IN')}/year · not maxing out any product
                  </p>
                </div>
              </div>
            );
          })()}

          <p className="text-center text-xs text-text-tertiary mt-6">
            Payouts processed monthly on the {payoutDay}
            {payoutDay === 1 ? 'st' : payoutDay === 2 ? 'nd' : payoutDay === 3 ? 'rd' : 'th'} via UPI transfer.
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

          {/* Urgency reminder — hidden when academy_batch_urgency is empty */}
          {academyContent.academy_batch_urgency && (
            <p className="text-white/60 text-sm mb-8 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              {academyContent.academy_batch_urgency}
            </p>
          )}

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
