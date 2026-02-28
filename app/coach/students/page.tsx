// app/coach/students/page.tsx
// Coach Students Page - Mobile-First Compact Design
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Loader2,
  UserCheck,
  Clock,
  Award,
} from 'lucide-react';
import CoachLayout from '@/components/layouts/CoachLayout';
import StudentCard from '@/components/coach/StudentCard';
import { supabase } from '@/lib/supabase/client';

interface Student {
  id: string;
  child_name: string;
  age: number;
  age_band: string | null;
  assessment_score: number | null;
  sessions_completed: number;
  total_sessions: number;
  status: string;
  is_coach_lead: boolean;
  trend?: string;
  focus_area?: string;
}

export default function CoachStudentsPage() {
  const router = useRouter();
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
        router.push('/coach/login');
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email!)
        .single();

      if (!coachData) {
        router.push('/coach/login');
        return;
      }

      setCoach(coachData);

      // Get all students through ENROLLMENTS (single source of truth)
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          sessions_scheduled,
          total_sessions,
          age_band,
          lead_source,
          child:children (
            id,
            child_name,
            age,
            latest_assessment_score,
            learning_profile
          )
        `)
        .eq('coach_id', coachData.id)
        .in('status', ['active', 'pending_start', 'completed'])
        .order('created_at', { ascending: false });

      // Get session counts for each enrollment
      const studentsWithSessions = await Promise.all(
        (enrollmentsData || []).map(async (enrollment) => {
          const child = enrollment.child as any;
          if (!child) return null;

          const { count } = await supabase
            .from('scheduled_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('enrollment_id', enrollment.id)
            .eq('status', 'completed');

          const profile = (child as any).learning_profile;
          return {
            id: child.id,
            child_name: child.child_name,
            age: child.age,
            age_band: (enrollment as any).age_band || null,
            assessment_score: child.latest_assessment_score,
            sessions_completed: count || 0,
            total_sessions: enrollment.total_sessions || enrollment.sessions_scheduled || 9, // V1 fallback – enrollment.total_sessions is authoritative
            status: enrollment.status === 'pending_start' ? 'active' : enrollment.status,
            is_coach_lead: enrollment.lead_source === 'coach',
            trend: profile?.reading_level?.trend || null,
            focus_area: profile?.recommended_focus_next_session || null,
          };
        })
      );

      setStudents(studentsWithSessions.filter(Boolean) as Student[]);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats computation
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    completed: students.filter(s => s.status === 'completed').length,
    leads: students.filter(s => s.is_coach_lead).length,
  }), [students]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = !searchTerm ||
        student.child_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'active' && student.status === 'active') ||
        (filterStatus === 'completed' && student.status === 'completed') ||
        (filterStatus === 'leads' && student.is_coach_lead);

      return matchesSearch && matchesFilter;
    });
  }, [students, searchTerm, filterStatus]);

  if (loading) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF]" />
        </div>
      </CoachLayout>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout>
      <div className="px-3 py-4 lg:px-6 lg:py-6 max-w-4xl mx-auto">
        {/* Header - Compact */}
        <div className="mb-4">
          <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00ABFF]" />
            My Students
          </h1>
          <p className="text-xs lg:text-sm text-text-tertiary">Manage your enrolled students</p>
        </div>

        {/* Stats Row - Compact Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: Users, value: stats.total, label: 'Total', color: 'text-white', bg: 'bg-surface-2' },
            { icon: UserCheck, value: stats.active, label: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' },
            { icon: Clock, value: stats.completed, label: 'Done', color: 'text-blue-400', bg: 'bg-blue-500/20' },
            { icon: Award, value: stats.leads, label: '70%', color: 'text-[#00ABFF]', bg: 'bg-[#00ABFF]/20' },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-1 rounded-lg p-2 lg:p-3 text-center border border-border">
              <div className={`w-6 h-6 lg:w-8 lg:h-8 ${stat.bg} rounded-md flex items-center justify-center mx-auto mb-1`}>
                <stat.icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${stat.color}`} />
              </div>
              <div className={`text-base lg:text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[9px] lg:text-[10px] text-text-tertiary">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filter - Single Row */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-10 pl-9 pr-3 bg-surface-1 border border-border rounded-lg text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-[#00ABFF]"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 bg-surface-1 border border-border rounded-lg text-sm text-white focus:outline-none focus:border-[#00ABFF] appearance-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Done</option>
            <option value="leads">70%</option>
          </select>
        </div>

        {/* Student Cards */}
        <div className="space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No students found</p>
            </div>
          ) : (
            filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))
          )}
        </div>
      </div>
    </CoachLayout>
  );
}
