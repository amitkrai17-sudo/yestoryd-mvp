'use client';

import { Lightbulb, BarChart3 } from 'lucide-react';

interface ProblemSectionProps {
  title: string;
  subtitle: string;
  insightTitle: string;
  insightDescription: string;
  aserStat: string;
  aserDescription: string;
  aserSource: string;
  signs: string[];
  symptomsText: string;
  goodNews: string;
}

export function ProblemSection({
  title,
  subtitle,
  insightTitle,
  insightDescription,
  aserStat,
  aserDescription,
  aserSource,
  signs,
  symptomsText,
  goodNews,
}: ProblemSectionProps) {
  // Parse title for highlighting
  const renderTitle = () => {
    if (title.includes("Don't Tell You")) {
      const parts = title.split("Don't Tell You");
      return (
        <>
          {parts[0]}Don't <span className="text-[#ff0099]">Tell You</span>{parts[1]}
        </>
      );
    }
    return title;
  };

  return (
    <section className="pt-10 pb-16 lg:pt-14 lg:pb-24 bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {renderTitle()}
          </h2>
          <p className="text-lg text-text-secondary">
            {subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* The Core Insight */}
          <div className="bg-surface-2 rounded-3xl p-8 shadow-lg border border-border">
            <div className="w-14 h-14 bg-[#ff0099]/10 rounded-2xl flex items-center justify-center mb-6">
              <Lightbulb className="w-7 h-7 text-[#ff0099]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {insightTitle}
            </h3>
            <p className="text-text-secondary mb-6 leading-relaxed">
              {insightDescription.includes('WHAT to read') ? (
                <>
                  Schools teach children <strong className="text-white">WHAT to read</strong>,
                  but rarely <strong className="text-white">HOW to read</strong>.
                  The science of reading — how sounds form words, how words form meaning — is often skipped.
                </>
              ) : insightDescription}
            </p>

            {/* ASER Stat */}
            <div className="bg-[#ff0099]/10 border border-[#ff0099]/20 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-[#ff0099]" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#ff0099] mb-1">{aserStat}</p>
                  <p className="text-sm text-text-secondary">
                    {aserDescription}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">{aserSource}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Signs List */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              Signs you might notice
            </p>

            {signs.map((text, index) => (
              <div
                key={index}
                className="flex items-center gap-4 bg-surface-2 rounded-2xl p-5 shadow-sm border border-border hover:border-[#ff0099]/30 hover:shadow-md transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-[#ff0099] flex-shrink-0" />
                <p className="text-text-secondary font-medium">
                  {typeof text === 'string' ? text : (text as any)?.title || (text as any)?.description || 'Sign'}
                </p>
              </div>
            ))}

            <div className="pt-4">
              <p className="text-text-secondary text-center md:text-left mb-4">
                {symptomsText.includes('symptoms') ? (
                  <>
                    These are <strong className="text-white">symptoms</strong>.
                    The cause is usually a gap in{' '}
                    <span className="text-[#00ABFF] font-semibold">phonemic awareness</span>.
                  </>
                ) : symptomsText}
              </p>
              <p className="text-[#00abff] font-semibold text-center md:text-left">
                {goodNews}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
