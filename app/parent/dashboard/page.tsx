// =============================================================================
// FILE: app/parent/dashboard/page.tsx
// PURPOSE: Parent Dashboard - Redesigned to match Coach Dashboard layout
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard, Calendar, TrendingUp, HelpCircle,
  LogOut, Menu, X, ChevronRight, Bell, Video,
  Clock, CheckCircle, Target, User, MessageCircle,
  BookOpen, Sparkles, Users
} from 'lucide-react';
import PauseEnrollmentCard from '@/components/parent/PauseEnrollmentCard';
import SupportWidget from '@/components/support/SupportWidget';
import SupportForm from '@/components/support/SupportForm';
import ChatWidget from '@/components/chat/ChatWidget';

// 4-Point Star Icon Component (Yestoryd branding)
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session {
  id: string;
  session_type: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  google_meet_link: string;
  status: string;
  title: string;
}

interface Enrollment {
  id: string;
  status: string;
  program_start: string;
  program_end: string;
  coach_id: string;
  coaches: {
    id: string;
    name: string;
    email: string;
    bio: string;
    phone: string;
  };
}

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sessions', label: 'Sessions', icon: Calendar },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'support', label: 'Support', icon: HelpCircle },
];

export default function ParentDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(9);
  const [latestScore, setLatestScore] = useState<number | null>(null);

  useEffect(() => {
    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/parent/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/parent/login');
        return;
      }

      setParentEmail(user.email || '');

      // Find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id, email, name')
        .eq('email', user.email)
        .maybeSingle();

      if (parentData?.name) {
        setParentName(parentData.name);
      }

      let enrolledChild = null;

      // Find enrolled child by parent_id first
      if (parentData?.id) {
        const { data: childByParentId } = await supabase
          .from('children')
          .select('*')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (childByParentId) {
          enrolledChild = childByParentId;
        }
      }

      // Fallback: try by parent_email
      if (!enrolledChild) {
        const { data: childByEmail } = await supabase
          .from('children')
          .select('*')
          .eq('parent_email', user.email)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (childByEmail) {
          enrolledChild = childByEmail;
        }
      }

      if (!enrolledChild) {
        setLoading(false);
        return;
      }

      setChildId(enrolledChild.id);
      setChildName(enrolledChild.name || enrolledChild.child_name || 'Your Child');
      setLatestScore(enrolledChild.latest_assessment_score);

      // Fetch enrollment with coach details
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          *,
          coaches!coach_id (
            id,
            name,
            email,
            bio,
            phone
          )
        `)
        .eq('child_id', enrolledChild.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollmentData) {
        setEnrollment(enrollmentData);
      }

      // Fetch upcoming sessions
      const today = new Date().toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', enrolledChild.id)
        .gte('scheduled_date', today)
        .in('status', ['scheduled', 'rescheduled'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(5);

      setUpcomingSessions(sessions || []);

      // Count completed sessions
      const { count: completed } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id)
        .eq('status', 'completed');

      setCompletedSessions(completed || 0);

      // Count total sessions
      const { count: total } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id);

      setTotalSessions(total || 9);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/parent/login');
  };

  function getProgressPercentage(): number {
    if (totalSessions === 0) return 0;
    return Math.round((completedSessions / totalSessions) * 100);
  }

  function getDaysRemaining(): number {
    const endDate = enrollment?.program_end;
    if (!endDate) return 90;
    const end = new Date(endDate);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!childId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-lg">
          <BookOpen className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Enrollment</h2>
          <p className="text-gray-500 mb-2">Logged in as: <span className="text-[#7b008b]">{parentEmail}</span></p>
          <p className="text-gray-500 mb-6">You don&apos;t have an active enrollment yet.</p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Take Free Assessment
            <ChevronRight className="w-5 h-5" />
          </a>
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
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-lg flex items-center justify-center">
                  <StarIcon className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-gray-900 hidden sm:block">Yestoryd</span>
              </Link>
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
                        ? 'bg-[#7b008b]/10 text-[#7b008b]'
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
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff0099] rounded-full"></span>
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900">{parentName || 'Parent'}</p>
                  <p className="text-xs text-gray-500">{childName}&apos;s Parent</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold">
                  {(parentName || 'P').charAt(0).toUpperCase()}
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
                        ? 'bg-[#7b008b]/10 text-[#7b008b]'
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
                      ? 'bg-[#7b008b] text-white'
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
          <OverviewTab
            childName={childName}
            enrollment={enrollment}
            upcomingSessions={upcomingSessions}
            completedSessions={completedSessions}
            totalSessions={totalSessions}
            latestScore={latestScore}
            getDaysRemaining={getDaysRemaining}
            getProgressPercentage={getProgressPercentage}
            onRefresh={fetchData}
            parentEmail={parentEmail}
            parentName={parentName}
          />
        )}

        {activeTab === 'sessions' && (
          <SessionsTab
            childId={childId}
            upcomingSessions={upcomingSessions}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressTab
            completedSessions={completedSessions}
            totalSessions={totalSessions}
            latestScore={latestScore}
            getProgressPercentage={getProgressPercentage}
          />
        )}

        {activeTab === 'support' && (
          <SupportTab parentEmail={parentEmail} parentName={parentName} childName={childName} />
        )}
      </main>

      {/* Floating rAI Chat Widget */}
      <ChatWidget
        userRole="parent"
        userEmail={parentEmail}
      />
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({
  childName,
  enrollment,
  upcomingSessions,
  completedSessions,
  totalSessions,
  latestScore,
  getDaysRemaining,
  getProgressPercentage,
  onRefresh,
  parentEmail,
  parentName,
}: {
  childName: string;
  enrollment: Enrollment | null;
  upcomingSessions: Session[];
  completedSessions: number;
  totalSessions: number;
  latestScore: number | null;
  getDaysRemaining: () => number;
  getProgressPercentage: () => number;
  onRefresh: () => void;
  parentEmail: string;
  parentName: string;
}) {
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  function getCoachPhone(): string {
    return enrollment?.coaches?.phone || '918976287997';
  }

  function getCoachName(): string {
    return enrollment?.coaches?.name || 'Rucha';
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back! 👋</h1>
        <p className="text-pink-100">Track {childName}&apos;s reading journey</p>
      </div>

      {/* Pause/Resume Card */}
      {enrollment && (
        <PauseEnrollmentCard
          enrollmentId={enrollment.id}
          childName={childName}
          onStatusChange={onRefresh}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-[#7b008b]/10 rounded-lg">
              <Target className="w-4 h-4 text-[#7b008b]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{getProgressPercentage()}%</p>
          <p className="text-sm text-gray-500">Progress</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{completedSessions}/{totalSessions}</p>
          <p className="text-sm text-gray-500">Sessions</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{latestScore ?? '--'}/10</p>
          <p className="text-sm text-gray-500">Latest Score</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-[#ff0099]/10 rounded-lg">
              <Clock className="w-4 h-4 text-[#ff0099]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#ff0099]">{getDaysRemaining()}</p>
          <p className="text-sm text-gray-500">Days Left</p>
        </div>
      </div>

      {/* Sessions & Coach Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#7b008b]" />
              Upcoming Sessions
            </h2>
            <Link href="/parent/sessions" className="text-sm text-[#7b008b] hover:text-[#6a0078] font-medium flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {upcomingSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#7b008b]/10 to-[#ff0099]/10 rounded-xl flex items-center justify-center">
                      <Video className="w-6 h-6 text-[#7b008b]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {session.title || (session.session_type === 'coaching' ? '📚 Coaching Session' : '👨‍👩‍👧 Parent Check-in')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
                      </p>
                    </div>
                  </div>
                  {session.google_meet_link && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#7b008b] text-white rounded-lg text-sm font-medium hover:bg-[#6a0078] transition-all"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No upcoming sessions</p>
              <p className="text-sm text-gray-400 mt-1">Sessions will appear here once scheduled</p>
            </div>
          )}
        </div>

        {/* Coach Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-[#7b008b]" />
              Your Coach
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl text-white font-bold">
                  {getCoachName().charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">{getCoachName()}</p>
                <p className="text-sm text-[#7b008b]">Reading Coach</p>
              </div>
            </div>
            {enrollment?.coaches?.bio && (
              <p className="text-sm text-gray-500 mb-4 line-clamp-3">{enrollment.coaches.bio}</p>
            )}
            <a
              href={`https://wa.me/${getCoachPhone()}?text=Hi ${getCoachName()}, I'm ${childName}'s parent.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Message on WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Support Widget */}
      <SupportWidget
        userType="parent"
        userEmail={parentEmail}
        userName={parentName}
        childName={childName}
        variant="card"
      />

      {/* rAI Tip */}
      <div className="bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">rAI says</h3>
            </div>
            <p className="text-white/90">
              Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration! 📚
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SESSIONS TAB
// ============================================================
function SessionsTab({ childId, upcomingSessions }: { childId: string; upcomingSessions: Session[] }) {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllSessions();
  }, [childId]);

  async function fetchAllSessions() {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('child_id', childId)
      .order('scheduled_date', { ascending: false })
      .limit(20);

    setAllSessions(data || []);
    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading sessions...</div>;
  }

  const upcoming = allSessions.filter(s => s.status === 'scheduled' || s.status === 'rescheduled');
  const completed = allSessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-900">Upcoming Sessions ({upcoming.length})</h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No upcoming sessions scheduled</p>
          </div>
        ) : (
          <div className="divide-y">
            {upcoming.map((session) => (
              <div key={session.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#7b008b]/10 rounded-lg flex items-center justify-center">
                    <Video className="w-5 h-5 text-[#7b008b]" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{session.title || 'Coaching Session'}</p>
                    <p className="text-sm text-gray-500">{formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}</p>
                  </div>
                </div>
                {session.google_meet_link && (
                  <a
                    href={session.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#7b008b] text-white rounded-lg text-sm font-medium"
                  >
                    Join
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-900">Completed Sessions ({completed.length})</h2>
        </div>
        {completed.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No completed sessions yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {completed.map((session) => (
              <div key={session.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{session.title || 'Coaching Session'}</p>
                    <p className="text-sm text-gray-500">{formatDate(session.scheduled_date)}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Completed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PROGRESS TAB
// ============================================================
function ProgressTab({
  completedSessions,
  totalSessions,
  latestScore,
  getProgressPercentage,
}: {
  completedSessions: number;
  totalSessions: number;
  latestScore: number | null;
  getProgressPercentage: () => number;
}) {
  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-6">Reading Progress</h2>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-bold text-[#7b008b]">{getProgressPercentage()}%</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-[#7b008b]">{completedSessions}</p>
              <p className="text-sm text-gray-500">Sessions Done</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-400">{totalSessions - completedSessions}</p>
              <p className="text-sm text-gray-500">Remaining</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-blue-600">{latestScore ?? '--'}/10</p>
              <p className="text-sm text-gray-500">Latest Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-gray-900 mb-2">📈 How Progress Works</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• Complete coaching sessions to increase your progress</li>
          <li>• Practice daily reading for best results</li>
          <li>• Your coach will provide personalized feedback</li>
          <li>• Assessment scores track reading improvement over time</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// SUPPORT TAB
// ============================================================
function SupportTab({ parentEmail, parentName, childName }: { parentEmail: string; parentName: string; childName: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [parentEmail]);

  async function fetchTickets() {
    try {
      const res = await fetch(`/api/support/tickets?email=${encodeURIComponent(parentEmail)}`);
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
            className="px-4 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] transition-all flex items-center gap-2"
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
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
          <SupportForm
            userType="parent"
            userEmail={parentEmail}
            userName={parentName}
            childName={childName}
            onClose={handleTicketCreated}
            isModal={false}
          />
        </div>
      )}

      {/* Tickets List */}
      {!showForm && (
        <>
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="font-medium text-gray-800">{ticket.subject || ticket.category}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                      <p className="font-medium text-gray-800">{ticket.subject || ticket.category}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && tickets.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <HelpCircle className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Support Requests</h3>
              <p className="text-gray-500 mb-6">You haven&apos;t submitted any requests yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all"
              >
                Submit Your First Request
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading your requests...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}