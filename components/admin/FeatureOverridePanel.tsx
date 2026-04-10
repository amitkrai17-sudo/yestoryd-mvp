'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Shield, Check } from 'lucide-react';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features/types';

const FEATURE_LABELS: Record<FeatureKey, string> = {
  smart_practice: 'SmartPractice',
  elearning_access: 'E-Learning Access',
  reading_tests: 'Reading Tests',
  recall_recording: 'Session Recording',
  rai_chat: 'rAI Chat',
  homework_tracking: 'Homework Tracking',
  detailed_analysis: 'Detailed Analysis',
  progress_cards: 'Progress Cards',
  whatsapp_full: 'WhatsApp Full Access',
  free_workshops: 'Free Workshops',
  gamification: 'Gamification',
  activity_calendar: 'Activity Calendar',
  book_library: 'Book Library',
};

const ALL_FEATURES: readonly FeatureKey[] = FEATURE_KEYS;

interface FeatureOverridePanelProps {
  childId: string;
}

export function FeatureOverridePanel({ childId }: FeatureOverridePanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productType, setProductType] = useState<string | null>(null);
  const [productDefaults, setProductDefaults] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [resolvedFeatures, setResolvedFeatures] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/children/${childId}/features`)
      .then(r => r.json())
      .then(data => {
        setProductType(data.productType);
        setProductDefaults(data.productDefaults || {});
        setOverrides(data.overrides || {});
        setResolvedFeatures(data.resolvedFeatures || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [childId]);

  const toggleOverride = (key: FeatureKey) => {
    const defaultVal = productDefaults[key] ?? false;
    const currentOverride = overrides[key];

    let newOverrides = { ...overrides };
    if (currentOverride === undefined) {
      newOverrides[key] = !defaultVal;
    } else {
      delete newOverrides[key];
    }
    saveOverrides(newOverrides);
  };

  const resetAll = () => {
    saveOverrides({});
  };

  const saveOverrides = async (newOverrides: Record<string, boolean>) => {
    const previousOverrides = { ...overrides };
    setOverrides(newOverrides);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/children/${childId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: newOverrides }),
      });
      const data = await res.json();
      if (data.success) {
        setResolvedFeatures(data.resolvedFeatures);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setOverrides(previousOverrides);
      }
    } catch (e) {
      console.error('Failed to save overrides:', e);
      setOverrides(previousOverrides);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">Loading features...</div>
    );
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Feature Gates
          </span>
          {productType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
              {productType}
            </span>
          )}
        </div>
        {hasOverrides && (
          <button
            onClick={resetAll}
            disabled={saving}
            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset All
          </button>
        )}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 gap-1">
        {ALL_FEATURES.map((key) => {
          const defaultVal = productDefaults[key] ?? false;
          const hasOverride = key in overrides;
          const resolved = resolvedFeatures[key] ?? false;

          return (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                hasOverride ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`truncate ${resolved ? 'text-gray-200' : 'text-gray-500'}`}>
                  {FEATURE_LABELS[key]}
                </span>
                {hasOverride && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium flex-shrink-0">
                    OVERRIDE
                  </span>
                )}
              </div>
              <button
                onClick={() => toggleOverride(key)}
                disabled={saving}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                  resolved ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    resolved ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Save indicator */}
      {saved && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <Check className="w-3.5 h-3.5" />
          Saved
        </div>
      )}
    </div>
  );
}
