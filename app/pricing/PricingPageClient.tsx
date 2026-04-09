'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Sparkles,
  Check,
  Minus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Zap,
  Star,
} from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

// ---------------------------------------------------------------------------
// Product card data
// ---------------------------------------------------------------------------

const PRODUCTS = [
  {
    key: 'workshops',
    name: 'Workshops',
    Icon: Users,
    accent: 'amber',
    pills: ['Group event', '8-15 kids', 'Drop-in'],
    price: '199 \u2013 399',
    priceUnit: '/ session',
    note: 'No commitment. Join anytime.',
    features: [
      'Storytelling, phonics, creative writing',
      'Age-grouped (4-6, 7-9, 10-12)',
      'AI micro-insight after each session',
      'Access to book library',
      'Workshop completion badges',
    ],
    missing: [
      'No regular schedule',
      'No dedicated coach',
      'No homework tracking',
    ],
    cta: { label: 'Browse workshops', href: '/classes', variant: 'ghost' as const },
    featured: false,
  },
  {
    key: 'classes',
    name: 'English Classes',
    Icon: BookOpen,
    accent: 'sky',
    pills: ['Group or 1:1', 'Weekly schedule', 'Prepaid packs'],
    price: '199 \u2013 399',
    priceUnit: '/ session',
    note: '45-120 min sessions. Buy packs, auto-reminder when low.',
    features: [
      'Grammar, olympiad, creative writing, phonics',
      'Assigned coach',
      'Activity calendar + homework',
      'AI artifact feedback',
      'Parent check-ins',
      'rAI Chat',
      'Reading assessment',
    ],
    missing: ['No AI-recorded sessions', 'No SmartPractice'],
    cta: { label: 'Enquire now', href: '/english-classes', variant: 'secondary' as const },
    featured: false,
  },
  {
    key: 'coaching',
    name: '1:1 Coaching',
    Icon: Sparkles,
    accent: 'pink',
    pills: ['Personalized 1:1', 'Season-based', 'AI-powered'],
    price: '6,999',
    priceUnit: '/ season (90 days)',
    note: '3 to 6 seasons to graduate. Every journey is unique.',
    features: [
      'Everything in Classes, plus:',
      'Dedicated personal coach',
      'AI-recorded sessions (Recall.ai)',
      'SmartPractice (AI daily homework)',
      'E-learning games',
      'Reading tests + shareable cards',
      'Full intelligence profile',
      'Skill boosters on-demand',
      'All workshops FREE forever',
    ],
    missing: [] as string[],
    cta: { label: 'Start with free AI reading test', href: '/assessment', variant: 'primary' as const },
    featured: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Comparison accordion data
// ---------------------------------------------------------------------------

interface CompareRow {
  label: string;
  workshops: string;
  classes: string;
  coaching: string;
}

interface CompareSection {
  title: string;
  rows: CompareRow[];
}

const COMPARE_SECTIONS: CompareSection[] = [
  {
    title: 'What makes each tier different',
    rows: [
      { label: 'Session type', workshops: 'Group event', classes: 'Group or Individual', coaching: '1:1 only' },
      { label: 'Coach', workshops: 'Rotating instructor', classes: 'Assigned coach', coaching: 'Dedicated personal coach' },
      { label: 'Schedule', workshops: 'Drop-in events', classes: 'Weekly schedule', coaching: 'Per age band' },
      { label: 'Duration', workshops: '45 min', classes: '45-120 min', coaching: '30/45/60 min by age' },
      { label: 'Commitment', workshops: 'None', classes: 'Prepaid session pack', coaching: 'Season (90 days)' },
    ],
  },
  {
    title: 'Parent experience',
    rows: [
      { label: 'Post-session insight', workshops: 'Micro-insight', classes: 'Session summary', coaching: 'Detailed AI analysis' },
      { label: 'Homework tracking', workshops: '\u2014', classes: 'Upload + AI feedback', coaching: 'SmartPractice (AI daily)' },
      { label: 'Progress reports', workshops: '\u2014', classes: 'Periodic snapshots', coaching: 'Continuous + shareable cards' },
      { label: 'rAI Chat', workshops: '\u2014', classes: '\u2713', coaching: '\u2713' },
      { label: 'Parent check-ins', workshops: '\u2014', classes: '\u2713', coaching: '\u2713' },
      { label: 'WhatsApp updates', workshops: 'Confirmation only', classes: 'Session + balance alerts', coaching: '82-touchpoint automation' },
    ],
  },
  {
    title: 'AI intelligence depth',
    rows: [
      { label: 'AI learning profile', workshops: 'Basic', classes: 'Moderate', coaching: 'Deep (full flywheel)' },
      { label: 'Session recording', workshops: '\u2014', classes: '\u2014', coaching: 'Every online session' },
      { label: 'SmartPractice', workshops: '\u2014', classes: '\u2014', coaching: 'Gamified, adaptive' },
      { label: 'E-learning games', workshops: '\u2014', classes: '\u2014', coaching: 'Full access' },
      { label: 'Reading tests', workshops: '\u2014', classes: '\u2713', coaching: 'Every 4th session' },
    ],
  },
  {
    title: 'Extras',
    rows: [
      { label: 'Book library', workshops: '\u2713', classes: '\u2713', coaching: '\u2713' },
      { label: 'Badges', workshops: 'Workshop badges', classes: '\u2014', coaching: 'Full gamification' },
      { label: 'Certificates', workshops: 'Per series', classes: '\u2014', coaching: 'Season certificate' },
      { label: 'Skill boosters', workshops: '\u2014', classes: '\u2014', coaching: 'On-demand' },
      { label: 'Workshops free', workshops: '\u2014', classes: '\u2014', coaching: 'Included' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Accent helpers
// ---------------------------------------------------------------------------

const ACCENT = {
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    pill: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  },
  sky: {
    text: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
    pill: 'bg-sky-400/10 text-sky-400 border border-sky-400/20',
  },
  pink: {
    text: 'text-[#FF0099]',
    bg: 'bg-[#FF0099]/10',
    border: 'border-[#FF0099]/20',
    pill: 'bg-[#FF0099]/10 text-[#FF0099] border border-[#FF0099]/20',
  },
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompareCell({ value }: { value: string }) {
  if (value === '\u2713') {
    return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  }
  if (value === '\u2014') {
    return <Minus className="w-4 h-4 text-gray-600 mx-auto" />;
  }
  return <span className="text-gray-300">{value}</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PricingPageClient() {
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 0: true });

  function toggleSection(idx: number) {
    setOpenSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      <main>
        {/* ── Section 1: Hero ── */}
        <section className="pt-16 pb-12 px-4 sm:px-6 text-center">
          <span className="inline-block bg-[#FF0099]/10 text-[#FF0099] text-xs font-semibold rounded-full px-3 py-1 mb-6">
            Choose your path
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display max-w-3xl mx-auto mb-4">
            Every child&apos;s{' '}
            <span className="text-[#FF0099]">English journey</span>{' '}
            is different
          </h1>
          <p className="text-gray-400 text-lg max-w-lg mx-auto">
            From fun group workshops to deep 1:1 AI coaching.
            Pick what fits your child today — upgrade anytime.
          </p>
        </section>

        {/* ── Section 2: Journey pills ── */}
        <section className="pb-12 px-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <span className={`${ACCENT.amber.pill} text-sm font-medium rounded-full px-3 py-1`}>
              Explore
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 hidden sm:block" />
            <span className={`${ACCENT.sky.pill} text-sm font-medium rounded-full px-3 py-1`}>
              Learn
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 hidden sm:block" />
            <span className={`${ACCENT.pink.pill} text-sm font-medium rounded-full px-3 py-1`}>
              Transform
            </span>
          </div>
          <p className="text-center text-gray-500 text-sm italic mt-3">
            Most families start with a workshop, then move to classes or coaching.
          </p>
        </section>

        {/* ── Section 3: Product cards ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            {/* Mobile: horizontal scroll. Desktop: 3-col grid */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
              {PRODUCTS.map((product) => {
                const a = ACCENT[product.accent];
                return (
                  <div
                    key={product.key}
                    className={`relative min-w-[280px] flex-1 snap-start flex flex-col rounded-2xl border p-6 ${
                      product.featured
                        ? 'border-[#FF0099]/30 bg-gray-900/80'
                        : 'border-gray-800 bg-gray-900/50'
                    }`}
                  >
                    {/* Featured badge */}
                    {product.featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF0099] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        Most popular
                      </span>
                    )}

                    {/* Icon + name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.bg}`}>
                        <product.Icon className={`w-5 h-5 ${a.text}`} />
                      </div>
                      <h3 className="text-lg font-bold text-white">{product.name}</h3>
                    </div>

                    {/* Pills */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {product.pills.map((pill) => (
                        <span key={pill} className={`${a.pill} text-xs rounded-full px-2.5 py-0.5`}>
                          {pill}
                        </span>
                      ))}
                    </div>

                    {/* Price */}
                    <div className="mb-1">
                      <span className="text-2xl font-bold text-white">
                        <span className="text-lg font-normal text-gray-400">&#8377;</span>
                        {product.price}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">{product.priceUnit}</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-5">{product.note}</p>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-5 flex-1">
                      {product.features.map((f) => {
                        const isEverything = f.startsWith('Everything in');
                        return (
                          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                            {isEverything ? (
                              <Star className="w-4 h-4 text-[#FF0099] mt-0.5 flex-shrink-0" />
                            ) : (
                              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={isEverything ? 'text-[#FF0099] font-medium' : ''}>
                              {f}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Missing */}
                    {product.missing.length > 0 && (
                      <ul className="space-y-2 mb-5">
                        {product.missing.map((m) => (
                          <li key={m} className="flex items-start gap-2 text-sm text-gray-500">
                            <Minus className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {m}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* CTA */}
                    <Link
                      href={product.cta.href}
                      className={`mt-auto flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors ${
                        product.cta.variant === 'primary'
                          ? 'bg-[#FF0099] hover:bg-[#FF0099]/90 text-white'
                          : product.cta.variant === 'secondary'
                            ? 'border border-gray-700 text-gray-300 hover:bg-gray-800'
                            : 'border border-gray-800 text-gray-400 hover:bg-gray-800/50'
                      }`}
                    >
                      {product.cta.label}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 4: Upgrade strip ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto bg-[#FF0099]/5 border border-[#FF0099]/20 rounded-2xl px-6 py-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-[#FF0099] flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <span className="text-white font-semibold">Coaching families get all workshops free.</span>{' '}
              Upgrade from classes or workshops at any time.
            </p>
          </div>
        </section>

        {/* ── Section 5: Compare features accordion ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2">
                Compare features
              </h2>
              <p className="text-gray-400">
                Same skills. The difference is how deep the AI goes.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
              {COMPARE_SECTIONS.map((section, sIdx) => {
                const isOpen = !!openSections[sIdx];
                return (
                  <div key={section.title} className={sIdx > 0 ? 'border-t border-gray-800' : ''}>
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(sIdx)}
                      className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left"
                    >
                      <span className="font-semibold text-white text-sm sm:text-base">
                        {section.title}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Section body */}
                    {isOpen && (
                      <div className="px-4 sm:px-6 pb-4">
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 mb-3">
                          <div />
                          <div className="text-center text-xs font-semibold text-amber-400">Workshops</div>
                          <div className="text-center text-xs font-semibold text-sky-400">Classes</div>
                          <div className="text-center text-xs font-semibold text-[#FF0099]">Coaching</div>
                        </div>

                        {/* Rows */}
                        {section.rows.map((row) => (
                          <div
                            key={row.label}
                            className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 mb-2"
                          >
                            <div className="text-gray-500 text-xs sm:text-sm flex items-center">
                              {row.label}
                            </div>
                            {(['workshops', 'classes', 'coaching'] as const).map((col) => (
                              <div
                                key={col}
                                className="bg-gray-800/30 rounded-lg p-2 text-center text-xs sm:text-sm"
                              >
                                <CompareCell value={row[col]} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 6: Why seasons, not courses? ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-6">
              Why seasons, not courses?
            </h2>
            <blockquote className="border-l-2 border-[#FF0099]/30 pl-4 italic text-gray-400 max-w-2xl mx-auto mb-10 text-sm sm:text-base">
              &ldquo;Every child reads differently. A 4-year-old needs short, frequent
              sessions. A 10-year-old needs longer, deeper practice. Same total
              hours, different rhythm.&rdquo;
            </blockquote>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Foundation */}
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-5">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Foundation
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 4-6</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>30 min sessions</li>
                  <li>18 coaching + 6 skill boosters</li>
                  <li>~2 sessions / week</li>
                </ul>
              </div>

              {/* Building */}
              <div className="bg-purple-400/10 border border-purple-400/20 rounded-2xl p-5">
                <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Building
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 7-9</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>45 min sessions</li>
                  <li>12 coaching + 4 skill boosters</li>
                  <li>~1 session / week</li>
                </ul>
              </div>

              {/* Mastery */}
              <div className="bg-rose-400/10 border border-rose-400/20 rounded-2xl p-5">
                <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Mastery
                </p>
                <p className="text-white font-bold text-lg mb-3">Ages 10-12</p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li>60 min sessions</li>
                  <li>9 coaching + 3 skill boosters</li>
                  <li>~3 sessions / month</li>
                </ul>
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Same price. Same total hours.</p>
              <p className="text-[#FF0099] text-2xl font-bold">
                <span className="text-lg font-normal text-gray-400">&#8377;</span>6,999
                <span className="text-gray-500 text-base font-normal"> / season</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 7: Footer CTA ── */}
        <section className="pb-20 px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-3">
            Not sure where to start?
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Take our free 5-minute AI reading assessment. It tells you exactly
            where your child stands — and which path makes sense.
          </p>
          <Link
            href="/assessment"
            className="inline-flex items-center gap-2 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold h-12 px-8 rounded-xl transition-colors"
          >
            Free AI Reading Test
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
