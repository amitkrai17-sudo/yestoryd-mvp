'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Shield, Star, Lock, Bell } from 'lucide-react';
import NotifyMeModal from '@/components/NotifyMeModal';

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
  isLocked?: boolean;
  lockMessage?: string | null;
}

interface SessionDurations {
  coaching: number;
  skillBuilding: number;
  checkin: number;
  discovery: number;
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
  sessionDurations?: SessionDurations;
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
  sessionDurations,
}: PricingSectionProps) {
  // Session durations from site_settings (single source of truth)
  const durations = sessionDurations || { coaching: 45, skillBuilding: 45, checkin: 45, discovery: 45 };

  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    productName: string;
    productSlug: string;
  }>({
    isOpen: false,
    productName: '',
    productSlug: '',
  });

  const openNotifyModal = (productName: string, productSlug: string) => {
    setNotifyModal({ isOpen: true, productName, productSlug });
  };

  const closeNotifyModal = () => {
    setNotifyModal({ ...notifyModal, isOpen: false });
  };

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
              className="block w-full min-h-[44px] text-center bg-white hover:bg-gray-100 text-surface-1 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-[1.02]"
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

        {/* Pricing Cards - 2 or 3 columns based on product count */}
        <div className={`grid gap-6 max-w-5xl mx-auto ${
          products.length === 2
            ? 'md:grid-cols-2 max-w-3xl'
            : 'md:grid-cols-3'
        }`}>
          {products.length > 0 ? products.map((product) => {
            const isFullProgram = product.slug === 'full';
            const isContinuation = product.slug === 'continuation';
            const savings = product.originalPrice - product.discountedPrice;
            const isLocked = product.isLocked === true;

            return (
              <div
                key={product.id}
                className={`rounded-3xl p-6 relative overflow-visible transition-all flex flex-col ${
                  isFullProgram
                    ? 'bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white ring-4 ring-[#ff0099]/30 scale-[1.02]'
                    : 'bg-surface-2 border-2 border-border'
                }`}
              >
                {/* Coming Soon Badge - top right corner */}
                {isLocked && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      isFullProgram
                        ? 'bg-yellow-400 text-gray-900'
                        : 'bg-surface-1 border border-border text-text-secondary'
                    }`}>
                      <Lock className="w-3 h-3" />
                      Mar 2026
                    </div>
                  </div>
                )}

                {/* Best Value Badge - only when not locked */}
                {isFullProgram && !isLocked && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-bl-xl text-xs font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Best Value
                  </div>
                )}
                {isContinuation && !isLocked && (
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
                  {/* Show savings for ALL products, not just featured */}
                  {savings > 0 && (
                    <p className={`text-sm font-semibold mt-1 ${isFullProgram ? 'text-yellow-300' : 'text-green-400'}`}>
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
                      <li>• {product.coachingSessions} Coaching sessions ({durations.coaching} min)</li>
                    )}
                    {product.skillBuildingSessions > 0 && (
                      <li>• {product.skillBuildingSessions} Skill Building sessions ({durations.skillBuilding} min)</li>
                    )}
                    {product.checkinSessions > 0 && (
                      <li>• {product.checkinSessions} Parent Check-ins ({durations.checkin} min)</li>
                    )}
                  </ul>
                </div>

                {/* Value-Add Features from Database */}
                {product.features && Array.isArray(product.features) && product.features.length > 0 && (
                  <ul className="space-y-2.5 mb-6">
                    {product.features.map((feature: string, idx: number) => (
                      <li
                        key={idx}
                        className={`flex items-start gap-2.5 text-sm ${isFullProgram ? 'text-white/90' : 'text-text-secondary'}`}
                      >
                        <svg
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isFullProgram ? 'text-yellow-300' : 'text-green-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{typeof feature === 'string' ? feature : String(feature)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA Section */}
                {isLocked ? (
                  <div className={`mt-auto pt-4 border-t ${isFullProgram ? 'border-white/20' : 'border-border'}`}>
                    <p className={`text-center text-sm mb-3 ${isFullProgram ? 'text-white/80' : 'text-text-secondary'}`}>
                      Be first to know when we launch
                    </p>
                    <button
                      onClick={() => openNotifyModal(product.name, product.slug)}
                      className={`w-full min-h-[44px] px-6 py-3 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        isFullProgram
                          ? 'bg-white text-[#ff0099] hover:bg-gray-100'
                          : 'bg-[#FF0099] hover:bg-[#e6008a] text-white'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                      Notify Me
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`/enroll?product=${product.slug}`}
                    className={`block w-full min-h-[44px] text-center px-6 py-3 rounded-xl font-semibold transition-all mt-auto hover:scale-[1.02] ${
                      isFullProgram
                        ? 'bg-white text-[#ff0099] hover:bg-gray-100'
                        : isContinuation
                        ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25'
                        : 'bg-[#ff0099] text-white hover:bg-[#FF0099]/90 hover:shadow-lg hover:shadow-[#FF0099]/25'
                    }`}
                  >
                    {isContinuation ? 'Continue Journey' : 'Enroll Now'}
                  </Link>
                )}

                {isContinuation && !isLocked && (
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

        <p className="text-center text-text-tertiary text-xs sm:text-sm mt-8 flex items-center justify-center gap-1.5 px-4">
          <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="leading-tight">{guaranteeText}</span>
        </p>
      </div>

      {/* Notify Me Modal */}
      <NotifyMeModal
        isOpen={notifyModal.isOpen}
        onClose={closeNotifyModal}
        productName={notifyModal.productName}
        productSlug={notifyModal.productSlug}
      />
    </section>
  );
}
