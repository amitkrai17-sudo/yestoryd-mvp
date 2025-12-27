// file: app/coach/dashboard/page.tsx
// Complete Coach Dashboard with My Referrals Tab, Floating rAI Widget, Activity Tracking & Support

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Users, Calendar, Gift, Wallet,
  LogOut, Menu, X, ChevronRight, Bell, Settings,
  TrendingUp, Clock, CheckCircle, Brain, HelpCircle
} from 'lucide-react';
import MyReferralsTab from './MyReferralsTab';
import RAIAssistantTab from './RAIAssistantTab';
import ChatWidget from '@/components/chat/ChatWidget';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import SupportWidget from '@/components/support/SupportWidget';
import SupportForm from '@/components/support/SupportForm';
import CoachTierCard from '@/components/coach/CoachTierCard';
import CoachAvailabilityCard from '@/components/coach/CoachAvailabilityCard';

// 4-Point Star Icon Component (Yestoryd branding for rAI)
function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface User {
  id: string;
  email: string;
}

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
  pending_earnings: number;
}

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'My Students', icon: Users },
  { id: 'sessions', label: 'Sessions', icon: Calendar },
  { id: 'referrals', label: 'My Referrals', icon: Gift },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'support', label: 'Support', icon: HelpCircle },
];

export default function CoachDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Activity tracking - tracks login and page views automatically
  useActivityTracker({
    userType: 'coach',
    userEmail: coach?.email || null,
    enabled: !!coach,
  });

  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/coach/login');
      } else if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.log('No authenticated session, redirecting to login');
        router.push('/coach/login');
        return;
      }

      const currentUser = {
        id: session.user.id,
        email: session.user.email || '',
      };
      setUser(currentUser);
      console.log('✅ Authenticated user:', currentUser.email);

      // Fetch coach profile
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', currentUser.email)
        .single();

      if (coachError) {
        console.error('Coach profile error:', coachError);
        // Coach might not exist yet - redirect to onboarding
        if (coachError.code === 'PGRST116') {
          console.log('Coach not found, redirecting to onboarding');
          router.push('/coach/onboarding');
          return;
        }
      }

      if (coachData) {
        setCoach(coachData);
        console.log('✅ Coach profile loaded:', coachData.name);

        // Fetch dashboard stats
        fetchDashboardStats(coachData.id);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      router.push('/coach/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async (coachId: string) => {
    try {
      // Get students count
      const { count: studentsCount } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId);

      // Get active students
      const { count: activeCount } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .in('lead_status', ['enrolled', 'active']);

      // Get upcoming sessions
      let sessionsCount = 0;
      try {
        const { count } = await supabase
          .from('scheduled_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', coachId)
          .gte('scheduled_time', new Date().toISOString())
          .eq('status', 'scheduled');
        sessionsCount = count || 0;
      } catch (e) {
        console.log('scheduled_sessions table may not exist');
      }

      // Get earnings (if payouts table exists)
      let totalEarnings = 0;
      let pendingEarnings = 0;

      try {
        const { data: payouts } = await supabase
          .from('coach_payouts')
          .select('net_amount, status')
          .eq('coach_id', coachId);

        if (payouts) {
          totalEarnings = payouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);
          pendingEarnings = payouts
            .filter(p => p.status !== 'paid')
            .reduce((sum, p) => sum + (p.net_amount || 0), 0);
        }
      } catch (e) {
        console.log('Payouts table may not exist yet');
      }

      setStats({
        total_students: studentsCount || 0,
        active_students: activeCount || 0,
        upcoming_sessions: sessionsCount,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/coach/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00abff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !coach) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load dashboard</p>
          <button
            onClick={() => router.push('/coach/login')}
            className="px-4 py-2 bg-[#00abff] text-white rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Mobile Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00abff] to-[#0066cc] rounded-lg flex items-center justify-center">
                  <StarIcon className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-gray-900 hidden sm:block">Yestoryd Coach</span>
              </div>
            </div>

            {/* Desktop Tabs */}
            <nav className="hidden lg:flex items-center gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-[#00abff]/10 text-[#00abff]'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#00abff] rounded-full"></span>
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900">{coach.name}</p>
                  <p className="text-xs text-gray-500">{coach.email}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#00abff] to-[#0066cc] rounded-full flex items-center justify-center text-white font-bold">
                  {coach.name.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                      activeTab === tab.id
                        ? 'bg-[#00abff]/10 text-[#00abff]'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                    {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Mobile Tab Pills */}
        <div className="lg:hidden mb-6 overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? 'bg-[#00abff] text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} coach={coach} onTabChange={setActiveTab} />
        )}

        {activeTab === 'students' && (
          <StudentsTab coachId={coach.id} />
        )}

        {activeTab === 'sessions' && (
          <SessionsTab coachId={coach.id} />
        )}

        {activeTab === 'referrals' && (
          <MyReferralsTab coachEmail={coach.email} />
        )}

        {activeTab === 'earnings' && (
          <EarningsTab coachId={coach.id} />
        )}

        {activeTab === 'support' && (
          <SupportTab coachEmail={coach.email} coachName={coach.name} />
        )}
      </main>

      {/* Floating rAI Chat Widget */}
      <ChatWidget
        userRole="coach"
        userEmail={coach.email}
      />
    </div>
  );
}

// ============================================================
// OVERVIEW TAB - WITH COACH TIER CARD & AVAILABILITY
// ============================================================
function OverviewTab({ stats, coach, onTabChange }: { stats: DashboardStats | null; coach: Coach; onTabChange: (tab: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#00abff] to-[#0066cc] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {coach.name.split(' ')[0]}! 👋</h1>
        <p className="text-blue-100">Here&apos;s what&apos;s happening with your coaching today.</p>
      </div>

      {/* ========== COACH TIER CARD - SHOWS TIER, EARNINGS & PROGRESS ========== */}
      <CoachTierCard coachId={coach.id} coachEmail={coach.email} />

      {/* ========== AVAILABILITY MANAGEMENT ========== */}
      <CoachAvailabilityCard
        coachId={coach.id}
        coachEmail={coach.email}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_students || 0}</p>
          <p className="text-sm text-gray-500">Total Students</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.active_students || 0}</p>
          <p className="text-sm text-gray-500">Active Students</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats?.upcoming_sessions || 0}</p>
          <p className="text-sm text-gray-500">Upcoming Sessions</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            ₹{(stats?.total_earnings || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-sm text-gray-500">Total Earnings</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onTabChange('students')}
            className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-center"
          >
            <Users className="w-6 h-6 text-[#00abff] mx-auto mb-2" />
            <span className="text-sm text-gray-700">View Students</span>
          </button>
          <button
            onClick={() => onTabChange('sessions')}
            className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-center"
          >
            <Calendar className="w-6 h-6 text-[#0066cc] mx-auto mb-2" />
            <span className="text-sm text-gray-700">Check Schedule</span>
          </button>
          <button
            onClick={() => onTabChange('referrals')}
            className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-center"
          >
            <Gift className="w-6 h-6 text-[#7B008B] mx-auto mb-2" />
            <span className="text-sm text-gray-700">Share Referral</span>
          </button>
          <button
            onClick={() => onTabChange('earnings')}
            className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-center"
          >
            <Wallet className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <span className="text-sm text-gray-700">View Earnings</span>
          </button>
        </div>
      </div>

      {/* Support Widget */}
      <SupportWidget
        userType="coach"
        userEmail={coach.email}
        userName={coach.name}
        variant="card"
      />
    </div>
  );
}

// ============================================================
// STUDENTS TAB
// ============================================================
function StudentsTab({ coachId }: { coachId: string }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, [coachId]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });

    if (!error) {
      setStudents(data || []);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading students...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-gray-900">My Students ({students.length})</h2>
      </div>
      {students.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No students assigned yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {students.map((student) => (
            <div key={student.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">Age {student.age} • {student.parent_name}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  student.lead_status === 'active' ? 'bg-green-100 text-green-700' :
                  student.lead_status === 'enrolled' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {student.lead_status || 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SESSIONS TAB
// ============================================================
function SessionsTab({ coachId }: { coachId: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [coachId]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .select('*, children(name)')
        .eq('coach_id', coachId)
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(20);

      if (!error) {
        setSessions(data || []);
      }
    } catch (e) {
      console.log('Error fetching sessions:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading sessions...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-gray-900">Upcoming Sessions ({sessions.length})</h2>
      </div>
      {sessions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No upcoming sessions</p>
        </div>
      ) : (
        <div className="divide-y">
          {sessions.map((session) => (
            <div key={session.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{session.children?.name || 'Student'}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(session.scheduled_time).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                {session.meet_link && (
                  <a
                    href={session.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#00abff] text-white rounded-lg text-sm font-medium hover:bg-[#0095E0]"
                  >
                    Join
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EARNINGS TAB
// ============================================================
function EarningsTab({ coachId }: { coachId: string }) {
  const [earnings, setEarnings] = useState({ total: 0, pending: 0, paid: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, [coachId]);

  const fetchEarnings = async () => {
    try {
      const { data } = await supabase
        .from('coach_payouts')
        .select('net_amount, status')
        .eq('coach_id', coachId);

      if (data) {
        const total = data.reduce((sum, p) => sum + (p.net_amount || 0), 0);
        const paid = data.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_amount || 0), 0);
        setEarnings({ total, pending: total - paid, paid });
      }
    } catch (e) {
      console.log('Error fetching earnings');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-1">Total Earned</p>
          <p className="text-2xl font-bold text-emerald-600">₹{earnings.total.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">₹{earnings.pending.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-1">Paid</p>
          <p className="text-2xl font-bold text-[#00abff]">₹{earnings.paid.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-gray-900 mb-2">💰 How You Earn</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• <strong>50%</strong> of coaching fee for each enrolled student (Rising Coach)</li>
          <li>• <strong>+20%</strong> lead bonus when you refer a student</li>
          <li>• Earn more as you progress: Expert (55%) → Master (60%)</li>
          <li>• Payments processed on <strong>7th of each month</strong></li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// SUPPORT TAB
// ============================================================
function SupportTab({ coachEmail, coachName }: { coachEmail: string; coachName: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [coachEmail]);

  async function fetchTickets() {
    try {
      const res = await fetch(`/api/support/tickets?email=${encodeURIComponent(coachEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
    setLoading(false);
  }

  function handleTicketCreated() {
    setShowForm(false);
    fetchTickets();
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    open: { label: 'Open', color: 'bg-yellow-100 text-yellow-700' },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
  };

  const CATEGORY_LABELS: Record<string, string> = {
    session_issue: '📅 Session Issue',
    technical_problem: '🔧 Technical Problem',
    payment_billing: '💳 Payment & Billing',
    coach_feedback: '👨‍🏫 Feedback',
    general_question: '❓ General Question',
    other: '📝 Other',
  };

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Support Center</h2>
          <p className="text-gray-500 text-sm">Get help with your questions and concerns</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#00abff] text-white rounded-lg font-medium hover:bg-[#0099ee] transition-all flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            Submit Request
          </button>
        )}
      </div>

      {/* Support Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">New Support Request</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          <SupportForm
            userType="coach"
            userEmail={coachEmail}
            userName={coachName}
            onClose={handleTicketCreated}
            isModal={false}
          />
        </div>
      )}

      {/* Tickets List */}
      {!showForm && (
        <>
          {/* Active Tickets */}
          {openTickets.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                Active Requests ({openTickets.length})
              </h3>
              <div className="space-y-3">
                {openTickets.map((ticket) => {
                  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  return (
                    <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-800">
                            {CATEGORY_LABELS[ticket.category] || ticket.category}
                          </p>
                          {ticket.subject && (
                            <p className="text-sm text-gray-600 mt-1">{ticket.subject}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved Tickets */}
          {resolvedTickets.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Resolved ({resolvedTickets.length})
              </h3>
              <div className="space-y-3">
                {resolvedTickets.slice(0, 5).map((ticket) => {
                  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.resolved;
                  return (
                    <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 p-4 opacity-75">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="font-medium text-gray-800">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && tickets.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <HelpCircle className="w-16 h-16 text-[#00abff]/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Support Requests</h3>
              <p className="text-gray-500 mb-6">You haven&apos;t submitted any requests yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#00abff] text-white rounded-xl font-semibold hover:bg-[#0099ee] transition-all"
              >
                Submit Your First Request
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-[#00abff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading your requests...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}