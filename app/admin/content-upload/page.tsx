// ============================================================
// FILE: app/admin/content-upload/page.tsx
// PURPOSE: Admin content warehouse — CSV upload, single item, library browser
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Upload, FileText, Library, Download, CheckCircle2, XCircle,
  Loader2, Plus, Search, ChevronLeft, ChevronRight, Film,
  Gamepad2, Headphones, BookOpen, Monitor, FileCheck,
  Trash2, Edit, Eye, EyeOff, X, AlertCircle,
} from 'lucide-react';

// ==================== TYPES ====================

interface Skill {
  id: string;
  name: string;
  skill_tag: string | null;
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  description: string | null;
  asset_url: string | null;
  asset_format: string | null;
  yrl_level: string | null;
  arc_stage: string | null;
  difficulty_level: string | null;
  coach_guidance: string | null;
  parent_instruction: string | null;
  child_label: string | null;
  duration_seconds: number | null;
  metadata: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  skills: {
    skill_id: string;
    skill_name: string | null;
    skill_tag: string | null;
    sub_skill_tag: string | null;
    is_primary: boolean;
  }[];
}

interface ParsedRow {
  title: string;
  content_type: string;
  description?: string;
  asset_url?: string;
  yrl_level?: string;
  arc_stage?: string;
  difficulty_level?: string;
  skill_tags?: string;
  sub_skill_tags?: string;
  coach_guidance?: string;
  parent_instruction?: string;
  child_label?: string;
  duration_seconds?: string;
  asset_format?: string;
  _valid?: boolean;
  _errors?: string[];
}

// ==================== CONSTANTS ====================

const CONTENT_TYPES = ['video', 'worksheet', 'game', 'audio', 'interactive', 'parent_guide'];
const ARC_STAGES = ['assess', 'remediate', 'celebrate'];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const YRL_LEVELS = ['F1', 'F2', 'F3', 'F4', 'B1', 'B2', 'B3', 'B4', 'M1', 'M2', 'M3', 'M4'];

const TYPE_BADGES: Record<string, { color: string; icon: typeof Film }> = {
  video: { color: 'bg-blue-500/20 text-blue-400', icon: Film },
  worksheet: { color: 'bg-green-500/20 text-green-400', icon: FileText },
  game: { color: 'bg-purple-500/20 text-purple-400', icon: Gamepad2 },
  audio: { color: 'bg-orange-500/20 text-orange-400', icon: Headphones },
  interactive: { color: 'bg-teal-500/20 text-teal-400', icon: Monitor },
  parent_guide: { color: 'bg-pink-500/20 text-pink-400', icon: BookOpen },
};

type TabType = 'csv' | 'single' | 'library';

// ==================== COMPONENT ====================

export default function ContentUploadPage() {
  const [activeTab, setActiveTab] = useState<TabType>('csv');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  useEffect(() => {
    fetchSkills();
  }, []);

  async function fetchSkills() {
    try {
      const res = await fetch('/api/admin/content-library?limit=1');
      // Skills loaded from a dedicated fetch
      const skillRes = await fetch('/api/admin/content-search?limit=1');
      // Actually, let's just load skills directly
    } catch {}

    // Fetch skills from supabase directly via the content library endpoint
    // We'll use a simple approach: fetch from the API
    try {
      // Use the supabase client directly since we're client-side
      const { supabase } = await import('@/lib/supabase/client');
      const { data } = await supabase
        .from('el_skills')
        .select('id, name, skill_tag')
        .order('name');
      setSkills(data || []);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setSkillsLoading(false);
    }
  }

  const tabs: { key: TabType; label: string; icon: typeof Upload }[] = [
    { key: 'csv', label: 'CSV Upload', icon: Upload },
    { key: 'single', label: 'Single Item', icon: Plus },
    { key: 'library', label: 'Content Library', icon: Library },
  ];

  return (
    <div className="min-h-screen bg-surface-0 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Warehouse</h1>
        <p className="text-text-tertiary text-sm mt-1">Upload, manage, and browse learning content</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-text-tertiary hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'csv' && <CsvUploadTab skills={skills} />}
      {activeTab === 'single' && <SingleItemTab skills={skills} />}
      {activeTab === 'library' && <ContentLibraryTab skills={skills} />}
    </div>
  );
}

// ==================== CSV UPLOAD TAB ====================

function CsvUploadTab({ skills }: { skills: Skill[] }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const skillSet = new Set(skills.map(s => s.name.toLowerCase()));
  const skillTagSet = new Set(skills.filter(s => s.skill_tag).map(s => s.skill_tag!.toLowerCase()));

  function validateRow(row: ParsedRow): ParsedRow {
    const errors: string[] = [];

    if (!row.title?.trim()) errors.push('Title is required');
    if (!row.content_type?.trim()) {
      errors.push('Content type is required');
    } else if (!CONTENT_TYPES.includes(row.content_type.trim().toLowerCase())) {
      errors.push(`Invalid content type: ${row.content_type}`);
    }
    if (row.yrl_level?.trim() && !YRL_LEVELS.includes(row.yrl_level.trim())) {
      errors.push(`Invalid YRL level: ${row.yrl_level}`);
    }
    if (row.arc_stage?.trim() && !ARC_STAGES.includes(row.arc_stage.trim().toLowerCase())) {
      errors.push(`Invalid arc stage: ${row.arc_stage}`);
    }
    if (row.difficulty_level?.trim() && !DIFFICULTY_LEVELS.includes(row.difficulty_level.trim().toLowerCase())) {
      errors.push(`Invalid difficulty: ${row.difficulty_level}`);
    }

    // Check skill tags
    const tags = row.skill_tags?.split('|').map(s => s.trim()).filter(Boolean) || [];
    for (const tag of tags) {
      if (!skillSet.has(tag.toLowerCase()) && !skillTagSet.has(tag.toLowerCase())) {
        errors.push(`Unknown skill: "${tag}"`);
      }
    }

    return { ...row, _valid: errors.length === 0, _errors: errors };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as ParsedRow[]).map(validateRow);
        setRows(parsed);
        setUploadResult(null);
      },
    });
  }

  async function handleUpload() {
    const validRows = rows.filter(r => r._valid);
    if (validRows.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    try {
      // Strip validation fields before sending
      const cleanRows = validRows.map(({ _valid, _errors, ...rest }) => rest);

      const res = await fetch('/api/admin/content-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cleanRows }),
      });

      const data = await res.json();
      setUploadResult(data);
      setProgress(100);

      if (data.success > 0) {
        // Clear rows on success
        setTimeout(() => {
          setRows([]);
          if (fileRef.current) fileRef.current.value = '';
        }, 3000);
      }
    } catch (err: any) {
      setUploadResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function downloadTemplate() {
    try {
      const res = await fetch('/api/admin/content-upload/template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'content-upload-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download failed:', err);
    }
  }

  const validCount = rows.filter(r => r._valid).length;
  const invalidCount = rows.filter(r => !r._valid).length;

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-1 border border-border rounded-xl text-text-secondary hover:text-white hover:bg-surface-2 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>

        <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/30 transition-colors text-sm cursor-pointer">
          <Upload className="w-4 h-4" />
          Choose CSV File
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-tertiary">{rows.length} rows parsed</span>
            {validCount > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" /> {validCount} valid
              </span>
            )}
            {invalidCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-4 h-4" /> {invalidCount} invalid
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-1 border-b border-border">
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-10">#</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-8">OK</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Title</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Type</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Level</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Skills</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 ${!row._valid ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2 text-text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      {row._valid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-white max-w-[200px] truncate">{row.title}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.content_type}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.yrl_level || '—'}</td>
                    <td className="px-3 py-2 text-text-secondary max-w-[150px] truncate">{row.skill_tags || '—'}</td>
                    <td className="px-3 py-2 text-red-400 text-xs max-w-[200px]">
                      {row._errors?.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleUpload}
              disabled={validCount === 0 || uploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload {validCount} Item{validCount !== 1 ? 's' : ''}
            </button>

            {uploading && (
              <div className="flex-1 max-w-xs">
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className={`p-4 rounded-xl border ${
          uploadResult.error
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {uploadResult.error ? (
            <p>{uploadResult.error}</p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">
                Upload complete: {uploadResult.success} created, {uploadResult.failed} failed
              </p>
              {uploadResult.errors?.length > 0 && (
                <ul className="text-sm text-red-400 space-y-1">
                  {uploadResult.errors.map((err: any, i: number) => (
                    <li key={i}>Row {err.row}: {err.error} ({err.field})</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== SINGLE ITEM TAB ====================

function SingleItemTab({ skills }: { skills: Skill[] }) {
  const [form, setForm] = useState({
    title: '',
    content_type: '',
    description: '',
    asset_url: '',
    yrl_level: '',
    arc_stage: '',
    difficulty_level: '',
    coach_guidance: '',
    parent_instruction: '',
    child_label: '',
    duration_seconds: '',
    asset_format: '',
  });
  const [selectedSkills, setSelectedSkills] = useState<{ id: string; name: string; subSkill: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleSkill(skill: Skill) {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.id === skill.id);
      if (exists) {
        return prev.filter(s => s.id !== skill.id);
      }
      return [...prev, { id: skill.id, name: skill.name, subSkill: '' }];
    });
  }

  function updateSubSkill(skillId: string, subSkill: string) {
    setSelectedSkills(prev =>
      prev.map(s => s.id === skillId ? { ...s, subSkill } : s)
    );
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content_type) return;

    setSaving(true);
    setResult(null);

    try {
      const item: any = { ...form };
      // Build skill_tags and sub_skill_tags pipe-delimited
      item.skill_tags = selectedSkills.map(s => s.name).join('|');
      item.sub_skill_tags = selectedSkills.map(s => s.subSkill).join('|');

      const res = await fetch('/api/admin/content-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item] }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success > 0) {
        // Clear form
        setForm({
          title: '', content_type: '', description: '', asset_url: '',
          yrl_level: '', arc_stage: '', difficulty_level: '', coach_guidance: '',
          parent_instruction: '', child_label: '', duration_seconds: '', asset_format: '',
        });
        setSelectedSkills([]);
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Title *</label>
        <input
          value={form.title}
          onChange={e => updateField('title', e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g., Phonics: CVC Words"
        />
      </div>

      {/* Content Type + YRL Level */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Content Type *</label>
          <select
            value={form.content_type}
            onChange={e => updateField('content_type', e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select type</option>
            {CONTENT_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">YRL Level</label>
          <select
            value={form.yrl_level}
            onChange={e => updateField('yrl_level', e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select level</option>
            {YRL_LEVELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Brief description of this content"
        />
      </div>

      {/* Asset URL */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Asset URL</label>
        <input
          value={form.asset_url}
          onChange={e => updateField('asset_url', e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="youtube:ID, storage:path, engine:name, or full URL"
        />
        <p className="text-xs text-text-muted mt-1">Prefixes: youtube:ID, storage:path, engine:name</p>
      </div>

      {/* Arc Stage + Difficulty + Asset Format */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Arc Stage</label>
          <select
            value={form.arc_stage}
            onChange={e => updateField('arc_stage', e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select stage</option>
            {ARC_STAGES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Difficulty</label>
          <select
            value={form.difficulty_level}
            onChange={e => updateField('difficulty_level', e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select difficulty</option>
            {DIFFICULTY_LEVELS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Asset Format</label>
          <input
            value={form.asset_format}
            onChange={e => updateField('asset_format', e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., pdf, mp4"
          />
        </div>
      </div>

      {/* Duration */}
      <div className="w-1/3">
        <label className="block text-sm text-text-secondary mb-1">Duration (seconds)</label>
        <input
          type="number"
          value={form.duration_seconds}
          onChange={e => updateField('duration_seconds', e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="180"
        />
      </div>

      {/* Coach Guidance */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Coach Guidance</label>
        <textarea
          value={form.coach_guidance}
          onChange={e => updateField('coach_guidance', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Notes for the coach on how to use this content"
        />
      </div>

      {/* Parent Instruction */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Parent Instruction</label>
        <textarea
          value={form.parent_instruction}
          onChange={e => updateField('parent_instruction', e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Instructions for parents on home practice"
        />
      </div>

      {/* Child Label */}
      <div>
        <label className="block text-sm text-text-secondary mb-1">Child Label</label>
        <input
          value={form.child_label}
          onChange={e => updateField('child_label', e.target.value)}
          className="w-full px-3 py-2.5 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Child-friendly name for this activity"
        />
      </div>

      {/* Skills Selector */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">Skills</label>
        <div className="flex flex-wrap gap-2">
          {skills.map(skill => {
            const isSelected = selectedSkills.some(s => s.id === skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-surface-1 text-text-secondary border border-border hover:bg-surface-2'
                }`}
              >
                {skill.name}
              </button>
            );
          })}
        </div>

        {/* Sub-skill inputs for selected skills */}
        {selectedSkills.length > 0 && (
          <div className="mt-3 space-y-2">
            {selectedSkills.map((sel, i) => (
              <div key={sel.id} className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-32 truncate">
                  {i === 0 && <span className="text-blue-400 mr-1">(primary)</span>}
                  {sel.name}:
                </span>
                <input
                  value={sel.subSkill}
                  onChange={e => updateSubSkill(sel.id, e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-surface-1 border border-border rounded-lg text-white text-xs placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Sub-skill tag (optional)"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!form.title.trim() || !form.content_type || saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Save Content Item
      </button>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl border ${
          result.error || result.failed > 0
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {result.error ? (
            <p>{result.error}</p>
          ) : result.success > 0 ? (
            <p>Content item created successfully!</p>
          ) : (
            <div>
              <p>Failed to create item</p>
              {result.errors?.map((err: any, i: number) => (
                <p key={i} className="text-sm">{err.field}: {err.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== CONTENT LIBRARY TAB ====================

function ContentLibraryTab({ skills }: { skills: Skill[] }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterActive, setFilterActive] = useState('true');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (filterType) params.set('type', filterType);
      if (filterLevel) params.set('yrl_level', filterLevel);
      if (filterStage) params.set('arc_stage', filterStage);
      if (filterSkill) params.set('skill_id', filterSkill);
      if (filterActive) params.set('is_active', filterActive);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/content-library?${params.toString()}`);
      const data = await res.json();

      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      console.error('Fetch content error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterLevel, filterStage, filterSkill, filterActive, searchQuery]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterType, filterLevel, filterStage, filterSkill, filterActive, searchQuery]);

  async function toggleActive(item: ContentItem) {
    try {
      const res = await fetch(`/api/admin/content-library/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      if (res.ok) {
        fetchContent();
      }
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  }

  async function deleteItem(item: ContentItem) {
    if (!confirm(`Deactivate "${item.title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/content-library/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchContent();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  function openEdit(item: ContentItem) {
    setEditItem(item);
    setEditForm({
      title: item.title,
      content_type: item.content_type,
      description: item.description || '',
      asset_url: item.asset_url || '',
      yrl_level: item.yrl_level || '',
      arc_stage: item.arc_stage || '',
      difficulty_level: item.difficulty_level || '',
      coach_guidance: item.coach_guidance || '',
      parent_instruction: item.parent_instruction || '',
      child_label: item.child_label || '',
      duration_seconds: item.duration_seconds || '',
      asset_format: item.asset_format || '',
    });
  }

  async function saveEdit() {
    if (!editItem) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/content-library/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditItem(null);
        fetchContent();
      }
    } catch (err) {
      console.error('Save edit error:', err);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Search content..."
          />
        </div>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>

        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="px-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Levels</option>
          {YRL_LEVELS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value)}
          className="px-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Stages</option>
          {ARC_STAGES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filterSkill}
          onChange={e => setFilterSkill(e.target.value)}
          className="px-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Skills</option>
          {skills.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="px-3 py-2 bg-surface-1 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Stats */}
      <div className="text-sm text-text-tertiary">
        {total} item{total !== 1 ? 's' : ''} found
        {loading && <Loader2 className="w-4 h-4 animate-spin inline ml-2" />}
      </div>

      {/* Content Cards */}
      <div className="space-y-3">
        {items.map(item => {
          const badge = TYPE_BADGES[item.content_type] || { color: 'bg-surface-2 text-text-secondary', icon: FileCheck };
          const BadgeIcon = badge.icon;

          return (
            <div
              key={item.id}
              className={`p-4 bg-surface-1 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 ${
                !item.is_active ? 'opacity-50' : ''
              }`}
            >
              {/* Type Badge */}
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium w-fit ${badge.color}`}>
                <BadgeIcon className="w-3.5 h-3.5" />
                {item.content_type.replace('_', ' ')}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                  {item.yrl_level && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-2 text-text-muted rounded font-mono">
                      {item.yrl_level}
                    </span>
                  )}
                  {!item.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                      inactive
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-text-muted mt-0.5 truncate max-w-lg">{item.description}</p>
                )}
                {/* Skill chips */}
                {item.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.skills.map((skill, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          skill.is_primary
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-surface-2 text-text-muted'
                        }`}
                      >
                        {skill.skill_name || skill.skill_id}
                        {skill.sub_skill_tag && ` / ${skill.sub_skill_tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 sm:flex-shrink-0">
                <button
                  onClick={() => openEdit(item)}
                  className="p-2 text-text-muted hover:text-white hover:bg-surface-2 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(item)}
                  className="p-2 text-text-muted hover:text-white hover:bg-surface-2 rounded-lg transition-colors"
                  title={item.is_active ? 'Deactivate' : 'Activate'}
                >
                  {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteItem(item)}
                  className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <Library className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-tertiary">No content items found</p>
            <p className="text-text-muted text-sm mt-1">Upload content via CSV or add a single item</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 bg-surface-1 border border-border rounded-lg text-text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-text-secondary px-4">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 bg-surface-1 border border-border rounded-lg text-text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Edit Content</h2>
              <button
                onClick={() => setEditItem(null)}
                className="p-1 hover:bg-surface-2 rounded-lg"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Title</label>
                <input
                  value={editForm.title || ''}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Description</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">YRL Level</label>
                  <select
                    value={editForm.yrl_level || ''}
                    onChange={e => setEditForm(f => ({ ...f, yrl_level: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {YRL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty_level || ''}
                    onChange={e => setEditForm(f => ({ ...f, difficulty_level: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Coach Guidance</label>
                <textarea
                  value={editForm.coach_guidance || ''}
                  onChange={e => setEditForm(f => ({ ...f, coach_guidance: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Parent Instruction</label>
                <textarea
                  value={editForm.parent_instruction || ''}
                  onChange={e => setEditForm(f => ({ ...f, parent_instruction: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-0 border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  Save Changes
                </button>
                <button
                  onClick={() => setEditItem(null)}
                  className="px-4 py-2 bg-surface-2 text-text-secondary rounded-xl text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
