// =============================================================================
// FILE: app/parent/dashboard/page.tsx
// VERSION: 3.2 - Premium Dark UI + Dynamic WhatsApp
// PURPOSE: Parent Dashboard with Skill Booster Session Support
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, TrendingUp, HelpCircle,
  ChevronRight, Video,
  Clock, CheckCircle, Target, User, MessageCircle,
  BookOpen, Zap, Gift, AlertCircle, RefreshCw,
  Sparkles, Star, Rocket, Trophy
} from 'lucide-react';
import PauseEnrollmentCard from '@/components/parent/PauseEnrollmentCard';
import ParentCallCard from '@/components/parent/ParentCallCard';
import ProgressPulseCard from '@/components/parent/ProgressPulseCard';
import AIInsightCard from '@/components/parent/AIInsightCard';
import SkillProgressCard from '@/components/parent/SkillProgressCard';
import SupportWidget from '@/components/support/SupportWidget';
import ChatWidget from '@/components/chat/ChatWidget';
import ReferralsTab from '@/components/parent/ReferralsTab';
import GroupClassesSection from '@/components/parent/GroupClassesSection';
import ChildTimeline from '@/components/parent/ChildTimeline';
import type { LearningProfile } from '@/components/parent/AIInsightCard';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import { supabase } from '@/lib/supabase/client';

// Default WhatsApp number (fetched from site_settings)
const DEFAULT_WHATSAPP = '918976287997';

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

/** Build contextual quick prompts for ChatWidget based on child's learning profile */
function buildContextualPrompts(childName: string, profile: LearningProfile): string[] {
  const prompts: string[] = [];
  prompts.push(`How is ${childName} doing?`);

  if (profile.struggle_areas && profile.struggle_areas.length > 0) {
    const area = profile.struggle_areas[0].skill?.replace(/_/g, ' ');
    prompts.push(`How can we help with ${area}?`);
  } else {
    prompts.push(`What should ${childName} practice?`);
  }

  if (profile.sessions_remaining && profile.sessions_remaining <= 3) {
    prompts.push('What to focus on in remaining sessions?');
  } else {
    prompts.push(`Explain ${childName}'s reading level`);
  }

  return prompts;
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
  const [totalSessions, setTotalSessions] = useState<number>(9); /* V1 fallback — will be replaced by age_band_config.total_sessions */
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [pendingSkillBooster, setPendingSkillBooster] = useState<PendingSkillBoosterSession | null>(null);
  const [parentCalls, setParentCalls] = useState<any[]>([]);
  const [parentCallQuota, setParentCallQuota] = useState({ used: 0, max: 1, remaining: 1 });
  const [latestPulse, setLatestPulse] = useState<any>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);

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
      setLearningProfile(enrolledChild.learning_profile as LearningProfile | null);

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
        setEnrollment(enrollmentData as any);
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
            coach_notes: skillBoosterData.coach_notes ?? undefined,
            created_at: skillBoosterData.created_at ?? new Date().toISOString(),
            coach_name: (skillBoosterData.coaches as any)?.name || 'Your Coach'
          });
        } else {
          setPendingSkillBooster(null);
        }
      } catch (skillBoosterErr) {
        console.error('Skill Booster fetch exception:', skillBoosterErr);
        setPendingSkillBooster(null);
      }

      // Fetch parent calls for this enrollment
      if (enrollmentData) {
        try {
          const pcRes = await fetch(`/api/parent-call/${enrollmentData.id}`);
          const pcData = await pcRes.json();
          if (pcData.success) {
            setParentCalls(pcData.calls || []);
            setParentCallQuota(pcData.quota || { used: 0, max: 1, remaining: 1 });
          }
        } catch (pcErr) {
          console.error('Parent call fetch exception:', pcErr);
        }
      }

      // Fetch latest Progress Pulse
      if (enrolledChild?.id) {
        try {
          const { data: pulseData } = await supabase
            .from('learning_events')
            .select('id, event_date, data, event_data')
            .eq('child_id', enrolledChild.id)
            .eq('event_type', 'progress_pulse')
            .order('event_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pulseData) {
            setLatestPulse({
              id: pulseData.id,
              event_date: pulseData.event_date,
              data: pulseData.event_data || pulseData.data,
            });
          } else {
            setLatestPulse(null);
          }
        } catch (pulseErr) {
          console.error('Progress Pulse fetch exception:', pulseErr);
          setLatestPulse(null);
        }
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

      setUpcomingSessions((sessions || []) as any);

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

      setTotalSessions(total || 9); /* V1 fallback */
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-surface-1 rounded-2xl p-6 shadow-xl shadow-black/30 border border-border">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-text-tertiary mb-6 text-sm">{error}</p>
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-surface-1 rounded-2xl p-6 shadow-xl shadow-black/30 border border-border">
          <BookOpen className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Active Enrollment</h2>
          <p className="text-text-tertiary mb-2 text-sm">Logged in as: <span className="text-[#7b008b]">{parentEmail}</span></p>
          <p className="text-text-tertiary mb-6 text-sm">You don&apos;t have an active enrollment yet.</p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg transition-all min-h-[48px]"
          >
            Reading Test - Free
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    // CRITICAL: overflow-x-hidden prevents horizontal scroll
    <div className="min-h-screen bg-surface-0 overflow-x-hidden">
      {/* Main Content - No separate header, uses layout's navigation */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Overview Content - Navigation handled by BottomNav and Sidebar */}
        <OverviewTab
          childId={childId}
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
          parentCalls={parentCalls}
          parentCallQuota={parentCallQuota}
          latestPulse={latestPulse}
          learningProfile={learningProfile}
        />
      </main>

      {/* Floating rAI Chat Widget */}
      <ChatWidget
        userRole="parent"
        userEmail={parentEmail}
        childId={childId || undefined}
        childName={childName || undefined}
        contextualPrompts={learningProfile ? buildContextualPrompts(childName, learningProfile) : undefined}
      />
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
      className="bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-amber-500/20
                 border-2 border-yellow-400/40 rounded-2xl p-5
                 shadow-lg shadow-black/20 w-full"
      role="alert"
      aria-label="Skill Booster session recommended"
    >
      <div className="flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500
                          rounded-xl flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-orange-500/30">
            <Zap className="w-7 h-7 text-white" />
          </div>

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white leading-tight">
              Skill Booster Session
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Coach <span className="font-semibold text-[#7B008B]">{session.coach_name}</span> recommends
              extra practice for <span className="font-semibold text-white">{childName}</span>
            </p>
          </div>
        </div>

        {/* Focus Area Highlight */}
        <div className="bg-surface-1/70 rounded-xl p-4 border border-yellow-500/30">
          <p className="text-sm text-text-tertiary uppercase tracking-wide font-medium mb-1">Focus Area</p>
          <p className="text-lg font-bold text-[#FF0099]">{focusAreaLabel}</p>
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400
                         rounded-full text-sm font-semibold border border-green-500/30">
            <CheckCircle className="w-4 h-4" />
            FREE - Included
          </span>
          {daysSince > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-text-tertiary">
              <Clock className="w-4 h-4" />
              {daysSince}d ago
            </span>
          )}
        </div>

        {/* CTA Button - Full Width */}
        <Link
          href={`/parent/book-skill-booster/${session.id}`}
          className="flex items-center justify-center gap-2 w-full px-5 py-3
                   bg-gradient-to-r from-[#FF0099] to-[#7B008B]
                   text-white font-semibold rounded-xl hover:opacity-90
                   transition-all shadow-lg shadow-[#FF0099]/30
                   text-base min-h-[48px] active:scale-[0.98]"
        >
          <Calendar className="w-5 h-5" />
          <span>Book Time Slot</span>
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({
  childId,
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
  parentCalls,
  parentCallQuota,
  latestPulse,
  learningProfile,
}: {
  childId: string;
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
  parentCalls: any[];
  parentCallQuota: { used: number; max: number; remaining: number };
  latestPulse: any;
  learningProfile: LearningProfile | null;
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
    return enrollment?.coaches?.phone || DEFAULT_WHATSAPP;
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
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          Icon: Rocket,
        };
      case 'continuation':
        return {
          label: 'Continuation',
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          Icon: TrendingUp,
        };
      case 'full':
        return {
          label: 'Full Program',
          color: 'bg-green-500/20 text-green-400 border-green-500/30',
          Icon: Star,
        };
      default:
        return {
          label: 'Program',
          color: 'bg-surface-2 text-text-secondary border-border',
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
    <div className="space-y-6 w-full">
      {/* Welcome Banner with Enrollment Type Badge */}
      <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Welcome back!
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </h1>
            <p className="text-white/80 mt-1">Track {childName}&apos;s reading journey</p>
          </div>
          {enrollment?.enrollment_type && (
            <span className={`px-4 py-2 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 whitespace-nowrap ${enrollmentTypeInfo.color}`}>
              <enrollmentTypeInfo.Icon className="w-4 h-4 flex-shrink-0" />
              {enrollmentTypeInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* AI INSIGHT CARD — surfaces learning_profile intelligence */}
      {learningProfile && (
        <AIInsightCard learningProfile={learningProfile} childName={childName} />
      )}

      {/* SKILL PROGRESS CARD — visual skill breakdown */}
      {learningProfile && (
        <SkillProgressCard
          masteredSkills={learningProfile.mastered_skills || []}
          activeSkills={learningProfile.active_skills || []}
          struggleAreas={learningProfile.struggle_areas || []}
          childName={childName}
        />
      )}

      {/* STARTER COMPLETION CTA - Show when starter is completed */}
      {isStarterCompleted && (
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-amber-400" />
                Starter Pack Completed!
              </h3>
              <p className="text-text-secondary text-base mb-4">
                {childName} has made great progress! Continue the journey with 9 more sessions.
              </p>
              {daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0 && (
                <p className="text-amber-400 text-sm mb-3 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Special continuation pricing expires in {daysUntilDeadline} day{daysUntilDeadline !== 1 ? 's' : ''}
                </p>
              )}
              <Link
                href={`/enroll?product=continuation&childId=${enrollment?.id ? enrollment.id.split('-')[0] : ''}`}
                className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl font-semibold hover:shadow-lg transition-all text-base min-h-[48px]"
              >
                <Zap className="w-5 h-5" />
                Continue Your Journey
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PENDING SKILL BOOSTER CARD */}
      {pendingSkillBooster && (
        <PendingSkillBoosterCard session={pendingSkillBooster} childName={childName} />
      )}

      {/* PARENT CALL CARD */}
      {enrollment && enrollment.status === 'active' && (
        <ParentCallCard
          enrollmentId={enrollment.id}
          coachName={enrollment.coaches?.name || 'Your Coach'}
          calls={parentCalls}
          quota={parentCallQuota}
          onRefresh={onRefresh}
        />
      )}

      {/* PROGRESS PULSE CARD */}
      {latestPulse && (
        <ProgressPulseCard pulse={latestPulse} childName={childName} />
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
      <div className="grid grid-cols-2 gap-4">
        {/* Progress Card */}
        <div className="bg-surface-1 rounded-2xl p-5 shadow-lg shadow-black/20 shadow-[#7b008b]/5 border border-[#7b008b]/20">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-[#FF0099]" />
          </div>
          <p className="text-2xl font-bold text-white">{getProgressPercentage()}%</p>
          <p className="text-sm text-text-tertiary mt-1">Progress</p>
          <div className="mt-3 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-surface-1 rounded-2xl p-5 shadow-lg shadow-black/20 shadow-[#7b008b]/5 border border-[#7b008b]/20">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">
            {completedSessions}/{enrollment?.sessions_purchased || totalSessions}
          </p>
          <p className="text-sm text-text-tertiary mt-1">Sessions</p>
        </div>

        {/* Score Card */}
        <div className="bg-surface-1 rounded-2xl p-5 shadow-lg shadow-black/20 shadow-[#7b008b]/5 border border-[#7b008b]/20">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{latestScore ?? '--'}/10</p>
          <p className="text-sm text-text-tertiary mt-1">Latest Score</p>
        </div>

        {/* Days Left Card */}
        <div className="bg-surface-1 rounded-2xl p-5 shadow-lg shadow-black/20 shadow-[#7b008b]/5 border border-[#7b008b]/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">{getDaysRemaining()}</p>
          <p className="text-sm text-text-tertiary mt-1">Days Left</p>
        </div>
      </div>

      {/* Group Classes Section */}
      <GroupClassesSection childId={childId} />

      {/* Sessions & Coach - Stack on mobile */}
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-surface-1 rounded-2xl border border-[#7b008b]/20 shadow-lg shadow-black/20 shadow-[#7b008b]/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-[#FF0099]" />
              Upcoming Sessions
            </h2>
            <Link
              href="/parent/sessions"
              className="text-sm text-[#FF0099] hover:text-[#CC007A] font-medium flex items-center gap-1 min-h-[44px] px-2 -mr-2"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="divide-y divide-white/[0.08]">
              {upcomingSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#FF0099]/20 to-[#7B008B]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-[#FF0099]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white text-base truncate">
                        {session.title || getSessionTypeLabel(session.session_type)}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {formatDate(session.scheduled_date)} • {formatTime(session.scheduled_time)}
                      </p>
                    </div>
                  </div>
                  {session.google_meet_link && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#CC007A] transition-all flex-shrink-0 min-h-[44px] flex items-center"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-text-tertiary/30 mx-auto mb-4" />
              <p className="text-text-secondary text-base">No upcoming sessions</p>
              <p className="text-sm text-text-tertiary mt-1">Sessions will appear here once scheduled</p>
            </div>
          )}
        </div>

        {/* Coach Card */}
        <div className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 shadow-lg shadow-black/20 shadow-[#7b008b]/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08]">
            <h2 className="font-semibold text-white flex items-center gap-2 text-base">
              <User className="w-5 h-5 text-[#FF0099]" />
              Your Coach
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-2xl text-white font-bold">
                  {getCoachName().charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-base truncate">{getCoachName()}</p>
                <p className="text-sm text-[#FF0099]">Reading Coach</p>
              </div>
            </div>
            {enrollment?.coaches?.bio && (
              <p className="text-sm text-text-tertiary mb-4 line-clamp-2">{enrollment.coaches.bio}</p>
            )}
            <a
              href={`https://wa.me/${getCoachPhone()}?text=Hi ${getCoachName()}, I'm ${childName}'s parent.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#1da851] transition-colors min-h-[48px] text-base"
            >
              <MessageCircle className="w-5 h-5" />
              Message on WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Child Timeline — unified learning journey */}
      <ChildTimeline childId={childId} childName={childName} />

      {/* Support Widget */}
      <SupportWidget
        userType="parent"
        userEmail={parentEmail}
        userName={parentName}
        childName={childName}
        variant="card"
      />

      {/* Referrals Card */}
      <div className="bg-surface-1 rounded-2xl border border-[#7b008b]/20 shadow-lg shadow-black/20 shadow-[#7b008b]/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2 text-base">
            <Gift className="w-5 h-5 text-[#FF0099]" />
            Refer Friends & Earn
          </h2>
        </div>
        <div className="p-5">
          <ReferralsTab
            parentEmail={parentEmail}
            parentName={parentName}
            childName={childName}
          />
        </div>
      </div>

      {/* rAI Tip — dynamic from learning profile or fallback */}
      <div className="bg-gradient-to-r from-[#7B008B] to-[#FF0099] rounded-2xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">rAI says</h3>
            <p className="text-white/90 text-base mt-1">
              {learningProfile?.what_works && learningProfile.what_works.length > 0
                ? `Tip: ${learningProfile.what_works[0]}. Keep it up!`
                : 'Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

