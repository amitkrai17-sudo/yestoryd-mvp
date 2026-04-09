'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Video,
  Zap,
  Gamepad2,
  BarChart3,
  MessageCircle,
  ArrowRight,
  ChevronDown,
  Star,
} from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import {
  TransformationSection,
  ArcSection,
  JourneySection,
} from '@/app/(home)/_components';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CoachingPageClientProps {
  coachingOriginalPrice: number;
  coachingDiscountedPrice: number;
}

// ---------------------------------------------------------------------------
// Static content (TODO: move to site_settings when content management
// for /coaching page is formalized — currently hardcoded as fallback)
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    Icon: UserCheck,
    title: 'Dedicated personal coach',
    desc: "Same coach every session. They know your child's strengths, struggles, and learning pace.",
    accent: { text: 'text-[#FF0099]', bg: 'bg-[#FF0099]/10' },
  },
  {
    Icon: Video,
    title: 'AI-recorded sessions',
    desc: 'Every online session recorded and analyzed by Gemini AI. Nothing is missed.',
    accent: { text: 'text-sky-400', bg: 'bg-sky-400/10' },
  },
  {
    Icon: Zap,
    title: 'SmartPractice',
    desc: 'AI-generated daily homework that adapts to exactly what your child needs. Gamified so they actually do it.',
    accent: { text: 'text-amber-400', bg: 'bg-amber-400/10' },
  },
  {
    Icon: Gamepad2,
    title: 'E-learning games',
    desc: 'Interactive modules covering phonics, vocabulary, comprehension. Progress tracked automatically.',
    accent: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  },
  {
    Icon: BarChart3,
    title: 'Reading assessments',
    desc: "Every 4th session includes a reading test. Shareable progress cards you'll want to show family.",
    accent: { text: 'text-purple-400', bg: 'bg-purple-400/10' },
  },
  {
    Icon: MessageCircle,
    title: 'rAI Chat',
    desc: "Ask anything about your child's progress anytime. Answers based on real session data, not guesses.",
    accent: { text: 'text-rose-400', bg: 'bg-rose-400/10' },
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    num: '1',
    title: 'Free AI reading test',
    desc: '5 minutes. Our AI identifies exactly where your child stands \u2014 phonics gaps, fluency level, comprehension.',
  },
  {
    num: '2',
    title: 'Discovery call',
    desc: 'Talk to a coach. Understand the plan. No pressure, no commitment.',
  },
  {
    num: '3',
    title: 'Start your season',
    desc: '90 days of personalized coaching. Sessions scheduled around your life. AI tracks every detail.',
  },
  {
    num: '4',
    title: 'See the transformation',
    desc: 'Progress cards, reading test improvements, a child who picks up books on their own.',
  },
] as const;

// TODO: move testimonials to site_settings/DB when content management for
// /coaching page is formalized. Currently hardcoded display values.
const TESTIMONIALS = [
  {
    quote:
      'Finally understood WHY my son struggled. The AI found gaps we never knew existed. In 3 months, his reading score went from 4/10 to 8/10.',
    name: 'Priya S.',
    location: 'Mumbai',
    child: 'Aarav, age 6',
  },
  {
    quote:
      'My daughter now picks up books on her own. She went from avoiding reading completely to asking "Can I read more?" Her fluency improved 2x.',
    name: 'Rahul G.',
    location: 'Delhi',
    child: 'Ananya, age 7',
  },
  {
    quote:
      'Ishaan was 2 grades behind in reading. After 3 months, his teacher asked what changed. Speed improved from 15 WPM to 40 WPM.',
    name: 'Meera K.',
    location: 'Pune',
    child: 'Ishaan, age 8',
  },
] as const;

const FAQS = [
  {
    q: 'How is this different from tuition?',
    a: 'Tuition teaches. Coaching transforms. Your child gets a dedicated coach, AI that tracks every session, SmartPractice homework that adapts daily, and a complete intelligence profile. It\u2019s the difference between practice and personalized development.',
  },
  {
    q: 'What if my child is shy or reluctant?',
    a: 'Most children are nervous for the first session. Our coaches are trained to build rapport. By session 3, most kids look forward to their coaching time.',
  },
  {
    q: 'How long until I see results?',
    a: 'Most parents notice changes within the first season (90 days). Our reading tests every 4th session give you concrete progress data.',
  },
  {
    q: 'Can we do offline/in-person sessions?',
    a: 'Yes. We support both online and offline coaching. Online sessions get AI recording and analysis. Offline sessions use our structured capture system for intelligence gathering.',
  },
  {
    q: 'What happens after one season?',
    a: 'Your coach recommends whether to continue, adjust focus, or graduate. Some children need 3 seasons, others 6. Every journey is personalized.',
  },
  {
    q: 'Is there a refund policy?',
    a: 'Yes. If your child completes all sessions and you don\u2019t see improvement, we offer a full refund. We believe in our method.',
  },
] as const;

const WA_LINK = `https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}?text=${encodeURIComponent(
  "Hi I'd like to learn more about 1:1 Coaching",
)}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoachingPageClient({
  coachingOriginalPrice,
  coachingDiscountedPrice,
}: CoachingPageClientProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const discountPercent = Math.round(
    (1 - coachingDiscountedPrice / coachingOriginalPrice) * 100,
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      <main>
        {/* ── Section 1: Hero ── */}
        <section className="pt-16 pb-14 px-4 sm:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-block bg-[#FF0099]/10 text-[#FF0099] text-xs font-semibold rounded-full px-3 py-1 mb-6">
              Personalized 1:1
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
              Your child&apos;s{' '}
              <span className="text-[#FF0099]">English transformation</span>{' '}
              starts here
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-8">
              A dedicated coach + AI intelligence working together. Every
              session recorded, analyzed, and personalized. Most children see
              measurable progress within one season.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/assessment"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors w-full sm:w-auto"
              >
                Start with free AI reading test
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-semibold text-sm transition-colors w-full sm:w-auto"
              >
                Compare all products
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Section 2: Transformation grid (reused) ── */}
        <section className="pb-16 px-4 sm:px-6">
          <TransformationSection
            header="The 90-Day Transformation"
            beforeItems={['"I hate reading"', 'Avoids books', 'Reads slowly', 'Losing confidence']}
            afterItems={['"Can I read more?"', 'Picks up books', 'Reads fluently', 'Speaks confidently']}
            tagline="rAI finds the gaps • Coach fills them • You see progress"
          />
        </section>

        {/* ── Section 3: What's included (feature grid) ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Everything that makes coaching different
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${feat.accent.bg}`}>
                    <feat.Icon className={`w-5 h-5 ${feat.accent.text}`} />
                  </div>
                  <h3 className="text-white font-semibold text-base mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: ARC method (reused) ── */}
        <ArcSection
          badge="THE YESTORYD ARC™"
          title="Your Child's 90-Day Transformation"
          subtitle="A clear path from struggling reader to confident communicator"
          phases={{
            assess: {
              letter: 'A',
              weeks: 'Week 1-4',
              title: 'Assess',
              subtitle: 'Foundation Arc',
              description:
                'AI listens to your child read and identifies exact gaps in 40+ sound patterns.',
              features: ['5-minute AI assessment', 'Detailed gap report', 'Personalized learning path'],
              icon: 'brain',
              color: '#00ABFF',
            },
            remediate: {
              letter: 'R',
              weeks: 'Week 5-8',
              title: 'Remediate',
              subtitle: 'Building Arc',
              description:
                'Expert coaches fill gaps with personalized 1:1 sessions covering phonics, grammar, comprehension, and vocabulary — tailored for ages 4-12.',
              features: ['9-18 coaching sessions (1:1)', 'Practice activities at home', 'Weekly WhatsApp updates'],
              icon: 'heart',
              color: '#FF0099',
            },
            celebrate: {
              letter: 'C',
              weeks: 'Week 9-12',
              title: 'Celebrate',
              subtitle: 'Confidence Arc',
              description:
                'Your child reads with confidence. Measurable improvement you can see.',
              features: ['Before/after comparison', 'Progress certificate', 'Continuation roadmap'],
              icon: 'award',
              color: '#c44dff',
            },
          }}
          promise={{
            title: 'The 90-Day Promise',
            description: 'In 90 days, your child reads more fluently.',
            badges: ['Measurable Growth', '100% Refund Guarantee', 'Full Transparency'],
          }}
          trustStats={{
            assessmentTime: '5 min',
            coachingType: '1:1',
            transformationDays: '90 days',
            happyParents: '100+',
          }}
          onCTAClick={() => {}}
        />

        {/* ── Section 5: Journey (reused) ── */}
        <JourneySection
          badge="The Complete Journey"
          title="From Reading Mastery to English Confidence"
          subtitle="Reading is the foundation. Everything else builds on top."
          steps={[]}
          insightText="In 90 days, your child masters reading fluency."
          insightDetail="This becomes the foundation for grammar, comprehension, writing, and eventually — confident English communication."
        />

        {/* ── Section 6: How coaching works ── */}
        <section className="py-16 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-10">
              From first test to confident reader
            </h2>
            <div className="relative pl-10">
              <div className="absolute left-4 top-1 bottom-1 w-px bg-[#FF0099]/20" />
              <div className="space-y-8">
                {HOW_IT_WORKS_STEPS.map((step) => (
                  <div key={step.num} className="relative">
                    <div className="absolute -left-10 top-0 w-8 h-8 rounded-full bg-[#FF0099]/10 border border-[#FF0099]/30 flex items-center justify-center">
                      <span className="text-[#FF0099] text-sm font-bold">{step.num}</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                    <p className="text-gray-400 text-sm">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 7: Pricing — age bands ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-3">
              One price. Tailored to every age.
            </h2>

            {/* Headline price block */}
            <div className="text-center mb-10">
              <div className="inline-flex items-baseline flex-wrap gap-x-2 justify-center">
                <span className="text-gray-500 line-through text-xl">
                  &#8377;{coachingOriginalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-[#FF0099] text-4xl font-bold">
                  <span className="text-2xl font-normal text-gray-400">&#8377;</span>
                  {coachingDiscountedPrice.toLocaleString('en-IN')}
                </span>
                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {discountPercent}% off
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1">/ season (90 days)</p>
            </div>

            {/* Age bands */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-5">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Foundation
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 4-6</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>30 min sessions</li>
                  <li>18 coaching + 6 boosters</li>
                  <li>~2 sessions / week</li>
                </ul>
              </div>
              <div className="bg-purple-400/10 border border-purple-400/20 rounded-2xl p-5">
                <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Building
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 7-9</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>45 min sessions</li>
                  <li>12 coaching + 4 boosters</li>
                  <li>~1 session / week</li>
                </ul>
              </div>
              <div className="bg-rose-400/10 border border-rose-400/20 rounded-2xl p-5">
                <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mastery
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 10-12</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>60 min sessions</li>
                  <li>9 coaching + 3 boosters</li>
                  <li>~3 sessions / month</li>
                </ul>
              </div>
            </div>

            <p className="text-gray-400 text-sm text-center mb-6">
              Same price. Same total hours. Different intensity &mdash; matched
              to how your child learns best.
            </p>

            <div className="text-center">
              <Link
                href="/assessment"
                className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors"
              >
                Start with free AI reading test
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Section 8: Testimonials ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Parents see the difference
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 flex flex-col"
                >
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4 flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.location} &middot; {t.child}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 9: FAQ ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Common questions about coaching
            </h2>
            <div className="space-y-2">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="text-white text-sm font-medium pr-4">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <p className="text-gray-400 text-sm">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 10: Footer CTA ── */}
        <section className="pb-20 px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-3">
            Ready to start?
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Take the free AI reading test. In 5 minutes, you&apos;ll know
            exactly where your child stands &mdash; and we&apos;ll build a plan
            to get them reading with confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/assessment"
              className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors"
            >
              Free AI reading test
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-semibold text-sm transition-colors"
            >
              Talk to us on WhatsApp
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
