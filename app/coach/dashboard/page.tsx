// file: app/coach/dashboard/page.tsx
// Clean Coach Dashboard - No duplicate navigation, uses layout.tsx sidebar

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
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

export default function CoachDashboardPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (coachId: string, coachEmail: string) => {
    try {
      const { count: studentsCount } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId);

      const { count: activeCount } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .in('lead_status', ['enrolled', 'active']);

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!coach) return null;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {coach.name.split(' ')[0]}! 👋
        </h1>
        <p className="text-white/80">
          Here&apos;s what&apos;s happening with your coaching today.
        </p>
      </div>

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
  );
}
