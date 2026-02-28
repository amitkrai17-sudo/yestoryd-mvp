'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Brain, Sparkles, ArrowLeft, TrendingUp,
  Shield, Eye, BookOpen, Target, Lightbulb,
  Star, ChevronRight, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';
import ParentLayout from '@/components/parent/ParentLayout';

// ============================================================
// Types
// ============================================================

interface SkillRating {
  skill_name: string;
  rating: string;
  rating_raw: string;
  trend: string;
}

interface ProfileData {
  overall_reading_level: string;
  overall_confidence: string;
  freshness_status: string;
  last_assessed: string;
  narrative_summary: string;
  key_strengths: string[];
  growth_areas: string[];
  skill_ratings: SkillRating[];
  engagement_pattern: string;
  modality_coverage: { modality: string; session_count: number }[];
  recommended_focus: string | null;
  last_synthesized_at: string | null;
}

interface WeeklyTrend {
  week: string;
  avg_score: number;
  session_count: number;
}

interface SkillProgression {
  skill_name: string;
  progression: { week: string; rating_numeric: number }[];
}

// ============================================================
// Constants
// ============================================================

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Mastered: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' },
  Strong: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  Growing: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
  Emerging: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/20' },
};

const TREND_ICONS: Record<string, string> = {
  improving: '↑',
  stable: '→',
  declining: '↓',
};

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'High Confidence', color: 'text-green-400' },
  medium: { label: 'Building Confidence', color: 'text-blue-400' },
  low: { label: 'Early Stage', color: 'text-amber-400' },
  insufficient: { label: 'Getting Started', color: 'text-text-tertiary' },
};

const FRESHNESS_DOT: Record<string, string> = {
  fresh: 'bg-green-400',
  aging: 'bg-yellow-400',
  stale: 'bg-red-400',
};

// ============================================================
// Page Component
// ============================================================

function IntelligenceProfileContent() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [childName, setChildName] = useState('');
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);

  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [skillProgression, setSkillProgression] = useState<SkillProgression[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch profile and trend in parallel
        const [profileRes, trendRes] = await Promise.all([
          fetch(`/api/parent/intelligence/${childId}`),
          fetch(`/api/parent/intelligence/${childId}/progress-over-time`),
        ]);

        const profileJson = await profileRes.json();
        const trendJson = await trendRes.json();

        if (profileJson.success) {
          setChildName(profileJson.child_name);
          if (profileJson.has_profile) {
            setProfile(profileJson.profile);
          } else {
            setHasProfile(false);
          }
        }

        if (trendJson.success) {
          setWeeklyTrend(trendJson.weekly_trend || []);
          setSkillProgression(trendJson.skill_progression || []);
        }
      } catch {
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    }

    if (childId) fetchData();
  }, [childId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading intelligence profile...</p>
        </div>
      </div>
    );
  }

  if (!hasProfile || !profile) {
    return (
      <div className="min-h-screen bg-surface-0 p-4">
        <div className="max-w-lg mx-auto mt-12 text-center">
          <Brain className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Profile Building</h2>
          <p className="text-text-secondary mb-6">
            {childName}&apos;s reading intelligence profile is being built.
            Complete more coaching sessions to unlock detailed insights.
          </p>
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#7b008b] text-white rounded-xl font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const conf = CONFIDENCE_CONFIG[profile.overall_confidence] || CONFIDENCE_CONFIG.medium;
  const freshDot = FRESHNESS_DOT[profile.freshness_status] || FRESHNESS_DOT.fresh;

  return (
    <div className="min-h-screen bg-surface-0 overflow-x-hidden">
      <main className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        {/* Back navigation */}
        <Link
          href="/parent/dashboard"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-white transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {childName}&apos;s Reading Profile
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${freshDot}`} />
                <span className="text-white/70 text-sm">{profile.last_assessed}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section A: Summary */}
        <section className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 p-5">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold
                           bg-[#7b008b]/20 text-[#ff0099] border border-[#7b008b]/30">
              <BookOpen className="w-3.5 h-3.5" />
              {profile.overall_reading_level}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-2 ${conf.color}`}>
              <Shield className="w-3 h-3" />
              {conf.label}
            </span>
          </div>
          <p className="text-text-secondary leading-relaxed">{profile.narrative_summary}</p>
          {profile.engagement_pattern && (
            <p className="text-xs text-text-tertiary mt-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#ff0099]" />
              {profile.engagement_pattern}
            </p>
          )}
        </section>

        {/* Section B: Skill Map */}
        <section className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 p-5">
          <h2 className="font-semibold text-white text-base flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#ff0099]" />
            Skill Map
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.skill_ratings.map((skill, i) => {
              const colors = RATING_COLORS[skill.rating] || RATING_COLORS.Growing;
              const trendIcon = TREND_ICONS[skill.trend] || '→';
              return (
                <div key={i}
                     className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
                  <span className={`text-sm font-medium ${colors.text}`}>{skill.skill_name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${colors.text}`}>{skill.rating}</span>
                    <span className="text-xs text-text-tertiary">{trendIcon}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {profile.skill_ratings.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-4">
              Skill ratings will appear after a few more sessions.
            </p>
          )}
        </section>

        {/* Section C: Progress Chart */}
        {weeklyTrend.length >= 2 && (
          <section className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 p-5">
            <h2 className="font-semibold text-white text-base flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#ff0099]" />
              Progress Over Time
            </h2>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: '#888' }}
                    tickFormatter={(w: string) => w.split('-')[1]}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#888' }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a2e',
                      border: '1px solid rgba(123,0,139,0.3)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number) => [`${value}`, 'Score']}
                    labelFormatter={(label: string) => `Week ${label.split('-')[1]}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#ff0099"
                    strokeWidth={2}
                    dot={{ fill: '#ff0099', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Section D: Session Modalities */}
        {profile.modality_coverage.length > 0 && (
          <section className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 p-5">
            <h2 className="font-semibold text-white text-base flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-[#ff0099]" />
              Learning Sessions
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.modality_coverage.map((m, i) => (
                <span key={i} className="px-3 py-1.5 bg-surface-2 border border-border rounded-full text-sm text-text-secondary">
                  {m.modality}: <span className="font-semibold text-white">{m.session_count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Section E: Strengths & Growth Areas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Strengths */}
          {profile.key_strengths.length > 0 && (
            <section className="bg-surface-1 rounded-2xl border border-green-500/20 p-5">
              <h2 className="font-semibold text-green-400 text-sm flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4" />
                Strengths
              </h2>
              <ul className="space-y-2">
                {profile.key_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Growth Areas */}
          {profile.growth_areas.length > 0 && (
            <section className="bg-surface-1 rounded-2xl border border-blue-500/20 p-5">
              <h2 className="font-semibold text-blue-400 text-sm flex items-center gap-2 mb-3">
                <Target className="w-4 h-4" />
                Next Steps
              </h2>
              <ul className="space-y-2">
                {profile.growth_areas.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Section F: Practice Recommendations */}
        {profile.recommended_focus && (
          <section className="bg-gradient-to-r from-[#7B008B]/20 to-[#FF0099]/10 rounded-2xl border border-[#7b008b]/30 p-5">
            <h2 className="font-semibold text-white text-base flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[#ff0099]" />
              Recommended Focus
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">{profile.recommended_focus}</p>
            <Link
              href="/parent/tasks"
              className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-[#ff0099] hover:text-white transition-colors min-h-[44px]"
            >
              View Practice Tasks <ChevronRight className="w-4 h-4" />
            </Link>
          </section>
        )}

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-xs text-text-tertiary">
            Powered by rAI · {profile.last_synthesized_at
              ? `Last analyzed ${new Date(profile.last_synthesized_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
              : 'Analyzing...'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function IntelligenceProfilePage() {
  return (
    <ParentLayout>
      <IntelligenceProfileContent />
    </ParentLayout>
  );
}
