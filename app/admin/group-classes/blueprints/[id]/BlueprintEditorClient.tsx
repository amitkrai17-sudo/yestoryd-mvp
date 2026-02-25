// =============================================================================
// FILE: app/admin/group-classes/blueprints/[id]/BlueprintEditorClient.tsx
// PURPOSE: Full-page blueprint editor with segment builder, content picker, skill tags
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Loader2, AlertCircle, Save, Search, X, Link2,
} from 'lucide-react';
import type {
  SegmentType, AgeBand, IndividualMomentType, CaptureMethod,
  BlueprintSegment, IndividualMomentConfig, BlueprintStatus,
} from '@/types/group-classes';

// =============================================================================
// TYPES
// =============================================================================
interface ClassType {
  id: string;
  slug: string;
  name: string;
  icon_emoji: string;
  color_hex: string;
  price_inr: number;
  duration_minutes: number;
  age_min: number;
  age_max: number;
}

interface Skill {
  id: string;
  name: string;
  skill_tag: string;
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  thumbnail_url: string | null;
}

interface FormState {
  name: string;
  classTypeId: string;
  ageBand: AgeBand;
  description: string;
  segments: BlueprintSegment[];
  individualMomentConfig: IndividualMomentConfig;
  guidedQuestions: string[];
  skillTags: string[];
  status: BlueprintStatus;
}

const SEGMENT_TYPES: { value: SegmentType; label: string }[] = [
  { value: 'content_playback', label: 'Content Playback' },
  { value: 'group_discussion', label: 'Group Discussion' },
  { value: 'individual_moment', label: 'Individual Moment' },
  { value: 'creative_activity', label: 'Creative Activity' },
  { value: 'wrap_up', label: 'Wrap Up' },
];

const AGE_BANDS: AgeBand[] = ['4-6', '7-9', '10-12'];

const DEFAULT_INDIVIDUAL_CONFIG: IndividualMomentConfig = {
  type: 'verbal',
  prompts: { '4-6': '', '7-9': '', '10-12': '' },
  duration_per_child_seconds: 60,
  capture_method: 'instructor_observation',
};

function createEmptySegment(index: number): BlueprintSegment {
  return {
    index,
    name: '',
    type: 'content_playback',
    duration_minutes: 10,
    instructions: '',
  };
}

// =============================================================================
// CONTENT PICKER SUB-COMPONENT
// =============================================================================
function ContentPicker({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string, title: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content-library?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setResults(data.items || data.content || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!isOpen) return null;

  return (
    <div className="mt-2 bg-surface-2 border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-secondary">Link Content</span>
        <button onClick={onClose} className="p-1 hover:bg-surface-1 rounded">
          <X className="w-4 h-4 text-text-tertiary" />
        </button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search content..."
          className="w-full pl-8 pr-3 py-2 bg-surface-1 border border-border rounded-lg text-sm text-white placeholder:text-text-muted"
          autoFocus
        />
      </div>
      {loading && <div className="text-center py-2"><Loader2 className="w-4 h-4 animate-spin text-text-tertiary mx-auto" /></div>}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id, item.title); onClose(); }}
              className="w-full text-left px-3 py-2 hover:bg-surface-1 rounded-lg text-sm text-white transition-colors"
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-text-tertiary ml-2 text-xs">{item.content_type}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && query && results.length === 0 && (
        <p className="text-xs text-text-tertiary py-2 text-center">No content found</p>
      )}
    </div>
  );
}

// =============================================================================
// SEGMENT CARD SUB-COMPONENT
// =============================================================================
function SegmentCard({
  segment,
  segmentIndex,
  totalSegments,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  segment: BlueprintSegment;
  segmentIndex: number;
  totalSegments: number;
  onChange: (updated: BlueprintSegment) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [showContentPicker, setShowContentPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(!!segment.instructor_notes);
  const [linkedContentTitle, setLinkedContentTitle] = useState('');

  const updateField = <K extends keyof BlueprintSegment>(key: K, value: BlueprintSegment[K]) => {
    onChange({ ...segment, [key]: value });
  };

  const updateGuidedQuestion = (idx: number, value: string) => {
    const questions = [...(segment.guided_questions || [])];
    questions[idx] = value;
    onChange({ ...segment, guided_questions: questions });
  };

  const addGuidedQuestion = () => {
    onChange({ ...segment, guided_questions: [...(segment.guided_questions || []), ''] });
  };

  const removeGuidedQuestion = (idx: number) => {
    const questions = [...(segment.guided_questions || [])];
    questions.splice(idx, 1);
    onChange({ ...segment, guided_questions: questions });
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-5">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {segmentIndex + 1}
        </span>

        <input
          type="text"
          value={segment.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Segment name"
          className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white placeholder:text-text-muted text-sm"
        />

        <select
          value={segment.type}
          onChange={(e) => updateField('type', e.target.value as SegmentType)}
          className="px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm"
        >
          {SEGMENT_TYPES.map(st => (
            <option key={st.value} value={st.value}>{st.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            value={segment.duration_minutes}
            onChange={(e) => updateField('duration_minutes', parseInt(e.target.value) || 1)}
            className="w-16 px-2 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm text-center"
            min={1}
            max={120}
          />
          <span className="text-xs text-text-tertiary">min</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={segmentIndex === 0}
            className="p-1.5 hover:bg-surface-2 rounded disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={segmentIndex === totalSegments - 1}
            className="p-1.5 hover:bg-surface-2 rounded disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Instructions */}
      <textarea
        value={segment.instructions}
        onChange={(e) => updateField('instructions', e.target.value)}
        placeholder="Instructions for this segment..."
        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white placeholder:text-text-muted text-sm mb-3 resize-none"
        rows={2}
      />

      {/* Conditional sub-forms */}
      {segment.type === 'content_playback' && (
        <div className="mb-3">
          {segment.content_item_id ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-lg">
              <Link2 className="w-4 h-4 text-[#ff0099]" />
              <span className="text-sm text-white flex-1">{linkedContentTitle || segment.content_item_id.slice(0, 8) + '...'}</span>
              <button
                onClick={() => { updateField('content_item_id', undefined); setLinkedContentTitle(''); }}
                className="p-1 hover:bg-surface-1 rounded"
              >
                <X className="w-3.5 h-3.5 text-text-tertiary" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowContentPicker(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#ff0099] hover:bg-[#ff0099]/10 rounded-lg transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Link Content
            </button>
          )}
          <ContentPicker
            isOpen={showContentPicker}
            onClose={() => setShowContentPicker(false)}
            onSelect={(id, title) => {
              updateField('content_item_id', id);
              setLinkedContentTitle(title);
            }}
          />
        </div>
      )}

      {segment.type === 'group_discussion' && (
        <div className="mb-3 space-y-2">
          <label className="text-xs font-medium text-text-secondary">Guided Questions</label>
          {(segment.guided_questions || []).map((q, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => updateGuidedQuestion(idx, e.target.value)}
                placeholder={`Question ${idx + 1}`}
                className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm placeholder:text-text-muted"
              />
              <button onClick={() => removeGuidedQuestion(idx)} className="p-1.5 hover:bg-red-500/10 rounded">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
          <button
            onClick={addGuidedQuestion}
            className="text-sm text-[#ff0099] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Question
          </button>
        </div>
      )}

      {segment.type === 'individual_moment' && (
        <div className="mb-3 space-y-3 p-3 bg-surface-2/50 rounded-lg">
          <label className="text-xs font-medium text-text-secondary">Verbal Config</label>
          <input
            type="text"
            value={segment.individual_config?.verbal?.prompt || ''}
            onChange={(e) => onChange({
              ...segment,
              individual_config: {
                ...segment.individual_config,
                verbal: {
                  applicable_age_bands: segment.individual_config?.verbal?.applicable_age_bands || ['4-6', '7-9', '10-12'],
                  prompt: e.target.value,
                  duration_per_child_seconds: segment.individual_config?.verbal?.duration_per_child_seconds || 60,
                  capture_method: 'instructor_observation',
                },
              },
            })}
            placeholder="Verbal prompt for instructor..."
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm placeholder:text-text-muted"
          />

          <label className="text-xs font-medium text-text-secondary">Typed Config (older kids)</label>
          <input
            type="text"
            value={segment.individual_config?.typed?.prompt_7_9 || ''}
            onChange={(e) => onChange({
              ...segment,
              individual_config: {
                ...segment.individual_config,
                typed: {
                  applicable_age_bands: segment.individual_config?.typed?.applicable_age_bands || ['7-9', '10-12'],
                  prompt_7_9: e.target.value,
                  prompt_10_12: segment.individual_config?.typed?.prompt_10_12 || '',
                  capture_method: 'parent_device_form',
                },
              },
            })}
            placeholder="Typed prompt for 7-9 yr olds..."
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm placeholder:text-text-muted"
          />
          <input
            type="text"
            value={segment.individual_config?.typed?.prompt_10_12 || ''}
            onChange={(e) => onChange({
              ...segment,
              individual_config: {
                ...segment.individual_config,
                typed: {
                  applicable_age_bands: segment.individual_config?.typed?.applicable_age_bands || ['7-9', '10-12'],
                  prompt_7_9: segment.individual_config?.typed?.prompt_7_9 || '',
                  prompt_10_12: e.target.value,
                  capture_method: 'parent_device_form',
                },
              },
            })}
            placeholder="Typed prompt for 10-12 yr olds..."
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm placeholder:text-text-muted"
          />
        </div>
      )}

      {/* Instructor notes (collapsible) */}
      <div>
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-text-tertiary hover:text-text-secondary"
        >
          {showNotes ? 'Hide' : 'Add'} instructor notes
        </button>
        {showNotes && (
          <textarea
            value={segment.instructor_notes || ''}
            onChange={(e) => updateField('instructor_notes', e.target.value)}
            placeholder="Private notes for instructor..."
            className="w-full mt-2 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white placeholder:text-text-muted text-sm resize-none"
            rows={2}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN EDITOR COMPONENT
// =============================================================================
export default function BlueprintEditorClient() {
  const params = useParams();
  const router = useRouter();
  const blueprintId = params.id as string;
  const isNew = blueprintId === 'new';

  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: '',
    classTypeId: '',
    ageBand: '7-9',
    description: '',
    segments: [createEmptySegment(0)],
    individualMomentConfig: { ...DEFAULT_INDIVIDUAL_CONFIG },
    guidedQuestions: [],
    skillTags: [],
    status: 'draft',
  });

  // Fetch options
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/group-classes/options');
        const data = await res.json();
        setClassTypes(data.classTypes || []);
        setSkills(data.skills || []);
        if (isNew && data.classTypes?.length > 0 && !form.classTypeId) {
          setForm(prev => ({ ...prev, classTypeId: data.classTypes[0].id }));
        }
      } catch (err) {
        console.error('Error fetching options:', err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch existing blueprint
  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/group-classes/blueprints/${blueprintId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const bp = data.blueprint;
        setForm({
          name: bp.name || '',
          classTypeId: bp.class_type_id || '',
          ageBand: bp.age_band || '7-9',
          description: bp.description || '',
          segments: bp.segments || [createEmptySegment(0)],
          individualMomentConfig: bp.individual_moment_config || { ...DEFAULT_INDIVIDUAL_CONFIG },
          guidedQuestions: bp.guided_questions || [],
          skillTags: bp.skill_tags || [],
          status: bp.status || 'draft',
        });
      } catch (err) {
        console.error('Error loading blueprint:', err);
        setError('Failed to load blueprint');
      } finally {
        setLoading(false);
      }
    })();
  }, [blueprintId, isNew]);

  // Segment operations
  const addSegment = () => {
    setForm(prev => ({
      ...prev,
      segments: [...prev.segments, createEmptySegment(prev.segments.length)],
    }));
  };

  const updateSegment = (idx: number, updated: BlueprintSegment) => {
    setForm(prev => ({
      ...prev,
      segments: prev.segments.map((s, i) => i === idx ? updated : s),
    }));
  };

  const removeSegment = (idx: number) => {
    setForm(prev => ({
      ...prev,
      segments: prev.segments
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, index: i })),
    }));
  };

  const moveSegment = (fromIdx: number, toIdx: number) => {
    setForm(prev => {
      const segs = [...prev.segments];
      const [moved] = segs.splice(fromIdx, 1);
      segs.splice(toIdx, 0, moved);
      return { ...prev, segments: segs.map((s, i) => ({ ...s, index: i })) };
    });
  };

  const toggleSkillTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      skillTags: prev.skillTags.includes(tag)
        ? prev.skillTags.filter(t => t !== tag)
        : [...prev.skillTags, tag],
    }));
  };

  // Save
  const handleSave = async (saveStatus: BlueprintStatus) => {
    if (!form.name.trim()) {
      setError('Blueprint name is required');
      return;
    }
    if (!form.classTypeId) {
      setError('Please select a class type');
      return;
    }
    if (form.segments.length === 0) {
      setError('At least one segment is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        class_type_id: form.classTypeId,
        age_band: form.ageBand,
        description: form.description || undefined,
        segments: form.segments.map((s, i) => ({ ...s, index: i })),
        individual_moment_config: form.individualMomentConfig,
        guided_questions: form.guidedQuestions.length > 0 ? form.guidedQuestions : undefined,
        skill_tags: form.skillTags.length > 0 ? form.skillTags : undefined,
        status: saveStatus,
      };

      const url = isNew
        ? '/api/admin/group-classes/blueprints'
        : `/api/admin/group-classes/blueprints/${blueprintId}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      // Navigate to list or to the new blueprint
      if (isNew && data.blueprint?.id) {
        router.push(`/admin/group-classes/blueprints/${data.blueprint.id}`);
      } else {
        // Update local form status
        setForm(prev => ({ ...prev, status: saveStatus }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const totalDuration = form.segments.reduce((sum, s) => sum + s.duration_minutes, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/group-classes/blueprints')}
              className="p-2 hover:bg-surface-2 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-text-tertiary" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isNew ? 'Create Blueprint' : 'Edit Blueprint'}
              </h1>
              <p className="text-sm text-text-tertiary mt-0.5">
                {totalDuration} min total across {form.segments.length} segments
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ─── SECTION 1: Core Details ─── */}
        <section className="space-y-5">
          <h2 className="text-lg font-bold text-white">Core Details</h2>

          {/* Class Type Cards */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-3">Class Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {classTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, classTypeId: ct.id }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.classTypeId === ct.id
                      ? 'border-[#ff0099] bg-[#ff0099]/10'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ct.icon_emoji}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">{ct.name}</p>
                      <p className="text-xs text-text-tertiary">{ct.duration_minutes}min</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Blueprint Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Dinosaur Discovery - Ages 7-9"
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-[#ff0099] focus:border-transparent text-white placeholder:text-text-muted"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what this blueprint covers..."
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-[#ff0099] focus:border-transparent text-white placeholder:text-text-muted resize-none"
              rows={3}
            />
          </div>

          {/* Age Band */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Age Band *</label>
            <div className="flex gap-3">
              {AGE_BANDS.map((ab) => (
                <button
                  key={ab}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, ageBand: ab }))}
                  className={`px-5 py-2.5 rounded-xl border-2 font-medium transition-all ${
                    form.ageBand === ab
                      ? 'border-[#ff0099] bg-[#ff0099]/10 text-white'
                      : 'border-border text-text-secondary hover:border-border/80'
                  }`}
                >
                  {ab} yrs
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: Segment Builder ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Segments</h2>
            <button
              onClick={addSegment}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#ff0099] hover:bg-[#ff0099]/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Segment
            </button>
          </div>

          <div className="space-y-4">
            {form.segments.map((seg, idx) => (
              <SegmentCard
                key={idx}
                segment={seg}
                segmentIndex={idx}
                totalSegments={form.segments.length}
                onChange={(updated) => updateSegment(idx, updated)}
                onMoveUp={() => moveSegment(idx, idx - 1)}
                onMoveDown={() => moveSegment(idx, idx + 1)}
                onRemove={() => removeSegment(idx)}
              />
            ))}
          </div>

          {form.segments.length === 0 && (
            <div className="text-center py-8 bg-surface-1 rounded-xl border border-dashed border-border">
              <p className="text-text-tertiary mb-3">No segments yet</p>
              <button
                onClick={addSegment}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff0099] text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add First Segment
              </button>
            </div>
          )}
        </section>

        {/* ─── SECTION 3: Individual Moment Config ─── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">Individual Moment Config</h2>
          <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-4">
            {/* Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Moment Type</label>
                <select
                  value={form.individualMomentConfig.type}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    individualMomentConfig: { ...prev.individualMomentConfig, type: e.target.value as IndividualMomentType },
                  }))}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm"
                >
                  <option value="verbal">Verbal</option>
                  <option value="typed">Typed</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Duration / Child (sec)</label>
                <input
                  type="number"
                  value={form.individualMomentConfig.duration_per_child_seconds}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    individualMomentConfig: { ...prev.individualMomentConfig, duration_per_child_seconds: parseInt(e.target.value) || 60 },
                  }))}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm"
                  min={10}
                  max={300}
                />
              </div>
            </div>

            {/* Capture method */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Capture Method</label>
              <select
                value={form.individualMomentConfig.capture_method}
                onChange={(e) => setForm(prev => ({
                  ...prev,
                  individualMomentConfig: { ...prev.individualMomentConfig, capture_method: e.target.value as CaptureMethod },
                }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm"
              >
                <option value="instructor_observation">Instructor Observation</option>
                <option value="parent_device_form">Parent Device Form</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Prompts per age band */}
            {AGE_BANDS.map((ab) => (
              <div key={ab}>
                <label className="block text-xs font-medium text-text-secondary mb-1">Prompt ({ab} yrs)</label>
                <textarea
                  value={form.individualMomentConfig.prompts[ab] || ''}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    individualMomentConfig: {
                      ...prev.individualMomentConfig,
                      prompts: { ...prev.individualMomentConfig.prompts, [ab]: e.target.value },
                    },
                  }))}
                  placeholder={`Prompt for ${ab} year olds...`}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white placeholder:text-text-muted text-sm resize-none"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ─── SECTION 4: Skill Tags ─── */}
        {skills.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white">Skill Tags</h2>
            {(() => {
              const SKILL_CATEGORIES: { label: string; tags: string[] }[] = [
                { label: 'Reading Skills', tags: ['comprehension', 'vocabulary', 'fluency', 'phonics', 'phonemic awareness', 'phonemic_awareness'] },
                { label: 'Expression Skills', tags: ['creativity', 'expression', 'pronunciation', 'confidence', 'listening', 'retelling', 'sentence formation', 'sentence_formation'] },
                { label: 'Thinking Skills', tags: ['reasoning', 'critical thinking', 'critical_thinking', 'spelling', 'grammar'] },
              ];

              const categorized = SKILL_CATEGORIES.map(cat => ({
                ...cat,
                skills: skills.filter(s =>
                  cat.tags.some(t => s.skill_tag.toLowerCase().includes(t) || s.name.toLowerCase().includes(t))
                ),
              }));

              const categorizedIds = new Set(categorized.flatMap(c => c.skills.map(s => s.id)));
              const uncategorized = skills.filter(s => !categorizedIds.has(s.id));
              if (uncategorized.length > 0) {
                categorized.push({ label: 'Other', tags: [], skills: uncategorized });
              }

              return categorized.filter(c => c.skills.length > 0).map(cat => (
                <div key={cat.label}>
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{cat.label}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {cat.skills.map((skill) => {
                      const isSelected = form.skillTags.includes(skill.skill_tag);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkillTag(skill.skill_tag)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-center ${
                            isSelected
                              ? 'bg-[#ff0099]/20 text-[#ff0099] border-[#ff0099]/40'
                              : 'bg-surface-1 text-text-secondary border-border hover:border-text-tertiary'
                          }`}
                        >
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ─── SECTION 5: Sticky Save Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-surface-1 border-t border-border z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/admin/group-classes/blueprints')}
            className="px-4 py-2.5 text-text-secondary hover:text-white transition-colors text-sm font-medium"
          >
            Back to List
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="px-5 py-2.5 border border-border text-text-secondary rounded-xl font-medium hover:bg-surface-2 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSave('published')}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save & Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
