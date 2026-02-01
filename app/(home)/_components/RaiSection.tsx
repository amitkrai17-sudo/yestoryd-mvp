'use client';

import { Brain, MessageCircle, BookOpen, ArrowRight } from 'lucide-react';

interface RaiSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  genericAi: {
    label: string;
    name: string;
    type: string;
    description: string;
  };
  safeAi: {
    label: string;
    name: string;
    type: string;
    description: string;
  };
  processSteps: string[];
  explanation: {
    intro: string;
    analogy: string;
    detail: string;
  };
}

export function RaiSection({
  badge,
  title,
  subtitle,
  genericAi,
  safeAi,
  processSteps,
  explanation,
}: RaiSectionProps) {
  return (
    <section className="py-16 lg:py-24 bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#00abff] tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Why <span className="text-[#00ABFF]">rAI</span> is <span className="text-[#ff0099]">Different</span> (and Safer)
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            rAI = <strong className="text-white">Reading Intelligence</strong> — {subtitle}
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {/* Generic AI Card */}
          <div className="bg-surface-2 rounded-2xl p-6 border-2 border-border relative">
            <div className="absolute -top-3 left-6 bg-surface-3 text-text-secondary px-3 py-1 rounded-full text-xs font-bold">
              {genericAi.label}
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-text-tertiary" />
                </div>
                <div>
                  <p className="font-bold text-white">{genericAi.name}</p>
                  <p className="text-sm text-text-tertiary">{genericAi.type}</p>
                </div>
              </div>
              <div className="bg-surface-3 rounded-xl p-4">
                <p className="text-text-secondary text-base leading-relaxed">
                  <span className="font-semibold text-text-secondary">Guesses</span> {genericAi.description}
                </p>
              </div>
            </div>
          </div>

          {/* Yestoryd Safe AI Card */}
          <div className="bg-gradient-to-br from-[#00abff]/10 to-[#ff0099]/10 rounded-2xl p-6 border-2 border-[#00abff] relative">
            <div className="absolute -top-3 left-6 bg-[#00abff] text-white px-3 py-1 rounded-full text-xs font-bold">
              {safeAi.label}
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#00abff]/10 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-[#00abff]" />
                </div>
                <div>
                  <p className="font-bold text-white">{safeAi.name}</p>
                  <p className="text-sm text-[#00abff]">{safeAi.type}</p>
                </div>
              </div>
              <div className="bg-surface-2 rounded-xl p-4 border border-[#00abff]/20">
                <p className="text-text-secondary text-base leading-relaxed">
                  <span className="font-semibold text-[#00abff]">Consults our Expert Knowledge Base first.</span>{' '}
                  {safeAi.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Flow */}
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-6">
            The Process
          </p>
          {/* Desktop: Horizontal */}
          <div className="hidden sm:flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-8">
            {processSteps.map((step, index) => {
              const colors = ['#ff0099', '#00abff', 'rgb(34 197 94)'];
              const isLast = index === processSteps.length - 1;
              const stepText = typeof step === 'string' ? step : (step as any)?.title || (step as any)?.description || 'Step';
              return (
                <div key={index} className="flex items-center gap-2 sm:gap-4">
                  <div
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      isLast ? 'bg-green-500/20 text-green-400' : ''
                    }`}
                    style={!isLast ? { backgroundColor: `${colors[index]}1a`, color: colors[index] } : {}}
                  >
                    {stepText}
                  </div>
                  {index < processSteps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-text-tertiary" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Mobile: Compact horizontal with smaller text */}
          <div className="flex sm:hidden items-center justify-center gap-1.5 mb-8 px-2">
            {processSteps.map((step, index) => {
              const colors = ['#ff0099', '#00abff', 'rgb(34 197 94)'];
              const isLast = index === processSteps.length - 1;
              const stepText = typeof step === 'string' ? step : (step as any)?.title || (step as any)?.description || 'Step';
              // Shorten labels for mobile
              const shortStep = stepText.replace('Check Expert DB', 'Expert DB').replace('Perfect Fix ✓', 'Fix ✓');
              return (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className={`px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      isLast ? 'bg-green-500/20 text-green-400' : ''
                    }`}
                    style={!isLast ? { backgroundColor: `${colors[index]}1a`, color: colors[index] } : {}}
                  >
                    {shortStep}
                  </div>
                  {index < processSteps.length - 1 && (
                    <span className="text-text-tertiary text-xs">→</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-surface-2 rounded-2xl p-6 sm:p-8 shadow-lg border border-border">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#ff0099]" />
                </div>
              </div>
              <div>
                <p className="text-text-secondary leading-relaxed mb-4">
                  <strong className="text-white">{explanation.intro}</strong>
                </p>
                <p className="text-text-secondary leading-relaxed mb-4">
                  Imagine <strong className="text-[#00abff]">rAI</strong> as a <strong className="text-[#00abff]">librarian with a manual written by Rucha</strong>.
                  Built on <strong className="text-[#ff0099]">7+ years of phonics expertise</strong>.
                </p>
                <p className="text-text-secondary leading-relaxed">
                  When your child makes a mistake, <strong className="text-[#00abff]">rAI</strong> doesn't guess. It looks up the
                  <strong className="text-white"> exact page in our "Expert Manual"</strong> and tells the coach
                  precisely which Phonics rule to practice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
