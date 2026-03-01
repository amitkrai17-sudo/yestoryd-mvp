// app/admin/coaches/page.tsx
// Coach management page with In-Person Session stats

'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Construction,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileText,
  Mic,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

interface CoachOfflineStats {
  total_sessions: number;
  online_count: number;
  offline_count: number;
  offline_ratio: number;
  reading_clips_provided: number;
  voice_notes_provided: number;
  late_reports: number;
  avg_report_time_minutes: number | null;
}

interface CoachWithStats extends Coach {
  stats: CoachOfflineStats | null;
  statsLoading: boolean;
}

// ============================================================
// PAGE
// ============================================================

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<CoachWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  useEffect(() => {
    fetchCoaches();
  }, []);

  async function fetchCoaches() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coach-applications?status=approved');
      if (!res.ok) {
        // Fallback: try a simpler query
        throw new Error('Coach list API failed');
      }
      const data = await res.json();
      // Applications endpoint returns applications, extract coach info
      const coachList: CoachWithStats[] = (data.applications || [])
        .filter((a: Record<string, unknown>) => a.status === 'approved' || a.coach_id)
        .map((a: Record<string, unknown>) => ({
          id: (a.coach_id as string) || (a.id as string),
          name: (a.name as string) || 'Unknown',
          email: (a.email as string) || '',
          phone: (a.phone as string) || null,
          is_active: true,
          stats: null,
          statsLoading: false,
        }));
      setCoaches(coachList);
    } catch {
      // Fallback: fetch coaches directly using overview endpoint
      // No direct coaches list API exists, so we use the overview data
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCoachStats(coachId: string) {
    setCoaches(prev => prev.map(c =>
      c.id === coachId ? { ...c, statsLoading: true } : c
    ));

    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/offline-stats`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      setCoaches(prev => prev.map(c =>
        c.id === coachId ? { ...c, stats: data.stats, statsLoading: false } : c
      ));
    } catch {
      setCoaches(prev => prev.map(c =>
        c.id === coachId ? { ...c, statsLoading: false } : c
      ));
    }
  }

  function toggleExpand(coachId: string) {
    if (expandedCoach === coachId) {
      setExpandedCoach(null);
    } else {
      setExpandedCoach(coachId);
      const coach = coaches.find(c => c.id === coachId);
      if (coach && !coach.stats && !coach.statsLoading) {
        fetchCoachStats(coachId);
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Coaches</h1>
              <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">Manage your coaching team</p>
            </div>
            <button
              onClick={fetchCoaches}
              disabled={loading}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-text-tertiary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6">
        {/* Coach List with In-Person Stats */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Loading coaches...</p>
          </div>
        ) : coaches.length > 0 ? (
          <div className="space-y-2 max-w-4xl">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-300" />
              In-Person Session Stats
            </h2>

            {coaches.map((coach) => {
              const isExpanded = expandedCoach === coach.id;
              const hasHighRatio = coach.stats && coach.stats.offline_ratio > 0.5;

              return (
                <div key={coach.id} className="bg-surface-1 rounded-xl border border-border overflow-hidden">
                  {/* Coach row */}
                  <button
                    onClick={() => toggleExpand(coach.id)}
                    className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-surface-2 transition-colors text-left"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/[0.08] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {coach.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{coach.name}</p>
                      <p className="text-xs text-text-tertiary truncate">{coach.email}</p>
                    </div>

                    {coach.stats && (
                      <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          hasHighRatio
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-white/[0.08] text-gray-300'
                        }`}>
                          {Math.round(coach.stats.offline_ratio * 100)}% in-person
                        </span>
                        {coach.stats.late_reports > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/10 text-red-400 border border-red-500/30">
                            {coach.stats.late_reports} late
                          </span>
                        )}
                      </div>
                    )}

                    {coach.statsLoading ? (
                      <Loader2 className="w-4 h-4 text-text-tertiary animate-spin flex-shrink-0" />
                    ) : isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded stats */}
                  {isExpanded && coach.stats && (
                    <div className="border-t border-border p-3 sm:p-4 bg-surface-0">
                      {hasHighRatio && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <p className="text-xs text-amber-400">
                            This coach has a high in-person ratio. Review session patterns for compliance.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <div className="bg-surface-1 rounded-lg p-2.5 border border-border">
                          <div className="flex items-center gap-1 mb-1">
                            <MapPin className="w-3 h-3 text-gray-300" />
                            <span className="text-[10px] text-text-tertiary font-medium">In-Person</span>
                          </div>
                          <p className="text-lg font-bold text-white">{coach.stats.offline_count}</p>
                          <p className="text-[10px] text-text-tertiary">of {coach.stats.total_sessions} total</p>
                        </div>

                        <div className="bg-surface-1 rounded-lg p-2.5 border border-border">
                          <div className="flex items-center gap-1 mb-1">
                            <Mic className="w-3 h-3 text-gray-300" />
                            <span className="text-[10px] text-text-tertiary font-medium">Clips</span>
                          </div>
                          <p className="text-lg font-bold text-white">{coach.stats.reading_clips_provided}</p>
                          <p className="text-[10px] text-text-tertiary">
                            {coach.stats.offline_count > 0
                              ? `${Math.round((coach.stats.reading_clips_provided / coach.stats.offline_count) * 100)}% rate`
                              : '—'}
                          </p>
                        </div>

                        <div className="bg-surface-1 rounded-lg p-2.5 border border-border">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className={`w-3 h-3 ${coach.stats.late_reports > 0 ? 'text-red-400' : 'text-text-tertiary'}`} />
                            <span className="text-[10px] text-text-tertiary font-medium">Late Reports</span>
                          </div>
                          <p className={`text-lg font-bold ${coach.stats.late_reports > 0 ? 'text-red-400' : 'text-white'}`}>
                            {coach.stats.late_reports}
                          </p>
                          <p className="text-[10px] text-text-tertiary">
                            {coach.stats.avg_report_time_minutes !== null
                              ? `Avg ${coach.stats.avg_report_time_minutes}m to submit`
                              : '—'}
                          </p>
                        </div>

                        <div className="bg-surface-1 rounded-lg p-2.5 border border-border">
                          <div className="flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-text-tertiary font-medium">Voice Notes</span>
                          </div>
                          <p className="text-lg font-bold text-white">{coach.stats.voice_notes_provided}</p>
                          <p className="text-[10px] text-text-tertiary">
                            {coach.stats.offline_count > 0
                              ? `${Math.round((coach.stats.voice_notes_provided / coach.stats.offline_count) * 100)}% rate`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && coach.statsLoading && (
                    <div className="border-t border-border p-6 text-center bg-surface-0">
                      <Loader2 className="w-5 h-5 text-text-tertiary animate-spin mx-auto" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Coming Soon section for other features */}
        <div className="max-w-md mx-auto text-center pt-4">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Construction className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">More Features Coming Soon</h2>
          <p className="text-text-tertiary text-sm mb-6">
            Full coach management features are under development.
          </p>
          <div className="bg-surface-1 rounded-xl p-5 text-left border border-border">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-300" />
              Planned Features
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                Add and manage coach profiles
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                Set availability and max students
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                View assigned students per coach
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                Track session completion rates
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
