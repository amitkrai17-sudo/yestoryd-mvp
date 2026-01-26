'use client';

import { Heart, BookOpen, Brain, Lightbulb, MessageCircle, Award } from 'lucide-react';

interface JourneyStep {
  stage: string;
  skill: string;
  icon: 'heart' | 'book' | 'brain' | 'lightbulb' | 'message' | 'award';
  color: string;
}

interface JourneySectionProps {
  badge: string;
  title: string;
  subtitle: string;
  steps: JourneyStep[];
  insightText: string;
  insightDetail: string;
}

const iconMap = {
  heart: Heart,
  book: BookOpen,
  brain: Brain,
  lightbulb: Lightbulb,
  message: MessageCircle,
  award: Award,
};

const defaultSteps: JourneyStep[] = [
  { stage: 'INTEREST', skill: 'Generate love for reading', icon: 'heart', color: '#00ABFF' },
  { stage: 'READ', skill: 'Phonics mastery', icon: 'book', color: '#0090d9' },
  { stage: 'UNDERSTAND', skill: 'Grammar rules', icon: 'brain', color: '#9333ea' },
  { stage: 'COMPREHEND', skill: 'Reading comprehension', icon: 'lightbulb', color: '#FF0099' },
  { stage: 'EXPRESS', skill: 'Writing skills', icon: 'message', color: '#d10080' },
  { stage: 'CONFIDENCE', skill: 'English fluency', icon: 'award', color: '#7B008B' },
];

export function JourneySection({
  badge,
  title,
  subtitle,
  steps = defaultSteps,
  insightText,
  insightDetail,
}: JourneySectionProps) {
  const journeySteps = steps.length > 0 ? steps : defaultSteps;

  return (
    <section className="py-16 lg:py-24 bg-surface-1 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#7b008b] uppercase tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {title.includes('English Confidence') ? (
              <>
                From Reading Mastery to{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                  English Confidence
                </span>
              </>
            ) : title}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Journey Flow - Desktop */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#00ABFF] via-[#FF0099] to-[#7B008B] -translate-y-1/2 rounded-full"></div>

            {/* Journey Steps */}
            <div className="grid grid-cols-6 gap-4 relative z-10">
              {journeySteps.map((step) => {
                const Icon = iconMap[step.icon];
                return (
                  <div key={step.stage} className="flex flex-col items-center">
                    {/* Icon Circle */}
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 bg-surface-2 border-4"
                      style={{ borderColor: step.color }}
                    >
                      <Icon className="w-7 h-7" style={{ color: step.color }} />
                    </div>

                    {/* Stage Name */}
                    <p className="font-bold text-white text-sm mb-1">{step.stage}</p>

                    {/* Arrow */}
                    <div className="text-text-tertiary my-2">↓</div>

                    {/* Skill Description */}
                    <p className="text-xs text-text-tertiary text-center leading-tight">{step.skill}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Journey Flow - Mobile */}
        <div className="lg:hidden">
          <div className="space-y-4">
            {journeySteps.map((step, index) => {
              const Icon = iconMap[step.icon];
              return (
                <div key={step.stage} className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 border-2 shadow-md"
                    style={{ borderColor: step.color }}
                  >
                    <Icon className="w-5 h-5" style={{ color: step.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <p className="font-bold text-white text-sm">{step.stage}</p>
                    <p className="text-xs text-text-tertiary">{step.skill}</p>
                  </div>

                  {/* Arrow (except last) */}
                  {index < journeySteps.length - 1 && (
                    <div className="text-text-tertiary text-xl">→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Insight */}
        <div className="mt-12 bg-gradient-to-r from-[#00ABFF]/10 via-[#FF0099]/10 to-[#7B008B]/10 rounded-3xl p-8 border border-border">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg text-text-secondary mb-4">
              <strong className="text-white">{insightText}</strong>
            </p>
            <p className="text-text-secondary">
              {insightDetail.includes('understanding exactly where they are today') ? (
                <>
                  This becomes the foundation for grammar, comprehension, writing, and eventually —
                  confident English communication. The journey starts with the first step:
                  <strong className="text-[#ff0099]"> understanding exactly where they are today.</strong>
                </>
              ) : insightDetail}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
