// file: app/coach/dashboard/CoachDashboardClient.tsx
// Coach Dashboard with Pending Skill Boosters section

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database } from '@/types/supabase';
import {
  Zap,
  AlertCircle,
  Clock,
  Lightbulb,
  Users,
  CheckCircle,
  Calendar,
  Wallet,
  Gift,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';
import CoachTierCard from '@/components/coach/CoachTierCard';
import CoachAvailabilityCard from '@/components/coach/CoachAvailabilityCard';
import { useActivityTracker } from '@/hooks/useActivityTracker';

type Coach = Database['public']['Tables']['coaches']['Row'];

interface PendingSkillBooster {
  id: string;
  child_id: string;
  child_name: string;
  focus_area: string;
  created_at: string;
  days_pending: number;
}

interface DashboardStats {
  total_students: number;
  active_students: number;
  upcoming_sessions: number;
  total_earnings: number;
}

// Focus area labels
const FOCUS_AREA_LABELS: Record<string, string> = {
  phonics_sounds: 'Phonics & Letter Sounds',
  reading_fluency: 'Reading Fluency',
  comprehension: 'Reading Comprehension',
  vocabulary: 'Vocabulary Building',
  grammar: 'Grammar & Sentence Structure',
  confidence: 'Speaking Confidence',
  specific_sounds: 'Specific Sound Practice',
  other: 'Special Focus',
};

interface TodaySession {
  id: string;
  child_id: string;
  child_name: string;
  session_number: number | null;
  session_type: string;
  scheduled_time: string;
  focus_area: string | null;
  trend: string | null;
}

interface NeedsAttentionStudent {
  child_id: string;
  child_name: string;
  reason: string;
}

interface CoachDashboardClientProps {
  coach: Coach;
  initialStats: DashboardStats;
  initialPendingSkillBoosters: PendingSkillBooster[];
  initialTodaySessions?: TodaySession[];
  initialNeedsAttention?: NeedsAttentionStudent[];
}

function formatTime(time: string): string {
  if (!time) return '';
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

export default function CoachDashboardClient({
  coach,
  initialStats,
  initialPendingSkillBoosters,
  initialTodaySessions = [],
  initialNeedsAttention = [],
}: CoachDashboardClientProps) {
  const [stats] = useState<DashboardStats | null>(initialStats);
  const [pendingSkillBoosters] = useState<PendingSkillBooster[]>(initialPendingSkillBoosters);
  const [todaySessions] = useState<TodaySession[]>(initialTodaySessions);
  const [needsAttention] = useState<NeedsAttentionStudent[]>(initialNeedsAttention);

  useActivityTracker({
    userType: 'coach',
    userEmail: coach?.email || null,
    enabled: !!coach,
  });

  if (!coach) return null;

  return (
    <div className="space-y-4 lg:space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#00ABFF] to-[#0066CC] rounded-xl lg:rounded-2xl p-4 lg:p-6 text-white">
          <h1 className="text-lg lg:text-2xl font-bold mb-1 lg:mb-2">
            Welcome back, {coach.name.split(' ')[0]}!
          </h1>
          <p className="text-sm lg:text-base text-white/80">
            Here&apos;s what&apos;s happening with your coaching today.
          </p>
        </div>

        {/* Pending Skill Boosters Alert */}
        {pendingSkillBoosters.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl lg:rounded-2xl border-2 border-yellow-500/40 p-3 lg:p-5">
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-base lg:text-lg flex items-center gap-2">
                  Pending Skill Boosters
                  <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingSkillBoosters.length}
                  </span>
                </h3>
                <p className="text-text-tertiary text-xs lg:text-sm mt-1 mb-3 lg:mb-4">
                  Waiting for parents to book a time slot.
                </p>

                <div className="space-y-2 lg:space-y-3">
                  {pendingSkillBoosters.map((session) => (
                    <div
                      key={session.id}
                      className="bg-surface-1/60 rounded-lg lg:rounded-xl p-2.5 lg:p-4 flex items-center justify-between gap-2 lg:gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 lg:mb-1">
                          <span className="font-semibold text-white text-sm lg:text-base truncate">{session.child_name}</span>
                          {session.days_pending >= 3 && (
                            <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              {session.days_pending}d
                            </span>
                          )}
                        </div>
                        <p className="text-xs lg:text-sm text-text-tertiary truncate">
                          {FOCUS_AREA_LABELS[session.focus_area] || session.focus_area}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="hidden sm:flex text-xs text-text-tertiary items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.days_pending === 0 ? 'Today' : `${session.days_pending}d ago`}
                        </span>
                        <Link
                          href={`/coach/students/${session.child_id}`}
                          className="px-3 py-1.5 bg-[#00ABFF] text-white text-xs lg:text-sm rounded-xl hover:bg-[#00ABFF]/90 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-text-tertiary mt-3 lg:mt-4 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                  <span className="hidden sm:inline">Tip: Follow up with parents via WhatsApp if booking is pending for 3+ days</span>
                  <span className="sm:hidden">Follow up if pending 3+ days</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Needs Attention — only show if students need attention */}
        {needsAttention.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl lg:rounded-2xl p-3 lg:p-5">
            <h3 className="font-bold text-amber-400 text-sm lg:text-base flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5" />
              Needs Attention
            </h3>
            <div className="space-y-2">
              {needsAttention.map((student) => (
                <div
                  key={student.child_id}
                  className="bg-surface-1/60 rounded-lg lg:rounded-xl p-2.5 lg:p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-white text-sm">{student.child_name}</span>
                    <p className="text-xs text-amber-400/80 mt-0.5">{student.reason}</p>
                  </div>
                  <Link
                    href={`/coach/students/${student.child_id}`}
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs rounded-xl hover:bg-amber-500/30 transition-colors flex items-center gap-1 flex-shrink-0"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Sessions with Intelligence */}
        {todaySessions.length > 0 && (
          <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl border border-border p-3 lg:p-5">
            <h3 className="font-bold text-white text-sm lg:text-base flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400" />
              Today&apos;s Sessions
            </h3>
            <div className="space-y-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-surface-0/50 rounded-lg lg:rounded-xl p-2.5 lg:p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 font-medium">
                        {formatTime(session.scheduled_time)}
                      </span>
                      <span className="font-medium text-white text-sm">{session.child_name}</span>
                      {session.session_number && (
                        <span className="text-[10px] text-gray-500">
                          Session {session.session_number}
                        </span>
                      )}
                      {session.trend === 'declining' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
                          <TrendingDown className="w-3 h-3" />
                          Attention
                        </span>
                      )}
                    </div>
                    {session.focus_area && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        Focus: {session.focus_area}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/coach/ai-assistant?studentId=${session.child_id}&prompt=${encodeURIComponent(`Prepare me for my session with ${session.child_name} today. What should I focus on?`)}`}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-[#00ABFF] to-[#0066CC] text-white text-[10px] lg:text-xs font-medium rounded-xl hover:opacity-90 transition-all flex items-center gap-1 flex-shrink-0"
                  >
                    <Sparkles className="w-3 h-3" />
                    Prep
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coach Tier Card */}
        <CoachTierCard coachId={coach.id} coachEmail={coach.email} />

        {/* Availability Management */}
        <CoachAvailabilityCard coachId={coach.id} coachEmail={coach.email} />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
          <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-lg lg:rounded-xl flex items-center justify-center mb-2 lg:mb-3">
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            <p className="text-xl lg:text-3xl font-bold text-[#00ABFF]">{stats?.total_students || 0}</p>
            <p className="text-xs lg:text-sm text-text-tertiary mt-0.5 lg:mt-1">Total Students</p>
          </div>

          <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-emerald-500/20 rounded-lg lg:rounded-xl flex items-center justify-center mb-2 lg:mb-3">
              <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-400" />
            </div>
            <p className="text-xl lg:text-3xl font-bold text-emerald-400">{stats?.active_students || 0}</p>
            <p className="text-xs lg:text-sm text-text-tertiary mt-0.5 lg:mt-1">Active Students</p>
          </div>

          <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-500/20 rounded-lg lg:rounded-xl flex items-center justify-center mb-2 lg:mb-3">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400" />
            </div>
            <p className="text-xl lg:text-3xl font-bold text-purple-400">{stats?.upcoming_sessions || 0}</p>
            <p className="text-xs lg:text-sm text-text-tertiary mt-0.5 lg:mt-1">Upcoming</p>
          </div>

          <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-lg lg:rounded-xl flex items-center justify-center mb-2 lg:mb-3">
              <Wallet className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            <p className="text-xl lg:text-3xl font-bold text-[#00ABFF]">
              ₹{Math.round(stats?.total_earnings || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs lg:text-sm text-text-tertiary mt-0.5 lg:mt-1">Earnings</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-surface-1/50 rounded-xl lg:rounded-2xl border border-border p-3 lg:p-6">
          <h2 className="font-bold text-white text-base lg:text-lg mb-3 lg:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            <Link
              href="/coach/students"
              className="p-3 lg:p-4 bg-surface-0 rounded-xl hover:bg-surface-2/50 transition-all group text-center border border-border/50"
            >
              <Users className="w-6 h-6 lg:w-7 lg:h-7 text-[#00ABFF] mx-auto mb-1.5 lg:mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs lg:text-sm text-text-secondary">Students</span>
            </Link>
            <Link
              href="/coach/sessions"
              className="p-3 lg:p-4 bg-surface-0 rounded-xl hover:bg-surface-2/50 transition-all group text-center border border-border/50"
            >
              <Calendar className="w-6 h-6 lg:w-7 lg:h-7 text-purple-400 mx-auto mb-1.5 lg:mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs lg:text-sm text-text-secondary">Schedule</span>
            </Link>
            <Link
              href="/coach/templates"
              className="p-3 lg:p-4 bg-surface-0 rounded-xl hover:bg-surface-2/50 transition-all group text-center border border-border/50"
            >
              <Gift className="w-6 h-6 lg:w-7 lg:h-7 text-[#0066CC] mx-auto mb-1.5 lg:mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs lg:text-sm text-text-secondary">Referral</span>
            </Link>
            <Link
              href="/coach/earnings"
              className="p-3 lg:p-4 bg-surface-0 rounded-xl hover:bg-surface-2/50 transition-all group text-center border border-border/50"
            >
              <Wallet className="w-6 h-6 lg:w-7 lg:h-7 text-[#00ABFF] mx-auto mb-1.5 lg:mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs lg:text-sm text-text-secondary">Earnings</span>
            </Link>
          </div>
        </div>

        {/* Need Help Card */}
        <div className="bg-gradient-to-r from-surface-1 to-surface-1/50 rounded-xl lg:rounded-2xl p-3 lg:p-6 border border-border">
          <div className="flex items-start gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 lg:w-6 lg:h-6 text-[#00ABFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm lg:text-base mb-0.5 lg:mb-1">Need Help?</h3>
              <p className="text-text-tertiary text-xs lg:text-sm mb-3 lg:mb-4">
                Have a question? We&apos;re here to help!
              </p>
              <div className="flex flex-wrap gap-2 lg:gap-3">
                <Link
                  href="/coach/ai-assistant"
                  className="inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-[#00ABFF] text-white rounded-xl text-xs lg:text-sm font-medium hover:bg-[#00ABFF]/90 transition-colors"
                >
                  <TrendingUp className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  Ask rAI
                </Link>
                <button className="inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-surface-2 text-text-secondary rounded-xl text-xs lg:text-sm font-medium hover:bg-surface-3 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  Request
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating rAI Chat Widget */}
        <ChatWidget userRole="coach" userEmail={coach.email} />
    </div>
  );
}
