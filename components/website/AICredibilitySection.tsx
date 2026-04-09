'use client';

import { Mic, Brain, TrendingUp, MessageCircle, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// 3-step process data
// ---------------------------------------------------------------------------

const steps = [
  {
    icon: Mic,
    number: '01',
    title: 'Listen',
    description:
      'Your child reads aloud for 5 minutes. rAI listens to every sound — identifying gaps in 40+ phonics patterns that schools miss.',
    color: '#FF0099',
    bgColor: 'bg-[#FF0099]/10',
    borderColor: 'border-[#FF0099]/20',
  },
  {
    icon: Brain,
    number: '02',
    title: 'Analyze',
    description:
      'rAI cross-references errors against our expert knowledge base — built on 7+ years of Jolly Phonics expertise. No guessing, ever.',
    color: '#00ABFF',
    bgColor: 'bg-[#00ABFF]/10',
    borderColor: 'border-[#00ABFF]/20',
  },
  {
    icon: TrendingUp,
    number: '03',
    title: 'Track',
    description:
      "After every coaching session, rAI updates your child's learning profile. Coaches see exactly what changed — and what to focus next.",
    color: '#c847f4',
    bgColor: 'bg-[#c847f4]/10',
    borderColor: 'border-[#c847f4]/20',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AICredibilitySection() {
  return (
    <section className="py-16 lg:py-24 bg-surface-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <span className="inline-block bg-[#00ABFF]/10 text-[#00ABFF] text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded-full mb-4">
            Meet rAI
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Intelligence that{' '}
            <span className="text-[#00ABFF]">knows</span> your child
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
            rAI is a Reading Intelligence engine — not a chatbot. It never guesses.
            Every recommendation is verified against our expert knowledge base.
          </p>
        </div>

        {/* rAI vs ChatGPT comparison */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {/* Generic AI Card */}
          <div className="bg-surface-2 rounded-2xl p-6 border-2 border-border relative">
            <div className="absolute -top-3 left-6 bg-surface-3 text-text-secondary px-3 py-1 rounded-full text-xs font-bold">
              Generic AI
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-text-tertiary" />
                </div>
                <div>
                  <p className="font-bold text-white">ChatGPT, etc.</p>
                  <p className="text-sm text-text-tertiary">General Purpose AI</p>
                </div>
              </div>
              <div className="bg-surface-3 rounded-xl p-4">
                <p className="text-text-secondary text-sm leading-relaxed">
                  <span className="font-semibold text-text-secondary">Guesses</span>{' '}
                  based on the internet. No reading expertise. No understanding of
                  phonics rules. May give incorrect or generic advice.
                </p>
              </div>
            </div>
          </div>

          {/* rAI Card */}
          <div className="bg-gradient-to-br from-[#00abff]/10 to-[#ff0099]/10 rounded-2xl p-6 border-2 border-[#00abff] relative">
            <div className="absolute -top-3 left-6 bg-[#00abff] text-white px-3 py-1 rounded-full text-xs font-bold">
              Expert-Verified AI
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#00abff]/10 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-[#00abff]" />
                </div>
                <div>
                  <p className="font-bold text-white">rAI Knowledge Engine</p>
                  <p className="text-sm text-[#00abff]">Reading Intelligence</p>
                </div>
              </div>
              <div className="bg-surface-2 rounded-xl p-4 border border-[#00abff]/20">
                <p className="text-text-secondary text-sm leading-relaxed">
                  <span className="font-semibold text-[#00abff]">
                    Consults our Expert Knowledge Base first.
                  </span>{' '}
                  Built on 7+ years of Jolly Phonics expertise. Never guesses —
                  always references proven methods.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3-step process */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <div
                className={`${step.bgColor} border ${step.borderColor} rounded-2xl p-6 h-full`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${step.color}15` }}
                  >
                    <step.icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                    Step {step.number}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Arrow between steps (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-text-tertiary" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom trust line */}
        <div className="mt-8 sm:mt-10 text-center">
          <p className="text-text-tertiary text-xs sm:text-sm">
            Every recommendation is verified against our expert knowledge base —
            never generated from the internet.
          </p>
        </div>
      </div>
    </section>
  );
}
