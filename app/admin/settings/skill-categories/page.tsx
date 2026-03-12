// =============================================================================
// FILE: app/admin/settings/skill-categories/page.tsx
// PURPOSE: Admin page for managing skill categories (taxonomy)
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen, Save, RefreshCw, CheckCircle, AlertCircle,
  GripVertical, Eye, EyeOff, ArrowLeft,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { SkillCategoryChip } from '@/components/shared/SkillCategoryChip';
import { PageHeader } from '@/components/shared/PageHeader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  slug: string;
  label: string;
  parent_label: string | null;
  label_hindi: string | null;
  icon: string;
  color: string;
  sort_order: number;
  scope: string;
  is_active: boolean;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // saving category id
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CategoryRow>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/skill-categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(id: string) {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/skill-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Save failed');
        return;
      }
      const data = await res.json();
      setCategories(prev =>
        prev.map(c => (c.id === id ? data.category : c))
      );
      setEditingId(null);
      setEditForm({});
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(cat: CategoryRow) {
    setSaving(cat.id);
    try {
      const res = await fetch('/api/admin/skill-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(prev =>
          prev.map(c => (c.id === cat.id ? data.category : c))
        );
      }
    } catch {
      setError('Toggle failed');
    } finally {
      setSaving(null);
    }
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditForm({
      label: cat.label,
      parent_label: cat.parent_label,
      label_hindi: cat.label_hindi,
      icon: cat.icon,
      color: cat.color,
      scope: cat.scope,
      sort_order: cat.sort_order,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner color="muted" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <PageHeader
        title="Skill Categories"
        subtitle="Manage the unified skill taxonomy used across coach sessions, parent goals, and e-learning."
        backHref="/admin/settings"
        action={
          <button
            onClick={fetchCategories}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
        }
      />

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Scope</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Preview</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Active</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const isEditing = editingId === cat.id;
              return (
                <tr
                  key={cat.id}
                  className={`border-b border-gray-100 dark:border-gray-800 ${!cat.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Sort order */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.sort_order ?? cat.sort_order}
                        onChange={e => setEditForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                        className="w-12 px-2 py-1 border rounded text-center dark:bg-gray-800 dark:border-gray-600"
                      />
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        {cat.sort_order}
                      </span>
                    )}
                  </td>

                  {/* Label */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editForm.label ?? cat.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                          placeholder="Coach/Admin label"
                        />
                        <input
                          type="text"
                          value={editForm.parent_label ?? cat.parent_label ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, parent_label: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                          placeholder="Parent label"
                        />
                        <input
                          type="text"
                          value={editForm.label_hindi ?? cat.label_hindi ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, label_hindi: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                          placeholder="Label (Hindi)"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{cat.label}</span>
                        {cat.parent_label && cat.parent_label !== cat.label && (
                          <span className="block text-xs text-gray-400">Parent: {cat.parent_label}</span>
                        )}
                        {cat.label_hindi && (
                          <span className="block text-xs text-gray-400">{cat.label_hindi}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Slug */}
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      {cat.slug}
                    </code>
                  </td>

                  {/* Scope */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editForm.scope ?? cat.scope}
                        onChange={e => setEditForm(f => ({ ...f, scope: e.target.value }))}
                        className="px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                      >
                        <option value="both">Both</option>
                        <option value="coach">Coach</option>
                        <option value="parent">Parent</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        cat.scope === 'both' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        cat.scope === 'coach' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                      }`}>
                        {cat.scope}
                      </span>
                    )}
                  </td>

                  {/* Preview */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 w-10">Coach:</span>
                        <SkillCategoryChip
                          slug={cat.slug}
                          label={isEditing ? (editForm.label ?? cat.label) : cat.label}
                          color={isEditing ? (editForm.color ?? cat.color) : cat.color}
                          size="xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 w-10">Parent:</span>
                        <SkillCategoryChip
                          slug={cat.slug}
                          label={isEditing ? (editForm.parent_label ?? cat.parent_label ?? editForm.label ?? cat.label) : (cat.parent_label ?? cat.label)}
                          color={isEditing ? (editForm.color ?? cat.color) : cat.color}
                          size="xs"
                        />
                      </div>
                    </div>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(cat)}
                      disabled={saving === cat.id}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {cat.is_active ? (
                        <Eye className="w-4 h-4 text-green-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(null); setEditForm({}); }}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(cat.id)}
                          disabled={saving === cat.id}
                          className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving === cat.id ? (
                            <Spinner size="sm" className="w-3 h-3" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {saved === cat.id && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <button
                          onClick={() => startEdit(cat)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 px-2 py-1"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 mt-4">
        Slugs are immutable — changing them would break learning_events JSONB references.
        To rename, update the label only.
      </p>
    </div>
  );
}
