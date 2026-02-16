'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParentLayout from '@/components/parent/ParentLayout';
import { supabase } from '@/lib/supabase/client';
import {
  TrendingUp,
  Star,
  BookOpen,
  Target,
  Award,
  Calendar,
  CheckCircle,
  Lock,
  GraduationCap,
  Trophy,
  Check,
  Flame,
} from 'lucide-react';

interface Enrollment {
  id: string;
  status: string;
  program_start: string;
  program_end: string;
}

interface LearningEvent {
  id: string;
  event_type: string;
  event_data: any;
  created_at: string;
}

export default function ParentProgressPage() {
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [totalSessions, setTotalSessions] = useState(9);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/parent/login');
        return;
      }

      // Find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id')
        .eq('email', user.email!)
        .maybeSingle();

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

      // Fetch enrollment
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('child_id', enrolledChild.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollmentData) {
        setEnrollment(enrollmentData);
      }

      // Count completed sessions
      const { count: completed } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id)
        .eq('status', 'completed');

      setSessionsCompleted(completed || 0);

      // Count total sessions
      const { count: total } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', enrolledChild.id);

      setTotalSessions(total || 9);

      // Fetch learning events (assessments, achievements, etc.)
      const { data: events } = await supabase
        .from('learning_events')
        .select('*')
        .eq('child_id', enrolledChild.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setLearningEvents(events || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching progress:', error);
      setLoading(false);
    }
  }

  function getProgressPercentage(): number {
    if (totalSessions === 0) return 0;
    return Math.round((sessionsCompleted / totalSessions) * 100);
  }

  function getScoreColor(score: number): string {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-[#FF0099]';
    return 'text-orange-400';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  if (loading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#FF0099] border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  if (!childId) {
    return (
      <ParentLayout>
        <div className="text-center py-12 bg-surface-1 rounded-2xl border border-border">
          <BookOpen className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Active Enrollment</h2>
          <p className="text-text-tertiary mb-6">Enroll your child to start tracking progress.</p>
          <Link
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-xl font-semibold hover:bg-[#FF0099]/80 transition-all"
          >
            Reading Test - Free
          </Link>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Progress Report</h1>
          <p className="text-text-tertiary">{childName}'s reading journey</p>
        </div>

        {/* Session Progress Track */}
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-white mb-5 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#FF0099]" />
            Session Progress
          </h2>

          {/* Visual Progress Track */}
          <div className="relative mb-6">
            {/* Track Line */}
            <div className="h-2 bg-surface-3 rounded-full">
              <div
                className="h-2 bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full transition-all duration-500"
                style={{ width: `${(sessionsCompleted / totalSessions) * 100}%` }}
              />
            </div>

            {/* Milestone Dots */}
            <div className="flex justify-between mt-3">
              {Array.from({ length: totalSessions }, (_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < sessionsCompleted
                      ? 'bg-[#FF0099] text-white shadow-sm'
                      : i === sessionsCompleted
                        ? 'bg-[#FF0099]/20 text-[#FF0099] border-2 border-[#FF0099]'
                        : 'bg-surface-3 text-text-muted'
                  }`}>
                    {i < sessionsCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-base text-text-secondary">
            <span className="font-bold text-[#FF0099]">{sessionsCompleted}</span> of <span className="font-bold text-white">{totalSessions}</span> sessions completed
          </p>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Progress % */}
          <div className="bg-surface-1 rounded-xl border border-border shadow-sm p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-[#FF0099]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#FF0099]" />
            </div>
            <p className="text-2xl font-bold text-white">{getProgressPercentage()}%</p>
            <p className="text-sm text-text-tertiary">Progress</p>
          </div>

          {/* Sessions */}
          <div className="bg-surface-1 rounded-xl border border-border shadow-sm p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">{sessionsCompleted}/{totalSessions}</p>
            <p className="text-sm text-text-tertiary">Sessions</p>
          </div>

          {/* Latest Score */}
          <div className="bg-surface-1 rounded-xl border border-border shadow-sm p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-blue-400" />
            </div>
            <p className={`text-2xl font-bold ${latestScore ? getScoreColor(latestScore) : 'text-text-muted'}`}>
              {latestScore ?? '--'}/10
            </p>
            <p className="text-sm text-text-tertiary">Score</p>
          </div>
        </div>

        {/* Timeline */}
        {learningEvents.length > 0 && (
          <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FF0099]" />
                Learning Timeline
              </h2>
            </div>
            <div className="divide-y divide-border">
              {learningEvents.map((event) => (
                <div key={event.id} className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#FF0099]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {event.event_type === 'assessment' ? (
                      <Award className="w-5 h-5 text-[#FF0099]" />
                    ) : event.event_type === 'session_completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Star className="w-5 h-5 text-yellow-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {event.event_type === 'assessment' ? 'Reading Assessment' :
                       event.event_type === 'session_completed' ? 'Session Completed' :
                       'Achievement Unlocked'}
                    </p>
                    <p className="text-sm text-text-tertiary">{formatDate(event.created_at)}</p>
                    {event.event_data?.score && (
                      <p className={`text-lg font-bold mt-1 ${getScoreColor(event.event_data.score)}`}>
                        Score: {event.event_data.score}/10
                      </p>
                    )}
                    {event.event_data?.feedback && (
                      <p className="text-sm text-text-secondary mt-1">{event.event_data.feedback}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for timeline */}
        {learningEvents.length === 0 && (
          <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FF0099]" />
                Learning Timeline
              </h2>
            </div>
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-tertiary">No learning events yet</p>
              <p className="text-sm text-text-muted mt-1">Events will appear here as your child progresses</p>
            </div>
          </div>
        )}

        {/* Achievement Badges - Horizontal Scroll */}
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FF0099]" />
            Achievements
          </h3>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {/* First Session Badge */}
            <div className={`flex-shrink-0 w-24 p-3 rounded-xl text-center ${
              sessionsCompleted >= 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-2 text-text-muted'
            }`}>
              <div className="flex justify-center mb-2">
                {sessionsCompleted >= 1 ? <Trophy className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </div>
              <p className="text-xs font-semibold">First Step</p>
              {sessionsCompleted >= 1 && <p className="text-[10px] mt-0.5 opacity-70">Unlocked!</p>}
            </div>

            {/* 3 in a Row Badge */}
            <div className={`flex-shrink-0 w-24 p-3 rounded-xl text-center ${
              sessionsCompleted >= 3 ? 'bg-orange-500/20 text-orange-400' : 'bg-surface-2 text-text-muted'
            }`}>
              <div className="flex justify-center mb-2">
                {sessionsCompleted >= 3 ? <Flame className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </div>
              <p className="text-xs font-semibold">On Fire!</p>
              {sessionsCompleted >= 3 && <p className="text-[10px] mt-0.5 opacity-70">3 sessions</p>}
            </div>

            {/* Halfway Badge */}
            <div className={`flex-shrink-0 w-24 p-3 rounded-xl text-center ${
              sessionsCompleted >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-surface-2 text-text-muted'
            }`}>
              <div className="flex justify-center mb-2">
                {sessionsCompleted >= 5 ? <Star className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </div>
              <p className="text-xs font-semibold">Halfway!</p>
              {sessionsCompleted >= 5 && <p className="text-[10px] mt-0.5 opacity-70">5 sessions</p>}
            </div>

            {/* Graduate Badge */}
            <div className={`flex-shrink-0 w-24 p-3 rounded-xl text-center ${
              sessionsCompleted >= totalSessions ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-2 text-text-muted'
            }`}>
              <div className="flex justify-center mb-2">
                {sessionsCompleted >= totalSessions ? <GraduationCap className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </div>
              <p className="text-xs font-semibold">Graduate</p>
              {sessionsCompleted >= totalSessions && <p className="text-[10px] mt-0.5 opacity-70">Complete!</p>}
            </div>
          </div>
        </div>

        {/* Motivational Banner */}
        <div className="bg-gradient-to-r from-[#7B008B] to-[#FF0099] rounded-2xl p-5 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              {sessionsCompleted < totalSessions ? (
                <Target className="w-6 h-6" />
              ) : (
                <Trophy className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {sessionsCompleted < totalSessions
                  ? `${totalSessions - sessionsCompleted} sessions to go!`
                  : 'Congratulations! Program Complete!'
                }
              </h3>
              <p className="text-white/80 text-sm">
                {sessionsCompleted < totalSessions
                  ? 'Keep up the great work. Consistency is key!'
                  : 'You\'ve completed all sessions. Amazing progress!'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
