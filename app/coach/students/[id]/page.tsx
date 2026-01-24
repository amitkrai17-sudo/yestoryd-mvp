'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import CoachLayout from '@/components/layouts/CoachLayout';
import SkillBoosterSection from '@/components/coach/SkillBoosterSection';
import {
  Calendar,
  MessageCircle,
  Phone,
  Bot,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Home,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface Student {
  id: string;
  child_name: string;
  age: number;
  parent_name: string;
  parent_phone: string;
  latest_assessment_score: number | null;
  lead_source: string;
}

interface Session {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  status: string;
  session_number?: number;
}

interface SessionEventData {
  focus_area?: string;
  progress_rating?: string;
  engagement_level?: string;
  highlights?: string[];
  challenges?: string[];
  homework_assigned?: boolean;
  homework_items?: string[];
  next_session_focus?: string;
}

interface Assessment {
  id: string;
  score: number;
  wpm: number;
  fluency: string;
  created_at: string;
}

interface Enrollment {
  id: string;
  coach_id: string;
  remedial_sessions_used: number;
  remedial_sessions_max: number;
  status: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type TabType = 'sessions' | 'ai' | 'history';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  // Core state
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionDetailsMap, setSessionDetailsMap] = useState<Map<string, SessionEventData>>(new Map());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/coach/login');
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!coachData) {
        router.push('/coach/login');
        return;
      }

      setCoach(coachData);

      // Verify access through enrollments (single source of truth)
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          id, coach_id, remedial_sessions_used, remedial_sessions_max, status,
          child:children (*)
        `)
        .eq('child_id', studentId)
        .eq('coach_id', coachData.id)
        .in('status', ['active', 'pending_start', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!enrollmentData || !enrollmentData.child) {
        router.push('/coach/students');
        return;
      }

      setStudent(enrollmentData.child as any);
      setEnrollment(enrollmentData);

      // Get sessions
      const { data: sessionsData } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('enrollment_id', enrollmentData.id)
        .order('scheduled_date', { ascending: true });

      setSessions(sessionsData || []);

      // Fetch learning_events for session details
      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map(s => s.id);
        const { data: sessionEvents } = await supabase
          .from('learning_events')
          .select('session_id, event_data')
          .in('session_id', sessionIds)
          .eq('event_type', 'session');

        if (sessionEvents) {
          const detailsMap = new Map<string, SessionEventData>(
            sessionEvents.map(e => [e.session_id, e.event_data as SessionEventData])
          );
          setSessionDetailsMap(detailsMap);
        }
      }

      // Get assessments
      const { data: assessmentsData } = await supabase
        .from('assessments')
        .select('*')
        .eq('child_id', studentId)
        .order('created_at', { ascending: false });

      setAssessments(assessmentsData || []);

    } catch (error) {
      console.error('Error loading student:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !student || !coach || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          childId: studentId,
          userRole: 'coach',
          userEmail: coach.email,
          chatHistory: chatMessages.slice(-6),
        }),
      });

      const data = await response.json();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.'
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error getting response. Please try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    const url = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}`;
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const quickPrompts = ['Progress?', 'Next focus?', 'Parent update'];

  if (loading) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
        </div>
      </CoachLayout>
    );
  }

  if (!coach || !student) return null;

  return (
    <CoachLayout
      showMobileBack
      mobileBackHref="/coach/students"
      mobileTitle={student.child_name}
      maxWidth="7xl"
      noPadding
    >
      <div className="px-3 py-3 lg:px-6 lg:py-6 max-w-7xl mx-auto">

        {/* Profile Card - COMPACT */}
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-2.5 lg:p-4 mb-3 lg:mb-6">
          <div className="flex items-center gap-2.5 lg:gap-4">
            {/* Avatar */}
            <div className="w-11 h-11 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-[#FF0099] to-[#7B008B] flex items-center justify-center text-white text-base lg:text-xl font-bold flex-shrink-0">
              {student.child_name?.charAt(0) || 'S'}
            </div>

            {/* Info - compact */}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm lg:text-xl font-bold text-white truncate">
                {student.child_name}
              </h1>
              <p className="text-xs lg:text-sm text-gray-400">
                Age {student.age} • <span className={getScoreColor(student.latest_assessment_score)}>
                  {student.latest_assessment_score ?? '-'}/10
                </span>
                {student.lead_source === 'coach' && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">
                    70%
                  </span>
                )}
              </p>
            </div>

            {/* Contact - icon only on mobile */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => openWhatsApp(student.parent_phone)}
                className="w-9 h-9 lg:w-auto lg:px-3 lg:py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden lg:inline text-sm">WhatsApp</span>
              </button>
              <a
                href={`tel:${student.parent_phone}`}
                className="w-9 h-9 lg:w-auto lg:px-3 lg:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-1.5"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden lg:inline text-sm">Call</span>
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Tabs - Short text, no truncation */}
        <div className="lg:hidden flex mb-3 bg-gray-800/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'sessions' ? 'bg-[#FF0099] text-white' : 'text-gray-400'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Sessions
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'ai' ? 'bg-[#FF0099] text-white' : 'text-gray-400'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'history' ? 'bg-[#FF0099] text-white' : 'text-gray-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            History
          </button>
        </div>

        {/* Content Grid */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-6">

          {/* Left Column - AI & History */}
          <div className={`lg:col-span-2 space-y-3 lg:space-y-6 ${
            activeTab === 'sessions' ? 'hidden lg:block' : ''
          }`}>

            {/* AI Chat */}
            <section className={`bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden ${
              activeTab !== 'ai' ? 'hidden lg:block' : ''
            }`}>
              <div className="p-2.5 lg:p-3 border-b border-gray-800 flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#FF0099]" />
                <span className="text-xs lg:text-sm font-semibold text-white">AI Assistant</span>
                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">RAG</span>
              </div>

              {/* Quick Prompts */}
              <div className="p-2 border-b border-gray-800 flex flex-wrap gap-1">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => setChatInput(p)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] rounded-full"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Messages */}
              <div className="h-44 lg:h-56 overflow-y-auto p-2.5 space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-6">
                    <Bot className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-[10px]">Ask about {student.child_name}</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                        msg.role === 'user' ? 'bg-[#FF0099] text-white' : 'bg-gray-800 text-gray-200'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg px-2.5 py-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF0099]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-2 border-t border-gray-800 flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask..."
                  className="flex-1 px-2.5 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#FF0099]"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-2 bg-[#FF0099] disabled:opacity-50 text-white rounded-lg"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Assessment History */}
            <section className={`bg-[#1a1a1a] rounded-xl border border-gray-800 ${
              activeTab !== 'history' ? 'hidden lg:block' : ''
            }`}>
              <div className="p-2.5 lg:p-3 border-b border-gray-800">
                <h2 className="flex items-center gap-2 text-xs lg:text-sm font-semibold text-white">
                  <BookOpen className="w-4 h-4 text-green-400" />
                  Assessment History
                </h2>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {assessments.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <BookOpen className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-[10px]">No assessments yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {assessments.map((a) => (
                      <div key={a.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className={`text-base font-bold ${getScoreColor(a.score)}`}>{a.score}/10</span>
                          <span className="text-[10px] text-gray-400 ml-2">{a.wpm} WPM</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{formatDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column - Sessions */}
          <div className={`lg:col-span-3 space-y-3 lg:space-y-6 ${
            activeTab !== 'sessions' ? 'hidden lg:block' : ''
          }`}>

            {/* Sessions List */}
            <section className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-2.5 lg:p-3 border-b border-gray-800">
                <h2 className="flex items-center gap-2 text-xs lg:text-sm font-semibold text-white">
                  <Calendar className="w-4 h-4 text-[#00ABFF]" />
                  Sessions ({sessions.length})
                </h2>
              </div>

              {/* COMPACT Session Cards */}
              <div className="max-h-[350px] lg:max-h-[450px] overflow-y-auto divide-y divide-gray-800">
                {sessions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Calendar className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-[10px]">No sessions scheduled</p>
                  </div>
                ) : (
                  sessions.map((session, index) => {
                    const details = sessionDetailsMap.get(session.id);
                    const isExpanded = expandedSession === session.id;

                    return (
                      <div key={session.id} className="p-2 lg:p-3 hover:bg-gray-800/30">
                        {/* SINGLE ROW layout */}
                        <div className="flex items-center gap-2">
                          {/* Status icon */}
                          <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                            session.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            session.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {session.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>

                          {/* Session info - SINGLE LINE */}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5 lg:gap-2">
                            <span className="text-xs lg:text-sm font-medium text-white">
                              #{index + 1}
                            </span>
                            <span className="text-[10px] lg:text-xs text-gray-400 truncate">
                              {formatDate(session.scheduled_date)}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[9px] lg:text-[10px] rounded ${
                              session.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              session.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {session.status}
                            </span>
                          </div>

                          {/* Action button */}
                          {session.status === 'completed' && details && (
                            <button
                              onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                              className="p-1.5 text-[#00ABFF] hover:bg-[#00ABFF]/10 rounded flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && details && (
                          <div className="mt-2 p-2 lg:p-3 bg-gray-800/50 rounded-lg text-[10px] lg:text-xs space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Focus</span>
                              <span className="text-white capitalize">{details.focus_area?.replace(/_/g, ' ') || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Progress</span>
                              <span className={`capitalize ${
                                details.progress_rating?.includes('improve') || details.progress_rating === 'breakthrough'
                                  ? 'text-green-400' : 'text-gray-300'
                              }`}>
                                {details.progress_rating?.replace(/_/g, ' ') || '-'}
                              </span>
                            </div>

                            {details.highlights && details.highlights.length > 0 && (
                              <div className="pt-1 border-t border-gray-700">
                                <span className="text-gray-400">Highlights:</span>
                                {details.highlights.map((h: string, i: number) => (
                                  <div key={i} className="flex items-center gap-1 text-green-400 mt-0.5">
                                    <CheckCircle className="w-3 h-3 flex-shrink-0" />
                                    <span>{h}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {details.challenges && details.challenges.length > 0 && (
                              <div className="pt-1 border-t border-gray-700">
                                <span className="text-gray-400">Challenges:</span>
                                {details.challenges.map((c: string, i: number) => (
                                  <div key={i} className="flex items-center gap-1 text-orange-400 mt-0.5">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    <span>{c}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {details.homework_assigned && details.homework_items && details.homework_items.length > 0 && (
                              <div className="pt-1 border-t border-gray-700">
                                <span className="text-gray-400">Homework:</span>
                                {details.homework_items.map((hw: string, i: number) => (
                                  <div key={i} className="flex items-center gap-1 text-[#FFDE00] mt-0.5">
                                    <Home className="w-3 h-3 flex-shrink-0" />
                                    <span>{hw}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {details.next_session_focus && (
                              <div className="flex justify-between pt-1 border-t border-gray-700">
                                <span className="text-gray-400">Next</span>
                                <span className="text-[#FF0099]">{details.next_session_focus}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Skill Booster - COMPACT */}
            {enrollment && (
              <SkillBoosterSection
                childId={studentId}
                childName={student.child_name}
                enrollmentId={enrollment.id}
                coachId={coach.id}
                skillBoosterUsed={enrollment.remedial_sessions_used || 0}
                skillBoosterMax={enrollment.remedial_sessions_max || 3}
                onSuccess={loadStudentData}
              />
            )}
          </div>
        </div>
      </div>
    </CoachLayout>
  );
}
