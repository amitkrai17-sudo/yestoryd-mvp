'use client';

import { useState } from 'react';
import {
  Brain, Sparkles, TrendingUp, TrendingDown, ArrowRight,
  ChevronDown, ChevronUp, Target, Lightbulb, BookOpen,
  CheckCircle, AlertTriangle, BarChart3,
} from 'lucide-react';

interface LearningProfile {
  last_updated?: string;
  reading_level?: {
    current?: string;
    wpm?: number | null;
    trend?: string;
  };
  active_skills?: string[];
  mastered_skills?: string[];
  struggle_areas?: { skill: string; sessions_struggling?: number; severity?: string }[];
  what_works?: string[];
  what_doesnt_work?: string[];
  personality_notes?: string;
  parent_engagement?: {
    level?: string;
    task_completion_rate?: number;
  };
  recommended_focus_next_session?: string;
  sessions_completed?: number;
  sessions_remaining?: number;
}

interface StudentIntelligenceCardProps {
  learningProfile: LearningProfile | null;
  childName: string;
  sessionsCompleted?: number;
  totalSessions?: number;
}

const TREND_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  improving: { label: 'Improving', color: 'text-green-400', Icon: TrendingUp },
  stable: { label: 'Stable', color: 'text-blue-400', Icon: ArrowRight },
  declining: { label: 'Needs Attention', color: 'text-amber-400', Icon: TrendingDown },
};

function formatSkillTag(tag: string): string {
  return tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function StudentIntelligenceCard({
  learningProfile,
  childName,
  sessionsCompleted,
  totalSessions,
}: StudentIntelligenceCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Empty state
  if (!learningProfile) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 lg:p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#00ABFF] to-[#7B008B] rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              rAI Intelligence
              <Sparkles className="w-3.5 h-3.5 text-[#00ABFF]" />
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Intelligence profile builds after the first session
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    reading_level,
    mastered_skills = [],
    active_skills = [],
    struggle_areas = [],
    what_works = [],
    what_doesnt_work = [],
    personality_notes,
    parent_engagement,
    recommended_focus_next_session,
  } = learningProfile;

  const completedCount = sessionsCompleted ?? learningProfile.sessions_completed;
  const remainingCount = totalSessions != null && completedCount != null
    ? totalSessions - completedCount
    : learningProfile.sessions_remaining;

  const trend = TREND_CONFIG[reading_level?.trend || ''] || TREND_CONFIG.stable;
  const TrendIcon = trend.Icon;

  const lastUpdated = learningProfile.last_updated
    ? new Date(learningProfile.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 lg:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#00ABFF] to-[#7B008B] rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              rAI Student Intelligence
              <Sparkles className="w-3.5 h-3.5 text-[#00ABFF]" />
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {reading_level?.current && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                               bg-[#00ABFF]/15 text-[#00ABFF] border border-[#00ABFF]/30">
                  <BookOpen className="w-3 h-3" />
                  {reading_level.current}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700/50 ${trend.color}`}>
                <TrendIcon className="w-3 h-3" />
                {trend.label}
              </span>
              {completedCount != null && (
                <span className="text-xs text-gray-400">
                  Session {completedCount}{totalSessions ? `/${totalSessions}` : ''}
                  {remainingCount != null && remainingCount > 0 ? ` · ${remainingCount} left` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Recommended Focus — always visible */}
        {recommended_focus_next_session && (
          <div className="mt-3 bg-gray-700/30 rounded-xl p-3 border border-gray-600/30">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-[#FF0099]" />
              Recommended Next Session Focus
            </p>
            <p className="text-sm text-white font-medium leading-snug">
              {recommended_focus_next_session}
            </p>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                   text-[#00ABFF] hover:text-white transition-colors border-t border-gray-700/50"
      >
        {expanded ? (
          <>Collapse <ChevronUp className="w-3.5 h-3.5" /></>
        ) : (
          <>Full Profile <ChevronDown className="w-3.5 h-3.5" /></>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 lg:px-5 pb-4 lg:pb-5 space-y-4 border-t border-gray-700/30">

          {/* Skills Overview */}
          {(mastered_skills.length > 0 || active_skills.length > 0 || struggle_areas.length > 0) && (
            <div className="pt-3">
              <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 mb-2">
                <BarChart3 className="w-3.5 h-3.5 text-[#00ABFF]" />
                Skills Overview
              </h4>
              <div className="space-y-2.5">
                {mastered_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mastered_skills.map((skill, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium
                                             bg-green-500/15 text-green-400 border border-green-500/25">
                        <CheckCircle className="w-3 h-3" />
                        {formatSkillTag(skill)}
                      </span>
                    ))}
                  </div>
                )}
                {active_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {active_skills.map((skill, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium
                                             bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        <Target className="w-3 h-3" />
                        {formatSkillTag(skill)}
                      </span>
                    ))}
                  </div>
                )}
                {struggle_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {struggle_areas.map((area, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border
                        ${area.severity === 'severe' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                          area.severity === 'moderate' ? 'bg-orange-500/15 text-orange-400 border-orange-500/25' :
                          'bg-amber-500/15 text-amber-400 border-amber-500/25'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {formatSkillTag(area.skill)}
                        {area.sessions_struggling && area.sessions_struggling > 1 && (
                          <span className="opacity-70">({area.sessions_struggling}s)</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What Works / Doesn't Work */}
          {(what_works.length > 0 || what_doesnt_work.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {what_works.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-400 flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    What Works
                  </h4>
                  <ul className="space-y-1">
                    {what_works.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                        <span className="text-green-400 mt-0.5">+</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {what_doesnt_work.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Avoid
                  </h4>
                  <ul className="space-y-1">
                    {what_doesnt_work.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                        <span className="text-red-400 mt-0.5">-</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Personality Notes */}
          {personality_notes && (
            <div>
              <h4 className="text-xs font-semibold text-[#00ABFF] flex items-center gap-1.5 mb-1.5">
                <Brain className="w-3.5 h-3.5" />
                Learner Profile
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">{personality_notes}</p>
            </div>
          )}

          {/* Parent Engagement */}
          {parent_engagement && parent_engagement.level && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 mb-1.5">
                <Target className="w-3.5 h-3.5" />
                Parent Engagement
              </h4>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${
                  parent_engagement.level === 'high' ? 'text-green-400' :
                  parent_engagement.level === 'medium' ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {parent_engagement.level.charAt(0).toUpperCase() + parent_engagement.level.slice(1)}
                </span>
                {parent_engagement.task_completion_rate != null && (
                  <>
                    <span className="text-gray-600">·</span>
                    <span className="text-xs text-gray-400">
                      {Math.round(parent_engagement.task_completion_rate * 100)}% tasks completed
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          {lastUpdated && (
            <div className="pt-2 border-t border-gray-700/30">
              <span className="text-[10px] text-gray-500">
                Updated {lastUpdated} · Powered by rAI
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
