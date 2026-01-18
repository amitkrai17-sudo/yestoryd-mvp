// ============================================================
// FILE: components/parent/PendingSkillBoosterCard.tsx
// PURPOSE: Shows pending Skill Booster session in parent dashboard
// ============================================================

'use client';

import { Zap, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PendingSkillBoosterSession {
  id: string;
  focus_area: string;
  coach_notes?: string;
  coach_name: string;
  created_at: string;
}

interface PendingSkillBoosterCardProps {
  session: PendingSkillBoosterSession;
  childName: string;
}

const FOCUS_AREA_LABELS: Record<string, string> = {
  phonics_sounds: 'Phonics & Letter Sounds',
  reading_fluency: 'Reading Fluency',
  comprehension: 'Reading Comprehension',
  vocabulary: 'Vocabulary Building',
  grammar: 'Grammar & Sentence Structure',
  confidence: 'Speaking Confidence',
  specific_sounds: 'Specific Sound Practice',
  other: 'Special Focus',
};

export default function PendingSkillBoosterCard({ session, childName }: PendingSkillBoosterCardProps) {
  const focusAreaLabel = FOCUS_AREA_LABELS[session.focus_area] || session.focus_area;

  // Calculate days since recommendation
  const daysSince = Math.floor(
    (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10
                    border border-yellow-500/30 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-6 h-6 text-yellow-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Skill Booster Session Recommended
          </h3>

          <p className="text-gray-600 text-sm mb-3">
            Coach {session.coach_name} recommends a Skill Booster session for {childName} focusing on{' '}
            <strong className="text-gray-800">{focusAreaLabel}</strong>.
          </p>

          {/* Info Badge */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              ✓ Free - Included in your program
            </span>
            {daysSince > 0 && (
              <span className="text-xs text-gray-500">
                Recommended {daysSince} day{daysSince > 1 ? 's' : ''} ago
              </span>
            )}
          </div>

          {/* CTA Button */}
          <Link
            href={`/parent/book-skill-booster/${session.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5
                     bg-gradient-to-r from-[#ff0099] to-[#7b008b]
                     text-white font-medium rounded-xl hover:opacity-90
                     transition-opacity shadow-lg shadow-[#ff0099]/20"
          >
            <Calendar className="w-5 h-5" />
            Book Time Slot
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
