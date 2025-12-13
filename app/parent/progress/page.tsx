'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  TrendingUp,
  Star,
  BookOpen,
  Target,
  Award,
  FileText,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface Child {
  id: string;
  child_name: string;
  name: string;
  age: number;
  sessions_completed: number;
  total_sessions: number;
  latest_assessment_score: number;
  program_start_date: string;
  program_end_date: string;
}

interface SessionNote {
  id: string;
  notes: string;
  created_at: string;
  scheduled_sessions: {
    session_number: number;
    session_type: string;
    scheduled_date: string;
  };
}

interface Assessment {
  id: string;
  score: number;
  created_at: string;
  feedback: string;
}

export default function ParentProgressPage() {
  const [child, setChild] = useState<Child | null>(null);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return;
    }

    // Get child
    const { data: childData } = await supabase
      .from('children')
      .select('*')
      .eq('parent_email', user.email)
      .eq('enrollment_status', 'active')
      .single();

    if (childData) {
      setChild(childData);

      // Get session notes
      const { data: notes } = await supabase
        .from('session_notes')
        .select('*, scheduled_sessions(session_number, session_type, scheduled_date)')
        .eq('child_id', childData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setSessionNotes(notes || []);

      // Get assessments
      const { data: assessmentsData } = await supabase
        .from('assessments')
        .select('*')
        .eq('child_id', childData.id)
        .order('created_at', { ascending: false });

      setAssessments(assessmentsData || []);
    }

    setLoading(false);
  }

  function getProgressPercentage(): number {
    if (!child) return 0;
    return Math.round((child.sessions_completed / child.total_sessions) * 100);
  }

  function getScoreColor(score: number): string {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-amber-600';
    return 'text-red-600';
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
          <h2 className="text-xl font-semibold text-gray-800">No Active Enrollment</h2>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Progress Report</h1>
          <p className="text-gray-500">{child.child_name || child.name}'s reading journey</p>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            Program Progress
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Overall Progress */}
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#fef3c7"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#gradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${getProgressPercentage() * 3.52} 352`}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-800">{getProgressPercentage()}%</span>
                </div>
              </div>
              <p className="text-gray-500">Overall Progress</p>
            </div>

            {/* Sessions */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-green-600">{child.sessions_completed}</span>
                <span className="text-green-600/70">of {child.total_sessions}</span>
              </div>
              <p className="text-gray-500">Sessions Completed</p>
            </div>

            {/* Latest Score */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreColor(child.latest_assessment_score || 0)}`}>
                  {child.latest_assessment_score || '--'}
                </span>
                <span className="text-blue-600/70">out of 10</span>
              </div>
              <p className="text-gray-500">Latest Score</p>
            </div>
          </div>
        </div>

        {/* Assessment History */}
        {assessments.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-amber-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Assessment History
              </h2>
            </div>
            <div className="divide-y divide-amber-50">
              {assessments.map((assessment) => (
                <div key={assessment.id} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Award className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Reading Assessment</p>
                      <p className="text-sm text-gray-500">{formatDate(assessment.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getScoreColor(assessment.score)}`}>
                      {assessment.score}/10
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.ceil(assessment.score / 2) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Notes */}
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-amber-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Coach Notes
            </h2>
          </div>
          {sessionNotes.length > 0 ? (
            <div className="divide-y divide-amber-50">
              {sessionNotes.map((note) => (
                <div key={note.id} className="p-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Session {note.scheduled_sessions?.session_number} • {formatDate(note.created_at)}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                      {note.scheduled_sessions?.session_type === 'coaching' ? 'Coaching' : 'Check-in'}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{note.notes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-amber-200 mx-auto mb-3" />
              <p className="text-gray-500">No coach notes yet</p>
              <p className="text-sm text-gray-400 mt-1">Notes will appear here after sessions</p>
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Milestones
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl ${child.sessions_completed >= 1 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{child.sessions_completed >= 1 ? '🏆' : '🔒'}</div>
              <p className="font-medium">First Session</p>
              <p className="text-sm text-white/70">Complete 1 session</p>
            </div>
            <div className={`p-4 rounded-xl ${child.sessions_completed >= 5 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{child.sessions_completed >= 5 ? '⭐' : '🔒'}</div>
              <p className="font-medium">Halfway There</p>
              <p className="text-sm text-white/70">Complete 5 sessions</p>
            </div>
            <div className={`p-4 rounded-xl ${child.sessions_completed >= 9 ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-2xl mb-1">{child.sessions_completed >= 9 ? '🎓' : '🔒'}</div>
              <p className="font-medium">Graduate</p>
              <p className="text-sm text-white/70">Complete all 9 sessions</p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
