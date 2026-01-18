'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import SkillBoosterSection from '@/components/coach/SkillBoosterSection';
import {
  ArrowLeft,
  User,
  Calendar,
  MessageCircle,
  Phone,
  Mail,
  Bot,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  X,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  id: string;
  child_name: string;
  age: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  latest_assessment_score: number | null;
  subscription_status: string;
  program_start_date: string;
  program_end_date: string;
  lead_source: string;
}

interface Session {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  status: string;
  google_meet_link: string;
  notes?: string;
}

interface SessionNote {
  id: string;
  session_id: string;
  notes: string;
  highlights: string;
  areas_to_improve: string;
  homework_assigned: string;
  created_at: string;
}

interface Assessment {
  id: string;
  score: number;
  wpm: number;
  fluency: string;
  pronunciation: string;
  feedback: string;
  created_at: string;
}

interface Enrollment {
  id: string;
  coach_id: string;
  remedial_sessions_used: number;
  remedial_sessions_max: number;
  status: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  // AI Assistant State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Add Notes Modal
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [noteForm, setNoteForm] = useState({
    notes: '',
    highlights: '',
    areas_to_improve: '',
    homework_assigned: '',
  });
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);

      // Get student details
      const { data: studentData } = await supabase
        .from('children')
        .select('*')
        .eq('id', studentId)
        .eq('coach_id', coachData.id)
        .single();

      if (!studentData) {
        window.location.href = '/coach/students';
        return;
      }

      setStudent(studentData);

      // Get sessions
      const { data: sessionsData } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', studentId)
        .order('scheduled_date', { ascending: true });

      setSessions(sessionsData || []);

      // Get enrollment with Skill Booster data (DB columns still use 'remedial' naming)
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('id, coach_id, remedial_sessions_used, remedial_sessions_max, status')
        .eq('child_id', studentId)
        .eq('status', 'active')
        .single();

      setEnrollment(enrollmentData);

      // Get session notes
      const { data: notesData } = await supabase
        .from('session_notes')
        .select('*')
        .eq('child_id', studentId)
        .order('created_at', { ascending: false });

      setSessionNotes(notesData || []);

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

  const askAI = async () => {
    if (!aiQuestion.trim() || !student || !coach) return;

    setAiLoading(true);
    setAiResponse('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiQuestion,
          childId: student.id,
          userRole: 'coach',
          userEmail: coach.email,
          chatHistory: [],
        }),
      });

      const data = await response.json();
      setAiResponse(data.response || 'Sorry, I could not generate a response.');
    } catch (error) {
      setAiResponse('Error getting AI response. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveSessionNote = async () => {
    if (!selectedSession || !noteForm.notes.trim()) return;

    setSavingNote(true);
    try {
      const { error } = await supabase.from('session_notes').insert({
        session_id: selectedSession.id,
        coach_id: coach.id,
        child_id: studentId,
        notes: noteForm.notes,
        highlights: noteForm.highlights,
        areas_to_improve: noteForm.areas_to_improve,
        homework_assigned: noteForm.homework_assigned,
      });

      if (!error) {
        setShowNotesModal(false);
        setNoteForm({ notes: '', highlights: '', areas_to_improve: '', homework_assigned: '' });
        loadStudentData(); // Refresh data
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const openWhatsApp = (phone: string, message: string) => {
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">Completed</span>;
      case 'scheduled':
        return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Scheduled</span>;
      case 'cancelled':
        return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">Cancelled</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-xs">Pending</span>;
    }
  };

  // Quick AI prompts
  const quickPrompts = [
    "How is this student progressing?",
    "What should I focus on in the next session?",
    "Prepare talking points for parent update",
    "What are the main areas to improve?",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
      </div>
    );
  }

  if (!coach || !student) return null;

  return (
    <CoachLayout coach={coach}>
      <div className="space-y-6">
        {/* Back Button */}
        <Link
          href="/coach/students"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </Link>

        {/* Student Header */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-[#FF0099] rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {student.child_name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{student.child_name}</h1>
                <p className="text-gray-400">Age {student.age}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-lg font-semibold ${getScoreColor(student.latest_assessment_score)}`}>
                    {student.latest_assessment_score ?? '-'}/10
                  </span>
                  {student.lead_source === 'coach' && (
                    <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">
                      Your Lead (70% split)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Parent Contact */}
            <div className="bg-gray-700/50 rounded-xl p-4 lg:min-w-[280px]">
              <p className="text-gray-400 text-sm mb-2">Parent Contact</p>
              <p className="text-white font-medium">{student.parent_name}</p>
              <div className="flex items-center gap-4 mt-3">
                <button
                  onClick={() => openWhatsApp(student.parent_phone, `Hi! This is ${coach.name} from Yestoryd regarding ${student.child_name}'s reading sessions.`)}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                <a
                  href={`tel:${student.parent_phone}`}
                  className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-500 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sessions */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Sessions ({sessions.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-[400px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No sessions scheduled</div>
              ) : (
                sessions.map((session, index) => {
                  const hasNote = sessionNotes.find((n) => n.session_id === session.id);
                  return (
                    <div key={session.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">Session {index + 1}</span>
                            {getStatusBadge(session.status)}
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">{session.session_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.status === 'completed' && !hasNote && (
                            <button
                              onClick={() => {
                                setSelectedSession(session);
                                setShowNotesModal(true);
                              }}
                              className="flex items-center gap-1 text-pink-400 text-sm hover:text-pink-300"
                            >
                              <Plus className="w-4 h-4" />
                              Add Notes
                            </button>
                          )}
                          {hasNote && (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Notes Added
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Assessment History */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Assessment History
              </h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-[400px] overflow-y-auto">
              {assessments.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No assessments yet</div>
              ) : (
                assessments.map((assessment) => (
                  <div key={assessment.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl font-bold ${getScoreColor(assessment.score)}`}>
                        {assessment.score}/10
                      </span>
                      <span className="text-gray-500 text-sm">
                        {formatDate(assessment.created_at)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>{assessment.wpm} WPM</span>
                      <span>Fluency: {assessment.fluency}</span>
                    </div>
                    {assessment.feedback && (
                      <p className="text-gray-400 text-sm mt-2 line-clamp-2">{assessment.feedback}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SKILL BOOSTER SECTION */}
        {/* ================================================================ */}
        {enrollment && (
          <SkillBoosterSection
            childId={student.id}
            childName={student.child_name}
            enrollmentId={enrollment.id}
            coachId={coach.id}
            skillBoosterUsed={enrollment.remedial_sessions_used || 0}
            skillBoosterMax={enrollment.remedial_sessions_max || 3}
            onSuccess={loadStudentData}
          />
        )}

        {/* AI Assistant */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              AI Assistant
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded ml-2">
                RAG Powered
              </span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Ask anything about {student.child_name}'s progress, get session prep, or parent talking points.
            </p>
          </div>

          <div className="p-4">
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setAiQuestion(prompt)}
                  className="text-sm bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-600 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAI()}
                placeholder={`Ask about ${student.child_name}...`}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={askAI}
                disabled={aiLoading || !aiQuestion.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>

            {/* AI Response */}
            {aiResponse && (
              <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-gray-200 whitespace-pre-wrap">{aiResponse}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session Notes History */}
        {sessionNotes.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-400" />
                Session Notes
              </h2>
            </div>
            <div className="divide-y divide-gray-700">
              {sessionNotes.map((note) => (
                <div key={note.id} className="p-4">
                  <p className="text-gray-500 text-sm mb-2">{formatDate(note.created_at)}</p>
                  <p className="text-white">{note.notes}</p>
                  {note.highlights && (
                    <p className="text-green-400 text-sm mt-2">
                      <strong>Highlights:</strong> {note.highlights}
                    </p>
                  )}
                  {note.areas_to_improve && (
                    <p className="text-orange-400 text-sm mt-1">
                      <strong>To Improve:</strong> {note.areas_to_improve}
                    </p>
                  )}
                  {note.homework_assigned && (
                    <p className="text-blue-400 text-sm mt-1">
                      <strong>Homework:</strong> {note.homework_assigned}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Notes Modal */}
      {showNotesModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Add Session Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Session Notes *
                </label>
                <textarea
                  value={noteForm.notes}
                  onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF0099]"
                  placeholder="What happened in this session?"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Highlights</label>
                <input
                  type="text"
                  value={noteForm.highlights}
                  onChange={(e) => setNoteForm({ ...noteForm, highlights: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF0099]"
                  placeholder="What went well?"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Areas to Improve</label>
                <input
                  type="text"
                  value={noteForm.areas_to_improve}
                  onChange={(e) => setNoteForm({ ...noteForm, areas_to_improve: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF0099]"
                  placeholder="What needs work?"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Homework Assigned</label>
                <input
                  type="text"
                  value={noteForm.homework_assigned}
                  onChange={(e) => setNoteForm({ ...noteForm, homework_assigned: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF0099]"
                  placeholder="Any homework for the student?"
                />
              </div>
              <button
                onClick={saveSessionNote}
                disabled={savingNote || !noteForm.notes.trim()}
                className="w-full bg-[#FF0099] hover:bg-[#FF0099]/90 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingNote ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </CoachLayout>
  );
}