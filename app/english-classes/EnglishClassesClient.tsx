'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  PenTool,
  Sparkles,
  Trophy,
  MessageCircle,
  ArrowRight,
  ChevronDown,
  Check,
  Users,
  User,
  CalendarDays,
  BrainCircuit,
  PhoneCall,
} from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const WA_LINK = `https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}?text=${encodeURIComponent(
  "Hi I'm interested in English Classes for my child",
)}`;

const SKILLS = [
  {
    Icon: PenTool,
    title: 'Grammar & Syntax',
    desc: 'Sentence structure, tenses, parts of speech',
    accent: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    Icon: BookOpen,
    title: 'Phonics & Reading',
    desc: 'Sound patterns, fluency, comprehension',
    accent: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    Icon: Sparkles,
    title: 'Creative Writing',
    desc: 'Stories, essays, vocabulary building',
    accent: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  },
  {
    Icon: Trophy,
    title: 'Olympiad Prep',
    desc: 'IEO, SOF, Unified Council practice',
    accent: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  {
    Icon: MessageCircle,
    title: 'Storytelling',
    desc: 'Narration, expression, confidence',
    accent: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  },
] as const;

const STEPS = [
  {
    num: '1',
    title: 'Choose your format',
    desc: 'Group sessions (\u20B9199/session) or Individual (\u20B9399/session). 45-120 min per session.',
  },
  {
    num: '2',
    title: 'Buy a session pack',
    desc: 'Prepaid packs. Platform reminds you when balance is low. No lock-in.',
  },
  {
    num: '3',
    title: 'Watch them grow',
    desc: 'AI tracks every session. Upload homework, get AI feedback. Regular check-ins with your coach.',
  },
] as const;

const PARENT_FEATURES = [
  {
    Icon: User,
    title: 'Assigned certified coach',
    desc: 'Your child works with the same coach every session. Continuity builds trust.',
  },
  {
    Icon: CalendarDays,
    title: 'Activity calendar + homework',
    desc: 'Upload writing work, photos, or recordings. AI analyzes and feeds intelligence.',
  },
  {
    Icon: BrainCircuit,
    title: 'rAI Chat',
    desc: "Ask anything about your child's progress, anytime. Answers based on real session data.",
  },
  {
    Icon: PhoneCall,
    title: 'Parent check-ins',
    desc: "Regular conversations with your child's coach about what's working and what needs focus.",
  },
] as const;

const FAQS = [
  {
    q: 'How are English Classes different from tuition?',
    a: "We don't just teach \u2014 our AI tracks your child's progress across sessions, analyzes homework uploads, and gives your coach data to personalize every class.",
  },
  {
    q: 'Can my child switch from group to individual?',
    a: 'Yes, anytime. Buy the session pack type you want. You can mix group and individual sessions.',
  },
  {
    q: 'What ages do you cover?',
    a: '4 to 12 years. Sessions are age-grouped so your child learns with peers at similar levels.',
  },
  {
    q: 'How do I enrol?',
    a: "Message us on WhatsApp. We'll understand your child's needs and set up the right batch or schedule.",
  },
  {
    q: 'Can we upgrade to 1:1 coaching later?',
    a: 'Absolutely. Many families start with classes and upgrade when they want the full AI-powered experience.',
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnglishClassesClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      <main>
        {/* ── Section 1: Hero ── */}
        <section className="pt-16 pb-14 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block bg-sky-400/10 text-sky-400 text-xs font-semibold rounded-full px-3 py-1 mb-6">
              Structured practice
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-4">
              <span className="text-[#FF0099]">English classes</span> your
              child will actually enjoy
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Regular sessions with a certified coach. Grammar, phonics, creative
              writing, olympiad prep — tracked by AI so you see real progress.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors w-full sm:w-auto"
              >
                Enquire on WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
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

        {/* ── Section 2: What's covered ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Everything your child needs to build English confidence
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {SKILLS.map((skill) => {
                const [textCls, bgCls, borderCls] = skill.accent.split(' ');
                return (
                  <div
                    key={skill.title}
                    className={`${bgCls} border ${borderCls} rounded-2xl p-4 text-center`}
                  >
                    <div className="flex justify-center mb-3">
                      <skill.Icon className={`w-6 h-6 ${textCls}`} />
                    </div>
                    <p className="text-white text-sm font-semibold mb-1">
                      {skill.title}
                    </p>
                    <p className="text-gray-400 text-xs">{skill.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 3: How it works ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-10">
              Simple, flexible, effective
            </h2>
            <div className="relative pl-10">
              {/* Connector line */}
              <div className="absolute left-4 top-1 bottom-1 w-px bg-sky-400/20" />

              <div className="space-y-8">
                {STEPS.map((step) => (
                  <div key={step.num} className="relative">
                    {/* Number circle */}
                    <div className="absolute -left-10 top-0 w-8 h-8 rounded-full bg-sky-400/10 border border-sky-400/30 flex items-center justify-center">
                      <span className="text-sky-400 text-sm font-bold">
                        {step.num}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: What parents get ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              You&apos;ll always know how your child is doing
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PARENT_FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-400/10 flex items-center justify-center">
                      <feat.Icon className="w-5 h-5 text-sky-400" />
                    </div>
                    <h3 className="text-white font-semibold text-sm">
                      {feat.title}
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Classes vs Coaching ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Classes vs 1:1 Coaching — which is right?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Classes column */}
              <div className="bg-sky-400/5 border border-sky-400/20 rounded-2xl p-5">
                <p className="text-sky-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  English Classes
                </p>
                <ul className="space-y-2.5">
                  {[
                    'Group or 1:1',
                    '\u20B9199-399 / session',
                    'Assigned coach',
                    'AI homework feedback',
                    'rAI Chat',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-gray-300"
                    >
                      <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Coaching column */}
              <div className="bg-[#FF0099]/5 border border-[#FF0099]/20 rounded-2xl p-5">
                <p className="text-[#FF0099] text-xs font-semibold uppercase tracking-wider mb-3">
                  1:1 Coaching
                </p>
                <ul className="space-y-2.5">
                  {[
                    'Always 1:1',
                    '\u20B96,999 / season (90 days)',
                    'Dedicated personal coach',
                    'SmartPractice (AI daily homework)',
                    'AI-recorded sessions',
                    'Full intelligence flywheel',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-gray-300"
                    >
                      <Check className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-gray-500 text-sm text-center mt-6 mb-4">
              Most families start with classes and upgrade when they see the AI
              difference.
            </p>
            <div className="text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-sm text-[#FF0099] hover:text-[#FF0099]/80 font-medium transition-colors"
              >
                Explore 1:1 coaching
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Section 6: Pricing clarity ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Transparent pricing, no surprises
            </h2>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-2">
                Flexible session pricing
              </h3>
              {/* TODO: move to site_settings when product pricing is formalized.
                  English Classes are per-onboarding priced (admin sets session_rate
                  per tuition_onboarding row) — no global product price exists. */}
              <p className="text-3xl font-bold text-white mb-1">
                <span className="text-xl font-normal text-gray-400">&#8377;</span>
                199 &ndash; 399
                <span className="text-base font-normal text-gray-400">
                  {' '}/ session
                </span>
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Group or individual. 45-120 min. Price varies by format and
                duration.
              </p>
            </div>

            <p className="text-gray-500 text-sm text-center mt-6 mb-4">
              Buy session packs. Use at your pace. Auto-reminder when balance is
              low.
            </p>
            <div className="text-center">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors"
              >
                Enquire on WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ── Section 7: FAQ ── */}
        <section className="pb-16 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-8">
              Common questions
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

        {/* ── Section 8: Footer CTA ── */}
        <section className="pb-20 px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-3">
            Ready to get started?
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Message us on WhatsApp and we&apos;ll find the right class for your
            child.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold text-sm transition-colors"
            >
              Enquire on WhatsApp
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/assessment"
              className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-semibold text-sm transition-colors"
            >
              Or take the free AI reading test
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
