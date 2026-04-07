'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, Circle, Clock, Flame, BookOpen,
  Camera, X, Check, XCircle,
  Smile, ThumbsUp, Frown,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useParentContext } from '@/app/parent/context';

// Skill icon backgrounds
const SKILL_ICON_MAP: Record<string, { icon: typeof BookOpen; bg: string; color: string }> = {
  'Letter Sounds': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Sound Skills': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Word Reading': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Reading Speed': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Understanding Stories': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Language Skills': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Writing': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Sight Words': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Word Power': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Reading with Feeling': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Reading Stamina': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
  'Reading': { icon: BookOpen, bg: 'bg-[#FFF5F9]', color: 'text-[#FF0099]' },
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
  program_label: 'Coaching' | 'Tuition' | null;
  session_date: string | null;
  session_number: number | null;
  source: string;
  content_item_id: string | null;
  photo_url: string | null;
  photo_urls: { url: string; uploaded_at: string; analysis?: any }[] | null;
}

// Get day-of-week index (0=Mon, 6=Sun) for a date string
function getDayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
}

function formatTaskDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Enrich generic task titles with skill label
function getDisplayTitle(task: Task): string {
  const generic = ['Practice Activity', 'Daily Practice', 'Practice'];
  if (generic.includes(task.title) && task.skill_label) {
    return `Practice activity: ${task.skill_label}`;
  }
  return task.title;
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

export default function ParentTasksPage() {
  const router = useRouter();
  const { selectedChildId, selectedChild } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Your Child';

  const [loading, setLoading] = useState(true);
  const [todayTask, setTodayTask] = useState<Task | null>(null);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    completed_this_week: 0,
    total_this_week: 0,
    current_streak: 0,
    longest_streak: 0,
  });
  const [completing, setCompleting] = useState<string | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [feedbackStep, setFeedbackStep] = useState(false);
  const [difficultyRating, setDifficultyRating] = useState<string | null>(null);
  const [practiceDuration, setPracticeDuration] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTasks = useCallback(async (cId: string) => {
    try {
      const res = await fetch(`/api/parent/tasks/${cId}`);
      const data = await res.json();
      if (data.success) {
        setTodayTask(data.today_task);
        setWeekTasks(data.week_tasks || []);
        setStats({
          completed_this_week: data.stats.completed_this_week,
          total_this_week: data.stats.total_this_week,
          current_streak: data.stats.current_streak,
          longest_streak: data.stats.longest_streak,
        });
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTasks(selectedChildId).finally(() => setLoading(false));

    const handleChildChange = () => {
      setLoading(true);
      fetchTasks(selectedChildId).finally(() => setLoading(false));
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [selectedChildId, fetchTasks]);

  const resetSheet = () => {
    setShowPhotoSheet(null);
    setPhotoPreview(null);
    setFeedbackStep(false);
    setDifficultyRating(null);
    setPracticeDuration(null);
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!selectedChildId || completing) return;
    setCompleting(taskId);

    try {
      const res = await fetch(`/api/parent/tasks/${selectedChildId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          difficulty_rating: difficultyRating,
          practice_duration: practiceDuration,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(prev => ({
          ...prev,
          completed_this_week: prev.completed_this_week + 1,
          current_streak: data.streak.current,
          longest_streak: data.streak.longest,
        }));
        await fetchTasks(selectedChildId);
      }
    } catch (err) {
      console.error('Complete task error:', err);
    } finally {
      setCompleting(null);
      resetSheet();
    }
  };

  // Photo handling
  const currentSheetTask = showPhotoSheet
    ? weekTasks.find((t: Task) => t.id === showPhotoSheet)
    : null;
  const currentPhotos = (currentSheetTask?.photo_urls || []) as { url: string; uploaded_at: string }[];
  const canAddPhoto = currentPhotos.length < 3;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChildId || !showPhotoSheet) return;

    setPhotoPreview(URL.createObjectURL(file));

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5 MB');
      setPhotoPreview(null);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', showPhotoSheet);

      const res = await fetch(`/api/parent/tasks/${selectedChildId}/upload-photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Photo upload failed:', data.error);
        if (data.error?.includes('Maximum')) alert(data.error);
      } else {
        if (selectedChildId) fetchTasks(selectedChildId);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploading(false);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFeedbackStep(true);
    }
  };

  // Build weekly habit tracker data
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const todayDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;

  // Build a set of completed day indices from week_tasks
  const completedDayIndices = new Set<number>();
  weekTasks.forEach(t => {
    if (t.is_completed && t.completed_at) {
      const completedDate = t.completed_at.split('T')[0];
      completedDayIndices.add(getDayIndex(completedDate));
    }
  });

  // Separate completed and missed/expired tasks for "This Week" section
  const completedTasks = weekTasks.filter(t => t.is_completed);
  const missedTasks = weekTasks.filter(t => !t.is_completed && t.is_past);
  const historyTasks = [...completedTasks, ...missedTasks];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-medium">No enrolled child found</p>
            <p className="text-gray-500 text-sm mt-1">Tasks will appear once enrollment is active.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ============ HEADER ============ */}
        <div>
          <h1 className="text-xl font-medium text-gray-900">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s tasks</p>
        </div>

        {/* ============ SECTION 1: STREAK BAR ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="w-6 h-6 text-[#FF0099]" />
            <div>
              <p className="text-base font-medium text-gray-900">
                {pluralize(stats.current_streak, 'day')} streak
              </p>
              <p className="text-xs text-gray-500">
                Best: {pluralize(stats.longest_streak, 'day')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-medium text-gray-900">
              {stats.completed_this_week}/{stats.total_this_week}
            </p>
            <p className="text-xs text-gray-500">this week</p>
          </div>
        </div>

        {/* ============ SECTION 2: WEEKLY HABIT TRACKER ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            {DAY_LABELS.map((label, i) => {
              const isCompleted = completedDayIndices.has(i);
              const isToday = i === todayDayIndex;
              const isFuture = i > todayDayIndex;

              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-[#FFF5F9]'
                        : isToday
                          ? 'border-2 border-[#FF0099] bg-white'
                          : 'bg-gray-100'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-[#FF0099]" />
                    ) : isToday ? (
                      <Circle className="w-2 h-2 fill-[#FF0099] text-[#FF0099]" />
                    ) : isFuture ? (
                      <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />
                    ) : (
                      <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ SECTION 3: TODAY ============ */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Today</p>

          {todayTask && !todayTask.is_completed ? (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#FFD6E8] p-4 space-y-3">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-[#FFF5F9] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-[#FF0099]" />
                </div>
                {/* Title + subtitle */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-900">{getDisplayTitle(todayTask)}</p>
                  {todayTask.session_number && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      From {todayTask.program_label?.toLowerCase() || 'coaching'} session #{todayTask.session_number}
                    </p>
                  )}
                </div>
              </div>

              {/* Pill badges */}
              <div className="flex items-center gap-2">
                {todayTask.program_label && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {todayTask.program_label}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {todayTask.duration_minutes} min
                </span>
              </div>

              {/* CTA */}
              {todayTask.content_item_id ? (
                <button
                  onClick={() => router.push(`/parent/practice/${todayTask.id}`)}
                  className="w-full py-3 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[44px]"
                >
                  Start practice
                </button>
              ) : todayTask.title === 'Reading Progress Check' && todayTask.source === 'system' ? (
                <button
                  onClick={() => router.push(`/parent/reading-test/${todayTask.id}`)}
                  className="w-full py-3 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[44px]"
                >
                  Start practice
                </button>
              ) : (
                <button
                  onClick={() => setShowPhotoSheet(todayTask.id)}
                  disabled={completing === todayTask.id}
                  className="w-full py-3 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[44px] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completing === todayTask.id ? <Spinner size="sm" /> : null}
                  Start practice
                </button>
              )}
            </div>
          ) : todayTask && todayTask.is_completed ? (
            /* Today done */
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#E8FCF1] flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-base font-medium text-gray-900">All done for today!</p>
              <p className="text-sm text-gray-500 mt-1">
                New tasks will appear after the next session
              </p>
            </div>
          ) : (
            /* No task today */
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#E8FCF1] flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-base font-medium text-gray-900">All done for today!</p>
              <p className="text-sm text-gray-500 mt-1">
                New tasks will appear after the next session
              </p>
            </div>
          )}
        </div>

        {/* ============ SECTION 4: THIS WEEK ============ */}
        {historyTasks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">This week</p>
            <div className="space-y-2">
              {historyTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3"
                >
                  {/* Status icon */}
                  {task.is_completed ? (
                    <div className="w-8 h-8 rounded-full bg-[#E8FCF1] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#FCEBEB] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <XCircle className="w-4 h-4 text-[#993556]" />
                    </div>
                  )}

                  {/* Task info — no truncation */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {getDisplayTitle(task)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                      {task.session_number && (
                        <span className="text-xs text-gray-400">
                          Session #{task.session_number}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTaskDate(task.task_date)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {task.duration_minutes} min
                      </span>
                      {!task.is_completed && task.is_past && (
                        <span className="text-xs text-[#993556] font-medium">expired</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No tasks at all */}
        {weekTasks.length === 0 && !todayTask && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-base font-medium text-gray-900">No tasks yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Daily practice tasks will appear after {childName}&apos;s next session.
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />

      {/* Photo + feedback completion bottom sheet */}
      {showPhotoSheet && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={resetSheet}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-24 space-y-4 animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {feedbackStep ? 'How did it go?' : 'Mark as done'}
              </h3>
              <button onClick={resetSheet} className="p-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {feedbackStep ? (
              <div className="space-y-4">
                {/* Difficulty */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">How was the difficulty?</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'easy', label: 'Easy', icon: Smile, color: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
                      { value: 'just_right', label: 'Just right', icon: ThumbsUp, color: 'bg-blue-50 border-blue-300 text-blue-700' },
                      { value: 'struggled', label: 'Struggled', icon: Frown, color: 'bg-amber-50 border-amber-300 text-amber-700' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDifficultyRating(difficultyRating === opt.value ? null : opt.value)}
                        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-h-[44px] ${
                          difficultyRating === opt.value ? opt.color : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        <opt.icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">How long did they practice?</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'under_5', label: '<5 min' },
                      { value: '5_to_15', label: '5-15 min' },
                      { value: '15_to_30', label: '15-30 min' },
                      { value: 'over_30', label: '30+ min' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPracticeDuration(practiceDuration === opt.value ? null : opt.value)}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all min-h-[44px] ${
                          practiceDuration === opt.value
                            ? 'bg-[#FF0099]/10 border-[#FF0099] text-[#FF0099]'
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleCompleteTask(showPhotoSheet)}
                    disabled={!!completing}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-[#FF0099] text-white rounded-xl text-sm font-medium min-h-[44px] disabled:opacity-50"
                  >
                    {completing ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
                    Submit
                  </button>
                  <button
                    onClick={() => {
                      setDifficultyRating(null);
                      setPracticeDuration(null);
                      handleCompleteTask(showPhotoSheet);
                    }}
                    disabled={!!completing}
                    className="w-full text-center text-xs text-gray-400 py-1"
                  >
                    Skip feedback
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Existing photo thumbnails */}
                {currentPhotos.length > 0 && (
                  <div className="flex gap-2">
                    {currentPhotos.map((p, i) => (
                      <div key={i} className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {uploading && (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setFeedbackStep(true)}
                  className="w-full flex items-center justify-center gap-2 p-3.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[48px]"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as done
                </button>

                {canAddPhoto ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-left hover:bg-gray-100 transition-colors min-h-[44px] disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {currentPhotos.length > 0 ? `Add another photo (${currentPhotos.length}/3)` : 'Attach photo (optional)'}
                      </p>
                      <p className="text-[11px] text-gray-400">Photo of completed work</p>
                    </div>
                  </button>
                ) : (
                  <p className="text-center text-xs text-gray-400">3/3 photos added</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
