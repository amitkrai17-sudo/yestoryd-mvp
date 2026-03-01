'use client';

import { useState } from 'react';
import {
  Sparkles, TrendingUp, TrendingDown, ArrowRight,
  ChevronDown, ChevronUp, Target, Lightbulb,
  Brain, BookOpen,
} from 'lucide-react';

export interface LearningProfile {
  last_updated?: string;
  reading_level?: {
    current?: string;
    wpm?: number | null;
    trend?: string;
  };
  recommended_focus_next_session?: string;
  what_works?: string[];
  what_doesnt_work?: string[];
  personality_notes?: string;
  parent_engagement?: {
    level?: string;
    task_completion_rate?: number;
  };
  sessions_completed?: number;
  sessions_remaining?: number;
  active_skills?: string[];
  mastered_skills?: string[];
  struggle_areas?: { skill: string; sessions_struggling?: number; severity?: string }[];
}

interface AIInsightCardProps {
  learningProfile: LearningProfile;
  childName: string;
}

const TREND_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  improving: { label: 'Improving', color: 'text-green-600', Icon: TrendingUp },
  stable: { label: 'Stable', color: 'text-blue-600', Icon: ArrowRight },
  declining: { label: 'Needs Attention', color: 'text-amber-600', Icon: TrendingDown },
};

export default function AIInsightCard({ learningProfile, childName }: AIInsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    reading_level,
    recommended_focus_next_session,
    what_works,
    personality_notes,
    parent_engagement,
    sessions_completed,
    sessions_remaining,
  } = learningProfile;

  const trend = TREND_CONFIG[reading_level?.trend || ''] || TREND_CONFIG.stable;
  const TrendIcon = trend.Icon;

  const lastUpdated = learningProfile.last_updated
    ? new Date(learningProfile.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  // Don't render if profile is essentially empty
  const hasContent = reading_level?.current || recommended_focus_next_session || (what_works && what_works.length > 0);
  if (!hasContent) return null;

  return (
    <div className="bg-gradient-to-r from-pink-50 to-white
                    border border-gray-100 rounded-2xl overflow-hidden
                    shadow-sm w-full">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#7b008b] to-[#ff0099]
                          rounded-xl flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-[#7b008b]/30">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">rAI Insight</h3>
              <Sparkles className="w-4 h-4 text-[#ff0099]" />
            </div>
            <p className="text-sm text-gray-600">
              {childName}&apos;s learning intelligence
            </p>
          </div>
        </div>

        {/* Reading Level + Trend */}
        {reading_level?.current && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold
                           bg-pink-50 text-[#ff0099] border border-pink-200">
              <BookOpen className="w-3.5 h-3.5" />
              {reading_level.current}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-50 ${trend.color}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.label}
            </span>
            {sessions_completed != null && (
              <span className="text-xs text-gray-500">
                {sessions_completed} sessions done
                {sessions_remaining ? ` · ${sessions_remaining} left` : ''}
              </span>
            )}
          </div>
        )}

        {/* Next Session Focus */}
        {recommended_focus_next_session && (
          <div className="mt-4 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#ff0099]" />
              Next Session Focus
            </p>
            <p className="text-sm text-gray-900 font-medium leading-snug">
              {recommended_focus_next_session}
            </p>
          </div>
        )}

        {/* What Works preview (collapsed) */}
        {what_works && what_works.length > 0 && !expanded && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              What works: <span className="text-green-600">{what_works[0]}</span>
              {what_works.length > 1 && (
                <span className="text-gray-500 ml-1">+{what_works.length - 1} more</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium
                   text-[#ff0099] hover:text-[#7B008B] transition-colors border-t border-gray-200"
      >
        {expanded ? (
          <>Show Less <ChevronUp className="w-4 h-4" /></>
        ) : (
          <>See More <ChevronDown className="w-4 h-4" /></>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-200">
          {/* What Works */}
          {what_works && what_works.length > 0 && (
            <div className="pt-4">
              <h4 className="text-sm font-semibold text-green-600 flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4" />
                What Works for {childName}
              </h4>
              <ul className="space-y-1.5">
                {what_works.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-600 mt-0.5">+</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Personality Notes */}
          {personality_notes && (
            <div>
              <h4 className="text-sm font-semibold text-[#00abff] flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4" />
                Learner Profile
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">{personality_notes}</p>
            </div>
          )}

          {/* Parent Engagement */}
          {parent_engagement && parent_engagement.level && (
            <div>
              <h4 className="text-sm font-semibold text-[#ff0099] flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" />
                Your Engagement
              </h4>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${
                  parent_engagement.level === 'high' ? 'text-green-600' :
                  parent_engagement.level === 'medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {parent_engagement.level.charAt(0).toUpperCase() + parent_engagement.level.slice(1)}
                </span>
                {parent_engagement.task_completion_rate != null && (
                  <span className="text-xs text-gray-500">
                    Tasks completed: {Math.round(parent_engagement.task_completion_rate * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Updated {lastUpdated} · Powered by rAI
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
