// =============================================================================
// FILE: app/admin/site-settings/page.tsx
// PURPOSE: Comprehensive Site Settings Manager - Full Coverage
// ACCESS: /admin/site-settings
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Settings, Save, Search, ChevronDown, ChevronRight,
  Edit2, X, Check, AlertCircle, RefreshCw, Database,
  Loader2, Copy, CheckCircle
} from 'lucide-react';

interface SiteSetting {
  id: string;
  category: string;
  key: string;
  value: any;
  description: string | null;
  updated_at: string | null;
}

// Category display configuration
const CATEGORY_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  hero: { label: 'Hero Section', color: 'bg-pink-500/20 text-pink-400', description: 'Homepage hero content & A/B variants' },
  arc: { label: 'ARC Method', color: 'bg-purple-500/20 text-purple-400', description: 'Assess, Remediate, Celebrate section' },
  rai: { label: 'rAI Technology', color: 'bg-blue-500/20 text-blue-400', description: 'AI technology comparison section' },
  problem: { label: 'Problem Section', color: 'bg-orange-500/20 text-orange-400', description: 'Problem awareness content' },
  pricing: { label: 'Pricing', color: 'bg-green-500/20 text-green-400', description: 'Pricing section content' },
  story: { label: 'Our Story', color: 'bg-indigo-500/20 text-indigo-400', description: "Rucha's story section" },
  testimonials: { label: 'Testimonials', color: 'bg-yellow-500/20 text-yellow-400', description: 'Testimonials section text' },
  header: { label: 'Header/Nav', color: 'bg-cyan-500/20 text-cyan-400', description: 'Navigation & top bar' },
  footer: { label: 'Footer', color: 'bg-slate-500/20 text-slate-400', description: 'Footer content' },
  cta: { label: 'CTA Section', color: 'bg-red-500/20 text-red-400', description: 'Call-to-action content' },
  journey: { label: 'Journey', color: 'bg-violet-500/20 text-violet-400', description: 'Learning journey visualization' },
  faq: { label: 'FAQ', color: 'bg-teal-500/20 text-teal-400', description: 'Frequently asked questions' },
  transformation: { label: 'Transformation', color: 'bg-emerald-500/20 text-emerald-400', description: 'Before/after transformation' },
  floating: { label: 'Floating Elements', color: 'bg-amber-500/20 text-amber-400', description: 'Floating buttons & CTAs' },
  triangulation: { label: 'Triangulation', color: 'bg-fuchsia-500/20 text-fuchsia-400', description: 'rAI/Coach/Parent triangle' },
  contact: { label: 'Contact Info', color: 'bg-sky-500/20 text-sky-400', description: 'Contact details' },
  program: { label: 'Program Config', color: 'bg-lime-500/20 text-lime-400', description: 'Program structure & sessions' },
  coach: { label: 'Coach Defaults', color: 'bg-rose-500/20 text-rose-400', description: 'Default coach settings' },
  videos: { label: 'Videos', color: 'bg-cyan-500/20 text-cyan-400', description: 'Video URLs' },
};

export default function SiteSettingsManager() {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch all settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .order('category')
      .order('key');

    if (error) {
      setError('Failed to load settings');
      console.error(error);
    } else {
      setSettings(data || []);
      // Expand first category by default
      if (data && data.length > 0) {
        const categories = Array.from(new Set(data.map(s => s.category)));
        setExpandedCategories(new Set([categories[0]]));
      }
    }
    setLoading(false);
  };

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SiteSetting[]>);

  // Filter by search
  const filteredCategories = Object.entries(groupedSettings).filter(([category, items]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return category.toLowerCase().includes(query) ||
           items.some(item =>
             item.key.toLowerCase().includes(query) ||
             (item.description && item.description.toLowerCase().includes(query)) ||
             JSON.stringify(item.value).toLowerCase().includes(query)
           );
  });

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Expand all categories
  const expandAll = () => {
    setExpandedCategories(new Set(Object.keys(groupedSettings)));
  };

  // Collapse all categories
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Start editing
  const startEdit = (setting: SiteSetting) => {
    setEditingId(setting.id);
    setEditValue(typeof setting.value === 'string'
      ? setting.value
      : JSON.stringify(setting.value, null, 2)
    );
    setError(null);
    setSuccess(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Save setting
  const saveSetting = async (setting: SiteSetting) => {
    setSaving(true);
    setError(null);

    let parsedValue: any = editValue;

    // Try to parse as JSON if it looks like JSON
    if (editValue.trim().startsWith('{') || editValue.trim().startsWith('[')) {
      try {
        parsedValue = JSON.parse(editValue);
      } catch (e) {
        setError('Invalid JSON format');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('site_settings')
      .update({
        value: parsedValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', setting.id);

    if (error) {
      setError('Failed to save: ' + error.message);
    } else {
      setSuccess(`Saved "${setting.key}"`);
      setEditingId(null);
      fetchSettings(); // Refresh
      setTimeout(() => setSuccess(null), 3000);
    }
    setSaving(false);
  };

  // Copy key to clipboard
  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Get value type for display
  const getValueType = (value: any): string => {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    return typeof value;
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  // Get category config
  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || {
      label: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
      color: 'bg-gray-500/20 text-gray-400',
      description: ''
    };
  };

  if (loading) {
    return (
      <div className="min-h-[400px] bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FF0099] animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-0 p-3 sm:p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FF0099]/20 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-[#FF0099]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Site Settings Manager</h1>
              <p className="text-text-tertiary text-sm">
                {settings.length} settings across {Object.keys(groupedSettings).length} categories
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 bg-surface-2 text-text-secondary rounded-lg hover:bg-surface-3 transition-colors text-sm"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 bg-surface-2 text-text-secondary rounded-lg hover:bg-surface-3 transition-colors text-sm"
            >
              Collapse All
            </button>
            <button
              onClick={fetchSettings}
              className="flex items-center gap-2 px-3 py-2 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/80 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search settings by category, key, description, or value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-1 border border-border rounded-xl text-white placeholder:text-text-muted focus:border-[#FF0099] focus:ring-2 focus:ring-[#FF0099]/20 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-surface-1 border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{settings.length}</p>
            <p className="text-xs text-text-tertiary">Total Settings</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{Object.keys(groupedSettings).length}</p>
            <p className="text-xs text-text-tertiary">Categories</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{settings.filter(s => getValueType(s.value) === 'object' || getValueType(s.value) === 'array').length}</p>
            <p className="text-xs text-text-tertiary">JSON Values</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{filteredCategories.length}</p>
            <p className="text-xs text-text-tertiary">Showing</p>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {filteredCategories.map(([category, items]) => {
            const config = getCategoryConfig(category);
            const filteredItems = items.filter(item => {
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();
              return item.key.toLowerCase().includes(query) ||
                     (item.description && item.description.toLowerCase().includes(query)) ||
                     JSON.stringify(item.value).toLowerCase().includes(query);
            });

            return (
              <div key={category} className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-5 h-5 text-[#FF0099]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-text-tertiary" />
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-text-tertiary text-sm hidden sm:block">
                      {config.description}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-surface-3 text-text-secondary text-sm rounded">
                    {filteredItems.length}
                  </span>
                </button>

                {/* Category Items */}
                {expandedCategories.has(category) && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {filteredItems.map((setting) => (
                      <div
                        key={setting.id}
                        className="p-4 hover:bg-surface-2/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Key & Type */}
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <button
                                onClick={() => copyKey(setting.key)}
                                className="flex items-center gap-1 group"
                                title="Click to copy key"
                              >
                                <code className="text-[#FF0099] font-mono text-sm group-hover:underline">
                                  {setting.key}
                                </code>
                                {copiedKey === setting.key ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100" />
                                )}
                              </button>
                              <span className="px-1.5 py-0.5 bg-surface-3 text-text-tertiary text-xs rounded">
                                {getValueType(setting.value)}
                              </span>
                            </div>

                            {/* Description */}
                            {setting.description && (
                              <p className="text-text-tertiary text-sm mb-2">
                                {setting.description}
                              </p>
                            )}

                            {/* Value */}
                            {editingId === setting.id ? (
                              <div className="mt-2">
                                <textarea
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={getValueType(setting.value) === 'object' || getValueType(setting.value) === 'array' ? 10 : 3}
                                  className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white font-mono text-sm focus:border-[#FF0099] focus:ring-2 focus:ring-[#FF0099]/20 outline-none resize-y"
                                  placeholder="Enter value..."
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => saveSetting(setting)}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/80 disabled:opacity-50 text-sm font-medium"
                                  >
                                    {saving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 text-white rounded-lg hover:bg-surface-2 text-sm"
                                  >
                                    <X className="w-4 h-4" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <pre className="bg-surface-2 rounded-lg p-3 text-text-secondary text-sm font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                                {formatValue(setting.value)}
                              </pre>
                            )}
                          </div>

                          {/* Edit Button */}
                          {editingId !== setting.id && (
                            <button
                              onClick={() => startEdit(setting)}
                              className="p-2 text-text-tertiary hover:text-[#FF0099] hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
                              title="Edit setting"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-12 bg-surface-1 rounded-xl border border-border">
            <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No settings found</p>
            <p className="text-text-tertiary text-sm">No settings match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/80 text-sm"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 p-4 bg-surface-1 border border-border rounded-xl">
          <h3 className="text-white font-medium mb-2">Usage Tips</h3>
          <ul className="text-text-tertiary text-sm space-y-1">
            <li>• Click on a key name to copy it to clipboard</li>
            <li>• JSON values (objects/arrays) will be validated before saving</li>
            <li>• Changes take effect immediately on the frontend</li>
            <li>• Use search to find settings by category, key, description, or value</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
