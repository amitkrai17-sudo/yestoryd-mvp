'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import {
  Users,
  Calendar,
  IndianRupee,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  MessageSquare,
  Bot,
  Loader2,
  Video,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  upcomingSessions: number;
  sessionsThisWeek: number;
  earningsThisMonth: number;
  totalEarnings: number;
}

interface UpcomingSession {
  id: string;
  child_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  meet_link: string;
}

interface RecentStudent {
  id: string;
  child_name: string;
  age: number;
  last_score: number;
  sessions_completed: number;
  parent_phone: string;
}

export default function CoachDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeStudents: 0,
    upcomingSessions: 0,
    sessionsThisWeek: 0,
    earningsThisMonth: 0,
    totalEarnings: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      // Get coach details
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

      // Get students count
      const { data: students, count: studentsCount } = await supabase
        .from('children')
        .select('*', { count: 'exact' })
        .eq('assigned_coach_id', coachData.id);

      // Get upcoming sessions
      const today = new Date().toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          session_type,
          google_meet_link,
          children (
            child_name
          )
        `)
        .eq('coach_id', coachData.id)
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(5);

      // Calculate earnings
      const programFee = 5999;
      const coachSplit = coachData.coach_split_percentage / 100;
      const totalEarnings = (studentsCount || 0) * programFee * coachSplit;

      // Get this month's students
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: thisMonthStudents } = await supabase
        .from('children')
        .select('*', { count: 'exact' })
        .eq('assigned_coach_id', coachData.id)
        .gte('created_at', startOfMonth.toISOString());

      const earningsThisMonth = (thisMonthStudents || 0) * programFee * coachSplit;

      // Get sessions this week
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      
      const { count: weekSessions } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact' })
        .eq('coach_id', coachData.id)
        .gte('scheduled_date', today)
        .lte('scheduled_date', endOfWeek.toISOString().split('T')[0]);

      setStats({
        totalStudents: studentsCount || 0,
        activeStudents: studentsCount || 0,
        upcomingSessions: sessions?.length || 0,
        sessionsThisWeek: weekSessions || 0,
        earningsThisMonth: earningsThisMonth,
        totalEarnings: totalEarnings,
      });

      // Format upcoming sessions
      const formattedSessions = sessions?.map((s: any) => ({
        id: s.id,
        child_name: s.children?.child_name || 'Unknown',
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        session_type: s.session_type,
        meet_link: s.google_meet_link,
      })) || [];
      setUpcomingSessions(formattedSessions);

      // Format recent students
      const formattedStudents = students?.slice(0, 5).map((s: any) => ({
        id: s.id,
        child_name: s.child_name,
        age: s.age,
        last_score: s.latest_assessment_score || 0,
        sessions_completed: 0,
        parent_phone: s.parent_phone,
      })) || [];
      setRecentStudents(formattedStudents);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!coach) {
    return null;
  }

  return (
    <CoachLayout coach={coach}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {coach.name?.split(' ')[0]}! 👋</h1>
            <p className="text-gray-400">Here's what's happening with your students today.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/coach/ai-assistant"
              className="flex items-center gap-2 bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              <Bot className="w-5 h-5" />
              AI Assistant
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Students</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalStudents}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">This Week</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.sessionsThisWeek}</p>
            <p className="text-gray-500 text-sm">sessions</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">This Month</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(stats.earningsThisMonth)}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Earned</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(stats.totalEarnings)}</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Sessions */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-400" />
                Upcoming Sessions
              </h2>
              <Link href="/coach/sessions" className="text-pink-400 text-sm hover:text-pink-300">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-gray-700">
              {upcomingSessions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No upcoming sessions scheduled
                </div>
              ) : (
                upcomingSessions.map((session) => (
                  <div key={session.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{session.child_name}</p>
                        <p className="text-sm text-gray-400">
                          {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
                        </p>
                        <span className="inline-block mt-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                          {session.session_type}
                        </span>
                      </div>
                      {session.meet_link && (
                        <a
                          href={session.meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Students */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                My Students
              </h2>
              <Link href="/coach/students" className="text-pink-400 text-sm hover:text-pink-300">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-gray-700">
              {recentStudents.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No students assigned yet
                </div>
              ) : (
                recentStudents.map((student) => (
                  <Link
                    key={student.id}
                    href={`/coach/students/${student.id}`}
                    className="p-4 hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {student.child_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{student.child_name}</p>
                        <p className="text-sm text-gray-400">Age {student.age}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{student.last_score}/10</p>
                      <p className="text-xs text-gray-500">Last Score</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/coach/templates"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-white">Send WhatsApp</p>
                <p className="text-xs text-gray-400">Use templates</p>
              </div>
            </Link>

            <Link
              href="/coach/ai-assistant"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white">AI Assistant</p>
                <p className="text-xs text-gray-400">Get insights</p>
              </div>
            </Link>

            <Link
              href="/coach/sessions"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">View Sessions</p>
                <p className="text-xs text-gray-400">Manage calendar</p>
              </div>
            </Link>

            <Link
              href="/coach/earnings"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-white">Earnings</p>
                <p className="text-xs text-gray-400">View payments</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </CoachLayout>
  );
}
