'use client';
import { ChatWidget } from '@/components/chat';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
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

interface Child {
  id: string;
  child_name: string;
  name: string;
  age: number;
  parent_email: string;
  parent_id: string;
  sessions_completed: number;
  total_sessions: number;
  latest_assessment_score: number;
  program_start_date: string;
  program_end_date: string;
  lead_status: string;
  coaches: {
    name: string;
    email: string;
    bio: string;
    phone: string;
  };
}

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
  const [child, setChild] = useState<Child | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(9);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
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

      setUserEmail(user.email || '');

      // First, find parent by email
      const { data: parentData } = await supabase
        .from('parents')
        .select('id, email, name')
        .eq('email', user.email)
        .maybeSingle();

      if (!parentData) {
        console.log('No parent found for email:', user.email);
        setLoading(false);
        return;
      }

      // Find enrolled child for this parent (using parent_id, not parent_email)
      const { data: childData } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', parentData.id)
        .eq('lead_status', 'enrolled')
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!childData) {
        // Also try by parent_email as fallback
        const { data: childByEmail } = await supabase
          .from('children')
          .select('*')
          .eq('parent_email', user.email)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!childByEmail) {
          console.log('No enrolled child found');
          setLoading(false);
          return;
        }
        
        setChild(childByEmail);
        await fetchEnrollmentAndSessions(childByEmail.id);
      } else {
        setChild(childData);
        await fetchEnrollmentAndSessions(childData.id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

  async function fetchEnrollmentAndSessions(childId: string) {
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
      .eq('child_id', childId)
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
      .eq('child_id', childId)
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
      .eq('child_id', childId)
      .eq('status', 'completed');

    setCompletedSessions(completed || 0);

    // Count total sessions
    const { count: total } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId);

    setTotalSessions(total || 9);
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
    const endDate = enrollment?.program_end || child?.program_end_date;
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
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  if (!child) {
    return (
      <ParentLayout>
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Enrollment</h2>
          <p className="text-gray-500 mb-2">Logged in as: {userEmail}</p>
          <p className="text-gray-500 mb-6">You don't have an active enrollment yet.</p>
          <a
            href="https://yestoryd.com/assessment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
          >
            Take Free Assessment
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </ParentLayout>
    );
  }

  const childName = child.name || child.child_name || 'Your Child';

  return (
    <ParentLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Welcome back! 👋</h1>
          <p className="text-gray-500 mt-1">Track {childName}'s reading journey</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm text-gray-500">Progress</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{getProgressPercentage()}%</p>
            <div className="mt-2 h-2 bg-amber-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Sessions</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{completedSessions}/{totalSessions}</p>
            <p className="text-sm text-gray-400 mt-1">Completed</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Score</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{child.latest_assessment_score || '--'}/10</p>
            <p className="text-sm text-gray-400 mt-1">Latest</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">Days Left</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{getDaysRemaining()}</p>
            <p className="text-sm text-gray-400 mt-1">In program</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="p-5 border-b border-amber-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Upcoming Sessions
              </h2>
              <a href="/parent/sessions" className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </a>
            </div>
            <div className="divide-y divide-amber-50">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((session) => (
                  <div key={session.id} className="p-5 flex items-center justify-between hover:bg-amber-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
                        <Video className="w-6 h-6 text-amber-600" />
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
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                      >
                        Join
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-amber-200 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming sessions</p>
                  <p className="text-sm text-gray-400 mt-1">Sessions will appear here once scheduled</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="p-5 border-b border-amber-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" />
                Your Coach
              </h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl text-white font-bold">
                    {getCoachName().charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{getCoachName()}</p>
                  <p className="text-sm text-amber-600">Reading Coach</p>
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

        <div className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Reading Tip of the Day</h3>
              <p className="text-white/90">
                Set aside 15-20 minutes of quiet reading time daily. Consistency matters more than duration!
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Chat Widget */}
      <ChatWidget
        childId={child.id}
        childName={childName}
        userRole="parent"
        userEmail={userEmail}
      />
    </ParentLayout>
  );
}