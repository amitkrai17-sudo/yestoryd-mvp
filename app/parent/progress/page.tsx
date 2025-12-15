'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  TrendingUp,
  Star,
  BookOpen,
  Target,
  Award,
  Calendar,
  CheckCircle,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
        .eq('email', user.email)
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
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-[#7b008b]';
    return 'text-orange-600';
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
          <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  if (!childId) {
    return (
      <ParentLayout>
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Enrollment</h2>
          <p className="text-gray-500 mb-6">Enroll your child to start tracking progress.</p>
          <Link
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all"
          >
            Take Free Assessment
          </Link>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Progress Report</h1>
          <p className="text-gray-500">{childName}'s reading journey</p>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#7b008b]" />
            Program Progress
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Circular Progress */}
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#f3f4f6" strokeWidth="12" fill="none" />
                  <circle
                    cx="64" cy="64" r="56"
                    stroke="url(#progressGradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${getProgressPercentage() * 3.52} 352`}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff0099" />
                      <stop offset="100%" stopColor="#7b008b" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-800">{getProgressPercentage()}%</span>
                </div>
              </div>
              <p className="text-gray-500">Overall Progress</p>
            </div>

            {/* Sessions Completed */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-3 bg-green-50 border border-green-100 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-green-600">{sessionsCompleted}</span>
                <span className="text-green-600/70">of {totalSessions}</span>
              </div>
              <p className="text-gray-500">Sessions Completed</p>
            </div>

            {/* Latest Score */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-3 bg-[#7b008b]/5 border border-[#7b008b]/10 rounded-2xl flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${latestScore ? getScoreColor(latestScore) : 'text-gray-400'}`}>
                  {latestScore ?? '--'}
                </span>
                <span className="text-[#7b008b]/70">out of 10</span>
              </div>
              <p className="text-gray-500">Latest Score</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {learningEvents.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#7b008b]" />
                Learning Timeline
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {learningEvents.map((event) => (
                <div key={event.id} className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#7b008b]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {event.event_type === 'assessment' ? (
                      <Award className="w-5 h-5 text-[#7b008b]" />
                    ) : event.event_type === 'session_completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Star className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {event.event_type === 'assessment' ? 'Reading Assessment' :
                       event.event_type === 'session_completed' ? 'Session Completed' :
                       'Achievement Unlocked'}
                    </p>
                    <p className="text-sm text-gray-500">{formatDate(event.created_at)}</p>
                    {event.event_data?.score && (
                      <p className={`text-lg font-bold mt-1 ${getScoreColor(event.event_data.score)}`}>
                        Score: {event.event_data.score}/10
                      </p>
                    )}
                    {event.event_data?.feedback && (
                      <p className="text-sm text-gray-600 mt-1">{event.event_data.feedback}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for timeline */}
        {learningEvents.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#7b008b]" />
                Learning Timeline
              </h2>
            </div>
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No learning events yet</p>
              <p className="text-sm text-gray-400 mt-1">Events will appear here as your child progresses</p>
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-2xl p-6 text-white">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Milestones
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl ${sessionsCompleted >= 1 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{sessionsCompleted >= 1 ? '🏆' : '🔒'}</div>
              <p className="font-medium">First Session</p>
              <p className="text-sm text-white/70">Complete 1 session</p>
            </div>
            <div className={`p-4 rounded-xl ${sessionsCompleted >= 5 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{sessionsCompleted >= 5 ? '⭐' : '🔒'}</div>
              <p className="font-medium">Halfway There</p>
              <p className="text-sm text-white/70">Complete 5 sessions</p>
            </div>
            <div className={`p-4 rounded-xl ${sessionsCompleted >= 9 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{sessionsCompleted >= 9 ? '🎓' : '🔒'}</div>
              <p className="font-medium">Graduate</p>
              <p className="text-sm text-white/70">Complete all 9 sessions</p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}