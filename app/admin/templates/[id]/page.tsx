'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Save, Loader2, BookOpen, Plus, Trash2, GripVertical,
  Link2, X, Search, Film, Gamepad2, FileText,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface ContentRef {
  type: 'video' | 'game' | 'worksheet';
  id: string;
  label: string;
}

interface ActivityStep {
  time: string;
  activity: string;
  purpose: string;
  activity_id?: string;
  activity_name?: string;
  planned_duration_minutes?: number;
  content_refs?: ContentRef[];
  is_required?: boolean;
  coach_can_substitute?: boolean;
}

interface TemplateForm {
  template_code: string;
  title: string;
  description: string;
  age_band: string;
  skill_dimensions: string[];
  difficulty_level: number;
  duration_minutes: number;
  prerequisites: string[];
  recommended_order: number;
  materials_needed: string[];
  parent_involvement: string;
  activity_flow: ActivityStep[];
  coach_prep_notes: string;
  is_diagnostic: boolean;
  is_season_finale: boolean;
  is_active: boolean;
}

const EMPTY_FORM: TemplateForm = {
  template_code: '',
  title: '',
  description: '',
  age_band: 'foundation',
  skill_dimensions: [],
  difficulty_level: 1,
  duration_minutes: 30,
  prerequisites: [],
  recommended_order: 1,
  materials_needed: [],
  parent_involvement: '',
  activity_flow: [],
  coach_prep_notes: '',
  is_diagnostic: false,
  is_season_finale: false,
  is_active: true,
};

const SKILL_OPTIONS = [
  'phonemic_awareness', 'phonics', 'fluency', 'vocabulary',
  'comprehension', 'writing', 'speaking', 'listening',
];

export default function TemplateEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [prereqInput, setPrereqInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');

  // Content picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStepIndex, setPickerStepIndex] = useState<number>(-1);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSkill, setPickerSkill] = useState('');
  const [pickerResults, setPickerResults] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (isNew) return;
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/admin/templates/${id}`);
        const data = await res.json();
        if (data.success && data.template) {
          const t = data.template;
          setForm({
            template_code: t.template_code || '',
            title: t.title || '',
            description: t.description || '',
            age_band: t.age_band || 'foundation',
            skill_dimensions: t.skill_dimensions || [],
            difficulty_level: t.difficulty_level || 1,
            duration_minutes: t.duration_minutes || 30,
            prerequisites: t.prerequisites || [],
            recommended_order: t.recommended_order || 1,
            materials_needed: t.materials_needed || [],
            parent_involvement: t.parent_involvement || '',
            activity_flow: t.activity_flow || [],
            coach_prep_notes: t.coach_prep_notes || '',
            is_diagnostic: t.is_diagnostic || false,
            is_season_finale: t.is_season_finale || false,
            is_active: t.is_active !== false,
          });
        } else {
          setError('Template not found');
        }
      } catch {
        setError('Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id, isNew]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (!form.template_code || !form.title || !form.age_band) {
        setError('Template code, title, and age band are required');
        setSaving(false);
        return;
      }

      const url = isNew ? '/api/admin/templates' : `/api/admin/templates/${id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess(isNew ? 'Template created!' : 'Template saved!');
      if (isNew && data.template?.id) {
        router.replace(`/admin/templates/${data.template.id}`);
      }
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      skill_dimensions: prev.skill_dimensions.includes(skill)
        ? prev.skill_dimensions.filter(s => s !== skill)
        : [...prev.skill_dimensions, skill],
    }));
  };

  // Activity flow helpers
  const addActivity = () => {
    setForm(prev => ({
      ...prev,
      activity_flow: [...prev.activity_flow, { time: '', activity: '', purpose: '' }],
    }));
  };

  const updateActivity = (index: number, field: keyof ActivityStep, value: string) => {
    setForm(prev => ({
      ...prev,
      activity_flow: prev.activity_flow.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  };

  const removeActivity = (index: number) => {
    setForm(prev => ({
      ...prev,
      activity_flow: prev.activity_flow.filter((_, i) => i !== index),
    }));
  };

  // Tag input helpers
  const addPrereq = () => {
    const val = prereqInput.trim().toUpperCase();
    if (val && !form.prerequisites.includes(val)) {
      updateField('prerequisites', [...form.prerequisites, val]);
    }
    setPrereqInput('');
  };

  const removePrereq = (p: string) => {
    updateField('prerequisites', form.prerequisites.filter(x => x !== p));
  };

  const addMaterial = () => {
    const val = materialInput.trim();
    if (val && !form.materials_needed.includes(val)) {
      updateField('materials_needed', [...form.materials_needed, val]);
    }
    setMaterialInput('');
  };

  const removeMaterial = (m: string) => {
    updateField('materials_needed', form.materials_needed.filter(x => x !== m));
  };

  // Content picker helpers
  const openContentPicker = (stepIndex: number) => {
    setPickerStepIndex(stepIndex);
    setPickerQuery('');
    setPickerSkill('');
    setPickerResults([]);
    setPickerOpen(true);
  };

  const searchContent = async () => {
    setPickerLoading(true);
    try {
      const params = new URLSearchParams();
      if (pickerQuery) params.set('q', pickerQuery);
      if (pickerSkill) params.set('skill', pickerSkill);
      if (form.age_band) params.set('age_band', form.age_band);
      params.set('limit', '20');

      const res = await fetch(`/api/admin/content-search?${params}`);
      const data = await res.json();
      setPickerResults(data.units || []);
    } catch {
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const addContentRef = (ref: ContentRef) => {
    setForm(prev => ({
      ...prev,
      activity_flow: prev.activity_flow.map((a, i) => {
        if (i !== pickerStepIndex) return a;
        const existing = a.content_refs || [];
        if (existing.some(r => r.id === ref.id)) return a;
        return { ...a, content_refs: [...existing, ref] };
      }),
    }));
  };

  const removeContentRef = (stepIndex: number, refId: string) => {
    setForm(prev => ({
      ...prev,
      activity_flow: prev.activity_flow.map((a, i) => {
        if (i !== stepIndex) return a;
        return { ...a, content_refs: (a.content_refs || []).filter(r => r.id !== refId) };
      }),
    }));
  };

  const contentIcon = (type: ContentRef['type']) => {
    switch (type) {
      case 'video': return <Film className="w-3 h-3" />;
      case 'game': return <Gamepad2 className="w-3 h-3" />;
      case 'worksheet': return <FileText className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-0 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-surface-0 min-h-screen">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/templates')}
                className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-tertiary" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-primary" />
                  {isNew ? 'New Template' : `Edit ${form.template_code}`}
                </h1>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
        {/* Error / Success */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Core Fields */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Core Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Template Code</label>
              <input
                type="text"
                value={form.template_code}
                onChange={e => updateField('template_code', e.target.value.toUpperCase())}
                placeholder="e.g. F01"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Age Band</label>
              <select
                value={form.age_band}
                onChange={e => updateField('age_band', e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="foundation">Foundation (4-6)</option>
                <option value="building">Building (7-9)</option>
                <option value="mastery">Mastery (10-12)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-tertiary mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="Session title"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-tertiary mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
              />
            </div>
          </div>
        </section>

        {/* Session Parameters */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Session Parameters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Duration (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => updateField('duration_minutes', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Difficulty (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.difficulty_level}
                onChange={e => updateField('difficulty_level', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Order</label>
              <input
                type="number"
                min={1}
                value={form.recommended_order}
                onChange={e => updateField('recommended_order', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="flex flex-col gap-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_diagnostic}
                  onChange={e => updateField('is_diagnostic', e.target.checked)}
                  className="rounded border-border bg-surface-2"
                />
                Diagnostic
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_season_finale}
                  onChange={e => updateField('is_season_finale', e.target.checked)}
                  className="rounded border-border bg-surface-2"
                />
                Season Finale
              </label>
            </div>
          </div>
        </section>

        {/* Skill Dimensions */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Skill Dimensions</h2>
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map(skill => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  form.skill_dimensions.includes(skill)
                    ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/30'
                    : 'bg-surface-2 text-text-tertiary border-border hover:text-white'
                }`}
              >
                {skill.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </section>

        {/* Prerequisites */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Prerequisites</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={prereqInput}
              onChange={e => setPrereqInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPrereq())}
              placeholder="e.g. F01"
              className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <button
              onClick={addPrereq}
              className="px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-tertiary hover:text-white text-sm transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.prerequisites.map(p => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-surface-2 border border-border rounded-full text-white"
              >
                {p}
                <button onClick={() => removePrereq(p)} className="text-text-tertiary hover:text-red-400">&times;</button>
              </span>
            ))}
            {form.prerequisites.length === 0 && (
              <span className="text-xs text-text-tertiary">No prerequisites</span>
            )}
          </div>
        </section>

        {/* Materials Needed */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Materials Needed</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={materialInput}
              onChange={e => setMaterialInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMaterial())}
              placeholder="e.g. Flashcards, Whiteboard"
              className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <button
              onClick={addMaterial}
              className="px-3 py-2 bg-surface-2 border border-border rounded-lg text-text-tertiary hover:text-white text-sm transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.materials_needed.map(m => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-surface-2 border border-border rounded-full text-white"
              >
                {m}
                <button onClick={() => removeMaterial(m)} className="text-text-tertiary hover:text-red-400">&times;</button>
              </span>
            ))}
            {form.materials_needed.length === 0 && (
              <span className="text-xs text-text-tertiary">No materials specified</span>
            )}
          </div>
        </section>

        {/* Activity Flow (JSONB Editor) */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Activity Flow</h2>
            <button
              onClick={addActivity}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-text-tertiary hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Step
            </button>
          </div>

          {form.activity_flow.length === 0 ? (
            <p className="text-text-tertiary text-sm text-center py-6">
              No activity steps yet. Click &quot;Add Step&quot; to begin.
            </p>
          ) : (
            <div className="space-y-0">
              {/* Table Header */}
              <div className="grid grid-cols-[80px_1fr_1fr_40px_40px] gap-2 pb-2 border-b border-border mb-2">
                <span className="text-xs text-text-tertiary font-medium">Time</span>
                <span className="text-xs text-text-tertiary font-medium">Activity</span>
                <span className="text-xs text-text-tertiary font-medium">Purpose</span>
                <span></span>
                <span></span>
              </div>
              {form.activity_flow.map((step, i) => (
                <div key={i} className="py-1">
                  <div className="grid grid-cols-[80px_1fr_1fr_40px_40px] gap-2 items-start">
                    <input
                      type="text"
                      value={step.time}
                      onChange={e => updateActivity(i, 'time', e.target.value)}
                      placeholder="0-5"
                      className="px-2 py-1.5 bg-surface-2 border border-border rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <input
                      type="text"
                      value={step.activity}
                      onChange={e => updateActivity(i, 'activity', e.target.value)}
                      placeholder="Activity description"
                      className="px-2 py-1.5 bg-surface-2 border border-border rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <input
                      type="text"
                      value={step.purpose}
                      onChange={e => updateActivity(i, 'purpose', e.target.value)}
                      placeholder="Purpose"
                      className="px-2 py-1.5 bg-surface-2 border border-border rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <button
                      onClick={() => openContentPicker(i)}
                      title="Link content"
                      className="p-1.5 rounded hover:bg-brand-primary/20 text-text-tertiary hover:text-brand-primary transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeActivity(i)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Content refs chips */}
                  {step.content_refs && step.content_refs.length > 0 && (
                    <div className="ml-[88px] mt-1 flex flex-wrap gap-1.5">
                      {step.content_refs.map(ref => (
                        <span
                          key={ref.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border ${
                            ref.type === 'video'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : ref.type === 'game'
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {contentIcon(ref.type)}
                          {ref.label}
                          <button
                            onClick={() => removeContentRef(i, ref.id)}
                            className="ml-0.5 hover:text-red-400"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Coach Notes + Parent Involvement */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-5">
          <h2 className="text-white font-semibold mb-4">Additional Notes</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Coach Prep Notes</label>
              <textarea
                value={form.coach_prep_notes}
                onChange={e => updateField('coach_prep_notes', e.target.value)}
                rows={3}
                placeholder="Notes for the coach to prepare for this session..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Parent Involvement</label>
              <textarea
                value={form.parent_involvement}
                onChange={e => updateField('parent_involvement', e.target.value)}
                rows={2}
                placeholder="Expected parent role or involvement..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
              />
            </div>
          </div>
        </section>

        {/* Status */}
        <section className="bg-surface-1 border border-border rounded-lg p-5 mb-8">
          <h2 className="text-white font-semibold mb-4">Status</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => updateField('is_active', e.target.checked)}
              className="rounded border-border bg-surface-2 w-5 h-5"
            />
            <span className="text-white text-sm">Active</span>
            <span className="text-text-tertiary text-xs">(inactive templates are hidden from coaches)</span>
          </label>
        </section>
      </div>

      {/* Content Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 border border-border rounded-xl w-full max-w-2xl max-h-[75vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-white font-semibold text-sm">Link Content</h3>
                <p className="text-text-tertiary text-xs mt-0.5">
                  Step {pickerStepIndex + 1}: {form.activity_flow[pickerStepIndex]?.activity || 'Activity'}
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-tertiary hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search bar */}
            <div className="p-4 border-b border-border">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                  <input
                    type="text"
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchContent()}
                    placeholder="Search learning units..."
                    className="w-full pl-8 pr-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    autoFocus
                  />
                </div>
                <button
                  onClick={searchContent}
                  disabled={pickerLoading}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {pickerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>
              <p className="text-[10px] text-text-tertiary mt-2">
                Filtering by age band: <span className="text-white">{form.age_band}</span>
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pickerResults.length === 0 && !pickerLoading && (
                <p className="text-text-tertiary text-sm text-center py-8">
                  Search for learning units to find content to link.
                </p>
              )}
              {pickerResults.map((unit: any) => (
                <div key={unit.id} className="bg-surface-2 border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-white text-sm font-medium">
                        {unit.icon_emoji && `${unit.icon_emoji} `}{unit.name}
                      </span>
                      {unit.content_code && (
                        <span className="ml-2 text-[10px] text-text-tertiary bg-surface-0 px-1.5 py-0.5 rounded">
                          {unit.content_code}
                        </span>
                      )}
                      {unit.skill && (
                        <span className="ml-2 text-[10px] text-brand-primary">
                          {(unit.skill as any)?.name || (Array.isArray(unit.skill) ? (unit.skill as any)[0]?.name : '')}
                        </span>
                      )}
                    </div>
                  </div>
                  {unit.description && (
                    <p className="text-text-tertiary text-xs mb-2 line-clamp-2">{unit.description}</p>
                  )}

                  {/* Videos */}
                  {unit.videos?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Videos</span>
                      <div className="mt-1 space-y-1">
                        {unit.videos.map((v: any) => {
                          const alreadyAdded = form.activity_flow[pickerStepIndex]?.content_refs?.some(r => r.id === v.id);
                          return (
                            <button
                              key={v.id}
                              disabled={alreadyAdded}
                              onClick={() => addContentRef({ type: 'video', id: v.id, label: v.title })}
                              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                alreadyAdded
                                  ? 'bg-blue-500/10 text-blue-400 cursor-default'
                                  : 'hover:bg-surface-0 text-white'
                              }`}
                            >
                              <Film className="w-3 h-3 text-blue-400 shrink-0" />
                              <span className="truncate">{v.title}</span>
                              {v.duration_seconds && (
                                <span className="text-text-tertiary ml-auto shrink-0">
                                  {Math.round(v.duration_seconds / 60)}m
                                </span>
                              )}
                              {alreadyAdded && <span className="text-[10px] ml-1 shrink-0">Added</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Games */}
                  {unit.games?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Games</span>
                      <div className="mt-1 space-y-1">
                        {unit.games.map((g: any) => {
                          const alreadyAdded = form.activity_flow[pickerStepIndex]?.content_refs?.some(r => r.id === g.id);
                          return (
                            <button
                              key={g.id}
                              disabled={alreadyAdded}
                              onClick={() => addContentRef({ type: 'game', id: g.id, label: g.title })}
                              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                alreadyAdded
                                  ? 'bg-purple-500/10 text-purple-400 cursor-default'
                                  : 'hover:bg-surface-0 text-white'
                              }`}
                            >
                              <Gamepad2 className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{g.title}</span>
                              {alreadyAdded && <span className="text-[10px] ml-auto shrink-0">Added</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Worksheets */}
                  {unit.worksheets?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Worksheets</span>
                      <div className="mt-1 space-y-1">
                        {unit.worksheets.map((w: any) => {
                          const alreadyAdded = form.activity_flow[pickerStepIndex]?.content_refs?.some(r => r.id === w.id);
                          return (
                            <button
                              key={w.id}
                              disabled={alreadyAdded}
                              onClick={() => addContentRef({ type: 'worksheet', id: w.id, label: w.title })}
                              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                alreadyAdded
                                  ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                  : 'hover:bg-surface-0 text-white'
                              }`}
                            >
                              <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{w.title}</span>
                              {w.asset_format && (
                                <span className="text-text-tertiary ml-auto shrink-0 uppercase">{w.asset_format}</span>
                              )}
                              {alreadyAdded && <span className="text-[10px] ml-1 shrink-0">Added</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No content available */}
                  {(!unit.videos?.length && !unit.games?.length && !unit.worksheets?.length) && (
                    <p className="text-text-tertiary text-[10px] mt-1 italic">No linked content assets</p>
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="p-3 border-t border-border flex justify-end">
              <button
                onClick={() => setPickerOpen(false)}
                className="px-4 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm hover:bg-surface-0 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
