'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import {
  Users,
  Search,
  Filter,
  MessageCircle,
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
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
  sessions_completed: number;
  total_sessions: number;
  lead_source: string;
}

export default function CoachStudentsPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
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

      // Get all students assigned to this coach
      const { data: studentsData } = await supabase
        .from('children')
        .select('*')
        .eq('coach_id', coachData.id)
        .order('created_at', { ascending: false });

      // Get session counts for each student
      const studentsWithSessions = await Promise.all(
        (studentsData || []).map(async (student) => {
          const { count } = await supabase
            .from('scheduled_sessions')
            .select('*', { count: 'exact' })
            .eq('child_id', student.id)
            .eq('status', 'completed');

          return {
            ...student,
            sessions_completed: count || 0,
            total_sessions: 6,
          };
        })
      );

      setStudents(studentsWithSessions);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return 'No assessment';
    if (score >= 8) return 'Reading Wizard';
    if (score >= 5) return 'Reading Star';
    return 'Budding Reader';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">Active</span>;
      case 'completed':
        return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Completed</span>;
      case 'paused':
        return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs">Paused</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-xs">Pending</span>;
    }
  };

  const openWhatsApp = (phone: string, childName: string) => {
    const message = `Hi! This is regarding ${childName}'s reading coaching sessions.`;
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.child_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parent_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter =
      filterStatus === 'all' || student.subscription_status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout coach={coach}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-400" />
              My Students
            </h1>
            <p className="text-gray-400">{students.length} students enrolled</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-pink-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No students found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Student Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {student.child_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white">{student.child_name}</h3>
                          {getStatusBadge(student.subscription_status)}
                          {student.lead_source === 'coach' && (
                            <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">
                              Your Lead
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm">
                          Age {student.age} • Parent: {student.parent_name}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className={`text-sm ${getScoreColor(student.latest_assessment_score)}`}>
                            Score: {student.latest_assessment_score ?? '-'}/10
                            <span className="text-gray-500 ml-1">({getScoreLabel(student.latest_assessment_score)})</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Sessions: {student.sessions_completed}/{student.total_sessions}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openWhatsApp(student.parent_phone, student.child_name)}
                        className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                        title="WhatsApp Parent"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <Link
                        href={`/coach/students/${student.id}`}
                        className="flex items-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors"
                      >
                        View <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  );
}
