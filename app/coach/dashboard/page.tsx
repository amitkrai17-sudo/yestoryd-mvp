// file: app/coach/dashboard/page.tsx
// Coach Dashboard with Pending Skill Boosters section

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import CoachLayout from '@/components/layouts/CoachLayout';
import {
  Users,
  Calendar,
  Gift,
  Wallet,
  TrendingUp,
  CheckCircle,
  HelpCircle,
  Loader2,
  ChevronRight,
  MessageCircle,
  Zap,
  Clock,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import SupportWidget from '@/components/support/SupportWidget';
import CoachTierCard from '@/components/coach/CoachTierCard';
import CoachAvailabilityCard from '@/components/coach/CoachAvailabilityCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Coach {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  referral_code?: string;
}

interface DashboardStats {
  total_students: number;
  active_students: number;
  upcoming_sessions: number;
  total_earnings: number;
}

interface PendingSkillBooster {
  id: string;
  child_id: string;
  child_name: string;
  focus_area: string;
  created_at: string;
  days_pending: number;
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

export default function CoachDashboardPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingSkillBoosters, setPendingSkillBoosters] = useState<PendingSkillBooster[]>([]);
  const [loading, setLoading] = useState(true);

  useActivityTracker({
    userType: 'coach',
    userEmail: coach?.email || null,
    enabled: !!coach,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);
      await fetchStats(coachData.id, coachData.email);
      await fetchPendingSkillBoosters(coachData.id);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (coachId: string, coachEmail: string) => {
    try {
      // Query through ENROLLMENTS (single source of truth for coach assignment)
      const { count: studentsCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .in('status', ['active', 'pending_start', 'completed']);

      const { count: activeCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .in('status', ['active', 'pending_start']);

      let sessionsCount = 0;
      try {
        const { count } = await supabase
          .from('scheduled_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', coachId)
          .gte('scheduled_date', new Date().toISOString().split('T')[0])
          .eq('status', 'scheduled');
        sessionsCount = count || 0;
      } catch (e) {
        console.log('scheduled_sessions table may not exist');
      }

      // Fetch earnings from single source of truth API
      let totalEarnings = 0;
      try {
        const earningsRes = await fetch(`/api/coach/earnings-summary?email=${encodeURIComponent(coachEmail)}`);
        if (earningsRes.ok) {
          const earningsData = await earningsRes.json();
          totalEarnings = earningsData.summary?.totalEarnings || 0;
        }
      } catch (e) {
        console.log('Earnings fetch error:', e);
      }

      setStats({
        total_students: studentsCount || 0,
        active_students: activeCount || 0,
        upcoming_sessions: sessionsCount,
        total_earnings: totalEarnings,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchPendingSkillBoosters = async (coachId: string) => {
    try {
      // Get pending Skill Booster sessions (DB uses 'remedial' type)
      const { data: pendingSessions, error } = await supabase
        .from('scheduled_sessions')
        .select(`
          id,
          child_id,
          focus_area,
          created_at,
          children:child_id (
            child_name,
            name
          )
        `)
        .eq('coach_id', coachId)
        .eq('session_type', 'remedial')
        .eq('status', 'pending_booking')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending Skill Boosters:', error);
        return;
      }

      const formattedSessions: PendingSkillBooster[] = (pendingSessions || []).map((session: any) => {
        const daysPending = Math.floor(
          (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: session.id,
          child_id: session.child_id,
          child_name: session.children?.child_name || session.children?.name || 'Unknown',
          focus_area: session.focus_area || 'general',
          created_at: session.created_at,
          days_pending: daysPending,
        };
      });

      setPendingSkillBoosters(formattedSessions);
    } catch (err) {
      console.error('Error in fetchPendingSkillBoosters:', err);
    }
  };

  if (loading) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      </CoachLayout>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout>
      <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {coach.name.split(' ')[0]}!
        </h1>
        <p className="text-white/80">
          Here&apos;s what&apos;s happening with your coaching today.
        </p>
      </div>

      {/* Pending Skill Boosters Alert */}
      {pendingSkillBoosters.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-2xl border-2 border-yellow-500/40 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                Pending Skill Boosters
                <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingSkillBoosters.length}
                </span>
              </h3>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                These sessions are waiting for parents to book a time slot.
              </p>

              <div className="space-y-3">
                {pendingSkillBoosters.map((session) => (
                  <div
                    key={session.id}
                    className="bg-gray-800/60 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{session.child_name}</span>
                        {session.days_pending >= 3 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {session.days_pending}d
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {FOCUS_AREA_LABELS[session.focus_area] || session.focus_area}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.days_pending === 0 ? 'Today' : `${session.days_pending}d ago`}
                      </span>
                      <Link
                        href={`/coach/students/${session.child_id}`}
                        className="px-3 py-1.5 bg-[#FF0099] text-white text-sm rounded-lg hover:bg-[#FF0099]/90 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                Tip: Follow up with parents via WhatsApp if booking is pending for 3+ days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coach Tier Card */}
      <CoachTierCard coachId={coach.id} coachEmail={coach.email} />

      {/* Availability Management */}
      <CoachAvailabilityCard coachId={coach.id} coachEmail={coach.email} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <div className="w-10 h-10 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-[#00ABFF]" />
          </div>
          <p className="text-3xl font-bold text-[#00ABFF]">{stats?.total_students || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Total Students</p>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">{stats?.active_students || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Active Students</p>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">{stats?.upcoming_sessions || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Upcoming Sessions</p>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <div className="w-10 h-10 bg-[#FF0099]/20 rounded-xl flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 text-[#FF0099]" />
          </div>
          <p className="text-3xl font-bold text-[#FF0099]">
            ₹{Math.round(stats?.total_earnings || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-sm text-gray-400 mt-1">Total Earnings</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
        <h2 className="font-bold text-white text-lg mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/coach/students"
            className="p-4 bg-gray-900 rounded-xl hover:bg-gray-700/50 transition-all group text-center border border-gray-700/50"
          >
            <Users className="w-7 h-7 text-[#00ABFF] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-gray-300">View Students</span>
          </Link>
          <Link
            href="/coach/sessions"
            className="p-4 bg-gray-900 rounded-xl hover:bg-gray-700/50 transition-all group text-center border border-gray-700/50"
          >
            <Calendar className="w-7 h-7 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-gray-300">Check Schedule</span>
          </Link>
          <Link
            href="/coach/templates"
            className="p-4 bg-gray-900 rounded-xl hover:bg-gray-700/50 transition-all group text-center border border-gray-700/50"
          >
            <Gift className="w-7 h-7 text-[#7B008B] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-gray-300">Share Referral</span>
          </Link>
          <Link
            href="/coach/earnings"
            className="p-4 bg-gray-900 rounded-xl hover:bg-gray-700/50 transition-all group text-center border border-gray-700/50"
          >
            <Wallet className="w-7 h-7 text-[#FF0099] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-gray-300">View Earnings</span>
          </Link>
        </div>
      </div>

      {/* Need Help Card */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6 text-[#00ABFF]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">Need Help?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Have a question or facing an issue? We&apos;re here to help!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/coach/ai-assistant"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#FF0099]/90 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Ask rAI First
              </Link>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-600 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Submit Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating rAI Chat Widget */}
      <ChatWidget userRole="coach" userEmail={coach.email} />
      </div>
    </CoachLayout>
  );
}
