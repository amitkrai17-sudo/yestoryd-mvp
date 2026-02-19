'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, ChevronDown,
  ChevronUp, GripVertical, ArrowUpDown, Replace, StickyNote,
  Sparkles, Target, Clock, BookOpen, Shield,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface PlanItem {
  id: string;
  session_number: number;
  session_template_id: string | null;
  focus_area: string | null;
  objectives: string[] | null;
  status: string;
  coach_notes: string | null;
  template: {
    id: string;
    template_code: string;
    title: string;
    description: string | null;
    skill_dimensions: string[];
    difficulty_level: number;
    duration_minutes: number;
    materials_needed: string[] | null;
    is_season_finale: boolean;
  } | null;
}

interface SwapOption {
  id: string;
  template_code: string;
  title: string;
  skill_dimensions: string[];
  difficulty_level: number;
  duration_minutes: number;
  is_season_finale: boolean;
}

interface Roadmap {
  id: string;
  season_number: number;
  age_band: string;
  status: string;
  season_name: string | null;
  focus_areas: string[];
  total_planned_sessions: number;
  milestone_description: string | null;
  generated_by: string | null;
  created_at: string;
}

export default function PlanReviewPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [child, setChild] = useState<any>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [swapOptions, setSwapOptions] = useState<SwapOption[]>([]);

  const [swappingItemId, setSwappingItemId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/coach/children/${childId}/plan`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load plan');
        setLoading(false);
        return;
      }

      setChild(data.child);
      setRoadmap(data.roadmap);
      setPlanItems(data.plan_items || []);
      setSwapOptions(data.swap_options || []);
    } catch {
      setError('Failed to load learning plan');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleSwapTemplate = async (planItemId: string, newTemplateId: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/coach/children/${childId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swap_template',
          planItemId,
          data: { new_template_id: newTemplateId },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Swap failed');
        return;
      }
      setSwappingItemId(null);
      setSuccess('Template swapped');
      setTimeout(() => setSuccess(''), 3000);
      await fetchPlan();
    } catch {
      setError('Failed to swap template');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = planItems.findIndex(p => p.id === itemId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= planItems.length) return;

    // Don't move past a season finale
    if (planItems[targetIdx].template?.is_season_finale && direction === 'down') return;
    if (planItems[idx].template?.is_season_finale && direction === 'up') return;

    const newItems = [...planItems];
    const [moved] = newItems.splice(idx, 1);
    newItems.splice(targetIdx, 0, moved);

    // Reassign session numbers
    const reordered = newItems.map((item, i) => ({
      ...item,
      session_number: i + 2, // +2 because session 1 is diagnostic
    }));

    setPlanItems(reordered);

    setSaving(true);
    try {
      const res = await fetch(`/api/coach/children/${childId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          data: {
            items: reordered.map(item => ({
              id: item.id,
              session_number: item.session_number,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Reorder failed');
        await fetchPlan(); // Revert
      }
    } catch {
      setError('Failed to reorder');
      await fetchPlan();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async (planItemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/children/${childId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_notes',
          planItemId,
          data: { coach_notes: notesText },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save notes');
        return;
      }
      setEditingNotesId(null);
      setSuccess('Notes saved');
      setTimeout(() => setSuccess(''), 3000);
      await fetchPlan();
    } catch {
      setError('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setError('');
    try {
      const res = await fetch(`/api/coach/children/${childId}/plan/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Approval failed');
        return;
      }
      setSuccess(`Plan approved! ${data.sessionsUpdated} sessions updated with templates.`);
      await fetchPlan();
    } catch {
      setError('Failed to approve plan');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF]" />
      </div>
    );
  }

  if (error && !child) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-white mb-2">{error}</p>
          <button onClick={() => router.back()} className="text-[#00ABFF] font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen bg-surface-0">
        <div className="sticky top-0 z-10 bg-surface-1 border-b border-border">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-surface-2 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-text-tertiary" />
            </button>
            <h1 className="font-bold text-white">Learning Plan</h1>
          </div>
        </div>
        <div className="px-4 py-12 text-center">
          <Target className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <p className="text-white font-medium mb-1">No Learning Plan Yet</p>
          <p className="text-text-tertiary text-sm">Complete a diagnostic session to generate a personalized plan.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-[#00ABFF] font-medium text-sm"
          >
            ← Back to Student
          </button>
        </div>
      </div>
    );
  }

  const isDraft = roadmap.status === 'draft';
  const completedCount = planItems.filter(p => p.status === 'completed').length;

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-surface-2 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-text-tertiary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm lg:text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00ABFF]" />
              {roadmap.season_name || `Season ${roadmap.season_number}`}
            </h1>
            <p className="text-xs text-text-tertiary">
              {child?.child_name} — {planItems.length} sessions planned
            </p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            isDraft
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {isDraft ? 'Draft' : 'Active'}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Status messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Plan Overview Card */}
        <div className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#7B008B] flex items-center justify-center text-white font-bold text-sm">
              {child?.child_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{child?.child_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-tertiary">{child?.age}y</span>
                <AgeBandBadge ageBand={roadmap.age_band} />
              </div>
            </div>
          </div>

          {/* Focus Areas */}
          {roadmap.focus_areas.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-text-tertiary font-medium mb-1 uppercase tracking-wider">Focus Areas</p>
              <div className="flex flex-wrap gap-1">
                {roadmap.focus_areas.map(area => (
                  <span
                    key={area}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ABFF]/10 text-[#00ABFF] border border-[#00ABFF]/20"
                  >
                    {area.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {!isDraft && (
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-text-tertiary mb-1">
                <span>Progress</span>
                <span>{completedCount}/{planItems.length} sessions</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00ABFF] to-[#00ABFF] rounded-full transition-all"
                  style={{ width: `${planItems.length > 0 ? (completedCount / planItems.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {roadmap.milestone_description && (
            <p className="text-xs text-text-tertiary">{roadmap.milestone_description}</p>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-text-tertiary font-medium">Session Plan</p>
            {isDraft && (
              <p className="text-[10px] text-yellow-400">Drag to reorder • Tap to swap</p>
            )}
          </div>

          {/* Diagnostic Session (always first) */}
          <div className="bg-surface-1 border border-red-500/30 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Diagnostic Session</p>
                <p className="text-text-tertiary text-[11px]">Assessment completed — plan generated</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>

          {/* Plan Items */}
          {planItems.map((item, idx) => (
            <div
              key={item.id}
              className={`bg-surface-1 border rounded-xl overflow-hidden transition-colors ${
                item.status === 'completed'
                  ? 'border-green-500/30'
                  : item.status === 'skipped'
                  ? 'border-gray-600'
                  : 'border-border hover:border-gray-600'
              }`}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                {isDraft && (
                  <GripVertical className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  item.status === 'completed'
                    ? 'bg-green-500/20 text-green-400'
                    : item.template?.is_season_finale
                    ? 'bg-[#00ABFF]/20 text-[#00ABFF]'
                    : 'bg-[#00ABFF]/20 text-[#00ABFF]'
                }`}>
                  {item.session_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {item.template?.template_code}: {item.template?.title || 'No template'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.template?.difficulty_level && (
                      <span className="text-[10px] text-text-tertiary">L{item.template.difficulty_level}</span>
                    )}
                    {item.template?.duration_minutes && (
                      <span className="text-[10px] text-text-tertiary flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{item.template.duration_minutes}m
                      </span>
                    )}
                    {item.template?.is_season_finale && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00ABFF]/20 text-[#00ABFF]">Finale</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {expandedItem === item.id
                    ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                    : <ChevronDown className="w-4 h-4 text-text-tertiary" />
                  }
                </div>
              </div>

              {/* Expanded detail */}
              {expandedItem === item.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                  {/* Skills */}
                  {item.template?.skill_dimensions && item.template.skill_dimensions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.template.skill_dimensions.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ABFF]/10 text-[#00ABFF] border border-[#00ABFF]/20">
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Focus & Objectives */}
                  {item.focus_area && (
                    <p className="text-xs text-text-tertiary">
                      <span className="font-medium">Focus:</span> {item.focus_area.replace(/_/g, ' ')}
                    </p>
                  )}
                  {item.objectives && item.objectives.length > 0 && (
                    <p className="text-xs text-text-tertiary">
                      <span className="font-medium">Why:</span> {item.objectives[0]}
                    </p>
                  )}

                  {/* Materials */}
                  {item.template?.materials_needed && item.template.materials_needed.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-tertiary font-medium mb-1">Materials</p>
                      <div className="flex flex-wrap gap-1">
                        {item.template.materials_needed.map(m => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 bg-surface-2 rounded text-white border border-border">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coach Notes */}
                  {item.coach_notes && editingNotesId !== item.id && (
                    <div className="bg-surface-2 rounded-lg p-2 border border-border">
                      <p className="text-[10px] text-text-tertiary font-medium mb-0.5">Coach Notes</p>
                      <p className="text-xs text-white">{item.coach_notes}</p>
                    </div>
                  )}

                  {/* Actions (draft mode) */}
                  {isDraft && item.status === 'planned' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Move up/down */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveItem(item.id, 'up'); }}
                        disabled={idx === 0 || saving}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary px-2 py-1 rounded bg-surface-2 border border-border hover:text-white disabled:opacity-30"
                      >
                        <ArrowUpDown className="w-3 h-3" /> Up
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveItem(item.id, 'down'); }}
                        disabled={idx === planItems.length - 1 || saving}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary px-2 py-1 rounded bg-surface-2 border border-border hover:text-white disabled:opacity-30"
                      >
                        <ArrowUpDown className="w-3 h-3" /> Down
                      </button>

                      {/* Swap template */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwappingItemId(swappingItemId === item.id ? null : item.id);
                        }}
                        className="flex items-center gap-1 text-[10px] text-[#00ABFF] px-2 py-1 rounded bg-[#00ABFF]/10 border border-[#00ABFF]/20 hover:bg-[#00ABFF]/20"
                      >
                        <Replace className="w-3 h-3" /> Swap
                      </button>

                      {/* Add/Edit notes */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingNotesId === item.id) {
                            setEditingNotesId(null);
                          } else {
                            setEditingNotesId(item.id);
                            setNotesText(item.coach_notes || '');
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary px-2 py-1 rounded bg-surface-2 border border-border hover:text-white"
                      >
                        <StickyNote className="w-3 h-3" /> Notes
                      </button>
                    </div>
                  )}

                  {/* Swap picker */}
                  {swappingItemId === item.id && (
                    <div className="bg-surface-2 rounded-lg p-3 border border-[#00ABFF]/30 space-y-2">
                      <p className="text-xs text-[#00ABFF] font-medium">Replace with:</p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {swapOptions.map(opt => (
                          <button
                            key={opt.id}
                            onClick={(e) => { e.stopPropagation(); handleSwapTemplate(item.id, opt.id); }}
                            disabled={saving}
                            className="w-full text-left p-2 rounded-lg bg-surface-1 border border-border hover:border-[#00ABFF]/50 transition-colors"
                          >
                            <p className="text-xs text-white font-medium">{opt.template_code}: {opt.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-text-tertiary">L{opt.difficulty_level}</span>
                              <span className="text-[10px] text-text-tertiary">{opt.duration_minutes}m</span>
                              {opt.skill_dimensions?.slice(0, 2).map(s => (
                                <span key={s} className="text-[10px] px-1 py-0.5 bg-surface-2 rounded text-text-tertiary">{s.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          </button>
                        ))}
                        {swapOptions.length === 0 && (
                          <p className="text-xs text-text-tertiary text-center py-2">No other templates available</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSwappingItemId(null); }}
                        className="text-[10px] text-text-tertiary hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Notes editor */}
                  {editingNotesId === item.id && (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Add notes for this session..."
                        className="w-full bg-surface-2 border border-border rounded-lg p-2 text-xs text-white placeholder:text-text-tertiary resize-none h-16 focus:outline-none focus:border-[#00ABFF]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveNotes(item.id)}
                          disabled={saving}
                          className="text-[10px] px-3 py-1 bg-[#00ABFF] text-white rounded font-medium"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="text-[10px] px-3 py-1 text-text-tertiary hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Approve Footer (draft only) */}
      {isDraft && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border p-4 z-20">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{planItems.length} sessions planned</p>
              <p className="text-text-tertiary text-[10px]">
                Approving will assign templates to scheduled sessions
              </p>
            </div>
            <button
              onClick={handleApprove}
              disabled={approving || planItems.length === 0}
              className="flex items-center gap-2 bg-[#00ABFF] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#00ABFF]/90 disabled:opacity-50 transition-colors"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Approve Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
