// =============================================================================
// FILE: app/parent/dashboard/page.tsx
// VERSION: 3.1 - Skill Booster Terminology Update
// PURPOSE: Parent Dashboard with Skill Booster Session Support
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  Calendar, TrendingUp, HelpCircle,
  ChevronRight, Video,
  Clock, CheckCircle, Target, User, MessageCircle,
  BookOpen, Zap, Gift, AlertCircle, RefreshCw,
  Sparkles, Star, Rocket, Trophy
} from 'lucide-react';
import PauseEnrollmentCard from '@/components/parent/PauseEnrollmentCard';
import SupportWidget from '@/components/support/SupportWidget';
import ChatWidget from '@/components/chat/ChatWidget';
import ReferralsTab from '@/components/parent/ReferralsTab';

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
  // New fields for multi-product support
  enrollment_type: 'starter' | 'continuation' | 'full' | null;
  product_id: string | null;
  sessions_purchased: number | null;
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

interface PendingSkillBoosterSession {
  id: string;
  focus_area: string;
  coach_notes?: string;
  created_at: string;
  coach_name: string;
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

// Safe localStorage access
function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {
    console.warn('localStorage not available');
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
  const [totalSessions, setTotalSessions] = useState<number>(9);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [pendingSkillBooster, setPendingSkillBooster] = useState<PendingSkillBoosterSession | null>(null);

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
        .eq('email', user.email)
        .maybeSingle();

      if (parentError) {
        console.error('Parent fetch error:', parentError);
      }

      if (parentData?.name) {
        setParentName(parentData.name);
        setParentId(parentData.id);
      }

      let enrolledChild = null;

      // Check localStorage for selected child
      const storedChildId = parentData?.id
        ? safeGetItem(`yestoryd_selected_child_${parentData.id}`)
        : null;

      // Find enrolled child by parent_id
      if (parentData?.id) {
        if (storedChildId) {
          const { data: selectedChild } = await supabase
            .from('children')
            .select('*')
            .eq('id', storedChildId)
            .eq('parent_id', parentData.id)
            .maybeSingle();

          if (selectedChild) {
            enrolledChild = selectedChild;
          }
        }

        if (!enrolledChild) {
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
      }

      // Fallback: try by parent_email
      if (!enrolledChild && user.email) {
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
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          *,
          enrollment_type,
          product_id,
          sessions_purchased,
          starter_completed_at,
          continuation_deadline,
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

      if (enrollmentError) {
        console.error('Enrollment fetch error:', enrollmentError);
      }

      if (enrollmentData) {
        setEnrollment(enrollmentData);
      }

      // Fetch pending Skill Booster sessions (DB still uses 'remedial' type)
      try {
        const { data: skillBoosterData, error: skillBoosterError } = await supabase
          .from('scheduled_sessions')
          .select(`
            id,
            focus_area,
            coach_notes,
            created_at,
            coaches:coach_id (name)
          `)
          .eq('child_id', enrolledChild.id)
          .eq('session_type', 'remedial')
          .eq('status', 'pending_booking')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (skillBoosterError) {
          console.error('Skill Booster fetch error:', skillBoosterError);
        }

        if (skillBoosterData) {
          setPendingSkillBooster({
            id: skillBoosterData.id,
            focus_area: skillBoosterData.focus_area || 'general',
            coach_notes: skillBoosterData.coach_notes,
            created_at: skillBoosterData.created_at,
            coach_name: (skillBoosterData.coaches as any)?.name || 'Your Coach'
          });
        } else {
          setPendingSkillBooster(null);
        }
      } catch (skillBoosterErr) {
        console.error('Skill Booster fetch exception:', skillBoosterErr);
        setPendingSkillBooster(null);
      }

      // Fetch upcoming sessions
      const today = new Date().toISOString().split('T')[0];
      const { data: sessions, error: sessionsError } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', enrolledChild.id)
        .gte('scheduled_date', today)
        .in('status', ['scheduled', 'rescheduled'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(5);

      if (sessionsError) {
        console.error('Sessions fetch error:', sessionsError);
      }

      setUpcomingSessions(sessions || []);

      // Count completed sessions
      const { count: completed, error: completedError } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id)
        .eq('status', 'completed');

      if (completedError) {
        console.error('Completed count error:', completedError);
      }

      setCompletedSessions(completed || 0);

      // Count total sessions
      const { count: total, error: totalError } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id);

      if (totalError) {
        console.error('Total count error:', totalError);
      }

      setTotalSessions(total || 9);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/parent/login');
      }
    });

    // Listen for child change events from layout
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/parent/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/parent/login');
    }
  };

  function getProgressPercentage(): number {
    if (totalSessions === 0) return 0;
    return Math.round((completedSessions / totalSessions) * 100);
  }

  function getDaysRemaining(): number {
    const endDate = enrollment?.program_end;
    if (!endDate) return 90;
    try {
      const end = new Date(endDate);
      const today = new Date();
      const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    } catch {
      return 90;
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-6 shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-6 text-sm">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchData();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all min-h-[48px]"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No enrollment state
  if (!childId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-6 shadow-lg">
          <BookOpen className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Enrollment</h2>
          <p className="text-gray-500 mb-2 text-sm">Logged in as: <span className="text-[#7b008b]">{parentEmail}</span></p>
          <p className="text-gray-500 mb-6 text-sm">You don&apos;t have an active enrollment yet.</p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg transition-all min-h-[48px]"
          >
            Take Free Assessment
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    // CRITICAL: overflow-x-hidden prevents horizontal scroll
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Main Content - No separate header, uses layout's navigation */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Overview Content - Navigation handled by BottomNav and Sidebar */}
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
          pendingSkillBooster={pendingSkillBooster}
        />
      </main>

      {/* Floating rAI Chat Widget */}
      <ChatWidget userRole="parent" userEmail={parentEmail} />
    </div>
  );
}

// ============================================================
// PENDING SKILL BOOSTER CARD - Mobile Optimized with proper width
// ============================================================
function PendingSkillBoosterCard({
  session,
  childName
}: {
  session: PendingSkillBoosterSession;
  childName: string;
}) {
  const focusAreaLabel = FOCUS_AREA_LABELS[session.focus_area] || session.focus_area;

  const daysSince = Math.floor(
    (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className="bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50
                 border-2 border-yellow-400/60 rounded-2xl p-4
                 shadow-lg shadow-yellow-200/30 w-full"
      role="alert"
      aria-label="Skill Booster session recommended"
    >
      <div className="flex flex-col gap-3">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 to-orange-500
                          rounded-xl flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-orange-200/50">
            <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
              Skill Booster Session
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
              Coach <span className="font-semibold text-[#7b008b]">{session.coach_name}</span> recommends
              extra practice for <span className="font-semibold">{childName}</span>
            </p>
          </div>
        </div>

        {/* Focus Area Highlight */}
        <div className="bg-white/70 rounded-xl p-3 border border-yellow-200">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Focus Area</p>
          <p className="text-sm sm:text-lg font-bold text-[#ff0099]">{focusAreaLabel}</p>
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700
                         rounded-full text-[10px] sm:text-sm font-semibold border border-green-200">
            <CheckCircle className="w-3 h-3" />
            FREE - Included
          </span>
          {daysSince > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-sm text-gray-500">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {daysSince}d ago
            </span>
          )}
        </div>

        {/* CTA Button - Full Width */}
        <Link
          href={`/parent/book-skill-booster/${session.id}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-3
                   bg-gradient-to-r from-[#ff0099] to-[#7b008b]
                   text-white font-semibold rounded-xl hover:opacity-90
                   transition-all shadow-lg shadow-[#ff0099]/30
                   text-sm min-h-[48px] active:scale-[0.98]"
        >
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Book Time Slot</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
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
  pendingSkillBooster,
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
  pendingSkillBooster: PendingSkillBoosterSession | null;
}) {
  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
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

  function getCoachPhone(): string {
    return enrollment?.coaches?.phone || '918976287997';
  }

  function getCoachName(): string {
    return enrollment?.coaches?.name || 'Rucha';
  }

  // Get enrollment type display info - uses Lucide icons
  const getEnrollmentTypeInfo = () => {
    const type = enrollment?.enrollment_type;
    switch (type) {
      case 'starter':
        return {
          label: 'Starter Pack',
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          Icon: Rocket,
        };
      case 'continuation':
        return {
          label: 'Continuation',
          color: 'bg-purple-100 text-purple-700 border-purple-200',
          Icon: TrendingUp,
        };
      case 'full':
        return {
          label: 'Full Program',
          color: 'bg-green-100 text-green-700 border-green-200',
          Icon: Star,
        };
      default:
        return {
          label: 'Program',
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          Icon: BookOpen,
        };
    }
  };

  const enrollmentTypeInfo = getEnrollmentTypeInfo();

  // Check if starter is completed and can continue
  const isStarterCompleted = enrollment?.enrollment_type === 'starter' &&
    (enrollment?.starter_completed_at || completedSessions >= totalSessions);

  // Check if continuation deadline is approaching (within 3 days)
  const continuationDeadline = enrollment?.continuation_deadline
    ? new Date(enrollment.continuation_deadline)
    : null;
  const daysUntilDeadline = continuationDeadline
    ? Math.ceil((continuationDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-4 w-full">
      {/* Welcome Banner with Enrollment Type Badge */}
      <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-xl p-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold mb-1 flex items-center gap-2">
              Welcome back!
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </h1>
            <p className="text-pink-100 text-sm">Track {childName}&apos;s reading journey</p>
          </div>
          {enrollment?.enrollment_type && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${enrollmentTypeInfo.color}`}>
              <enrollmentTypeInfo.Icon className="w-3 h-3" />
              {enrollmentTypeInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* STARTER COMPLETION CTA - Show when starter is completed */}
      {isStarterCompleted && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Starter Pack Completed!
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                {childName} has made great progress! Continue the journey with 9 more sessions.
              </p>
              {daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0 && (
                <p className="text-amber-600 text-xs mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Special continuation pricing expires in {daysUntilDeadline} day{daysUntilDeadline !== 1 ? 's' : ''}
                </p>
              )}
              <Link
                href={`/enroll?product=continuation&childId=${enrollment?.id ? enrollment.id.split('-')[0] : ''}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg transition-all text-sm"
              >
                <Zap className="w-4 h-4" />
                Continue Your Journey
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PENDING SKILL BOOSTER CARD */}
      {pendingSkillBooster && (
        <PendingSkillBoosterCard session={pendingSkillBooster} childName={childName} />
      )}

      {/* Pause/Resume Card */}
      {enrollment && (
        <PauseEnrollmentCard
          enrollmentId={enrollment.id}
          childName={childName}
          onStatusChange={onRefresh}
        />
      )}

      {/* Stats Grid - 2x2 on mobile */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-[#7b008b]/10 rounded-lg">
              <Target className="w-4 h-4 text-[#7b008b]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{getProgressPercentage()}%</p>
          <p className="text-xs text-gray-500">Progress</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {completedSessions}/{enrollment?.sessions_purchased || totalSessions}
          </p>
          <p className="text-xs text-gray-500">Sessions</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{latestScore ?? '--'}/10</p>
          <p className="text-xs text-gray-500">Latest Score</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-[#ff0099]/10 rounded-lg">
              <Clock className="w-4 h-4 text-[#ff0099]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#ff0099]">{getDaysRemaining()}</p>
          <p className="text-xs text-gray-500">Days Left</p>
        </div>
      </div>

      {/* Sessions & Coach - Stack on mobile */}
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[#7b008b]" />
              Upcoming Sessions
            </h2>
            <Link
              href="/parent/sessions"
              className="text-xs text-[#7b008b] hover:text-[#6a0078] font-medium flex items-center gap-1 min-h-[44px] px-2 -mr-2"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {upcomingSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#7b008b]/10 to-[#ff0099]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Video className="w-5 h-5 text-[#7b008b]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {session.title || (session.session_type === 'coaching' ? 'Coaching Session' : 'Parent Check-in')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(session.scheduled_date)} • {formatTime(session.scheduled_time)}
                      </p>
                    </div>
                  </div>
                  {session.google_meet_link && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-[#7b008b] text-white rounded-lg text-xs font-medium hover:bg-[#6a0078] transition-all flex-shrink-0 min-h-[36px] flex items-center"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No upcoming sessions</p>
              <p className="text-xs text-gray-400 mt-1">Sessions will appear here once scheduled</p>
            </div>
          )}
        </div>

        {/* Coach Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-[#7b008b]" />
              Your Coach
            </h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-xl text-white font-bold">
                  {getCoachName().charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{getCoachName()}</p>
                <p className="text-xs text-[#7b008b]">Reading Coach</p>
              </div>
            </div>
            {enrollment?.coaches?.bio && (
              <p className="text-xs text-gray-500 mb-4 line-clamp-2">{enrollment.coaches.bio}</p>
            )}
            <a
              href={`https://wa.me/${getCoachPhone()}?text=Hi ${getCoachName()}, I'm ${childName}'s parent.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#1da851] transition-colors min-h-[44px] text-sm"
            >
              <MessageCircle className="w-4 h-4" />
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

      {/* Referrals Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Gift className="w-4 h-4 text-[#FF0099]" />
            Refer Friends & Earn
          </h2>
        </div>
        <div className="p-4">
          <ReferralsTab
            parentEmail={parentEmail}
            parentName={parentName}
            childName={childName}
          />
        </div>
      </div>

      {/* rAI Tip */}
      <div className="bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base">rAI says</h3>
            <p className="text-white/90 text-xs sm:text-sm mt-1">
              Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

