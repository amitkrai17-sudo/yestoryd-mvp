'use client';

import { Zap } from 'lucide-react';
import SupportWidget from '@/components/support/SupportWidget';
import ReferralCard from '@/components/parent/ReferralCard';
import ChildTimeline from '@/components/parent/ChildTimeline';
import type { LearningProfile } from '@/components/parent/AIInsightCard';

interface CROSectionProps {
  childId: string;
  childName: string;
  parentEmail: string;
  parentName: string;
  learningProfile: LearningProfile | null;
  croSettings: Record<string, string>;
}

export default function CROSection({
  childId,
  childName,
  parentEmail,
  parentName,
  learningProfile,
  croSettings,
}: CROSectionProps) {
  return (
    <>
      {/* Child Timeline */}
      <ChildTimeline childId={childId} childName={childName} />

      {/* Support Widget */}
      <SupportWidget
        userType="parent"
        userEmail={parentEmail}
        userName={parentName}
        childName={childName}
        variant="card"
      />

      {/* Referral Card */}
      <ReferralCard
        parentEmail={parentEmail}
        childName={childName}
        croSettings={croSettings}
      />

      {/* Trust Element */}
      {croSettings['trust_families_count'] && parseInt(croSettings['trust_families_count']) > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Trusted by {croSettings['trust_families_count']}+ families
        </p>
      )}

      {/* rAI Tip */}
      <div className="bg-gradient-to-r from-[#7B008B] to-[#FF0099] rounded-2xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">rAI says</h3>
            <p className="text-white/90 text-base mt-1">
              {learningProfile?.what_works && learningProfile.what_works.length > 0
                ? `Tip: ${learningProfile.what_works[0]}. Keep it up!`
                : 'Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration!'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
