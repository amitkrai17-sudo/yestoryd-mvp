'use client';

import Link from 'next/link';
import { Brain, Heart, Zap, Play, Star, Shield, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

// ==================== TYPES ====================
interface TestimonialData {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
}

interface HeroContentProps {
  badge: string;
  headline: string;
  reframeText: string;
  explanation: string;
  ctaPrimary: string;
  ctaSecondary: string;
  trustBadge1: string;
  trustBadge2: string;
  trustBadge3: string;
  statPercentage: string;
  statText: string;
  urgencyText: string;
}

interface HeroSectionProps {
  variant: 'curiosity' | 'validation';
  testimonial: TestimonialData;
  content: HeroContentProps;
  onCTAClick: () => void;
}

// ==================== HERO CURIOSITY VARIANT ====================
function HeroCuriosity({
  testimonial,
  content,
  onCTAClick,
}: Omit<HeroSectionProps, 'variant'>) {
  return (
    <div className="text-center lg:text-left">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-surface-2 border border-border rounded-full px-4 py-1.5 mb-6 shadow-sm">
        <Brain className="w-3 h-3 text-[#00abff]" />
        <span className="text-xs font-bold text-text-secondary tracking-wide uppercase">
          {content.badge}
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
        {content.headline.includes('Avoids Reading') ? (
          <>
            There's a Reason Your Child{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
              Avoids Reading
            </span>
          </>
        ) : content.headline}
      </h1>

      {/* Subheadline - The Reframe */}
      <p className="text-lg sm:text-xl text-text-secondary mb-4 leading-relaxed max-w-xl mx-auto lg:mx-0">
        <strong className="text-white">{content.reframeText}</strong>
      </p>
      <p className="text-lg text-text-secondary mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
        {content.explanation.split('rAI').map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>{part}<span className="font-black text-[#00ABFF]">rAI</span></span>
          ) : part
        )}
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-6">
        <Link
          href="/assessment"
          onClick={onCTAClick}
          className="w-full sm:w-auto h-14 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 transition-all shadow-xl shadow-[#ff0099]/20 whitespace-nowrap"
        >
          <Zap className="w-5 h-5" />
          {content.ctaPrimary}
        </Link>
        <a
          href="#rucha-story"
          className="flex items-center gap-2 text-text-secondary font-semibold hover:text-[#ff0099] transition-colors"
        >
          <Play className="w-5 h-5" />
          {content.ctaSecondary}
        </a>
      </div>

      {/* Testimonial with Score */}
      {testimonial && (
        <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-6 max-w-xl mx-auto lg:mx-0 shadow-sm">
          <div className="flex gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
            ))}
          </div>
          <p className="text-text-secondary text-sm mb-2">"{testimonial.testimonial_text}"</p>
          <p className="text-xs text-text-tertiary">
            — {testimonial.parent_name}, {testimonial.parent_location}
          </p>
        </div>
      )}

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-text-tertiary mb-4">
        <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/20">
          <Shield className="w-4 h-4" />
          {content.trustBadge1}
        </span>
        <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">
          <Clock className="w-4 h-4" />
          {content.trustBadge2}
        </span>
        <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-full border border-purple-500/20">
          <TrendingUp className="w-4 h-4" />
          {content.trustBadge3}
        </span>
      </div>

      {/* Sharp Stat + Urgency */}
      <div className="space-y-2">
        <p className="text-sm text-text-secondary flex items-center justify-center lg:justify-start gap-2">
          <span className="text-[#00abff] font-bold">{content.statPercentage}</span> {content.statText}
        </p>
        <p className="text-xs text-amber-400 flex items-center justify-center lg:justify-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {content.urgencyText}
        </p>
      </div>
    </div>
  );
}

// ==================== HERO VALIDATION VARIANT ====================
function HeroValidation({
  testimonial,
  content,
  onCTAClick,
}: Omit<HeroSectionProps, 'variant'>) {
  return (
    <div className="text-center lg:text-left">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-surface-2 border border-border rounded-full px-4 py-1.5 mb-6 shadow-sm">
        <Heart className="w-3 h-3 text-[#ff0099] fill-[#ff0099]" />
        <span className="text-xs font-bold text-text-secondary tracking-wide uppercase">
          {content.badge}
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
        {content.headline.includes("Isn't Clicking") ? (
          <>
            You've Noticed Something{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
              Isn't Clicking
            </span>
            <br />
            <span className="text-3xl sm:text-4xl lg:text-5xl">With Your Child's Reading</span>
          </>
        ) : content.headline}
      </h1>

      {/* Subheadline - Validation + Reframe */}
      <p className="text-lg sm:text-xl text-text-secondary mb-4 leading-relaxed max-w-xl mx-auto lg:mx-0">
        <strong className="text-white">{content.reframeText}</strong>
      </p>
      <p className="text-lg text-text-secondary mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
        {content.explanation.split('rAI').map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>{part}<span className="font-black text-[#00ABFF]">rAI</span></span>
          ) : part
        )}
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-6">
        <Link
          href="/assessment"
          onClick={onCTAClick}
          className="w-full sm:w-auto h-14 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 transition-all shadow-xl shadow-[#ff0099]/20 whitespace-nowrap"
        >
          <Zap className="w-5 h-5" />
          {content.ctaPrimary}
        </Link>
        <a
          href="#rucha-story"
          className="flex items-center gap-2 text-text-secondary font-semibold hover:text-[#ff0099] transition-colors"
        >
          <Play className="w-5 h-5" />
          {content.ctaSecondary}
        </a>
      </div>

      {/* Testimonial with Score */}
      {testimonial && (
        <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-6 max-w-xl mx-auto lg:mx-0 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
              ))}
            </div>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
              4/10 → 8/10
            </span>
          </div>
          <p className="text-text-secondary text-sm mb-2">"{testimonial.testimonial_text}"</p>
          <p className="text-xs text-text-tertiary">
            — {testimonial.parent_name}, {testimonial.parent_location}
          </p>
        </div>
      )}

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-text-tertiary mb-4">
        <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/20">
          <Shield className="w-4 h-4" />
          {content.trustBadge1}
        </span>
        <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">
          <Clock className="w-4 h-4" />
          {content.trustBadge2}
        </span>
        <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-full border border-purple-500/20">
          <TrendingUp className="w-4 h-4" />
          {content.trustBadge3}
        </span>
      </div>

      {/* Sharp Stat + Urgency */}
      <div className="space-y-2">
        <p className="text-sm text-text-secondary flex items-center justify-center lg:justify-start gap-2">
          <span className="text-[#00abff] font-bold">{content.statPercentage}</span> {content.statText}
        </p>
        <p className="text-xs text-amber-400 flex items-center justify-center lg:justify-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {content.urgencyText}
        </p>
      </div>
    </div>
  );
}

// ==================== MAIN EXPORT ====================
export function HeroSection({ variant, testimonial, content, onCTAClick }: HeroSectionProps) {
  if (variant === 'curiosity') {
    return <HeroCuriosity testimonial={testimonial} content={content} onCTAClick={onCTAClick} />;
  }
  return <HeroValidation testimonial={testimonial} content={content} onCTAClick={onCTAClick} />;
}

export type { HeroContentProps, TestimonialData };
