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
  emerging: { label: 'Emerging', color: 'text-blue-700', bgColor: 'bg-blue-50 border border-blue-200' },
  developing: { label: 'Developing', color: 'text-amber-700', bgColor: 'bg-amber-50 border border-amber-200' },
  proficient: { label: 'Proficient', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border border-emerald-200' },
  advanced: { label: 'Advanced', color: 'text-purple-700', bgColor: 'bg-purple-50 border border-purple-200' },
};

const TREND_LABELS: Record<string, { label: string; color: string; Icon: any }> = {
  rising: { label: 'Rising', color: 'text-green-600', Icon: ArrowUpRight },
  steady: { label: 'Steady', color: 'text-blue-600', Icon: ArrowRight },
  needs_attention: { label: 'Needs Focus', color: 'text-amber-600', Icon: Target },
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
    <div className="bg-gradient-to-r from-pink-50 to-white
                    border border-gray-100 rounded-2xl overflow-hidden
                    shadow-sm w-full">
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
              <h3 className="text-lg font-bold text-gray-900">Progress Pulse</h3>
              <span className="text-xs text-gray-500">#{data.pulse_number}</span>
            </div>
            <p className="text-sm text-gray-600">{pulseDate}</p>
          </div>
        </div>

        {/* Headline */}
        <p className="mt-3 text-base text-gray-900 font-medium leading-snug">
          {data.headline}
        </p>

        {/* Progress + Confidence badges */}
        <div className="flex items-center gap-3 mt-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${progressInfo.bgColor} ${progressInfo.color}`}>
            <Star className="w-3.5 h-3.5" />
            {progressInfo.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 ${trendInfo.color}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            Confidence: {trendInfo.label}
          </span>
        </div>

        {/* Milestone badge */}
        {data.milestone_reached && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-700 font-medium">{data.milestone_reached}</span>
          </div>
        )}

        {/* Summary */}
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          {data.parent_summary}
        </p>
      </div>

      {/* Expand/Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium
                   text-[#ff0099] hover:text-[#7B008B] transition-colors border-t border-gray-200"
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
        <div className="px-5 pb-5 space-y-4 border-t border-gray-200">
          {/* Strengths */}
          <div className="pt-4">
            <h4 className="text-sm font-semibold text-green-600 flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" />
              Strengths
            </h4>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-600 mt-0.5">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Focus Areas */}
          <div>
            <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" />
              Areas to Focus On
            </h4>
            <ul className="space-y-1.5">
              {focusAreas.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-amber-600 mt-0.5">-</span>
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
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-[#ff0099] mt-0.5">{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sessions completed */}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Based on {data.completed_sessions} completed sessions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
