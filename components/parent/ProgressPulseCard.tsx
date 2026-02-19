'use client';

import { useState } from 'react';
import {
  TrendingUp, Star, ChevronDown, ChevronUp,
  Sparkles, Target, BookOpen, ArrowUpRight,
  ArrowRight, CheckCircle,
} from 'lucide-react';

interface ProgressPulseData {
  id: string;
  event_date: string;
  data: {
    pulse_number: number;
    completed_sessions: number;
    overall_progress: string;
    confidence_trend: string;
    headline: string;
    parent_summary: string;
    strengths: string[];
    focus_areas: string[];
    home_activities: string[];
    coach_notes: string;
    milestone_reached?: string;
  };
}

interface ProgressPulseCardProps {
  pulse: ProgressPulseData | null;
  childName: string;
}

const PROGRESS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  emerging: { label: 'Emerging', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  developing: { label: 'Developing', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  proficient: { label: 'Proficient', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  advanced: { label: 'Advanced', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
};

const TREND_LABELS: Record<string, { label: string; color: string; Icon: any }> = {
  rising: { label: 'Rising', color: 'text-green-400', Icon: ArrowUpRight },
  steady: { label: 'Steady', color: 'text-blue-400', Icon: ArrowRight },
  needs_attention: { label: 'Needs Focus', color: 'text-amber-400', Icon: Target },
};

/** Safely coerce Gemini output (string | string[] | null) into string[] */
const toArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
};

export default function ProgressPulseCard({ pulse, childName }: ProgressPulseCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!pulse) return null;

  const { data } = pulse;
  const strengths = toArray(data.strengths);
  const focusAreas = toArray(data.focus_areas);
  const homeActivities = toArray(data.home_activities);
  const progressInfo = PROGRESS_LABELS[data.overall_progress] || PROGRESS_LABELS.developing;
  const trendInfo = TREND_LABELS[data.confidence_trend] || TREND_LABELS.steady;
  const TrendIcon = trendInfo.Icon;

  const pulseDate = new Date(pulse.event_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="bg-gradient-to-br from-[#7b008b]/20 via-surface-1 to-[#ff0099]/10
                    border border-[#7b008b]/30 rounded-2xl overflow-hidden
                    shadow-lg shadow-black/20 w-full">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-14 h-14 bg-gradient-to-br from-[#7b008b] to-[#ff0099]
                          rounded-xl flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-[#7b008b]/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">Progress Pulse</h3>
              <span className="text-xs text-text-tertiary">#{data.pulse_number}</span>
            </div>
            <p className="text-sm text-text-secondary">{pulseDate}</p>
          </div>
        </div>

        {/* Headline */}
        <p className="mt-3 text-base text-white font-medium leading-snug">
          {data.headline}
        </p>

        {/* Progress + Confidence badges */}
        <div className="flex items-center gap-3 mt-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${progressInfo.bgColor} ${progressInfo.color}`}>
            <Star className="w-3.5 h-3.5" />
            {progressInfo.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-2 ${trendInfo.color}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            Confidence: {trendInfo.label}
          </span>
        </div>

        {/* Milestone badge */}
        {data.milestone_reached && (
          <div className="mt-3 flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/30 rounded-xl px-4 py-2.5">
            <CheckCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <span className="text-sm text-yellow-300 font-medium">{data.milestone_reached}</span>
          </div>
        )}

        {/* Summary */}
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          {data.parent_summary}
        </p>
      </div>

      {/* Expand/Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium
                   text-[#ff0099] hover:text-white transition-colors border-t border-border/50"
      >
        {expanded ? (
          <>
            Show Less <ChevronUp className="w-4 h-4" />
          </>
        ) : (
          <>
            See Details <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/30">
          {/* Strengths */}
          <div className="pt-4">
            <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" />
              Strengths
            </h4>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-green-400 mt-0.5">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Focus Areas */}
          <div>
            <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" />
              Areas to Focus On
            </h4>
            <ul className="space-y-1.5">
              {focusAreas.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-amber-400 mt-0.5">-</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Home Activities */}
          <div>
            <h4 className="text-sm font-semibold text-[#ff0099] flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4" />
              Activities to Try at Home
            </h4>
            <ul className="space-y-1.5">
              {homeActivities.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-[#ff0099] mt-0.5">{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sessions completed */}
          <div className="pt-2 border-t border-border/30 flex items-center justify-between">
            <span className="text-xs text-text-tertiary">
              Based on {data.completed_sessions} completed sessions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
