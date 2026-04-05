// ============================================================
// components/coach/HomeworkSection.tsx
// Coach view: manage homework for a child — assign, edit, delete, view
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, Pencil, Trash2, CheckCircle2,
  ChevronDown, ChevronUp, Camera, X, Calendar,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getHomeworkSuggestions } from '@/lib/homework/suggestion-templates';

interface HomeworkTask {
  id: string;
  session_id: string | null;
  task_date: string;
  title: string;
  description: string;
  coach_notes: string | null;
  linked_skill: string | null;
  source: string;
  is_completed: boolean;
  completed_at: string | null;
  difficulty_rating: string | null;
  practice_duration: string | null;
  photo_signed_urls: string[];
  content_item_id: string | null;
  quiz_result: { score: number; correct: number; total: number } | null;
  created_at: string;
}

interface HomeworkStats {
  total: number;
  completed: number;
  completion_rate: number;
  with_photos: number;
}

interface HomeworkSectionProps {
  childId: string;
  childName: string;
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  ai_recommended: { label: 'AI', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  coach_assigned: { label: 'Coach', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  template_generated: { label: 'Auto', className: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
  system: { label: 'System', className: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
  parent_summary: { label: 'Summary', className: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  just_right: 'Just right',
  struggled: 'Struggled',
};

const DURATION_LABELS: Record<string, string> = {
  under_5: '<5 min',
  '5_to_15': '5-15 min',
  '15_to_30': '15-30 min',
  over_30: '30+ min',
};

function formatTaskDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

export default function HomeworkSection({ childId, childName }: HomeworkSectionProps) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<HomeworkTask[]>([]);
  const [past, setPast] = useState<HomeworkTask[]>([]);
  const [stats, setStats] = useState<HomeworkStats>({ total: 0, completed: 0, completion_rate: 0, with_photos: 0 });
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSheet, setShowSheet] = useState<'assign' | 'edit' | null>(null);
  const [editTask, setEditTask] = useState<HomeworkTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Form state
  const [formDescription, setFormDescription] = useState('');
  const [formSkill, setFormSkill] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const fetchHomework = useCallback(async () => {
    try {
      const res = await fetch(`/api/coach/children/${childId}/homework`);
      const data = await res.json();
      if (data.success) {
        setActive(data.active || []);
        setPast(data.past || []);
        setStats(data.stats || { total: 0, completed: 0, completion_rate: 0, with_photos: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch homework:', err);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  const openAssignSheet = () => {
    setFormDescription('');
    setFormSkill('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDueDate(tomorrow.toISOString().split('T')[0]);
    setEditTask(null);
    setShowSheet('assign');
  };

  const openEditSheet = (task: HomeworkTask) => {
    setFormDescription(task.coach_notes || task.description);
    setFormSkill(task.linked_skill || '');
    setFormDueDate(task.task_date);
    setEditTask(task);
    setShowSheet('edit');
  };

  const handleSubmit = async () => {
    if (formDescription.trim().length < 10) return;
    setSubmitting(true);

    try {
      if (showSheet === 'edit' && editTask) {
        await fetch(`/api/coach/children/${childId}/homework`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: editTask.id,
            description: formDescription.trim(),
            linked_skill: formSkill || null,
            due_date: formDueDate,
          }),
        });
      } else {
        await fetch(`/api/coach/children/${childId}/homework`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formDescription.trim(),
            linked_skill: formSkill || null,
            due_date: formDueDate,
          }),
        });
      }
      setShowSheet(null);
      fetchHomework();
    } catch (err) {
      console.error('Homework submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await fetch(`/api/coach/children/${childId}/homework?taskId=${taskId}`, {
        method: 'DELETE',
      });
      setDeleteConfirm(null);
      fetchHomework();
    } catch (err) {
      console.error('Homework delete error:', err);
    }
  };

  const suggestions = getHomeworkSuggestions([formSkill].filter(Boolean));

  if (loading) {
    return (
      <section className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#00ABFF]" />
          <h3 className="text-white text-sm font-semibold">Homework</h3>
        </div>
        <div className="flex justify-center py-6">
          <Spinner size="sm" className="text-[#00ABFF]" />
        </div>
      </section>
    );
  }

  const completedCount = past.filter(t => t.is_completed).length;

  return (
    <>
      <section className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#00ABFF]" />
            <h3 className="text-white text-sm font-semibold">Homework</h3>
          </div>
          <button
            onClick={openAssignSheet}
            className="flex items-center gap-1 bg-[#00ABFF] text-white px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-[#00ABFF]/90 transition-colors h-9"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign New
          </button>
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{stats.total} total</span>
            <span className="text-gray-600">|</span>
            <span className={
              stats.completion_rate > 70 ? 'text-green-400' :
              stats.completion_rate > 40 ? 'text-amber-400' : 'text-red-400'
            }>
              {stats.completion_rate}% completed
            </span>
            {stats.with_photos > 0 && (
              <>
                <span className="text-gray-600">|</span>
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {stats.with_photos} with photos
                </span>
              </>
            )}
          </div>
        )}

        {/* Active Tasks */}
        {active.length > 0 ? (
          <div className="space-y-2">
            {active.map(task => (
              <div key={task.id} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      isOverdue(task.task_date) ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                    <p className="text-white text-sm leading-snug">{task.coach_notes || task.description}</p>
                    {task.coach_notes && task.coach_notes !== task.description && (
                      <p className="text-gray-500 text-[11px] mt-0.5">Parent sees: {task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditSheet(task)}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(task.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                  <span>{formatTaskDate(task.task_date)}</span>
                  {task.linked_skill && (
                    <span className="px-1.5 py-0.5 bg-gray-700/50 rounded text-gray-400">{task.linked_skill}</span>
                  )}
                  {SOURCE_BADGE[task.source] && (
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${SOURCE_BADGE[task.source].className}`}>
                      {SOURCE_BADGE[task.source].label}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-xs text-center py-3">No active homework assigned</p>
        )}

        {/* Completed Toggle */}
        {completedCount > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
            </button>

            {showCompleted && (
              <div className="mt-2 space-y-2">
                {past.filter(t => t.is_completed).map(task => (
                  <div key={task.id} className="bg-gray-900/30 border border-gray-700/30 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-300 text-sm">{task.coach_notes || task.description}</p>
                        {task.quiz_result && (
                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            <span className={`font-medium ${task.quiz_result.score >= 70 ? 'text-green-400' : 'text-amber-400'}`}>
                              Score: {task.quiz_result.correct}/{task.quiz_result.total} ({task.quiz_result.score}%)
                            </span>
                            {task.content_item_id && (
                              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px]">SmartPractice</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
                          {task.completed_at && (
                            <span>{new Date(task.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          )}
                          {task.difficulty_rating && DIFFICULTY_LABELS[task.difficulty_rating] && (
                            <span className="px-1.5 py-0.5 bg-gray-700/50 rounded">{DIFFICULTY_LABELS[task.difficulty_rating]}</span>
                          )}
                          {task.practice_duration && DURATION_LABELS[task.practice_duration] && (
                            <span className="px-1.5 py-0.5 bg-gray-700/50 rounded">{DURATION_LABELS[task.practice_duration]}</span>
                          )}
                        </div>
                        {/* Photo thumbnails */}
                        {task.photo_signed_urls.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {task.photo_signed_urls.map((url, i) => (
                              <button
                                key={i}
                                onClick={() => setPhotoModal(url)}
                                className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0 hover:ring-2 ring-[#00ABFF] transition-all"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Assign / Edit Bottom Sheet */}
      {showSheet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowSheet(null)}>
          <div
            className="bg-gray-800 rounded-t-2xl w-full max-w-lg p-5 pb-8 space-y-4 animate-in slide-in-from-bottom border-t border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">
                {showSheet === 'edit' ? 'Edit Homework' : `Assign Homework for ${childName.split(' ')[0]}`}
              </h3>
              <button onClick={() => setShowSheet(null)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">What to practice *</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="e.g. Read pages 12-15 aloud to parent..."
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00ABFF] focus:border-transparent resize-none"
              />
              {formDescription.length > 0 && formDescription.length < 10 && (
                <p className="text-red-400 text-[11px] mt-1">At least 10 characters required</p>
              )}
            </div>

            {/* Suggestion Chips */}
            {showSheet === 'assign' && suggestions.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Suggestions</label>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setFormDescription(s)}
                      className="px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded-xl text-xs text-gray-300 hover:bg-gray-600 hover:text-white transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skill */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Skill area</label>
              <select
                value={formSkill}
                onChange={e => setFormSkill(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00ABFF]"
              >
                <option value="">Select skill (optional)</option>
                <option value="phonics_letter_sounds">Phonics / Letter Sounds</option>
                <option value="reading_fluency">Reading Fluency</option>
                <option value="reading_comprehension">Comprehension</option>
                <option value="vocabulary_building">Vocabulary</option>
                <option value="creative_writing">Creative Writing</option>
                <option value="grammar_syntax">Grammar</option>
                <option value="sight_words">Sight Words</option>
                <option value="decoding">Decoding</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Due date</label>
              <div className="relative">
                <input
                  type="date"
                  value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00ABFF] [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || formDescription.trim().length < 10}
              className="w-full flex items-center justify-center gap-2 bg-[#00ABFF] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#00ABFF]/90 transition-colors disabled:opacity-50 h-12"
            >
              {submitting ? (
                <Spinner size="sm" />
              ) : showSheet === 'edit' ? (
                'Save Changes'
              ) : (
                'Assign & Notify Parent'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm">Delete this homework? The parent will no longer see it.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors h-10"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors h-10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <button onClick={() => setPhotoModal(null)} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoModal} alt="Homework photo" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
        </div>
      )}
    </>
  );
}
