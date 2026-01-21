'use client';

import { ShieldCheck, CheckCircle, Lock, Star } from 'lucide-react';

interface MoneyBackGuaranteeProps {
  variant?: 'badge' | 'card' | 'inline';
  className?: string;
}

export default function MoneyBackGuarantee({
  variant = 'card',
  className = '',
}: MoneyBackGuaranteeProps) {
  // Badge variant - small, for checkout buttons
  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-2 text-green-700 ${className}`}>
        <ShieldCheck className="w-5 h-5" />
        <span className="text-sm font-medium">100% Money-Back Guarantee</span>
      </div>
    );
  }

  // Inline variant - single line
  if (variant === 'inline') {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg ${className}`}
      >
        <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-800">
          <span className="font-bold">100% Satisfaction Guarantee:</span>{' '}
          No improvement after 3 sessions? Full refund, no questions asked.
        </p>
      </div>
    );
  }

  // Card variant - full featured (default)
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 ${className}`}
    >
      {/* Decorative shield in background */}
      <div className="absolute -right-8 -bottom-8 opacity-5">
        <ShieldCheck className="w-40 h-40 text-green-800" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              100% Satisfaction Guarantee
            </h3>
            <p className="text-sm text-green-700">Risk-free investment in your child</p>
          </div>
        </div>

        {/* Main text */}
        <p className="text-green-800 mb-4">
          If you don't see improvement in your child's reading confidence after{' '}
          <strong>3 sessions</strong>, we'll refund your full payment.{' '}
          <strong>No questions asked.</strong>
        </p>

        {/* What counts as improvement */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-green-700">
            What we measure:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              'Reading confidence',
              'Fluency improvement',
              'Willingness to read aloud',
              'Parent satisfaction',
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export a simpler trust badge for use near buttons
export function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
      <div className="flex items-center gap-1">
        <ShieldCheck className="w-4 h-4 text-green-500" />
        <span>Money-back guarantee</span>
      </div>
      <div className="flex items-center gap-1">
        <Lock className="w-4 h-4 text-emerald-500" />
        <span>Secure payment</span>
      </div>
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span>500+ happy parents</span>
      </div>
    </div>
  );
}
