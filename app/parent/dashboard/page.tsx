'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  Calendar,
  Clock,
  Video,
  TrendingUp,
  User,
  MessageCircle,
  ChevronRight,
  Sparkles,
  BookOpen,
  Target,
} from 'lucide-react';

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
    name: string;
    email: string;
    bio: string;
    phone: string;
  };
}

export default function ParentDashboardPage() {
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(9);
  const [latestScore, setLatestScore] = useState<number | null>(null);
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

      setParentEmail(user.email || '');

      // Find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id, email, name')
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
        console.log('No enrolled child found');
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
          coaches (
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
        .limit(3);

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

  function getCoachPhone(): string {
    return enrollment?.coaches?.phone || '918976287997';
  }

  function getCoachName(): string {
    return enrollment?.coaches?.name || 'Rucha';
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
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <BookOpen className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Enrollment</h2>
          <p className="text-gray-500 mb-2">Logged in as: <span className="text-[#7b008b]">{parentEmail}</span></p>
          <p className="text-gray-500 mb-6">You don't have an active enrollment yet.</p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all shadow-lg"
          >
            Take Free Assessment
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Welcome back! 👋</h1>
          <p className="text-gray-500 mt-1">Track {childName}'s reading journey</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#7b008b]/10 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-[#7b008b]" />
              </div>
              <span className="text-sm text-gray-500">Progress</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{getProgressPercentage()}%</p>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Sessions</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{completedSessions}/{totalSessions}</p>
            <p className="text-sm text-gray-400 mt-1">Completed</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Score</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{latestScore ?? '--'}/10</p>
            <p className="text-sm text-gray-400 mt-1">Latest</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#ff0099]/10 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#ff0099]" />
              </div>
              <span className="text-sm text-gray-500">Days Left</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{getDaysRemaining()}</p>
            <p className="text-sm text-gray-400 mt-1">In program</p>
          </div>
        </div>

        {/* Sessions & Coach */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Sessions */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#7b008b]" />
                Upcoming Sessions
              </h2>
              <Link href="/parent/sessions" className="text-sm text-[#7b008b] hover:text-[#6a0078] font-medium flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((session) => (
                  <div key={session.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#7b008b]/10 to-[#ff0099]/10 rounded-xl flex items-center justify-center">
                        <Video className="w-6 h-6 text-[#7b008b]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
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
                        className="px-4 py-2 bg-[#7b008b] text-white rounded-lg text-sm font-medium hover:bg-[#6a0078] transition-all shadow-sm"
                      >
                        Join
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming sessions</p>
                  <p className="text-sm text-gray-400 mt-1">Sessions will appear here once scheduled</p>
                </div>
              )}
            </div>
          </div>

          {/* Coach Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Message on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* rAI Tip */}
        <div className="mt-6 bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <Image
              src="/images/rai-mascot.png"
              alt="rAI AI"
              width={48}
              height={48}
              className="w-12 h-12 rounded-xl bg-white/20 p-1"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">rAI says</h3>
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-white/90">
                Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration! 📚
              </p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}