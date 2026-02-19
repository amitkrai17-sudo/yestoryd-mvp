'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Shield, Star, Lock, Bell, Heart, Sparkles, Rocket, Clock, Zap } from 'lucide-react';
import NotifyMeModal from '@/components/NotifyMeModal';

// ── Types from pricing_plans (legacy flat structure) ──
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

// ── Types from /api/pricing-display (V3 age-band structure) ──
interface PricingTier {
  slug: string;
  name: string;
  durationWeeks: number;
  originalPrice: number;
  discountedPrice: number;
  currency: string;
  sessionsCoaching: number;
  skillBoosterCredits: number;
  isFeatured: boolean;
  displayOrder: number | null;
  features: unknown;
}

interface AgeBandDisplay {
  id: string;
  displayName: string;
  ageMin: number;
  ageMax: number;
  tagline: string | null;
  shortDescription: string | null;
  icon: string | null;
  differentiators: string[];
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
  progressPulseInterval: number | null;
  tiers: PricingTier[];
}

interface PricingDisplayData {
  success: boolean;
  ageBands: AgeBandDisplay[];
  headline: string | null;
  subheadline: string | null;
  industryAvgClassCost: string | null;
  parentCallDurationMinutes: number;
}

// ── Component Props ──
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
  pricingDisplayData?: PricingDisplayData | null;
}

// ── Icon + color mapping per band ──
const BAND_CONFIG: Record<string, {
  Icon: typeof Heart;
  color: string;
  bgColor: string;
  borderColor: string;
  tabActive: string;
  glowColor: string;
}> = {
  foundation: {
    Icon: Heart,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    borderColor: 'border-pink-500/30',
    tabActive: 'bg-gradient-to-r from-pink-500 to-[#ff0099] text-white shadow-lg shadow-pink-500/25',
    glowColor: 'shadow-pink-500/10',
  },
  building: {
    Icon: Sparkles,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    tabActive: 'bg-gradient-to-r from-blue-500 to-[#00ABFF] text-white shadow-lg shadow-blue-500/25',
    glowColor: 'shadow-blue-500/10',
  },
  mastery: {
    Icon: Rocket,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
    tabActive: 'bg-gradient-to-r from-purple-500 to-[#7b008b] text-white shadow-lg shadow-purple-500/25',
    glowColor: 'shadow-purple-500/10',
  },
};

// ── Canonical product display names (keyed by pricing_plans.slug) ──
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: 'Starter',
  full: 'Full Program',
  continuation: 'Continuation',
};

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
  pricingDisplayData,
}: PricingSectionProps) {
  const durations = sessionDurations || { coaching: 45, skillBuilding: 45, checkin: 45, discovery: 45 };
  const bands = pricingDisplayData?.ageBands || [];
  const hasBands = bands.length > 0;

  const [selectedBandId, setSelectedBandId] = useState('foundation');
  const selectedBand = bands.find(b => b.id === selectedBandId) || bands[0] || null;

  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    productName: string;
    productSlug: string;
  }>({ isOpen: false, productName: '', productSlug: '' });

  const openNotifyModal = (productName: string, productSlug: string) => {
    setNotifyModal({ isOpen: true, productName, productSlug });
  };
  const closeNotifyModal = () => {
    setNotifyModal({ ...notifyModal, isOpen: false });
  };

  // Resolve headline/subheadline from pricingDisplayData or fallback to props
  const sectionTitle = (hasBands && pricingDisplayData?.headline) || title;
  const sectionSubtitle = (hasBands && pricingDisplayData?.subheadline) || subtitle;

  return (
    <section id="pricing" className="py-16 lg:py-24 bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ─── Section Header ─── */}
        <div className="text-center mb-10">
          <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {sectionTitle}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {sectionSubtitle}
          </p>
        </div>

        {/* ─── Free Assessment Card ─── */}
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

        {/* ─── Step 2 Badge ─── */}
        <div className="text-center mb-8">
          <span className="inline-block bg-[#ff0099]/10 text-[#ff0099] px-4 py-2 rounded-full text-sm font-semibold">
            {step2Badge}
          </span>
        </div>

        {/* ─── Age Band Tabs ─── */}
        {hasBands && (
          <div className="mb-8 sm:flex sm:justify-center">
            <div className="flex w-full sm:w-auto gap-1 sm:gap-2 p-1 bg-surface-1 rounded-xl overflow-hidden">
              {bands.map(band => {
                const config = BAND_CONFIG[band.id] || BAND_CONFIG.foundation;
                const BandIcon = config.Icon;
                const isActive = selectedBandId === band.id;

                return (
                  <button
                    key={band.id}
                    onClick={() => setSelectedBandId(band.id)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 min-w-0 truncate ${
                      isActive
                        ? config.tabActive
                        : 'text-text-secondary hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <BandIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{band.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Band Info Card (changes with tab) ─── */}
        {hasBands && selectedBand && (
          <div className="max-w-2xl mx-auto mb-10">
            {(() => {
              const config = BAND_CONFIG[selectedBand.id] || BAND_CONFIG.foundation;
              const BandIcon = config.Icon;
              const fullTier = selectedBand.tiers.find(t => t.slug === 'full');
              const totalHours = fullTier
                ? Math.round(
                    (fullTier.sessionsCoaching + fullTier.skillBoosterCredits) *
                    selectedBand.sessionDurationMinutes / 60
                  )
                : 0;

              return (
                <div className={`rounded-2xl p-5 sm:p-6 ${config.bgColor} border ${config.borderColor} shadow-lg ${config.glowColor} transition-all duration-300`}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <BandIcon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedBand.displayName}
                        {selectedBand.tagline && (
                          <span className={`ml-2 text-sm font-medium ${config.color}`}>
                            — {selectedBand.tagline}
                          </span>
                        )}
                      </h3>
                      {selectedBand.shortDescription && (
                        <p className="text-sm text-text-secondary mt-1">{selectedBand.shortDescription}</p>
                      )}
                    </div>
                  </div>

                  {/* Differentiators */}
                  {selectedBand.differentiators.length > 0 && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                      {selectedBand.differentiators.map((diff, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                          {diff}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Session stats row */}
                  <div className="flex flex-wrap gap-4 pt-3 mt-1 border-t border-white/10 bg-white/5 -mx-5 sm:-mx-6 px-5 sm:px-6 -mb-5 sm:-mb-6 pb-4 rounded-b-2xl">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Clock className={`w-4 h-4 ${config.color}`} />
                      <span>{selectedBand.sessionDurationMinutes}-min sessions</span>
                    </div>
                    {fullTier && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Zap className={`w-4 h-4 ${config.color}`} />
                        <span>{fullTier.sessionsCoaching} coaching + {fullTier.skillBoosterCredits} boosters</span>
                      </div>
                    )}
                    {totalHours > 0 && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Star className={`w-4 h-4 ${config.color}`} />
                        <span>{totalHours} hours total</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── Pricing Cards ─── */}
        {hasBands && selectedBand ? (
          <BandPricingCards
            tiers={selectedBand.tiers}
            bandSessionDuration={selectedBand.sessionDurationMinutes}
            openNotifyModal={openNotifyModal}
            onCTAClick={onCTAClick}
            industryAvgClassCost={pricingDisplayData?.industryAvgClassCost}
          />
        ) : (
          /* Fallback: legacy flat product cards when pricing-display API unavailable */
          <LegacyPricingCards
            products={products}
            durations={durations}
            openNotifyModal={openNotifyModal}
            onCTAClick={onCTAClick}
          />
        )}

        {/* ─── Value prop footer ─── */}
        {pricingDisplayData?.industryAvgClassCost && selectedBand && (
          <div className="text-center mt-6 space-y-1">
            {(() => {
              const fullTier = selectedBand.tiers.find(t => t.slug === 'full');
              if (!fullTier || fullTier.discountedPrice <= 0) return null;
              const weeklyPrice = Math.round(fullTier.discountedPrice / fullTier.durationWeeks);
              return (
                <>
                  <p className="text-sm text-text-secondary">
                    Works out to <span className="text-white font-semibold">₹{weeklyPrice.toLocaleString('en-IN')}/week</span>
                  </p>
                  <p className="text-xs text-text-tertiary">
                    (Industry avg: ₹{pricingDisplayData.industryAvgClassCost}/class)
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {/* ─── Guarantee ─── */}
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

// ════════════════════════════════════════════════════════════════
// Band Pricing Cards (V3 — from /api/pricing-display)
// ════════════════════════════════════════════════════════════════
function BandPricingCards({
  tiers,
  bandSessionDuration,
  openNotifyModal,
  onCTAClick,
  industryAvgClassCost,
}: {
  tiers: PricingTier[];
  bandSessionDuration: number;
  openNotifyModal: (name: string, slug: string) => void;
  onCTAClick: () => void;
  industryAvgClassCost?: string | null;
}) {
  // Sort by displayOrder
  const sortedTiers = [...tiers].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <div className={`grid gap-6 max-w-5xl mx-auto ${
      sortedTiers.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'
    }`}>
      {sortedTiers.map(tier => {
        const isFullProgram = tier.slug === 'full';
        const isContinuation = tier.slug === 'continuation';
        const savings = tier.originalPrice - tier.discountedPrice;
        const isLocked = true; // All products are locked per spec
        const totalSessions = tier.sessionsCoaching + tier.skillBoosterCredits;
        const features = Array.isArray(tier.features) ? tier.features as string[] : [];

        return (
          <div
            key={tier.slug}
            className={`rounded-3xl p-6 relative overflow-visible transition-all flex flex-col ${
              isFullProgram
                ? 'bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white ring-4 ring-[#ff0099]/30 md:scale-[1.02]'
                : 'bg-surface-2 border-2 border-border'
            }`}
          >
            {/* Badges */}
            {isFullProgram && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-yellow-400 text-gray-900 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Star className="w-3 h-3 fill-current" />
                  BEST VALUE
                </div>
              </div>
            )}
            {isContinuation && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1.5 rounded-bl-xl text-xs font-bold">
                After Starter
              </div>
            )}

            {/* Product Name — always use canonical display name, not DB label */}
            <div className="mb-4 mt-2">
              <h3 className="text-xl font-bold text-white mb-1">
                {PLAN_DISPLAY_NAMES[tier.slug] || tier.name}
              </h3>
              <p className={`text-sm ${isFullProgram ? 'text-white/80' : 'text-text-tertiary'}`}>
                {tier.durationWeeks} weeks
                {isContinuation ? ' (after Starter)' : ''}
              </p>
            </div>

            {/* Price */}
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">
                ₹{tier.discountedPrice.toLocaleString('en-IN')}
              </span>
              {savings > 0 && (
                <span className={`ml-2 line-through text-sm ${isFullProgram ? 'text-white/50' : 'text-text-tertiary'}`}>
                  ₹{tier.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
              {savings > 0 && (
                <p className={`text-sm font-semibold mt-1 ${isFullProgram ? 'text-yellow-300' : 'text-green-400'}`}>
                  Save ₹{savings.toLocaleString('en-IN')}
                </p>
              )}
            </div>

            {/* Sessions Breakdown (band-specific, changes with tab) */}
            <div className={`rounded-xl p-3 mb-4 ${isFullProgram ? 'bg-white/10' : 'bg-surface-3'}`}>
              <p className={`text-sm font-semibold mb-2 ${isFullProgram ? 'text-white' : 'text-text-secondary'}`}>
                {totalSessions} sessions included:
              </p>
              <ul className={`text-xs space-y-1 ${isFullProgram ? 'text-white/80' : 'text-text-secondary'}`}>
                <li>• {tier.sessionsCoaching} Coaching sessions ({bandSessionDuration} min)</li>
                {tier.skillBoosterCredits > 0 && (
                  <li>• Up to {tier.skillBoosterCredits} Skill Booster sessions</li>
                )}
              </ul>
            </div>

            {/* Features from database */}
            {features.length > 0 && (
              <ul className="space-y-2.5 mb-6">
                {features.map((feature: string, idx: number) => (
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{String(feature)}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* CTA — locked = Notify Me, unlocked = Enroll */}
            {isLocked ? (
              <div className={`mt-auto pt-4 border-t ${isFullProgram ? 'border-white/20' : 'border-gray-700'}`}>
                <p className={`text-center text-sm mb-3 ${isFullProgram ? 'text-white/80' : 'text-text-secondary'}`}>
                  Be first to know when we launch
                </p>
                <button
                  onClick={() => openNotifyModal(tier.name, tier.slug)}
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
                href={`/enroll?product=${tier.slug}`}
                onClick={onCTAClick}
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

            {isContinuation && (
              <p className={`text-center text-xs mt-2 ${isFullProgram ? 'text-white/60' : 'text-text-tertiary'}`}>
                Requires completed Starter Pack
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Legacy Pricing Cards (fallback when pricing-display unavailable)
// ════════════════════════════════════════════════════════════════
function LegacyPricingCards({
  products,
  durations,
  openNotifyModal,
  onCTAClick,
}: {
  products: ProductData[];
  durations: SessionDurations;
  openNotifyModal: (name: string, slug: string) => void;
  onCTAClick: () => void;
}) {
  return (
    <div className={`grid gap-6 max-w-5xl mx-auto ${
      products.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'
    }`}>
      {products.length > 0 ? products.map(product => {
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
            {isLocked && (
              <div className="absolute -top-2 -right-2 z-10">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  isFullProgram
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-surface-1 border border-border text-text-secondary'
                }`}>
                  <Lock className="w-3 h-3" />
                  Coming Soon
                </div>
              </div>
            )}
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

            <div className="mb-4 mt-2">
              <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
              <p className={`text-sm ${isFullProgram ? 'text-white/80' : 'text-text-tertiary'}`}>
                {product.description || `${product.durationMonths} month${product.durationMonths > 1 ? 's' : ''} program`}
              </p>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold text-white">
                ₹{product.discountedPrice.toLocaleString('en-IN')}
              </span>
              {savings > 0 && (
                <span className={`ml-2 line-through text-sm ${isFullProgram ? 'text-white/50' : 'text-text-tertiary'}`}>
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
              {savings > 0 && (
                <p className={`text-sm font-semibold mt-1 ${isFullProgram ? 'text-yellow-300' : 'text-green-400'}`}>
                  Save ₹{savings.toLocaleString('en-IN')}
                </p>
              )}
            </div>

            <div className={`rounded-xl p-3 mb-4 ${isFullProgram ? 'bg-white/10' : 'bg-surface-3'}`}>
              <p className={`text-sm font-semibold mb-2 ${isFullProgram ? 'text-white' : 'text-text-secondary'}`}>
                {product.sessionsIncluded} sessions included:
              </p>
              <ul className={`text-xs space-y-1 ${isFullProgram ? 'text-white/80' : 'text-text-secondary'}`}>
                {product.coachingSessions > 0 && (
                  <li>• {product.coachingSessions} Coaching sessions ({durations.coaching} min)</li>
                )}
                {product.skillBuildingSessions > 0 && (
                  <li>• {product.skillBuildingSessions} Skill Booster sessions ({durations.skillBuilding} min)</li>
                )}
                {product.checkinSessions > 0 && (
                  <li>• {product.checkinSessions} Parent Check-ins ({durations.checkin} min)</li>
                )}
              </ul>
            </div>

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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{String(feature)}</span>
                  </li>
                ))}
              </ul>
            )}

            {isLocked ? (
              <div className={`mt-auto pt-4 border-t ${isFullProgram ? 'border-white/20' : 'border-gray-700'}`}>
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
                onClick={onCTAClick}
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
  );
}
