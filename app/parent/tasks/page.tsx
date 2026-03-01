'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  CheckCircle, Circle, Clock, Flame, Trophy,
  Loader2, Star, BookOpen, Sparkles,
} from 'lucide-react';

// Skill labels for display
const SKILL_COLORS: Record<string, string> = {
  'Letter Sounds': 'bg-purple-50 text-purple-700 border-purple-200',
  'Sound Skills': 'bg-blue-50 text-blue-700 border-blue-200',
  'Word Reading': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Reading Speed': 'bg-amber-50 text-amber-700 border-amber-200',
  'Understanding Stories': 'bg-pink-50 text-pink-700 border-pink-200',
  'Language Skills': 'bg-teal-50 text-teal-700 border-teal-200',
  'Writing': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Sight Words': 'bg-orange-50 text-orange-700 border-orange-200',
  'Word Power': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Reading with Feeling': 'bg-rose-50 text-rose-700 border-rose-200',
  'Reading Stamina': 'bg-lime-50 text-lime-700 border-lime-200',
  'Reading': 'bg-violet-50 text-violet-700 border-violet-200',
};

interface Task {
  id: string;
  task_date: string;
  title: string;
  description: string;
  linked_skill: string;
  skill_label: string;
  duration_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  is_today: boolean;
  is_past: boolean;
}

function formatDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ParentTasksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [todayTask, setTodayTask] = useState<Task | null>(null);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ completed_this_week: 0, total_this_week: 0, current_streak: 0, longest_streak: 0 });
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchChildId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return null;
    }

    // Find parent
    const { data: parentData } = await supabase
      .from('parents')
      .select('id')
      .eq('email', user.email!)
      .maybeSingle();

    let child = null;

    if (parentData?.id) {
      // Check localStorage for selected child
      let storedChildId: string | null = null;
      try {
        storedChildId = localStorage.getItem(`yestoryd_selected_child_${parentData.id}`);
      } catch {}

      if (storedChildId) {
        const { data } = await supabase
          .from('children')
          .select('id, child_name, name')
          .eq('id', storedChildId)
          .eq('parent_id', parentData.id)
          .maybeSingle();
        if (data) child = data;
      }

      if (!child) {
        const { data } = await supabase
          .from('children')
          .select('id, child_name, name')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) child = data;
      }
    }

    // Fallback by email
    if (!child && user.email) {
      const { data } = await supabase
        .from('children')
        .select('id, child_name, name')
        .eq('parent_email', user.email)
        .eq('lead_status', 'enrolled')
        .limit(1)
        .maybeSingle();
      if (data) child = data;
    }

    return child;
  }, [router]);

  const fetchTasks = useCallback(async (cId: string) => {
    const res = await fetch(`/api/parent/tasks/${cId}`);
    const data = await res.json();
    if (data.success) {
      setChildName(data.child_name);
      setTodayTask(data.today_task);
      setWeekTasks(data.week_tasks || []);
      setStats(data.stats);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const child = await fetchChildId();
      if (child) {
        setChildId(child.id);
        setChildName(child.child_name || child.name || 'Your Child');
        await fetchTasks(child.id);
      }
      setLoading(false);
    };
    init();

    const handleChildChange = () => {
      setLoading(true);
      init();
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [fetchChildId, fetchTasks]);

  const handleComplete = async (taskId: string) => {
    if (!childId || completing) return;
    setCompleting(taskId);

    try {
      const res = await fetch(`/api/parent/tasks/${childId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          completed_this_week: prev.completed_this_week + 1,
          current_streak: data.streak.current,
          longest_streak: data.streak.longest,
        }));
        // Refresh tasks
        await fetchTasks(childId);
      }
    } catch (err) {
      console.error('Complete task error:', err);
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }

  if (!childId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No enrolled child found</p>
          <p className="text-gray-500 text-sm mt-1">Tasks will appear once enrollment is active.</p>
        </div>
      </div>
    );
  }

  const completionRate = stats.total_this_week > 0
    ? Math.round((stats.completed_this_week / stats.total_this_week) * 100)
    : 0;

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF0099]" />
            Daily Practice
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s reading activities</p>
        </div>

        {/* Streak & Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <Flame className={`w-6 h-6 mx-auto mb-1 ${stats.current_streak > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
            <p className="text-xl font-bold text-gray-900">{stats.current_streak}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Day Streak</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <Trophy className={`w-6 h-6 mx-auto mb-1 ${stats.longest_streak > 0 ? 'text-amber-400' : 'text-gray-500'}`} />
            <p className="text-xl font-bold text-gray-900">{stats.longest_streak}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Best Streak</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <Star className={`w-6 h-6 mx-auto mb-1 ${completionRate >= 80 ? 'text-yellow-400' : 'text-gray-500'}`} />
            <p className="text-xl font-bold text-gray-900">{stats.completed_this_week}/{stats.total_this_week}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">This Week</p>
          </div>
        </div>

        {/* Today's Task — Prominent */}
        {todayTask && (
          <div className={`rounded-2xl p-5 border-2 transition-all ${
            todayTask.is_completed
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-gradient-to-br from-pink-50 to-pink-50 border-pink-200'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#FF0099] font-medium">Today&apos;s Practice</p>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5">{todayTask.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  SKILL_COLORS[todayTask.skill_label] || 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {todayTask.skill_label}
                </span>
              </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              {todayTask.description}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {todayTask.duration_minutes} minutes
              </span>

              {todayTask.is_completed ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Done!</span>
                </div>
              ) : (
                <button
                  onClick={() => handleComplete(todayTask.id)}
                  disabled={completing === todayTask.id}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#FF0099]/90 transition-all active:scale-[0.98] min-h-[44px] disabled:opacity-50"
                >
                  {completing === todayTask.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        )}

        {!todayTask && weekTasks.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
            <CheckCircle className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
            <p className="text-gray-900 font-medium">No task for today</p>
            <p className="text-gray-500 text-sm mt-1">Enjoy a break! Tasks will be added after the next session.</p>
          </div>
        )}

        {weekTasks.length === 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
            <BookOpen className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-900 font-medium">No tasks yet</p>
            <p className="text-gray-500 text-sm mt-1">Daily practice tasks will appear after {childName}&apos;s next coaching session.</p>
          </div>
        )}

        {/* Weekly Checklist */}
        {weekTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">This Week</h3>
              {completionRate > 0 && (
                <span className="text-xs text-gray-500">
                  {completionRate}% complete
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-200">
              {weekTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    task.is_today ? 'bg-[#FF0099]/5' : ''
                  }`}
                >
                  {/* Checkbox */}
                  {task.is_completed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                  ) : task.is_past ? (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  ) : (
                    <button
                      onClick={() => handleComplete(task.id)}
                      disabled={completing === task.id || (!task.is_today && !task.is_past)}
                      className="flex-shrink-0 disabled:opacity-30"
                    >
                      {completing === task.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#FF0099]" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-500 hover:text-[#FF0099] transition-colors" />
                      )}
                    </button>
                  )}

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${task.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{formatDay(task.task_date)}</span>
                      <span className="text-[10px] text-gray-500">{task.duration_minutes}m</span>
                    </div>
                  </div>

                  {/* Skill badge */}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${
                    SKILL_COLORS[task.skill_label] || 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    {task.skill_label}
                  </span>

                  {/* Today indicator */}
                  {task.is_today && !task.is_completed && (
                    <span className="w-2 h-2 bg-[#FF0099] rounded-full flex-shrink-0 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational footer */}
        {stats.current_streak >= 3 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200 text-center">
            <p className="text-gray-900 text-sm font-medium">
              {stats.current_streak >= 7
                ? `Amazing! ${stats.current_streak} day streak! ${childName} is building a reading superpower!`
                : `${stats.current_streak} days in a row! Keep the momentum going!`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
