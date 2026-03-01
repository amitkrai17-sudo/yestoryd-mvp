// =============================================================================
// FILE: components/parent/ReEnrollmentBanner.tsx
// PURPOSE: CRO - Subtle re-enrollment nudge when sessions remaining <= 2
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';

interface ReEnrollmentBannerProps {
  childId: string;
  childName: string;
  sessionsRemaining: number;
  croSettings: Record<string, string>;
}

export default function ReEnrollmentBanner({
  childId,
  childName,
  sessionsRemaining,
  croSettings,
}: ReEnrollmentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const val = sessionStorage.getItem(`yestoryd_dismiss_reenroll_${childId}`);
        if (val) setDismissed(true);
      }
    } catch {}
  }, [childId]);

  if (dismissed || sessionsRemaining > 2 || sessionsRemaining < 0) return null;

  const heading = (croSettings['re_enrollment_heading'] || '{child_name} is making great progress!')
    .replace('{child_name}', childName)
    .replace(/\{child_name\}/g, childName);

  const subtext = croSettings['re_enrollment_subtext'] || 'Continue the journey';
  const ctaText = croSettings['re_enrollment_cta'] || 'Renew Plan';
  const trustText = croSettings['re_enrollment_trust'] || 'Flexible plans \u2014 pause anytime';

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`yestoryd_dismiss_reenroll_${childId}`, '1');
    } catch {}
  };

  return (
    <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-5 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <h3 className="text-base font-semibold text-gray-900 pr-8">{heading}</h3>
      <p className="text-sm text-gray-600 mt-1">
        {subtext} &mdash; {sessionsRemaining} session{sessionsRemaining !== 1 ? 's' : ''} remaining in current plan
      </p>

      <Link
        href={`/parent/re-enroll/${childId}`}
        className="mt-3 inline-flex items-center gap-2 bg-[#FF0099] text-white rounded-xl h-12 px-6 font-medium hover:bg-[#CC007A] transition-all duration-200"
      >
        {ctaText}
        <ArrowRight className="w-4 h-4" />
      </Link>

      <p className="text-xs text-gray-500 mt-2">{trustText}</p>
    </div>
  );
}
