'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Trophy, Loader2, Star, ArrowRight, Share2,
  TrendingUp, ChevronDown, ChevronUp, Calendar,
  Award, AlertCircle, MessageCircle, ShieldCheck,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface SkillGrowth {
  skill: string;
  before: string;
  after: string;
}

export default function SeasonReportPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.enrollmentId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [showCoachNotes, setShowCoachNotes] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/parent/report/${enrollmentId}`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          setError(result.error || 'Failed to load report');
          return;
        }
        setData(result);
      } catch {
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [enrollmentId]);

  const handleShare = async () => {
    if (!data) return;
    const childName = data.child.name;
    const seasonNum = data.season.number;
    const completionPct = Math.round((data.season.completion_rate || 0) * 100);
    const skills = (data.skill_growth || [])
      .filter((s: SkillGrowth) => s.after && s.after !== '--')
      .map((s: SkillGrowth) => `${s.skill}: ${s.before} -> ${s.after}`)
      .join('\n');

    const shareText = [
      `${childName}'s Reading Journey - Season ${seasonNum} Complete!`,
      `${completionPct}% sessions completed`,
      '',
      'Growth highlights:',
      skills,
      '',
      `${data.coach.biggest_achievement ? `Achievement: ${data.coach.biggest_achievement}` : ''}`,
      '',
      'Powered by Yestoryd',
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: `${childName}'s Season ${seasonNum} Report`, text: shareText });
      } catch { /* user cancelled */ }
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 mb-2">{error || 'Report not available'}</p>
          <button onClick={() => router.back()} className="text-[#FF0099] font-medium">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { child, season, skill_growth, coach, next_season } = data;
  const completionPct = Math.round((season.completion_rate || 0) * 100);

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-amber-50 via-pink-50 to-pink-50 border border-amber-200 rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-white/50 to-transparent" />
          <div className="relative">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {child.name}&apos;s Reading Journey
            </h1>
            <p className="text-amber-700 font-medium text-sm">
              Season {season.number} Complete!
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <AgeBandBadge ageBand={child.age_band} />
              <span className="text-xs text-gray-500">{child.age} years</span>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#FF0099]">{season.sessions_completed}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Sessions</p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{completionPct}%</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Complete</p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{skill_growth.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Skills Tracked</p>
          </div>
        </div>

        {/* Growth Comparison */}
        {skill_growth.length > 0 && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              <h2 className="text-gray-900 font-bold text-sm">Growth Journey</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {/* Column Headers */}
              <div className="px-5 py-2 flex items-center bg-gray-50">
                <span className="flex-1 text-[10px] text-gray-500 uppercase tracking-wider">Skill</span>
                <span className="w-24 text-center text-[10px] text-gray-500 uppercase tracking-wider">Before</span>
                <span className="w-6 text-center" />
                <span className="w-24 text-center text-[10px] text-gray-500 uppercase tracking-wider">After</span>
              </div>
              {skill_growth.map((s: SkillGrowth) => (
                <div key={s.skill} className="px-5 py-3 flex items-center">
                  <span className="flex-1 text-sm text-gray-900">{s.skill}</span>
                  <span className="w-24 text-center text-xs text-gray-500">
                    {s.before === '--' ? <span className="text-gray-400">--</span> : s.before}
                  </span>
                  <ArrowRight className="w-4 h-4 text-emerald-700 mx-1 flex-shrink-0" />
                  <span className="w-24 text-center text-xs text-emerald-700 font-medium">
                    {s.after === '--' ? <span className="text-gray-400">--</span> : s.after}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Assessed by Yestoryd Reading Intelligence</span>
            </div>
          </div>
        )}

        {/* Achievement Badge */}
        {coach.biggest_achievement && (
          <div className="bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200 rounded-2xl p-5 text-center">
            <Award className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-[10px] text-amber-700 uppercase tracking-wider mb-1">Biggest Achievement</p>
            <p className="text-gray-900 font-medium">{coach.biggest_achievement}</p>
          </div>
        )}

        {/* Coach Message */}
        {(coach.notes || coach.overall_progress) && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCoachNotes(!showCoachNotes)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#00ABFF]" />
                <span className="text-gray-900 font-bold text-sm">
                  Message from {coach.name || 'Your Coach'}
                </span>
              </div>
              {showCoachNotes ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {showCoachNotes && (
              <div className="px-5 pb-4 space-y-3">
                {coach.overall_progress && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Overall Progress</p>
                    <p className="text-sm text-gray-900 capitalize">{coach.overall_progress.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {coach.notes && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Coach Notes</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{coach.notes}</p>
                  </div>
                )}
                {coach.parent_engagement && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Parent Engagement</p>
                    <p className="text-sm text-gray-900 capitalize">{coach.parent_engagement.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Season Timeline */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h2 className="text-gray-900 font-bold text-sm">Season Timeline</h2>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              <p className="text-gray-900 font-medium">Started</p>
              <p>{season.started_at ? new Date(season.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}</p>
            </div>
            <div className="flex-1 mx-3 h-px bg-gradient-to-r from-[#FF0099]/50 to-green-500/50" />
            <div className="text-right">
              <p className="text-emerald-700 font-medium">Completed</p>
              <p>{season.completed_at ? new Date(season.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}</p>
            </div>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="w-full py-3.5 bg-white border border-gray-200 hover:shadow-md hover:border-pink-200 rounded-xl text-gray-900 font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share {child.name}&apos;s Progress
        </button>

        {/* Next Season CTA */}
        {next_season && (
          <div className="bg-gradient-to-r from-pink-50 to-pink-50 border border-pink-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Star className="w-6 h-6 text-[#FF0099] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-gray-900 font-bold text-sm">
                  Ready for Season {next_season.season_number}?
                </p>
                <p className="text-sm text-[#FF0099] font-medium mt-0.5">
                  {next_season.season_name}
                </p>
                {next_season.focus_areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {next_season.focus_areas.slice(0, 4).map((area: string) => (
                      <span key={area} className="px-2 py-0.5 text-[10px] bg-pink-50 text-[#FF0099] rounded-full border border-pink-200">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => router.push(`/parent/re-enroll/${child.id}`)}
                  className="mt-4 w-full py-3 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  Continue {child.name}&apos;s Journey
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
