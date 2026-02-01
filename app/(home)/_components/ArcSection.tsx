'use client';

import Link from 'next/link';
import {
  Sparkles,
  Brain,
  Heart,
  Award,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Shield,
  Eye,
  Mic,
  Users,
  Calendar,
  Star,
} from 'lucide-react';

interface ArcPhase {
  letter: string;
  weeks: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  icon: 'brain' | 'heart' | 'award';
  color: string;
}

interface ArcSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  phases: {
    assess: ArcPhase;
    remediate: ArcPhase;
    celebrate: ArcPhase;
  };
  promise: {
    title: string;
    description: string;
    badges: string[];
  };
  trustStats: {
    assessmentTime: string;
    coachingType: string;
    transformationDays: string;
    happyParents: string;
  };
  onCTAClick: () => void;
}

const iconMap = {
  brain: Brain,
  heart: Heart,
  award: Award,
};

export function ArcSection({
  badge,
  title,
  subtitle,
  phases,
  promise,
  trustStats,
  onCTAClick,
}: ArcSectionProps) {
  const phaseArray = [
    { ...phases.assess, letter: 'A', color: phases.assess.color || '#00ABFF' },
    { ...phases.remediate, letter: 'R', color: phases.remediate.color || '#FF0099' },
    { ...phases.celebrate, letter: 'C', color: phases.celebrate.color || '#c44dff' },
  ];

  return (
    <section id="how-it-works" className="py-16 lg:py-24 bg-surface-1 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#ff0099]" />
            <span className="text-sm font-bold text-[#ff0099]">{badge}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {title.includes('90-Day') ? (
              <>
                Your Child's <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">90-Day Transformation</span>
              </>
            ) : title}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* ARC Visual - Mobile */}
        <div className="lg:hidden mb-12">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00ABFF] via-[#FF0099] to-[#7B008B] rounded-full"></div>

            {phaseArray.map((phase, index) => {
              const Icon = iconMap[phase.icon];
              return (
                <div key={phase.letter} className={`relative pl-20 ${index < 2 ? 'pb-12' : ''}`}>
                  <div
                    className="absolute left-4 w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg"
                    style={{ backgroundColor: phase.color, boxShadow: `0 10px 15px -3px ${phase.color}30` }}
                  >
                    {phase.letter}
                  </div>
                  <div
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: `${phase.color}15`, borderColor: `${phase.color}30`, borderWidth: 1 }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: phase.color }}>
                      {phase.weeks}
                    </p>
                    <h3 className="text-xl font-bold text-white mb-2">{phase.title}</h3>
                    <p className="text-sm text-text-secondary mb-3">{phase.description}</p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: phase.color }}>
                      <Icon className="w-4 h-4" />
                      <span className="font-semibold">{phase.subtitle}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ARC Visual - Desktop */}
        <div className="hidden lg:block mb-16">
          <div className="relative">
            {/* The Arc Curve Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 800 200" className="w-full max-w-4xl h-auto opacity-10">
                <path
                  d="M 50 150 Q 400 -50 750 150"
                  fill="none"
                  stroke="url(#arcGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00ABFF" />
                    <stop offset="50%" stopColor="#FF0099" />
                    <stop offset="100%" stopColor="#7B008B" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* ARC Cards */}
            <div className="grid grid-cols-3 gap-8 relative z-10">
              {phaseArray.map((phase, index) => {
                const Icon = iconMap[phase.icon];
                const isMiddle = index === 1;

                return (
                  <div key={phase.letter} className={`group ${isMiddle ? '-mt-4' : ''}`}>
                    <div
                      className={`bg-surface-2 rounded-3xl p-8 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full relative`}
                      style={{ borderWidth: 2, borderColor: `${phase.color}${isMiddle ? '4d' : '33'}` }}
                    >
                      <div
                        className={`absolute ${isMiddle ? '-top-8' : '-top-6'} left-1/2 -translate-x-1/2 ${isMiddle ? 'w-16 h-16' : 'w-14 h-14'} rounded-2xl flex items-center justify-center text-white font-black ${isMiddle ? 'text-3xl' : 'text-2xl'} shadow-xl group-hover:scale-110 transition-transform`}
                        style={{ background: `linear-gradient(to bottom right, ${phase.color}, ${phase.color}cc)`, boxShadow: `0 25px 50px -12px ${phase.color}30` }}
                      >
                        {phase.letter}
                      </div>

                      <div className={isMiddle ? 'pt-8' : 'pt-6'}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1 text-center" style={{ color: phase.color }}>
                          {phase.weeks}
                        </p>
                        <h3 className="text-2xl font-bold text-white mb-1 text-center">{phase.title}</h3>
                        <p className="text-sm font-semibold mb-4 text-center" style={{ color: phase.color }}>
                          {phase.subtitle}
                        </p>

                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                          style={{ backgroundColor: `${phase.color}1a` }}
                        >
                          <Icon className="w-7 h-7" style={{ color: phase.color }} />
                        </div>

                        <p className="text-text-secondary text-center mb-6">
                          {phase.description}
                        </p>

                        <ul className="space-y-2 text-sm text-text-tertiary">
                          {phase.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: phase.color }} />
                              {typeof feature === 'string' ? feature : (feature as any)?.title || (feature as any)?.description || 'Feature'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* The Promise */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 sm:p-8 lg:p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff0099]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00ABFF]/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
              <div>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4">
                  The <span className="text-[#ffde00]">{promise.title.replace('The ', '').replace('90-Day ', '90-Day ')}</span>
                </h3>
                <p className="text-gray-300 text-base sm:text-lg mb-6">
                  {promise.description}
                </p>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  {promise.badges.map((badgeText, idx) => {
                    const icons = [TrendingUp, Shield, Eye];
                    const colors = ['#00ABFF', '#FF0099', '#7B008B'];
                    const Icon = icons[idx];
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                        <div
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${colors[idx]}33` }}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: colors[idx] }} />
                        </div>
                        <span>{badgeText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 lg:justify-end">
                <Link
                  href="/assessment"
                  onClick={onCTAClick}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#ff0099] hover:bg-[#FF0099]/90 text-white px-6 py-3 rounded-xl font-bold text-sm sm:text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-[#FF0099]/25 whitespace-nowrap"
                >
                  Reading Test - Free
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#00ABFF]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Mic className="w-6 h-6 text-[#00ABFF]" />
            </div>
            <p className="text-2xl font-bold text-white">{trustStats.assessmentTime}</p>
            <p className="text-sm text-text-tertiary">Assessment Time</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#FF0099]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-[#FF0099]" />
            </div>
            <p className="text-2xl font-bold text-white">{trustStats.coachingType}</p>
            <p className="text-sm text-text-tertiary">Personal Coaching</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#7B008B]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-[#7B008B]" />
            </div>
            <p className="text-2xl font-bold text-white">{trustStats.transformationDays}</p>
            <p className="text-sm text-text-tertiary">Transformation</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#ffde00]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-[#e6b800]" />
            </div>
            <p className="text-2xl font-bold text-white">{trustStats.happyParents}</p>
            <p className="text-sm text-text-tertiary">Parent Satisfaction</p>
          </div>
        </div>

      </div>
    </section>
  );
}
