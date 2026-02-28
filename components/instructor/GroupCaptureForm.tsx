// ============================================================
// GroupCaptureForm — Multi-child structured capture for instructors
// ============================================================
// Simplified version of StructuredCaptureForm for MULTIPLE children.
// Shows participants list, per-child expandable cards with engagement,
// skill chips, observation chips, and optional notes.
// Submits all captures at once → POST /api/group-classes/session/[id]/capture
// ============================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, Zap, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeIntelligenceScore, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import type { SignalInputs } from '@/lib/intelligence/score';

// ============================================================
// Types
// ============================================================

interface Participant {
  id: string;
  child_id: string;
  child: {
    id: string;
    child_name: string;
    age?: number | null;
    age_band?: string | null;
  };
  payment_status?: string;
  attendance_status?: string;
}

interface SkillItem {
  id: string;
  name: string;
  skillTag: string;
  description: string | null;
}

interface ModuleGroup {
  module: { id: string; name: string; slug: string; icon: string | null };
  skills: SkillItem[];
}

interface ObservationItem {
  id: string;
  text: string;
  type: 'strength' | 'struggle' | 'neutral';
  sortOrder: number | null;
}

interface ChildCapture {
  engagement_level: 'low' | 'moderate' | 'high' | 'exceptional';
  skill_ids: string[];
  strength_observations: string[];
  struggle_observations: string[];
  custom_note: string;
  voice_note_url: string;
}

interface CaptureResult {
  childId: string;
  childName: string;
  intelligenceScore: number;
  signalConfidence: string;
}

interface GroupCaptureFormProps {
  sessionId: string;
  participants: Participant[];
  blueprintSkillTags?: string[];
  onComplete: (results: CaptureResult[]) => void;
  onBack?: () => void;
}

// ============================================================
// Constants
// ============================================================

const ENGAGEMENT_OPTIONS: Array<{ value: ChildCapture['engagement_level']; label: string; color: string; bg: string }> = [
  { value: 'low', label: 'Low', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  { value: 'moderate', label: 'Moderate', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
  { value: 'high', label: 'High', color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
  { value: 'exceptional', label: 'Exceptional', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300' },
];

// ============================================================
// Component
// ============================================================

export default function GroupCaptureForm({ sessionId, participants, blueprintSkillTags, onComplete, onBack }: GroupCaptureFormProps) {
  // ─── State ───
  const [captures, setCaptures] = useState<Record<string, ChildCapture>>({});
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<CaptureResult[]>([]);

  // ─── Skills & observations ───
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [observations, setObservations] = useState<Record<string, ObservationItem[]>>({});
  const [loadingSkills, setLoadingSkills] = useState(true);

  // Initialize captures for all participants
  useEffect(() => {
    const initial: Record<string, ChildCapture> = {};
    for (const p of participants) {
      if (!captures[p.child_id]) {
        initial[p.child_id] = {
          engagement_level: 'moderate',
          skill_ids: [],
          strength_observations: [],
          struggle_observations: [],
          custom_note: '',
          voice_note_url: '',
        };
      }
    }
    if (Object.keys(initial).length > 0) {
      setCaptures(prev => ({ ...initial, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  // Fetch skills
  useEffect(() => {
    fetch('/api/intelligence/skills')
      .then(res => res.json())
      .then(data => {
        if (data?.modules) setModules(data.modules);
      })
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, []);

  // Fetch observations when any child has skills selected
  const allSelectedSkillIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cap of Object.values(captures)) {
      for (const sid of cap.skill_ids) ids.add(sid);
    }
    return Array.from(ids);
  }, [captures]);

  useEffect(() => {
    if (allSelectedSkillIds.length === 0) {
      setObservations({});
      return;
    }
    const params = new URLSearchParams();
    params.set('skillIds', allSelectedSkillIds.join(','));
    fetch(`/api/intelligence/observations?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data?.observations) setObservations(data.observations);
      })
      .catch(() => {});
  }, [allSelectedSkillIds]);

  // ─── Helpers ───
  const updateCapture = useCallback((childId: string, updates: Partial<ChildCapture>) => {
    setCaptures(prev => ({
      ...prev,
      [childId]: { ...prev[childId], ...updates },
    }));
  }, []);

  const toggleSkill = useCallback((childId: string, skillId: string) => {
    setCaptures(prev => {
      const cap = prev[childId];
      if (!cap) return prev;
      const has = cap.skill_ids.includes(skillId);
      return {
        ...prev,
        [childId]: {
          ...cap,
          skill_ids: has ? cap.skill_ids.filter(s => s !== skillId) : [...cap.skill_ids, skillId],
        },
      };
    });
  }, []);

  const toggleObservation = useCallback((childId: string, obsId: string, type: 'strength' | 'struggle') => {
    setCaptures(prev => {
      const cap = prev[childId];
      if (!cap) return prev;
      const key = type === 'strength' ? 'strength_observations' : 'struggle_observations';
      const has = cap[key].includes(obsId);
      return {
        ...prev,
        [childId]: {
          ...cap,
          [key]: has ? cap[key].filter(o => o !== obsId) : [...cap[key], obsId],
        },
      };
    });
  }, []);

  const rateAllModerate = useCallback(() => {
    setCaptures(prev => {
      const updated = { ...prev };
      for (const childId of Object.keys(updated)) {
        updated[childId] = { ...updated[childId], engagement_level: 'moderate' };
      }
      return updated;
    });
  }, []);

  const getScoreForChild = useCallback((childId: string): number => {
    const cap = captures[childId];
    if (!cap) return 0;
    const signals: SignalInputs = {
      hasSkillsCovered: cap.skill_ids.length > 0,
      hasPerformanceRatings: false,
      hasChildArtifact: !!cap.voice_note_url,
      hasObservations: cap.strength_observations.length > 0 || cap.struggle_observations.length > 0,
      hasEngagement: true,
    };
    return computeIntelligenceScore(signals, DEFAULT_WEIGHTS);
  }, [captures]);

  // ─── Flatten observations for a child ───
  const getObservationsForChild = useCallback((childId: string) => {
    const cap = captures[childId];
    if (!cap) return { strengths: [] as ObservationItem[], struggles: [] as ObservationItem[] };
    const strengths: ObservationItem[] = [];
    const struggles: ObservationItem[] = [];
    const seen = new Set<string>();

    for (const skillId of cap.skill_ids) {
      const obs = observations[skillId] || [];
      for (const o of obs) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        if (o.type === 'strength') strengths.push(o);
        else if (o.type === 'struggle') struggles.push(o);
      }
    }
    return { strengths, struggles };
  }, [captures, observations]);

  // ─── Submit ───
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const capturesArray = participants.map(p => ({
        child_id: p.child_id,
        ...(captures[p.child_id] || {
          engagement_level: 'moderate' as const,
          skill_ids: [],
          strength_observations: [],
          struggle_observations: [],
          custom_note: '',
          voice_note_url: '',
        }),
      }));

      const res = await fetch(`/api/group-classes/session/${sessionId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captures: capturesArray, session_notes: sessionNotes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');

      setSubmitted(true);
      setResults(data.results || []);
      onComplete(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success state ───
  if (submitted) {
    const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.intelligenceScore, 0) / results.length) : 0;
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">Session Captured!</h2>
        <p className="text-gray-600 text-center">
          {results.length} children rated &middot; Avg intelligence score: {avgScore}/100
        </p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {results.map(r => (
            <div key={r.childId} className="bg-white rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">{r.childName}</span>
              <span className={cn('ml-2 font-mono', r.intelligenceScore >= 50 ? 'text-green-600' : 'text-orange-600')}>
                {r.intelligenceScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main form ───
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Rate Participants</h1>
            <p className="text-sm opacity-90">{participants.length} children &middot; Tap to expand</p>
          </div>
          <button
            onClick={rateAllModerate}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
          >
            Rate All Moderate
          </button>
        </div>
      </div>

      {/* Participants list */}
      <div className="p-4 space-y-3">
        {participants.map(p => {
          const cap = captures[p.child_id];
          const isExpanded = expandedChild === p.child_id;
          const childName = p.child?.child_name || 'Unknown';
          const childAge = p.child?.age;
          const score = getScoreForChild(p.child_id);
          const { strengths: obsStrengths, struggles: obsStruggles } = getObservationsForChild(p.child_id);

          return (
            <div key={p.child_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* ─── Collapsed header ─── */}
              <button
                onClick={() => setExpandedChild(isExpanded ? null : p.child_id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {childName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{childName}</p>
                    <p className="text-xs text-gray-500">
                      {childAge ? `Age ${childAge}` : ''}
                      {cap ? ` · ${cap.engagement_level}` : ''}
                      {cap && cap.skill_ids.length > 0 ? ` · ${cap.skill_ids.length} skills` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded-full',
                    score >= 50 ? 'bg-green-100 text-green-700' : score > 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500',
                  )}>
                    {score}
                  </span>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </button>

              {/* ─── Expanded detail ─── */}
              {isExpanded && cap && (
                <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                  {/* Engagement */}
                  <div className="pt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Engagement</p>
                    <div className="flex gap-2">
                      {ENGAGEMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateCapture(p.child_id, { engagement_level: opt.value })}
                          className={cn(
                            'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            cap.engagement_level === opt.value
                              ? `${opt.bg} ${opt.color} border-2`
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Skills Observed</p>
                    {loadingSkills ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <div className="space-y-2">
                        {modules.map(mod => (
                          <div key={mod.module.id}>
                            <p className="text-xs text-gray-400 mb-1">{mod.module.icon || ''} {mod.module.name}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {mod.skills.map(skill => (
                                <button
                                  key={skill.id}
                                  onClick={() => toggleSkill(p.child_id, skill.id)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                    cap.skill_ids.includes(skill.id)
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
                                  )}
                                >
                                  {skill.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Observations (only when skills selected) */}
                  {cap.skill_ids.length > 0 && (obsStrengths.length > 0 || obsStruggles.length > 0) && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Observations</p>
                      {obsStrengths.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-green-600 font-medium mb-1">Strengths</p>
                          <div className="flex flex-wrap gap-1.5">
                            {obsStrengths.map(obs => (
                              <button
                                key={obs.id}
                                onClick={() => toggleObservation(p.child_id, obs.id, 'strength')}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs border transition-all',
                                  cap.strength_observations.includes(obs.id)
                                    ? 'bg-green-100 text-green-700 border-green-300 font-medium'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-green-50',
                                )}
                              >
                                {obs.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {obsStruggles.length > 0 && (
                        <div>
                          <p className="text-xs text-orange-600 font-medium mb-1">Struggles</p>
                          <div className="flex flex-wrap gap-1.5">
                            {obsStruggles.map(obs => (
                              <button
                                key={obs.id}
                                onClick={() => toggleObservation(p.child_id, obs.id, 'struggle')}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs border transition-all',
                                  cap.struggle_observations.includes(obs.id)
                                    ? 'bg-orange-100 text-orange-700 border-orange-300 font-medium'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-orange-50',
                                )}
                              >
                                {obs.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  <div>
                    <input
                      type="text"
                      placeholder="Quick note (optional)"
                      value={cap.custom_note}
                      onChange={e => updateCapture(p.child_id, { custom_note: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      maxLength={1000}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Session notes */}
      <div className="px-4 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Session Notes</p>
        <textarea
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
          placeholder="Overall session observations..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          rows={2}
          maxLength={5000}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3 z-30">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center justify-center gap-2',
            submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700',
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Submit & Close ({participants.length} rated)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
