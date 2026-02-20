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
  improving: { label: 'Improving', color: 'text-green-400', Icon: TrendingUp },
  stable: { label: 'Stable', color: 'text-blue-400', Icon: ArrowRight },
  declining: { label: 'Needs Attention', color: 'text-amber-400', Icon: TrendingDown },
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
    <div className="bg-gradient-to-br from-[#7b008b]/20 via-surface-1 to-[#ff0099]/10
                    border border-[#7b008b]/30 rounded-2xl overflow-hidden
                    shadow-lg shadow-black/20 w-full">
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
              <h3 className="text-lg font-bold text-white">rAI Insight</h3>
              <Sparkles className="w-4 h-4 text-[#ff0099]" />
            </div>
            <p className="text-sm text-text-secondary">
              {childName}&apos;s learning intelligence
            </p>
          </div>
        </div>

        {/* Reading Level + Trend */}
        {reading_level?.current && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold
                           bg-[#7b008b]/20 text-[#ff0099] border border-[#7b008b]/30">
              <BookOpen className="w-3.5 h-3.5" />
              {reading_level.current}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-2 ${trend.color}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.label}
            </span>
            {sessions_completed != null && (
              <span className="text-xs text-text-tertiary">
                {sessions_completed} sessions done
                {sessions_remaining ? ` · ${sessions_remaining} left` : ''}
              </span>
            )}
          </div>
        )}

        {/* Next Session Focus */}
        {recommended_focus_next_session && (
          <div className="mt-4 bg-surface-1/70 rounded-xl p-4 border border-[#7b008b]/20">
            <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#ff0099]" />
              Next Session Focus
            </p>
            <p className="text-sm text-white font-medium leading-snug">
              {recommended_focus_next_session}
            </p>
          </div>
        )}

        {/* What Works preview (collapsed) */}
        {what_works && what_works.length > 0 && !expanded && (
          <div className="mt-3">
            <p className="text-xs text-text-tertiary flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              What works: <span className="text-green-400">{what_works[0]}</span>
              {what_works.length > 1 && (
                <span className="text-text-tertiary ml-1">+{what_works.length - 1} more</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium
                   text-[#ff0099] hover:text-white transition-colors border-t border-border/50"
      >
        {expanded ? (
          <>Show Less <ChevronUp className="w-4 h-4" /></>
        ) : (
          <>See More <ChevronDown className="w-4 h-4" /></>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/30">
          {/* What Works */}
          {what_works && what_works.length > 0 && (
            <div className="pt-4">
              <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4" />
                What Works for {childName}
              </h4>
              <ul className="space-y-1.5">
                {what_works.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-green-400 mt-0.5">+</span>
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
              <p className="text-sm text-text-secondary leading-relaxed">{personality_notes}</p>
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
                  parent_engagement.level === 'high' ? 'text-green-400' :
                  parent_engagement.level === 'medium' ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {parent_engagement.level.charAt(0).toUpperCase() + parent_engagement.level.slice(1)}
                </span>
                {parent_engagement.task_completion_rate != null && (
                  <span className="text-xs text-text-tertiary">
                    Tasks completed: {Math.round(parent_engagement.task_completion_rate * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="pt-2 border-t border-border/30">
              <span className="text-xs text-text-tertiary">
                Updated {lastUpdated} · Powered by rAI
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
