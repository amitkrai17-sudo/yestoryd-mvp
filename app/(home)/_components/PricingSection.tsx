'use client';

import Link from 'next/link';
import { CheckCircle, Shield, Star } from 'lucide-react';

interface ProductData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string | null;
  sessionsIncluded: number;
  coachingSessions: number;
  skillBuildingSessions: number;
  checkinSessions: number;
  durationMonths: number;
  features: string[];
  isFeatured: boolean;
  badgeText: string | null;
  displayOrder: number;
}

interface PricingSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  freeBadge: string;
  freeTitle: string;
  freeDescription: string;
  freePriceLabel: string;
  freeAssessmentWorth: string;
  step2Badge: string;
  guaranteeText: string;
  products: ProductData[];
  onCTAClick: () => void;
}

export function PricingSection({
  badge,
  title,
  subtitle,
  freeBadge,
  freeTitle,
  freeDescription,
  freePriceLabel,
  freeAssessmentWorth,
  step2Badge,
  guaranteeText,
  products,
  onCTAClick,
}: PricingSectionProps) {
  return (
    <section id="pricing" className="py-16 lg:py-24 bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Free Assessment Card */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-surface-2 rounded-3xl p-6 sm:p-8 border-2 border-border">
            <div className="mb-6">
              <span className="inline-block bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
                {freeBadge}
              </span>
              <h3 className="text-2xl font-bold text-white mb-2">{freeTitle}</h3>
              <p className="text-text-secondary">{freeDescription}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-white">₹0</span>
              <span className="text-text-tertiary ml-2">{freePriceLabel}</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'rAI analyzes reading in real-time',
                'Clarity, Fluency & Speed scores',
                'Personalized improvement tips',
                { text: 'Detailed Diagnosis Report', highlight: `(Worth ₹${freeAssessmentWorth})` },
                'Instant shareable certificate',
                'No credit card required',
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-text-secondary">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  {typeof item === 'string' ? item : (
                    <span>
                      {item.text} <span className="text-[#ff0099] font-semibold">{item.highlight}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <Link
              href="/assessment"
              onClick={onCTAClick}
              className="block w-full text-center bg-white hover:bg-gray-100 text-surface-1 py-4 rounded-xl font-semibold transition-colors"
            >
              Reading Test - Free
            </Link>
          </div>
        </div>

        {/* Step 2 Label */}
        <div className="text-center mb-6">
          <span className="inline-block bg-[#ff0099]/10 text-[#ff0099] px-4 py-2 rounded-full text-sm font-semibold">
            {step2Badge}
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {products.length > 0 ? products.map((product) => {
            const isFullProgram = product.slug === 'full';
            const isContinuation = product.slug === 'continuation';
            const savings = product.originalPrice - product.discountedPrice;

            return (
              <div
                key={product.id}
                className={`rounded-3xl p-6 relative overflow-hidden transition-all ${
                  isFullProgram
                    ? 'bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white ring-4 ring-[#ff0099]/30 scale-[1.02]'
                    : 'bg-surface-2 border-2 border-border'
                }`}
              >
                {/* Badge */}
                {isFullProgram && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-bl-xl text-xs font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Best Value
                  </div>
                )}
                {isContinuation && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1.5 rounded-bl-xl text-xs font-bold">
                    After Starter
                  </div>
                )}

                {/* Product Name */}
                <div className="mb-4 mt-2">
                  <h3 className={`text-xl font-bold mb-1 ${isFullProgram ? 'text-white' : 'text-white'}`}>
                    {product.name}
                  </h3>
                  <p className={`text-sm ${isFullProgram ? 'text-white/80' : 'text-text-tertiary'}`}>
                    {product.description || `${product.durationMonths} month${product.durationMonths > 1 ? 's' : ''} program`}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className={`text-3xl font-bold ${isFullProgram ? 'text-white' : 'text-white'}`}>
                    ₹{product.discountedPrice.toLocaleString('en-IN')}
                  </span>
                  {savings > 0 && (
                    <span className={`ml-2 line-through text-sm ${isFullProgram ? 'text-white/50' : 'text-text-tertiary'}`}>
                      ₹{product.originalPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                  {isFullProgram && savings > 0 && (
                    <p className="text-yellow-300 text-sm font-semibold mt-1">
                      Save ₹{savings.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                {/* Sessions Breakdown */}
                <div className={`rounded-xl p-3 mb-4 ${isFullProgram ? 'bg-white/10' : 'bg-surface-3'}`}>
                  <p className={`text-sm font-semibold mb-2 ${isFullProgram ? 'text-white' : 'text-text-secondary'}`}>
                    {product.sessionsIncluded} sessions included:
                  </p>
                  <ul className={`text-xs space-y-1 ${isFullProgram ? 'text-white/80' : 'text-text-secondary'}`}>
                    {product.coachingSessions > 0 && (
                      <li>• {product.coachingSessions} Coaching sessions (45 min)</li>
                    )}
                    {product.skillBuildingSessions > 0 && (
                      <li>• {product.skillBuildingSessions} Skill Building sessions (45 min)</li>
                    )}
                    {product.checkinSessions > 0 && (
                      <li>• {product.checkinSessions} Parent Check-ins (30 min)</li>
                    )}
                  </ul>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {(product.features.length > 0 ? product.features : [
                    'Everything in Free Assessment',
                    'Expert 1:1 coaching',
                    'WhatsApp support',
                    'Progress tracking',
                  ]).slice(0, 4).map((feature, idx) => (
                    <li key={idx} className={`flex items-center gap-2 text-sm ${isFullProgram ? 'text-white/90' : 'text-text-secondary'}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isFullProgram ? 'text-yellow-300' : 'text-green-400'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  href={`/enroll?product=${product.slug}`}
                  className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                    isFullProgram
                      ? 'bg-white text-[#ff0099] hover:bg-gray-100'
                      : isContinuation
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-[#ff0099] text-white hover:bg-[#e6008a]'
                  }`}
                >
                  {isContinuation ? 'Continue Journey' : 'Enroll Now'}
                </Link>

                {isContinuation && (
                  <p className={`text-center text-xs mt-2 ${isFullProgram ? 'text-white/60' : 'text-text-tertiary'}`}>
                    Requires completed Starter Pack
                  </p>
                )}
              </div>
            );
          }) : (
            <div className="md:col-span-3 text-center py-8 text-text-tertiary">
              <p>Programs loading...</p>
            </div>
          )}
        </div>

        <p className="text-center text-text-tertiary text-sm mt-8 flex items-center justify-center gap-1.5">
          <Shield className="w-4 h-4 text-green-400" />
          {guaranteeText}
        </p>
      </div>
    </section>
  );
}
