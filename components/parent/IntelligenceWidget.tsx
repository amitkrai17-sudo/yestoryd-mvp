'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain, Sparkles, ChevronRight,
  TrendingUp, Shield, Eye,
} from 'lucide-react';

interface IntelligenceData {
  overall_reading_level: string;
  overall_confidence: string;
  freshness_status: string;
  last_assessed: string;
  narrative_summary: string;
  key_strengths: string[];
  growth_areas: string[];
  engagement_pattern: string;
}

interface IntelligenceWidgetProps {
  childId: string;
  childName: string;
}

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string; Icon: typeof Shield }> = {
  high: { label: 'High Confidence', color: 'text-green-600', Icon: Shield },
  medium: { label: 'Building', color: 'text-blue-600', Icon: Eye },
  low: { label: 'Early Stage', color: 'text-amber-600', Icon: Eye },
  insufficient: { label: 'Getting Started', color: 'text-gray-500', Icon: Eye },
};

const FRESHNESS_CONFIG: Record<string, { dot: string; tooltip: string }> = {
  fresh: { dot: 'bg-green-400', tooltip: 'Recently updated' },
  aging: { dot: 'bg-yellow-400', tooltip: 'Profile may need updating' },
  stale: { dot: 'bg-red-400', tooltip: 'Schedule a session for updated insights' },
};

export default function IntelligenceWidget({ childId, childName }: IntelligenceWidgetProps) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/parent/intelligence/${childId}`);
        const json = await res.json();

        if (json.success && json.has_profile) {
          setData(json.profile);
          setHasProfile(true);
        } else {
          setHasProfile(false);
        }
      } catch {
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    }

    if (childId) fetchProfile();
  }, [childId]);

  // Skeleton loader
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gray-50 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-50 rounded w-32" />
            <div className="h-3 bg-gray-50 rounded w-48" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-50 rounded w-full" />
          <div className="h-3 bg-gray-50 rounded w-3/4" />
        </div>
        <div className="flex gap-2 mt-4">
          <div className="h-7 bg-gray-50 rounded-full w-20" />
          <div className="h-7 bg-gray-50 rounded-full w-24" />
          <div className="h-7 bg-gray-50 rounded-full w-18" />
        </div>
      </div>
    );
  }

  // Empty state — no profile yet
  if (!hasProfile || !data) {
    return (
      <div className="bg-gradient-to-br from-pink-50 via-white to-pink-50/50
                      border border-pink-200 rounded-2xl p-5 w-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#7b008b]/30 to-[#ff0099]/20
                          rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-[#ff0099]/50" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Reading Intelligence</h3>
            <p className="text-xs text-gray-500">Profile building...</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {childName}&apos;s intelligence profile is being built. Complete more sessions to unlock
          personalized insights about their reading development.
        </p>
      </div>
    );
  }

  const conf = CONFIDENCE_CONFIG[data.overall_confidence] || CONFIDENCE_CONFIG.medium;
  const ConfIcon = conf.Icon;
  const freshness = FRESHNESS_CONFIG[data.freshness_status] || FRESHNESS_CONFIG.fresh;

  return (
    <div className="bg-gradient-to-r from-pink-50 to-white
                    border border-gray-100 rounded-2xl overflow-hidden
                    shadow-sm w-full">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#7b008b] to-[#ff0099]
                          rounded-xl flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-[#7b008b]/30">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-base">Reading Intelligence</h3>
              <Sparkles className="w-4 h-4 text-[#ff0099]" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${freshness.dot}`} title={freshness.tooltip} />
              <span className="text-xs text-gray-500">{data.last_assessed}</span>
            </div>
          </div>
        </div>

        {/* Reading Level + Confidence */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold
                         bg-pink-50 text-[#ff0099] border border-pink-200">
            <TrendingUp className="w-3.5 h-3.5" />
            {data.overall_reading_level}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 ${conf.color}`}>
            <ConfIcon className="w-3 h-3" />
            {conf.label}
          </span>
        </div>

        {/* Strengths */}
        {data.key_strengths.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1.5">Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {data.key_strengths.slice(0, 3).map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200
                                         rounded-full text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Growth Areas (blue chips, encouraging tone) */}
        {data.growth_areas.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1.5">Next Steps</p>
            <div className="flex flex-wrap gap-1.5">
              {data.growth_areas.slice(0, 3).map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200
                                         rounded-full text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View Full Profile link */}
      <Link
        href={`/parent/intelligence/${childId}`}
        className="flex items-center justify-center gap-2 py-3 text-sm font-medium
                   text-[#ff0099] hover:text-[#7B008B] transition-colors border-t border-gray-200 min-h-[44px]"
      >
        View Full Profile <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
