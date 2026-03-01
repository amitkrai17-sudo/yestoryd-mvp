// =============================================================================
// FILE: app/admin/group-classes/blueprints/BlueprintListClient.tsx
// PURPOSE: Admin UI for listing, filtering, and managing group class blueprints
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Loader2, Clock, Layers,
  Archive, Copy, Edit, Filter,
} from 'lucide-react';
import type { AgeBand, BlueprintStatus } from '@/types/group-classes';

// =============================================================================
// TYPES
// =============================================================================
interface ClassType {
  id: string;
  slug: string;
  name: string;
  icon_emoji: string;
  color_hex: string;
}

interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  class_type_id: string;
  age_band: AgeBand;
  segments: { index: number; name: string; type: string; duration_minutes: number }[];
  total_duration_minutes: number | null;
  status: BlueprintStatus;
  times_used: number | null;
  created_at: string | null;
  class_type: ClassType | null;
}

// =============================================================================
// HELPERS
// =============================================================================
function getStatusBadge(status: BlueprintStatus): { classes: string; label: string } {
  switch (status) {
    case 'draft':
      return { classes: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', label: 'Draft' };
    case 'published':
      return { classes: 'bg-green-500/20 text-green-400 border border-green-500/30', label: 'Published' };
    case 'archived':
      return { classes: 'bg-gray-500/20 text-gray-400 border border-gray-500/30', label: 'Archived' };
  }
}

function getAgeBadge(ageBand: AgeBand): string {
  return `${ageBand} yrs`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function BlueprintListClient() {
  const router = useRouter();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassTypeId, setFilterClassTypeId] = useState('');
  const [filterAgeBand, setFilterAgeBand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBlueprints();
    fetchClassTypes();
  }, [filterClassTypeId, filterAgeBand, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBlueprints = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClassTypeId) params.set('class_type_id', filterClassTypeId);
      if (filterAgeBand) params.set('age_band', filterAgeBand);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/group-classes/blueprints?${params}`);
      const data = await res.json();
      setBlueprints(data.blueprints || []);
    } catch (err) {
      console.error('Error fetching blueprints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassTypes = async () => {
    try {
      const res = await fetch('/api/admin/group-classes/options');
      const data = await res.json();
      setClassTypes(data.classTypes || []);
    } catch (err) {
      console.error('Error fetching class types:', err);
    }
  };

  const handleDuplicate = async (blueprint: Blueprint) => {
    setActionLoading(blueprint.id);
    try {
      // GET full blueprint
      const getRes = await fetch(`/api/admin/group-classes/blueprints/${blueprint.id}`);
      const getData = await getRes.json();
      if (!getRes.ok) throw new Error(getData.error);

      const bp = getData.blueprint;
      // POST as new with "Copy of" name and draft status
      const postRes = await fetch('/api/admin/group-classes/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Copy of ${bp.name}`,
          class_type_id: bp.class_type_id,
          age_band: bp.age_band,
          description: bp.description || undefined,
          segments: bp.segments,
          individual_moment_config: bp.individual_moment_config,
          guided_questions: bp.guided_questions || undefined,
          content_refs: bp.content_refs || undefined,
          quiz_refs: bp.quiz_refs || undefined,
          skill_tags: bp.skill_tags || undefined,
          status: 'draft',
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error);

      fetchBlueprints();
    } catch (err) {
      console.error('Error duplicating blueprint:', err);
      alert('Failed to duplicate blueprint');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (blueprint: Blueprint) => {
    if (!window.confirm(`Archive "${blueprint.name}"? It will no longer be available for new sessions.`)) return;

    setActionLoading(blueprint.id);
    try {
      const res = await fetch(`/api/admin/group-classes/blueprints/${blueprint.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      fetchBlueprints();
    } catch (err) {
      console.error('Error archiving blueprint:', err);
      alert('Failed to archive blueprint');
    } finally {
      setActionLoading(null);
    }
  };

  // Client-side search filter
  const filteredBlueprints = blueprints.filter(bp =>
    bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.class_type?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by class type
  const grouped = filteredBlueprints.reduce((acc, bp) => {
    const key = bp.class_type?.id || 'unknown';
    if (!acc[key]) acc[key] = { classType: bp.class_type, blueprints: [] };
    acc[key].blueprints.push(bp);
    return acc;
  }, {} as Record<string, { classType: ClassType | null; blueprints: Blueprint[] }>);

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Blueprints</h1>
              <p className="text-text-tertiary mt-1">Reusable session templates for group classes</p>
            </div>
            <button
              onClick={() => router.push('/admin/group-classes/blueprints/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Blueprint
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search blueprints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              />
            </div>
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-tertiary" />
            <select
              value={filterClassTypeId}
              onChange={(e) => setFilterClassTypeId(e.target.value)}
              className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-white text-sm"
            >
              <option value="">All Types</option>
              {classTypes.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.icon_emoji} {ct.name}</option>
              ))}
            </select>

            <select
              value={filterAgeBand}
              onChange={(e) => setFilterAgeBand(e.target.value)}
              className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-white text-sm"
            >
              <option value="">All Ages</option>
              <option value="4-6">4-6 yrs</option>
              <option value="7-9">7-9 yrs</option>
              <option value="10-12">10-12 yrs</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-white text-sm"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Blueprint Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredBlueprints.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No blueprints found</h3>
            <p className="text-text-tertiary mb-4">Create your first blueprint to get started!</p>
            <button
              onClick={() => router.push('/admin/group-classes/blueprints/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200"
            >
              <Plus className="w-5 h-5" />
              Create Blueprint
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([key, group]) => (
              <div key={key}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{group.classType?.icon_emoji || '📚'}</span>
                  <h2 className="text-lg font-bold text-white">{group.classType?.name || 'Unknown Type'}</h2>
                  <span className="text-sm text-text-tertiary">({group.blueprints.length})</span>
                </div>

                {/* Cards grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.blueprints.map((bp) => {
                    const status = getStatusBadge(bp.status);
                    const isActioning = actionLoading === bp.id;

                    return (
                      <div
                        key={bp.id}
                        className="bg-surface-1 rounded-xl border border-border p-5 transition-colors"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white truncate">{bp.name}</h3>
                            {bp.description && (
                              <p className="text-sm text-text-tertiary mt-1 line-clamp-2">{bp.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.classes}`}>
                            {status.label}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/[0.08] text-gray-400 border border-white/[0.08]">
                            {getAgeBadge(bp.age_band)}
                          </span>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-text-tertiary" />
                            <span>{bp.segments?.length || 0} segments</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                            <span>{bp.total_duration_minutes || 0} min</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-tertiary mb-4">
                          <span>Used {bp.times_used || 0} times</span>
                          {bp.created_at && <span>{formatDate(bp.created_at)}</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                          <button
                            onClick={() => router.push(`/admin/group-classes/blueprints/${bp.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-surface-2 hover:bg-surface-2/80 rounded-lg transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicate(bp)}
                            disabled={isActioning}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary hover:text-white hover:bg-surface-2 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {bp.status !== 'archived' && (
                            <button
                              onClick={() => handleArchive(bp)}
                              disabled={isActioning}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
