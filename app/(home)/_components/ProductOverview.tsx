'use client';

import Link from 'next/link';
import { Users, BookOpen, Sparkles, Check, Star, ArrowRight, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductOverviewProps {
  /** Coaching original price (from pricing_plans 'full' tier) */
  coachingOriginalPrice?: number;
  /** Coaching discounted price (from pricing_plans 'full' tier) */
  coachingDiscountedPrice?: number;
}

// ---------------------------------------------------------------------------
// Static product data (workshops + classes are display ranges, not DB-sourced)
// ---------------------------------------------------------------------------

const STATIC_PRODUCTS = [
  {
    key: 'workshops',
    name: 'Workshops',
    Icon: Users,
    subtitle: 'Fun group events for curious readers',
    features: [
      'Storytelling, phonics, creative writing',
      'Age-grouped (4-6, 7-9, 10-12)',
      'AI micro-insight after each session',
      'No commitment \u2014 drop in anytime',
    ],
    cta: { label: 'Browse workshops', href: '/classes' },
    classes: {
      card: 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      checkColor: 'text-amber-400',
      cta: 'border border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
    },
  },
  {
    key: 'classes',
    name: 'English Classes',
    Icon: BookOpen,
    subtitle: 'Structured learning with an assigned coach',
    features: [
      'Grammar, olympiad, creative writing, phonics',
      'Assigned coach + weekly schedule',
      'Homework with AI feedback',
      'Parent check-ins + rAI Chat',
    ],
    cta: { label: 'Enquire now', href: '/english-classes' },
    classes: {
      card: 'bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/20',
      iconBg: 'bg-sky-500/15',
      iconColor: 'text-sky-400',
      checkColor: 'text-sky-400',
      cta: 'border border-sky-500/30 text-sky-400 hover:bg-sky-500/10',
    },
  },
] as const;

const COACHING_FEATURES = [
  'Dedicated personal coach',
  'AI-recorded sessions + SmartPractice',
  'Full intelligence profile + e-learning',
  'All workshops FREE forever',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductOverview({
  coachingOriginalPrice = 11999,
  coachingDiscountedPrice = 6999,
}: ProductOverviewProps = {}) {
  const discountPercent = Math.round(
    (1 - coachingDiscountedPrice / coachingOriginalPrice) * 100,
  );

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-gray-900/30 border-t border-b border-gray-800 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-[#FF0099]/10 text-[#FF0099] text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full mb-4">
            Three ways to learn
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pick what fits your child{' '}
            <span className="text-[#FF0099]">today</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Start with a workshop, move to classes, or dive into full coaching.
            Upgrade anytime.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {/* Static cards: Workshops + English Classes */}
          {STATIC_PRODUCTS.map((product) => (
            <div
              key={product.key}
              className={`relative flex flex-col rounded-2xl p-6 transition-colors ${product.classes.card}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${product.classes.iconBg}`}>
                  <product.Icon className={`w-6 h-6 ${product.classes.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-white">{product.name}</h3>
              </div>

              <p className="text-gray-400 text-sm mb-5">{product.subtitle}</p>

              {/* TODO: move to site_settings when product pricing is formalized.
                  No DB source exists yet — workshops and English Classes are
                  per-batch / per-onboarding priced. */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-white">
                  <span className="text-xl font-normal text-gray-400">&#8377;</span>
                  199 &ndash; 399
                </span>
                <span className="text-gray-400 text-sm ml-1">/ session</span>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${product.classes.checkColor}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={product.cta.href}
                className={`mt-auto flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors ${product.classes.cta}`}
              >
                {product.cta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}

          {/* Coaching card (DB-driven price) */}
          <div className="relative flex flex-col rounded-2xl p-6 transition-colors bg-[#FF0099]/5 hover:bg-[#FF0099]/10 border-2 border-[#FF0099]/30">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF0099] text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              Most popular
            </span>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#FF0099]/15">
                <Sparkles className="w-6 h-6 text-[#FF0099]" />
              </div>
              <h3 className="text-xl font-bold text-white">1:1 Coaching</h3>
            </div>

            <p className="text-gray-400 text-sm mb-5">Deep, AI-powered transformation</p>

            <div className="mb-6">
              <div className="flex items-baseline flex-wrap gap-x-2">
                <span className="text-gray-500 line-through text-lg">
                  &#8377;{coachingOriginalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-white text-3xl font-bold">
                  <span className="text-xl font-normal text-gray-400">&#8377;</span>
                  {coachingDiscountedPrice.toLocaleString('en-IN')}
                </span>
                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {discountPercent}% off
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1">/ season (90 days)</p>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {COACHING_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Star className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#FF0099]" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/pricing"
              className="mt-auto flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors bg-[#FF0099] hover:bg-[#FF0099]/90 text-white"
            >
              Explore coaching
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Compare CTA — prominent button */}
        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#FF0099]/10 border border-[#FF0099]/20 text-[#FF0099] hover:bg-[#FF0099]/15 px-6 py-3 rounded-xl text-base font-semibold transition-colors"
          >
            See full comparison
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Upgrade strip */}
        <div className="max-w-3xl mx-auto mt-6 bg-[#FF0099]/5 border border-[#FF0099]/20 rounded-2xl p-4 flex items-center justify-center gap-3 text-center text-sm text-gray-400">
          <Zap className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
          <p>
            <span className="text-[#FF0099] font-bold">
              Coaching families get all workshops free.
            </span>{' '}
            That&apos;s &#8377;800-2,000/month included with your season.
          </p>
        </div>
      </div>
    </section>
  );
}
