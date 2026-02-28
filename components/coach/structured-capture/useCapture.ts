// ============================================================
// useCapture — Custom hook for structured capture form
// Manages: skill fetching, localStorage draft, score preview, submit
// ============================================================

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { computeIntelligenceScore, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import type { StructuredCapturePayload, SkillPerformance } from '@/lib/intelligence/types';
import type {
  CaptureFormState,
  ModuleGroup,
  ObservationItem,
  CaptureFormProps,
} from './types';
import { createInitialCaptureState } from './types';

const DRAFT_STALENESS_MS = 48 * 60 * 60 * 1000; // 48 hours

function getDraftKey(sessionId: string, childId: string): string {
  return `capture_draft_${sessionId}_${childId}`;
}

interface DraftEnvelope {
  state: CaptureFormState;
  savedAt: number;
}

function loadDraft(sessionId: string, childId: string): CaptureFormState | null {
  try {
    const raw = localStorage.getItem(getDraftKey(sessionId, childId));
    if (!raw) return null;
    const envelope: DraftEnvelope = JSON.parse(raw);
    if (Date.now() - envelope.savedAt > DRAFT_STALENESS_MS) {
      localStorage.removeItem(getDraftKey(sessionId, childId));
      return null;
    }
    return envelope.state;
  } catch {
    return null;
  }
}

function saveDraft(sessionId: string, childId: string, state: CaptureFormState): void {
  try {
    const envelope: DraftEnvelope = { state, savedAt: Date.now() };
    localStorage.setItem(getDraftKey(sessionId, childId), JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function clearDraft(sessionId: string, childId: string): void {
  try {
    localStorage.removeItem(getDraftKey(sessionId, childId));
  } catch {
    // ignore
  }
}

export function useCapture(props: CaptureFormProps) {
  const { sessionId, childId, childAge, coachId, modality, groupSessionId } = props;

  // Form state — initialize from draft or fresh
  const [state, setState] = useState<CaptureFormState>(() => {
    if (typeof window === 'undefined') return createInitialCaptureState();
    return loadDraft(sessionId, childId) || createInitialCaptureState();
  });

  // Data state
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [observations, setObservations] = useState<Record<string, ObservationItem[]>>({});
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingObservations, setLoadingObservations] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ref for auth token
  const tokenRef = useRef<string | null>(null);

  // Get auth token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      tokenRef.current = session?.access_token || null;
    });
  }, []);

  // Fetch skills on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchSkills() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/intelligence/skills', { headers });
        if (!res.ok) throw new Error('Failed to load skills');
        const data = await res.json();
        if (!cancelled) {
          setModules(data.modules || []);
        }
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      } finally {
        if (!cancelled) setLoadingSkills(false);
      }
    }
    fetchSkills();
    return () => { cancelled = true; };
  }, []);

  // Fetch observations when selected skills change
  useEffect(() => {
    if (state.selectedSkillIds.length === 0) {
      setObservations({});
      return;
    }

    let cancelled = false;
    async function fetchObservations() {
      setLoadingObservations(true);
      try {
        const ageBand = childAge <= 6 ? '4-6' : childAge <= 9 ? '7-9' : '10-12';
        const skillIds = state.selectedSkillIds.slice(0, 20).join(',');
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(
          `/api/intelligence/observations?skillIds=${skillIds}&ageBand=${ageBand}`,
          { headers },
        );
        if (!res.ok) throw new Error('Failed to load observations');
        const data = await res.json();
        if (!cancelled && data.skills) {
          const obsMap: Record<string, ObservationItem[]> = {};
          for (const [skillId, skillData] of Object.entries(data.skills)) {
            const sd = skillData as { observations: ObservationItem[] };
            obsMap[skillId] = sd.observations || [];
          }
          setObservations(obsMap);
        }
      } catch (err) {
        console.error('Failed to fetch observations:', err);
      } finally {
        if (!cancelled) setLoadingObservations(false);
      }
    }
    fetchObservations();
    return () => { cancelled = true; };
  }, [state.selectedSkillIds, childAge]);

  // Save draft on state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(sessionId, childId, state);
    }, 500);
    return () => clearTimeout(timer);
  }, [state, sessionId, childId]);

  // Update helper
  const updateState = useCallback((updates: Partial<CaptureFormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Live score preview
  const scorePreview = useMemo(() => {
    const hasSkills = state.selectedSkillIds.length > 0;
    const hasPerformance = hasSkills && state.selectedSkillIds.every(
      id => state.skillPerformances[id]?.rating != null,
    );
    const hasArtifact = state.artifactType !== 'none' && (
      state.artifactUrl !== '' || state.artifactText !== ''
    );
    const hasObservations = state.strengthObservationIds.length > 0 ||
      state.struggleObservationIds.length > 0;
    const hasEngagement = state.engagementLevel !== null;

    const score = computeIntelligenceScore({
      hasSkillsCovered: hasSkills,
      hasPerformanceRatings: hasPerformance,
      hasChildArtifact: hasArtifact,
      hasObservations: hasObservations,
      hasEngagement: hasEngagement,
    }, DEFAULT_WEIGHTS);

    return {
      score,
      signals: {
        hasSkills,
        hasPerformance,
        hasArtifact,
        hasObservations,
        hasEngagement,
      },
    };
  }, [state]);

  // Submit
  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Build skill performances
      const skillPerformances: SkillPerformance[] = state.selectedSkillIds
        .filter(id => state.skillPerformances[id]?.rating)
        .map(id => ({
          skillId: id,
          rating: state.skillPerformances[id].rating!,
          observationIds: [],
          note: state.skillPerformances[id].note || undefined,
        }));

      // Build payload
      const payload: StructuredCapturePayload = {
        childId,
        coachId,
        sessionId: sessionId === 'new' ? null : sessionId,
        groupSessionId: groupSessionId || null,
        sessionDate: new Date().toISOString().split('T')[0],
        sessionModality: modality || 'online_1on1',
        captureMethod: 'manual_structured',
        skillsCovered: state.selectedSkillIds,
        skillPerformances,
        engagementLevel: state.engagementLevel!,
        strengthObservations: state.strengthObservationIds,
        struggleObservations: state.struggleObservationIds,
        customStrengthNote: state.customStrengthNote || undefined,
        customStruggleNote: state.customStruggleNote || undefined,
        contextTags: state.contextTags.length > 0 ? state.contextTags : undefined,
        aiPrefilled: false,
        coachConfirmed: true,
      };

      // Add artifact if present
      if (state.artifactType !== 'none') {
        if (state.artifactType === 'text' && state.artifactText) {
          payload.childArtifact = { type: 'text', url: '', text: state.artifactText };
        } else if (state.artifactUrl) {
          payload.childArtifact = { type: state.artifactType === 'photo' ? 'image' : state.artifactType, url: state.artifactUrl };
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/intelligence/capture', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit capture');
      }

      const result = await res.json();
      clearDraft(sessionId, childId);

      return {
        captureId: result.capture.id as string,
        intelligenceScore: result.capture.intelligenceScore as number,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setSubmitError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [state, sessionId, childId, coachId, modality, groupSessionId]);

  return {
    state,
    updateState,
    modules,
    observations,
    loadingSkills,
    loadingObservations,
    scorePreview,
    submitting,
    submitError,
    submit,
  };
}
