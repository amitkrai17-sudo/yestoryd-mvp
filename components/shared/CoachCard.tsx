// ============================================================
// COACH CARD COMPONENT
// File: components/shared/CoachCard.tsx
// Display coach info with match score for smart matching
// ============================================================

'use client';

import React from 'react';
import Image from 'next/image';
import { 
  Star, Clock, Users, Award, Check, 
  ChevronRight, Calendar, Sparkles
} from 'lucide-react';
import { SkillTagDisplay } from './SkillTagSelector';

// =====================================================
// TYPES
// =====================================================
interface MatchedCoach {
  coach_id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  match_score: number;
  matched_skills: string[];
  unmet_needs: string[];
  available_slots_count: number;
  avg_rating: number;
  total_sessions_completed: number;
  years_experience: number;
  is_accepting_new: boolean;
  timezone?: string;
}

interface CoachCardProps {
  coach: MatchedCoach;
  onSelect?: (coachId: string) => void;
  onViewAvailability?: (coachId: string) => void;
  isSelected?: boolean;
  showMatchScore?: boolean;
  compact?: boolean;
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function CoachCard({
  coach,
  onSelect,
  onViewAvailability,
  isSelected = false,
  showMatchScore = true,
  compact = false,
}: CoachCardProps) {
  // Match score color
  const getMatchColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-500' };
    if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-500' };
    return { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-500' };
  };

  const matchColors = getMatchColor(coach.match_score);

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(coach.coach_id)}
        className={`
          p-4 rounded-xl border-2 cursor-pointer transition-all
          ${isSelected 
            ? 'border-pink-500 bg-pink-50 shadow-md' 
            : 'border-gray-200 hover:border-pink-300 hover:shadow-sm bg-white'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {coach.photo_url ? (
              <Image
                src={coach.photo_url}
                alt={coach.name}
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold">
                {coach.name.charAt(0)}
              </div>
            )}
            {showMatchScore && (
              <div className={`
                absolute -top-1 -right-1 w-6 h-6 rounded-full 
                ${matchColors.bg} ${matchColors.text}
                flex items-center justify-center text-xs font-bold
                border-2 border-white
              `}>
                {coach.match_score}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{coach.name}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span>{coach.avg_rating.toFixed(1)}</span>
              <span className="text-gray-300">•</span>
              <span>{coach.total_sessions_completed} sessions</span>
            </div>
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="w-6 h-6 rounded-full bg-pink-600 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-white rounded-2xl border-2 overflow-hidden transition-all
        ${isSelected 
          ? 'border-pink-500 ring-4 ring-pink-100 shadow-lg' 
          : 'border-gray-200 hover:border-pink-300 hover:shadow-md'
        }
      `}
    >
      {/* Header with match score */}
      {showMatchScore && (
        <div className={`px-4 py-2 ${matchColors.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${matchColors.text}`} />
            <span className={`text-sm font-medium ${matchColors.text}`}>
              {coach.match_score}% Match
            </span>
          </div>
          {coach.matched_skills.length > 0 && (
            <span className="text-xs text-gray-600">
              {coach.matched_skills.length} matching skills
            </span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="p-5">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {coach.photo_url ? (
              <Image
                src={coach.photo_url}
                alt={coach.name}
                width={72}
                height={72}
                className="rounded-xl object-cover"
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white text-2xl font-bold">
                {coach.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{coach.name}</h3>
            
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium">{coach.avg_rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{coach.total_sessions_completed} sessions</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4 text-gray-400" />
                <span>{coach.years_experience}+ years exp</span>
              </div>
            </div>

            {/* Bio */}
            {coach.bio && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {coach.bio}
              </p>
            )}
          </div>
        </div>

        {/* Matched skills */}
        {coach.matched_skills.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Matching Skills
            </h4>
            <SkillTagDisplay tags={coach.matched_skills} maxVisible={6} size="xs" />
          </div>
        )}

        {/* Unmet needs warning */}
        {coach.unmet_needs.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">
              <span className="font-medium">Note:</span> This coach doesn't specialize in{' '}
              {coach.unmet_needs.slice(0, 2).join(', ')}
              {coach.unmet_needs.length > 2 && ` and ${coach.unmet_needs.length - 2} more`}
            </p>
          </div>
        )}

        {/* Availability indicator */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className={coach.available_slots_count > 0 ? 'text-green-600' : 'text-gray-500'}>
              {coach.available_slots_count > 0 
                ? `${coach.available_slots_count} slots available` 
                : 'Limited availability'
              }
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          {onViewAvailability && (
            <button
              onClick={() => onViewAvailability(coach.coach_id)}
              className="
                flex-1 flex items-center justify-center gap-2
                px-4 py-2.5 border border-gray-200 rounded-xl
                text-gray-700 hover:bg-gray-50 transition-colors
              "
            >
              <Calendar className="w-4 h-4" />
              View Schedule
            </button>
          )}
          {onSelect && (
            <button
              onClick={() => onSelect(coach.coach_id)}
              className={`
                flex-1 flex items-center justify-center gap-2
                px-4 py-2.5 rounded-xl transition-colors
                ${isSelected 
                  ? 'bg-pink-600 text-white' 
                  : 'bg-pink-600 text-white hover:bg-pink-700'
                }
              `}
            >
              {isSelected ? (
                <>
                  <Check className="w-4 h-4" />
                  Selected
                </>
              ) : (
                <>
                  Select Coach
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// COACH LIST COMPONENT
// =====================================================
export function CoachMatchList({
  coaches,
  selectedCoachId,
  onSelectCoach,
  onViewAvailability,
  isLoading,
  searchCriteria,
}: {
  coaches: MatchedCoach[];
  selectedCoachId?: string;
  onSelectCoach?: (coachId: string) => void;
  onViewAvailability?: (coachId: string) => void;
  isLoading?: boolean;
  searchCriteria?: {
    learning_needs_display: string[];
  };
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (coaches.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No matching coaches found</h3>
        <p className="text-gray-500 mt-1">
          Try adjusting your search criteria or check back later
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search criteria summary */}
      {searchCriteria && searchCriteria.learning_needs_display.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Searching for coaches with skills in:</span>{' '}
            {searchCriteria.learning_needs_display.join(', ')}
          </p>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-600">
        Found {coaches.length} matching coach{coaches.length !== 1 ? 'es' : ''}
      </p>

      {/* Coach cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {coaches.map((coach) => (
          <CoachCard
            key={coach.coach_id}
            coach={coach}
            onSelect={onSelectCoach}
            onViewAvailability={onViewAvailability}
            isSelected={selectedCoachId === coach.coach_id}
            showMatchScore={true}
          />
        ))}
      </div>
    </div>
  );
}
