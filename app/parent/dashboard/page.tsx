// =============================================================================
// FILE: app/parent/dashboard/page.tsx
// VERSION: 4.0 - Redesigned Home Dashboard (feed-style, mobile-first)
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, ChevronRight, AlertCircle, RefreshCw,
  Sparkles, BookOpen, Users, HelpCircle, MessageCircle,
  Brain,
} from 'lucide-react';
import ReEnrollmentBanner from '@/components/parent/ReEnrollmentBanner';
import type { LearningProfile } from '@/components/parent/AIInsightCard';
import { supabase } from '@/lib/supabase/client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

const DEFAULT_WHATSAPP = COMPANY_CONFIG.leadBotWhatsApp;

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
  enrollment_type: 'starter' | 'continuation' | 'full' | 'tuition' | null;
  product_id: string | null;
  sessions_purchased: number | null;
  sessions_remaining: number | null;
  session_rate: number | null;
  billing_model: string | null;
  starter_completed_at: string | null;
  continuation_deadline: string | null;
  coaches: {
    id: string;
    name: string;
    email: string;
    bio: string;
    phone: string;
  } | null;
}

// Safe localStorage access
function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // localStorage not available
  }
  return null;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [taskStats, setTaskStats] = useState<{ current_streak: number; longest_streak: number; completed_this_week: number; total_this_week: number } | null>(null);
  const [todayTask, setTodayTask] = useState<any>(null);
  const [croSettings, setCroSettings] = useState<Record<string, string>>({});
  const [lastCompletedDate, setLastCompletedDate] = useState<string | null>(null);
  const [readingStats, setReadingStats] = useState<{ booksThisMonth: number; monthlyGoal: number }>({ booksThisMonth: 0, monthlyGoal: 4 });
  const [recommendedBook, setRecommendedBook] = useState<{ title: string; reason: string } | null>(null);
  const [referralLabel, setReferralLabel] = useState('10% off');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('User fetch error:', userError);
        throw new Error('Failed to verify authentication');
      }

      if (!user) {
        router.push('/parent/login');
        return;
      }

      setParentEmail(user.email || '');

      // Find parent record
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('id, email, name')
        .eq('email', user.email!)
        .maybeSingle();

      if (parentError) console.error('Parent fetch error:', parentError);

      if (parentData?.name) {
        setParentName(parentData.name);
        setParentId(parentData.id);
      }

      let enrolledChild: any = null;

      // Check localStorage for selected child
      const storedChildId = parentData?.id
        ? safeGetItem(`yestoryd_selected_child_${parentData.id}`)
        : null;

      // Find enrolled child by parent_id
      if (parentData?.id) {
        const childQuery = supabase
          .from('children')
          .select('id, name, child_name, latest_assessment_score, learning_profile')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false });

        if (storedChildId) {
          const { data: storedChild } = await supabase
            .from('children')
            .select('id, name, child_name, latest_assessment_score, learning_profile')
            .eq('id', storedChildId)
            .eq('parent_id', parentData.id)
            .eq('lead_status', 'enrolled')
            .single();
          enrolledChild = storedChild;
        }

        if (!enrolledChild) {
          const { data: children } = await childQuery.limit(1);
          enrolledChild = children?.[0] || null;
        }
      }

      // Fallback: by parent_email
      if (!enrolledChild) {
        const { data: children } = await supabase
          .from('children')
          .select('id, name, child_name, latest_assessment_score, learning_profile')
          .eq('parent_email', user.email!)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1);
        enrolledChild = children?.[0] || null;
      }

      if (!enrolledChild) {
        setLoading(false);
        return;
      }

      const displayName = enrolledChild.child_name || enrolledChild.name || 'Your Child';
      setChildId(enrolledChild.id);
      setChildName(displayName);

      if (enrolledChild.learning_profile) {
        try {
          const profile = typeof enrolledChild.learning_profile === 'string'
            ? JSON.parse(enrolledChild.learning_profile)
            : enrolledChild.learning_profile;
          setLearningProfile(profile);
        } catch { /* ignore parse errors */ }
      }

      // Active enrollment
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*, coaches!coach_id (id, name, email, bio, phone)')
        .eq('child_id', enrolledChild.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (enrollmentData) {
        setEnrollment(enrollmentData as any);
      }

      // Fire-and-forget: task stats
      fetch(`/api/parent/tasks/${enrolledChild.id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setTaskStats(d.stats || null);
            setTodayTask(d.today_task || null);
          }
        })
        .catch(() => {});

      // Fire-and-forget: CRO settings
      fetch('/api/parent/cro-settings')
        .then(r => r.json())
        .then(d => { if (d.settings) setCroSettings(d.settings); })
        .catch(() => {});

      // Fire-and-forget: referral percent from site_settings
      Promise.resolve(
        supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'parent_referral_credit_percent')
          .maybeSingle()
      )
        .then(({ data }) => {
          const pct = parseInt(String(data?.value).replace(/"/g, '')) || 10;
          setReferralLabel(`${pct}% off`);
        })
        .catch(() => {});

      // Fire-and-forget: reading stats + recommendation
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;
      if (token) {
        fetch(`/api/parent/reading?childId=${enrolledChild.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (d.success && d.stats) setReadingStats(d.stats); })
          .catch(() => {});
        fetch(`/api/books/recommendations?childId=${enrolledChild.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => {
            if (d.success && d.recommendations?.length) {
              const book = d.recommendations[0];
              setRecommendedBook({ title: book.title, reason: book.recommendation_reason || '' });
            }
          })
          .catch(() => {});
      }

      // Upcoming sessions
      const today = new Date().toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', enrolledChild.id)
        .gte('scheduled_date', today)
        .in('status', ['scheduled', 'rescheduled', 'confirmed', 'pending_scheduling', 'pending'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(5);

      setUpcomingSessions((sessions || []) as Session[]);

      // Completed sessions count
      const { count: completed } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id)
        .eq('status', 'completed');

      setCompletedSessions(completed || 0);

      // Last completed session date (for coach card)
      const { data: lastSession } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date')
        .eq('child_id', enrolledChild.id)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSession?.scheduled_date) {
        setLastCompletedDate(lastSession.scheduled_date);
      }

      // Total sessions
      const { count: total } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id);

      setTotalSessions(total || enrollmentData?.total_sessions || enrollmentData?.sessions_purchased || 24);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/parent/login');
      }
    });

    const handleChildChange = () => {
      setLoading(true);
      fetchData();
    };
    window.addEventListener('childChanged', handleChildChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('childChanged', handleChildChange);
    };
  }, [fetchData, router]);

  // --- Helpers ---

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function getFirstName(name: string): string {
    return name.split(' ')[0] || name;
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

  function getCoachName(): string {
    return enrollment?.coaches?.name || 'Your coach';
  }

  function getCoachInitial(): string {
    return getCoachName().charAt(0).toUpperCase();
  }

  function getChildInitials(): string {
    const parts = childName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || '').toUpperCase();
  }

  function getProgramTypePill(): string {
    switch (enrollment?.enrollment_type) {
      case 'tuition': return 'English Classes';
      case 'starter': return 'Starter';
      case 'continuation': return 'Continuation';
      case 'full': return 'Full Program';
      default: return 'Program';
    }
  }

  function getSeasonLabel(): string {
    const level = learningProfile?.reading_level?.current;
    if (level) return `${level} level`;
    return 'Building season';
  }

  function getSeasonSummary(): string {
    if (learningProfile?.recommended_focus_next_session) {
      return learningProfile.recommended_focus_next_session;
    }
    if (learningProfile?.active_skills?.length) {
      return `Working on ${learningProfile.active_skills.slice(0, 2).join(' & ').replace(/_/g, ' ')}`;
    }
    return 'Building reading confidence';
  }

  function getSessionDuration(): number {
    // Default durations by program type — real values come from age_band_config
    return 45;
  }

  function getDaysSinceLastSession(): string {
    if (!lastCompletedDate) return 'No sessions yet';
    const diff = Math.floor((Date.now() - new Date(lastCompletedDate).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Last session today';
    if (diff === 1) return 'Last session yesterday';
    return `Last session ${diff} days ago`;
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#FF0099] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center max-w-sm rounded-2xl bg-white border border-gray-100 p-6">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData(); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#cc007a] transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- No enrollment ---
  if (!childId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center max-w-sm rounded-2xl bg-white border border-gray-100 p-6">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-900 mb-1">No Active Enrollment</h2>
          <p className="text-sm text-gray-500 mb-4">Take a free assessment to get started.</p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#cc007a] transition-colors min-h-[44px]"
          >
            Reading Test - Free
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  const sessionsRemaining = enrollment?.enrollment_type === 'tuition'
    ? (enrollment?.sessions_remaining ?? 0)
    : Math.max(0, (enrollment?.sessions_purchased || totalSessions) - completedSessions);
  const nextSession = upcomingSessions[0] || null;

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-2xl mx-auto">
      <div className="space-y-2">

        {/* ── SECTION 1: GREETING ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{getGreeting()}, {getFirstName(parentName)}</p>
            <h1 className="text-xl font-medium text-gray-900">{childName}&apos;s dashboard</h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF5F9] text-[#993556]">
                {getProgramTypePill()}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                {getSeasonLabel()}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FBEAF0] flex items-center justify-center flex-shrink-0 mt-1">
            <span className="text-sm font-medium text-[#993556]">{getChildInitials()}</span>
          </div>
        </div>

        {/* ── RE-ENROLLMENT BANNER ── */}
        {enrollment && childId && (() => {
          const isTuition = enrollment.enrollment_type === 'tuition';
          if (isTuition && (enrollment.sessions_remaining ?? 0) <= 2) {
            return (
              <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {(enrollment.sessions_remaining ?? 0) <= 0
                      ? `Sessions have run out`
                      : `Only ${enrollment.sessions_remaining} session${(enrollment.sessions_remaining ?? 0) === 1 ? '' : 's'} left`
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Add more to continue learning</p>
                </div>
                <a
                  href={`/tuition/pay/${enrollment.id}?renewal=true`}
                  className="flex-shrink-0 bg-[#FF0099] text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-[#cc007a] transition-colors min-h-[44px] flex items-center"
                >
                  Renew
                </a>
              </div>
            );
          }
          if (!isTuition && sessionsRemaining <= 2 && sessionsRemaining >= 0) {
            return (
              <ReEnrollmentBanner
                childId={childId}
                childName={childName}
                sessionsRemaining={sessionsRemaining}
                croSettings={croSettings}
              />
            );
          }
          return null;
        })()}

        {/* ── SECTION 2: HERO PROGRESS + INLINE TASK ── */}
        <div className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5">
          {/* Top: season icon + label */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF0099, #cc007a)' }}
            >
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-medium text-gray-900">{getSeasonLabel()}</p>
              <p className="text-xs text-gray-500 truncate">{getSeasonSummary()}</p>
            </div>
          </div>

          {/* Middle: 3-column stat grid */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xl font-medium text-gray-900">{completedSessions}</p>
              <p className="text-xs text-gray-500">Sessions done</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-medium text-gray-900">{sessionsRemaining}</p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-medium text-[#FF0099]">{taskStats?.current_streak || 0}</p>
              <p className="text-xs text-gray-500">Day streak</p>
            </div>
          </div>

          {/* Bottom: inline task banner (conditional) */}
          {todayTask && !todayTask.is_completed && (
            <div className="mt-4 bg-[#FFF5F9] border border-[#FFD6E8] rounded-lg p-3 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#FF0099] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#993556] truncate">{todayTask.title}</p>
                <p className="text-xs text-[#993556]/70">15 min practice</p>
              </div>
              <Link
                href="/parent/tasks"
                className="text-sm font-medium text-[#FF0099] flex-shrink-0 min-h-[44px] flex items-center"
              >
                Start
              </Link>
            </div>
          )}
        </div>

        {/* ── SECTION 3: NEXT SESSION ── */}
        <div className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5">
          <p className="text-xs text-gray-500 tracking-wide uppercase mb-3">Next session</p>
          {nextSession ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                <p className="text-[10px] text-gray-500 uppercase leading-none">
                  {(() => {
                    try {
                      return new Date(nextSession.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short' });
                    } catch { return ''; }
                  })()}
                </p>
                <p className="text-lg font-medium text-gray-900 leading-none mt-0.5">
                  {(() => {
                    try {
                      return new Date(nextSession.scheduled_date).getDate();
                    } catch { return ''; }
                  })()}
                </p>
                <p className="text-[10px] text-gray-500 uppercase leading-none">
                  {(() => {
                    try {
                      return new Date(nextSession.scheduled_date).toLocaleDateString('en-IN', { month: 'short' });
                    } catch { return ''; }
                  })()}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {nextSession.title || `Session #${nextSession.session_number}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTime(nextSession.scheduled_time)} · {getSessionDuration()} min · with {getCoachName()}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                <p className="text-lg font-medium text-gray-300 leading-none">--</p>
              </div>
              <p className="text-sm text-gray-400">No sessions scheduled</p>
            </div>
          )}
        </div>

        {/* ── SECTION 4: READING LOG ── */}
        <div className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 tracking-wide uppercase">Reading log</p>
            <Link href="/library" className="text-xs font-medium text-[#FF0099]">Browse library</Link>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-700 whitespace-nowrap">
              {readingStats.booksThisMonth} of {readingStats.monthlyGoal} books
            </p>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0099] rounded-full transition-all"
                style={{ width: `${Math.min(100, (readingStats.booksThisMonth / readingStats.monthlyGoal) * 100)}%` }}
              />
            </div>
          </div>

          {/* Recommended book */}
          {recommendedBook && (
            <>
              <div className="my-3 h-px bg-gray-100" />
              <p className="text-xs text-gray-500 mb-2">Recommended for {getFirstName(childName)}</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{recommendedBook.title}</p>
                  {recommendedBook.reason && (
                    <p className="text-xs text-gray-500 truncate">{recommendedBook.reason}</p>
                  )}
                </div>
                <Link href="/parent/tasks" className="text-xs font-medium text-[#FF0099] flex-shrink-0 min-h-[44px] flex items-center">
                  Log
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── E-LEARNING ACCESS ── */}
        <Link
          href="/parent/elearning"
          className="rounded-2xl bg-[#E8FCF1] border border-[#1D9E75]/20 p-4 md:p-5 flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-[#1D9E75]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#085041]">E-Learning</p>
            <p className="text-xs text-[#0F6E56]">Videos, quizzes, and practice content</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#1D9E75] group-hover:text-[#085041] flex-shrink-0" />
        </Link>

        {/* ── SECTION 5: COACH ── */}
        <div className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FBEAF0] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-[#993556]">{getCoachInitial()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{getCoachName()}</p>
              <p className="text-xs text-gray-500">{getDaysSinceLastSession()}</p>
            </div>
            <a
              href={`https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}?text=${encodeURIComponent(`Hi, I'm ${childName}'s parent.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#E8FCF1] text-[#1D9E75] rounded-xl px-3 min-h-[44px] text-sm font-medium flex-shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </a>
          </div>
        </div>

        {/* ── SECTION 6: REFERRAL ── */}
        <Link
          href="/parent/journey"
          className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5 flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#FFF5F9] flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-[#FF0099]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Refer a friend, get {referralLabel}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        </Link>

        {/* ── SECTION 7: NEED HELP ── */}
        <Link
          href="/parent/rai"
          className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5 flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Need help?</p>
            <p className="text-xs text-gray-500">Ask rAI or submit a request</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        </Link>

      </div>
    </div>
  );
}
