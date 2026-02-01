'use client';

import { Star } from 'lucide-react';

interface TestimonialData {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
}

interface TestimonialsSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  testimonials: TestimonialData[];
  activeIndex: number;
  stats: {
    totalAssessments: string;
    foundIssueStat: string;
    foundIssueLabel: string;
    improvementStat: string;
    improvementLabel: string;
  };
}

export function TestimonialsSection({
  badge,
  title,
  subtitle,
  testimonials,
  activeIndex,
  stats,
}: TestimonialsSectionProps) {
  // Score mappings for display
  const scoreMatches = [
    { before: '4/10', after: '8/10' },
    { before: '—', after: '2x fluency' },
    { before: '5', after: '9', label: 'Clarity' },
    { before: '15 WPM', after: '40 WPM' },
  ];

  return (
    <section className="py-16 lg:py-24 bg-surface-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-text-secondary">
            <span className="text-[#00abff] font-bold">{stats.foundIssueStat}</span> {subtitle}
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.slice(0, 4).map((testimonial, index) => {
            const score = scoreMatches[index] || null;

            return (
              <div
                key={testimonial.id || index}
                className={`bg-surface-2 rounded-2xl p-6 shadow-lg border-2 transition-all ${
                  activeIndex === index
                    ? 'border-[#ff0099] shadow-[#ff0099]/10'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                {/* Score Badge */}
                {score && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-[#ffde00] fill-[#ffde00]" />
                      ))}
                    </div>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">
                      {score.before} → {score.after}
                    </span>
                  </div>
                )}

                {/* Quote */}
                <p className="text-text-secondary mb-5 text-sm leading-relaxed">
                  "{testimonial.testimonial_text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.parent_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{testimonial.parent_name}</p>
                    <p className="text-xs text-text-tertiary">
                      {testimonial.parent_location && `${testimonial.parent_location} • `}
                      Parent of {testimonial.child_name}, {testimonial.child_age}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Stats */}
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-[#ff0099]">{stats.totalAssessments}</p>
            <p className="text-sm text-text-tertiary">Assessments Done</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-[#00abff]">{stats.foundIssueStat}</p>
            <p className="text-sm text-text-tertiary">{stats.foundIssueLabel}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-[#c44dff]">{stats.improvementStat}</p>
            <p className="text-sm text-text-tertiary">{stats.improvementLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
