'use client';

import Link from 'next/link';
import {
  Award,
  Calendar,
  CreditCard,
  Loader2,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
} from 'lucide-react';

interface Pricing {
  programPrice: number;
  originalPrice: number;
  displayPrice: string;
  displayOriginalPrice: string;
  discountLabel: string;
  sessionsIncluded: number;
  durationMonths: number;
}

interface PaymentSectionProps {
  pricing: Pricing | null;
  productName?: string;
  loading: boolean;
  razorpayLoaded: boolean;
  error: string;
  whatsappNumber: string;
  whatsappMessage: string;
  renderCtaText: () => React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  formData: { parentName: string; childName: string };
  source: string;
  children: React.ReactNode;
}

export function PaymentSection({
  pricing,
  productName,
  loading,
  razorpayLoaded,
  error,
  whatsappNumber,
  whatsappMessage,
  renderCtaText,
  onSubmit,
  formData,
  source,
  children,
}: PaymentSectionProps) {
  return (
    <div className="bg-surface-1 rounded-xl border-2 border-border overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white">
        {!pricing ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Loading pricing...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold truncate">
                  {productName || `${pricing.durationMonths}-Month Reading Coaching`}
                </h2>
                <p className="text-white/80 text-xs">{pricing.sessionsIncluded} sessions • Everything included</p>
              </div>
              <div className="text-right flex-shrink-0">
                {pricing.originalPrice > pricing.programPrice && (
                  <div className="text-xs line-through text-white/60">{pricing.displayOriginalPrice}</div>
                )}
                <div className="text-xl sm:text-2xl font-black">{pricing.displayPrice}</div>
              </div>
            </div>
            {pricing.discountLabel && (
              <div className="mt-2 inline-block bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full text-xs font-bold">
                {pricing.discountLabel}
              </div>
            )}
          </>
        )}
      </div>

      {/* Personalized Welcome - if coming from assessment/lets-talk */}
      {(formData.parentName || formData.childName) && source !== 'direct' && (
        <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-[#FF0099]/10 to-purple-500/10 rounded-xl border border-[#FF0099]/20">
          <p className="text-sm text-text-secondary flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#FF0099] flex-shrink-0 mt-0.5" />
            <span className="break-words">
              {formData.parentName ? (
                <>Welcome back, <strong className="break-all text-white">{formData.parentName.split(' ')[0]}</strong>! {formData.childName ? `Ready to start ${formData.childName}'s reading journey?` : 'Complete your enrollment below.'}</>
              ) : (
                <>Ready to start <strong className="break-all text-white">{formData.childName}</strong>&apos;s reading journey?</>
              )}
            </span>
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={onSubmit} className="p-4 space-y-3">
        {children}

        {/* Error */}
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{error}</div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !razorpayLoaded}
          className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30 mt-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {renderCtaText()}
            </>
          )}
        </button>

        {/* Trust Signals */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-text-tertiary pt-2">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-400 flex-shrink-0" />
            <span className="whitespace-nowrap">100% Refund</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <span className="whitespace-nowrap">Flexible</span>
          </span>
          <span className="flex items-center gap-1">
            <Award className="w-3 h-3 text-purple-400 flex-shrink-0" />
            <span className="whitespace-nowrap">Certified</span>
          </span>
        </div>

        {/* Secure Payment Badge */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <Shield className="w-4 h-4 text-text-tertiary" />
          <span className="text-xs text-text-tertiary">Secure payment via Razorpay</span>
        </div>
      </form>

      {/* Alternative */}
      <div className="p-4 border-t border-border bg-surface-2">
        <p className="text-center text-text-secondary text-xs mb-2">Need help deciding?</p>
        <div className="flex gap-2">
          <Link
            href="/lets-talk"
            className="flex-1 h-10 flex items-center justify-center gap-1 bg-purple-500/20 text-purple-300 font-semibold rounded-lg text-sm hover:bg-purple-500/30 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Free Call
          </Link>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
