'use client';

import { Heart, BookOpen, Brain, Lightbulb, PenTool, Award } from 'lucide-react';

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
  message: PenTool,
  award: Award,
};

// Gradient colors for the 6 steps (cyan → purple → pink)
const gradientColors = [
  '#00ABFF', // 1 - Cyan
  '#3D7FD9', // 2 - Blue-purple
  '#7B53B3', // 3 - Purple
  '#9933AA', // 4 - Deep purple
  '#C41A9A', // 5 - Magenta
  '#FF0099', // 6 - Pink
];

const defaultSteps: JourneyStep[] = [
  { stage: 'INTEREST', skill: 'Generate love for reading', icon: 'heart', color: gradientColors[0] },
  { stage: 'READ', skill: 'Phonics mastery', icon: 'book', color: gradientColors[1] },
  { stage: 'UNDERSTAND', skill: 'Grammar rules', icon: 'brain', color: gradientColors[2] },
  { stage: 'COMPREHEND', skill: 'Reading comprehension', icon: 'lightbulb', color: gradientColors[3] },
  { stage: 'EXPRESS', skill: 'Writing skills', icon: 'message', color: gradientColors[4] },
  { stage: 'CONFIDENCE', skill: 'English fluency', icon: 'award', color: gradientColors[5] },
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
    <section className="py-16 lg:py-24 bg-surface-1 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#c44dff] uppercase tracking-wider mb-4">
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

        {/* Journey Flow - Desktop: Horizontal Timeline */}
        <div className="hidden lg:block">
          <div className="relative py-8">
            {/* Horizontal Gradient Line - positioned at number badge center */}
            <div className="absolute top-12 left-[8%] right-[8%] h-1 bg-gradient-to-r from-[#00ABFF] via-[#7B008B] to-[#FF0099] rounded-full" />

            {/* Journey Steps */}
            <div className="grid grid-cols-6 gap-2 relative z-10">
              {journeySteps.map((step, index) => {
                const Icon = iconMap[step.icon];
                const stepColor = gradientColors[index] || step.color;
                return (
                  <div key={step.stage} className="flex flex-col items-center">
                    {/* Number Badge - ON the line */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-surface-0 border-2 shadow-lg mb-4"
                      style={{ borderColor: stepColor, color: stepColor }}
                    >
                      {index + 1}
                    </div>

                    {/* Icon Circle */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg mb-3 bg-surface-2 border-2"
                      style={{ borderColor: stepColor }}
                    >
                      <Icon className="w-6 h-6" style={{ color: stepColor }} />
                    </div>

                    {/* Stage Name */}
                    <p className="font-bold text-white text-sm mb-1">{step.stage}</p>

                    {/* Skill Description */}
                    <p className="text-xs text-text-tertiary text-center leading-tight max-w-[120px]">{step.skill}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Journey Flow - Mobile: Vertical Timeline */}
        <div className="lg:hidden">
          <div className="relative pl-6">
            {/* Vertical Gradient Line - on the left */}
            <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#00ABFF] via-[#7B008B] to-[#FF0099] rounded-full" />

            {/* Journey Steps */}
            <div className="space-y-6">
              {journeySteps.map((step, index) => {
                const Icon = iconMap[step.icon];
                const stepColor = gradientColors[index] || step.color;
                const isLast = index === journeySteps.length - 1;
                return (
                  <div key={step.stage} className="relative flex items-start gap-4">
                    {/* Number Badge - ON the vertical line */}
                    <div
                      className="absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-surface-0 border-2 shadow-md z-10"
                      style={{ borderColor: stepColor, color: stepColor }}
                    >
                      {index + 1}
                    </div>

                    {/* Card */}
                    <div className="flex-1 bg-surface-2/50 rounded-xl p-3 border border-border/50 ml-2">
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 border-2"
                          style={{ borderColor: stepColor }}
                        >
                          <Icon className="w-5 h-5" style={{ color: stepColor }} />
                        </div>

                        {/* Content */}
                        <div className="flex-grow min-w-0">
                          <p className="font-bold text-white text-sm">{step.stage}</p>
                          <p className="text-xs text-text-tertiary">{step.skill}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
