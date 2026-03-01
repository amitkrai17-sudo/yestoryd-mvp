'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Search, Loader2, Plus, Filter,
  Clock, Zap, Star, ToggleLeft, ToggleRight, Pencil,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

type AgeBandFilter = 'all' | 'foundation' | 'building' | 'mastery';

interface Template {
  id: string;
  template_code: string;
  title: string;
  description: string | null;
  age_band: string;
  skill_dimensions: string[] | null;
  difficulty_level: number | null;
  duration_minutes: number;
  prerequisites: string[] | null;
  recommended_order: number;
  is_active: boolean;
  is_diagnostic: boolean;
  is_season_finale: boolean;
  activity_flow: any[] | null;
  created_at: string;
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very Easy', 2: 'Easy', 3: 'Easy-Med', 4: 'Medium-Low', 5: 'Medium',
  6: 'Medium-High', 7: 'Hard-Med', 8: 'Hard', 9: 'Very Hard', 10: 'Expert',
};

const SKILL_COLORS: Record<string, string> = {
  phonemic_awareness: 'bg-white/[0.08] text-gray-400',
  phonics: 'bg-white/[0.08] text-gray-400',
  fluency: 'bg-white/[0.08] text-gray-400',
  vocabulary: 'bg-white/[0.08] text-gray-400',
  comprehension: 'bg-white/[0.08] text-gray-400',
  writing: 'bg-white/[0.08] text-gray-400',
  speaking: 'bg-white/[0.08] text-gray-400',
  listening: 'bg-white/[0.08] text-gray-400',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filter, setFilter] = useState<AgeBandFilter>('all');
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const toggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (res.ok) {
        setTemplates(prev =>
          prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t)
        );
      }
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = templates.filter(t => {
    if (filter !== 'all' && t.age_band !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.template_code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: templates.length,
    foundation: templates.filter(t => t.age_band === 'foundation').length,
    building: templates.filter(t => t.age_band === 'building').length,
    mastery: templates.filter(t => t.age_band === 'mastery').length,
  };

  const FILTER_TABS: { key: AgeBandFilter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'foundation', label: `Foundation (${counts.foundation})` },
    { key: 'building', label: `Building (${counts.building})` },
    { key: 'mastery', label: `Mastery (${counts.mastery})` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-gray-300" />
                Session Templates
              </h1>
              <p className="text-text-tertiary mt-1">
                Manage curated session templates for each age band
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/templates/new')}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-[#0a0a0f] rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex gap-1 bg-surface-1 rounded-lg p-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-white/[0.12] text-white'
                    : 'text-text-tertiary hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-1 border border-border rounded-lg text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-white/[0.10]"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        )}

        {/* Template Cards */}
        {!loading && (
          <div className="grid gap-4">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-text-tertiary">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No templates found</p>
              </div>
            ) : (
              filtered.map(template => (
                <div
                  key={template.id}
                  className={`bg-surface-1 border rounded-lg p-4 transition-colors ${
                    template.is_active ? 'border-border' : 'border-border opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Code + Title + Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-mono font-bold text-white">
                          {template.template_code}
                        </span>
                        <AgeBandBadge ageBand={template.age_band} />
                        {template.is_diagnostic && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                            Diagnostic
                          </span>
                        )}
                        {template.is_season_finale && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Finale
                          </span>
                        )}
                        {!template.is_active && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-medium text-sm mb-2">{template.title}</h3>
                      {template.description && (
                        <p className="text-text-tertiary text-xs mb-3 line-clamp-2">{template.description}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {template.duration_minutes} min
                        </span>
                        {template.difficulty_level && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5" />
                            L{template.difficulty_level}{' '}
                            {DIFFICULTY_LABELS[template.difficulty_level] || ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          #{template.recommended_order}
                        </span>
                        {template.activity_flow && template.activity_flow.length > 0 && (
                          <span>{template.activity_flow.length} activities</span>
                        )}
                      </div>

                      {/* Skill dimensions */}
                      {template.skill_dimensions && template.skill_dimensions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {template.skill_dimensions.map(skill => (
                            <span
                              key={skill}
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                SKILL_COLORS[skill] || 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {skill.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Prerequisites */}
                      {template.prerequisites && template.prerequisites.length > 0 && (
                        <p className="text-xs text-text-tertiary mt-2">
                          Prereq: {template.prerequisites.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(template.id, template.is_active)}
                        disabled={togglingId === template.id}
                        className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
                        title={template.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {togglingId === template.id ? (
                          <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
                        ) : template.is_active ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => router.push(`/admin/templates/${template.id}`)}
                        className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
                        title="Edit template"
                      >
                        <Pencil className="w-4 h-4 text-text-tertiary hover:text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
