'use client';

import Link from 'next/link';
import {
  Heart,
  Sparkles,
  Users,
  Camera,
  GraduationCap,
  BookOpen,
  Award,
  ArrowRight,
} from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const METHOD_CARDS = [
  {
    Icon: Heart,
    title: 'Human expertise',
    desc: "Every session is led by a certified coach who understands your child's unique learning pace.",
    accent: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  },
  {
    Icon: Sparkles,
    title: 'AI intelligence',
    desc: 'rAI tracks every session, analyzes homework, and builds a learning profile that gets smarter over time.',
    accent: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    Icon: Users,
    title: 'Parent partnership',
    desc: "You're never in the dark. Progress reports, rAI Chat, and regular check-ins keep you informed.",
    accent: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
] as const;

const STATS = [
  { value: '12+', label: 'Active students' },
  { value: '100+', label: 'Sessions completed' },
  { value: '3', label: 'Products', sub: 'Workshops, English Classes, 1:1 Coaching' },
  { value: '4-12', label: 'Ages served' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AboutPageClient() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      <main>
        {/* ── Section 1: Hero ── */}
        <section className="pt-16 pb-14 px-4 sm:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
              Every child deserves to read with confidence
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
              Yestoryd was born from a simple belief — the right coach, powered
              by the right technology, can transform any child&apos;s
              relationship with English.
            </p>
          </div>
        </section>

        {/* ── Section 2: Rucha's story ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Text */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-6">
                  Meet Rucha Rai
                </h2>
                <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
                  <p>
                    Rucha is a certified reading coach, co-founder of Yestoryd,
                    and a mother who saw firsthand how children struggle with
                    English confidence — even in good schools.
                  </p>
                  <p>
                    She built Yestoryd&apos;s curriculum by combining phonics
                    science, Oxford Reading Tree methodology, and years of real
                    classroom experience working with children across age groups.
                  </p>
                  <p>
                    Today, she personally coaches the first cohort of students,
                    refining every session with the help of rAI — the Reading
                    Intelligence engine she helped design.
                  </p>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-2 mt-6">
                  <span className="inline-flex items-center gap-1.5 bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-1.5 text-sm text-gray-300">
                    <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                    Certified Reading Coach
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-1.5 text-sm text-gray-300">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Oxford Reading Tree Trained
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-1.5 text-sm text-gray-300">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    100+ sessions completed
                  </span>
                </div>
              </div>

              {/* Photo placeholder */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs aspect-square rounded-2xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center gap-3">
                  <Camera className="w-10 h-10 text-gray-600" />
                  <p className="text-gray-600 text-xs">Photo coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: The Yestoryd method ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              How we&apos;re different
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {METHOD_CARDS.map((card) => {
                const [textCls, bgCls, borderCls] = card.accent.split(' ');
                return (
                  <div
                    key={card.title}
                    className={`${bgCls} border ${borderCls} rounded-2xl p-5`}
                  >
                    <card.Icon className={`w-6 h-6 ${textCls} mb-3`} />
                    <h3 className="text-white font-semibold mb-2">
                      {card.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{card.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 4: By the numbers ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center"
                >
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
                  {'sub' in stat && (
                    <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Footer CTA ── */}
        <section className="pb-20 px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-3">
            Join us
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Take the free AI reading test and see where your child stands.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/assessment"
              className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors"
            >
              Free AI reading test
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-semibold text-sm transition-colors"
            >
              Explore our products
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
