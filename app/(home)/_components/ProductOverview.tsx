'use client';

import Link from 'next/link';
import { Users, BookOpen, Sparkles, Check, ArrowRight } from 'lucide-react';

const PRODUCTS = [
  {
    key: 'workshops',
    name: 'Workshops',
    Icon: Users,
    accent: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
    subtitle: 'Fun group events for curious readers',
    price: '199 \u2013 399',
    priceUnit: '/ session',
    features: [
      'Storytelling, phonics, creative writing',
      'Age-grouped (4-6, 7-9, 10-12)',
      'AI micro-insight after each session',
      'No commitment — drop in anytime',
    ],
    cta: { label: 'Browse workshops', href: '/classes' },
    featured: false,
  },
  {
    key: 'classes',
    name: 'English Classes',
    Icon: BookOpen,
    accent: { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20' },
    subtitle: 'Structured learning with an assigned coach',
    price: '199 \u2013 399',
    priceUnit: '/ session',
    features: [
      'Grammar, olympiad, creative writing, phonics',
      'Assigned coach + weekly schedule',
      'Homework with AI feedback',
      'Parent check-ins + rAI Chat',
    ],
    cta: { label: 'Enquire now', href: '/english-classes' },
    featured: false,
  },
  {
    key: 'coaching',
    name: '1:1 Coaching',
    Icon: Sparkles,
    accent: { text: 'text-[#FF0099]', bg: 'bg-[#FF0099]/10', border: 'border-[#FF0099]/20' },
    subtitle: 'Deep, AI-powered transformation',
    price: '6,999',
    priceUnit: '/ season',
    features: [
      'Dedicated personal coach',
      'AI-recorded sessions + SmartPractice',
      'Full intelligence profile + e-learning',
      'All workshops FREE forever',
    ],
    cta: { label: 'Start with free AI test', href: '/assessment' },
    featured: true,
  },
] as const;

export function ProductOverview() {
  return (
    <section className="py-16 sm:py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-sm font-semibold text-[#FF0099] uppercase tracking-wider mb-4">
            Three ways to learn
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pick what fits your child{' '}
            <span className="text-[#FF0099]">today</span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Start with a workshop, move to classes, or dive into full coaching.
            Upgrade anytime.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PRODUCTS.map((product) => (
            <div
              key={product.key}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                product.featured
                  ? 'border-[#FF0099]/30 bg-surface-2'
                  : 'border-border bg-surface-2'
              }`}
            >
              {/* Featured badge */}
              {product.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF0099] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}

              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${product.accent.bg}`}>
                  <product.Icon className={`w-5 h-5 ${product.accent.text}`} />
                </div>
                <h3 className="text-lg font-bold text-white">{product.name}</h3>
              </div>

              <p className="text-text-secondary text-sm mb-4">{product.subtitle}</p>

              {/* Price */}
              <div className="mb-5">
                <span className="text-2xl font-bold text-white">
                  <span className="text-lg font-normal text-text-tertiary">&#8377;</span>
                  {product.price}
                </span>
                <span className="text-text-tertiary text-sm ml-1">{product.priceUnit}</span>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={product.cta.href}
                className={`mt-auto flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors ${
                  product.featured
                    ? 'bg-[#FF0099] hover:bg-[#FF0099]/90 text-white'
                    : 'border border-border text-text-secondary hover:bg-white/[0.05]'
                }`}
              >
                {product.cta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* Compare link */}
        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors"
          >
            See full comparison
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
