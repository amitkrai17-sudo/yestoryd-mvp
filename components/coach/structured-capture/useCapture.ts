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
  const { sessionId, childId, childAge, coachId, modality, groupSessionId, captureId, initialData } = props;

  // Form state — initialize from initialData (AI review), draft, or fresh
  const [state, setState] = useState<CaptureFormState>(() => {
    if (typeof window === 'undefined') return createInitialCaptureState();
    // AI-prefilled data takes priority over localStorage draft
    if (initialData) return { ...createInitialCaptureState(), ...initialData };
    const draft = loadDraft(sessionId, childId);
    if (!draft) return createInitialCaptureState();
    return { ...createInitialCaptureState(), ...draft };
  });

  // Data state
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [observations, setObservations] = useState<Record<string, ObservationItem[]>>({});
  const [continuations, setContinuations] = useState<Array<{
    id: string;
    observation_id: string;
    observation_text: string;
    observation_type: string;
    skill_id: string;
  }>>([]);
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

  // Fetch active continuations for this child (struggle follow-ups from previous sessions)
  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    async function fetchContinuations() {
      try {
        const { supabase: clientSb } = await import('@/lib/supabase/client');
        const { data } = await clientSb
          .from('observation_continuations')
          .select('id, observation_id, el_skill_observations(observation_text, observation_type, skill_id)')
          .eq('child_id', childId)
          .eq('continuation_status', 'active');
        if (!cancelled && data) {
          setContinuations(data.map((c: any) => ({
            id: c.id,
            observation_id: c.observation_id,
            observation_text: c.el_skill_observations?.observation_text || '',
            observation_type: c.el_skill_observations?.observation_type || 'struggle',
            skill_id: c.el_skill_observations?.skill_id || '',
          })));
        }
      } catch { /* Non-fatal */ }
    }
    fetchContinuations();
    return () => { cancelled = true; };
  }, [childId]);

  // Pre-fill from micro-observations (during-session quick taps)
  const [microObsCount, setMicroObsCount] = useState(0);
  useEffect(() => {
    if (!sessionId || sessionId === 'new') return;
    let cancelled = false;
    async function fetchMicroObs() {
      try {
        const res = await fetch(`/api/intelligence/micro-observation?sessionId=${sessionId}`);
        const result = await res.json();
        const microObs = result.data as any[] | undefined;
        if (cancelled || !microObs?.length) return;

        setMicroObsCount(microObs.length);

        const preStrengths = microObs
          .filter((m: any) => m.observation_type === 'strength' && m.observation_id)
          .map((m: any) => m.observation_id);
        const preStruggles = microObs
          .filter((m: any) => m.observation_type === 'struggle' && m.observation_id)
          .map((m: any) => m.observation_id);
        const mastered = microObs
          .filter((m: any) => m.observation_type === 'word' && m.word_status === 'mastered' && m.word_text)
          .map((m: any) => m.word_text);
        const struggled = microObs
          .filter((m: any) => m.observation_type === 'word' && m.word_status === 'struggled' && m.word_text)
          .map((m: any) => m.word_text);
        const notes = microObs
          .filter((m: any) => m.observation_type === 'note' && m.note_text)
          .map((m: any) => `[${m.minutes_into_session || '?'}min] ${m.note_text}`)
          .join('. ');

        setState(prev => ({
          ...prev,
          strengthObservationIds: Array.from(new Set([...prev.strengthObservationIds, ...preStrengths])),
          struggleObservationIds: Array.from(new Set([...prev.struggleObservationIds, ...preStruggles])),
          wordsMastered: Array.from(new Set([...(prev.wordsMastered || []), ...mastered])),
          wordsStruggled: Array.from(new Set([...(prev.wordsStruggled || []), ...struggled])),
          customStrengthNote: prev.customStrengthNote || (notes ? notes : ''),
        }));
      } catch { /* Non-fatal */ }
    }
    fetchMicroObs();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Pre-fill from companion panel activity logs (online sessions)
  const [activityLogCount, setActivityLogCount] = useState(0);
  useEffect(() => {
    if (!sessionId || sessionId === 'new') return;
    let cancelled = false;
    async function fetchActivityLog() {
      try {
        const res = await fetch(`/api/intelligence/activity-log?sessionId=${sessionId}`);
        const result = await res.json();
        const prefill = result.data;
        if (cancelled || !prefill) return;

        setActivityLogCount(prefill.activityCount || 0);

        setState(prev => ({
          ...prev,
          // Activity-log skills fill gaps (micro-obs take priority via earlier effect)
          selectedSkillIds: Array.from(new Set([...prev.selectedSkillIds, ...(prefill.skillsCovered || [])])),
          strengthObservationIds: Array.from(new Set([...prev.strengthObservationIds, ...(prefill.suggestedStrengths || [])])),
          struggleObservationIds: Array.from(new Set([...prev.struggleObservationIds, ...(prefill.suggestedStruggles || [])])),
          customStrengthNote: prev.customStrengthNote || prefill.customStrengthNote || '',
          customStruggleNote: prev.customStruggleNote || prefill.customStruggleNote || '',
          engagementLevel: prev.engagementLevel || prefill.engagementLevel || null,
        }));
      } catch { /* Non-fatal */ }
    }
    fetchActivityLog();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Pre-fill from Recall transcript analysis (online sessions with recording)
  const [recallPrefillAvailable, setRecallPrefillAvailable] = useState(false);
  useEffect(() => {
    if (!sessionId || sessionId === 'new') return;
    let cancelled = false;
    async function fetchRecallPrefill() {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data: session } = await supabase
          .from('scheduled_sessions')
          .select('recall_prefill_data')
          .eq('id', sessionId)
          .single();

        const prefill = session?.recall_prefill_data as Record<string, any> | null;
        if (cancelled || !prefill) return;

        setRecallPrefillAvailable(true);

        setState(prev => ({
          ...prev,
          customStrengthNote: prev.customStrengthNote || prefill.strength_summary || '',
          customStruggleNote: prev.customStruggleNote || prefill.struggle_summary || '',
          engagementLevel: prev.engagementLevel || prefill.suggested_engagement || null,
        }));
      } catch { /* Non-fatal */ }
    }
    fetchRecallPrefill();
    return () => { cancelled = true; };
  }, [sessionId]);

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
        wordsStruggled: state.wordsStruggled?.length > 0 ? state.wordsStruggled : undefined,
        wordsMastered: state.wordsMastered?.length > 0 ? state.wordsMastered : undefined,
        coachVoiceNoteUrl: state.coachVoiceNoteUrl || undefined,
        aiPrefilled: false,
        coachConfirmed: true,
        homeworkAssigned: state.homeworkAssigned || undefined,
        homeworkDescription: state.homeworkAssigned && state.homeworkDescription ? state.homeworkDescription : undefined,
        contentItemId: state.worksheetContentItemId || undefined,
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
        // Include captureId if updating an existing capture (AI review mode)
        body: JSON.stringify(captureId ? { ...payload, captureId } : payload),
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
  }, [state, sessionId, childId, coachId, modality, groupSessionId, captureId]);

  return {
    state,
    updateState,
    modules,
    observations,
    continuations,
    microObsCount,
    activityLogCount,
    recallPrefillAvailable,
    loadingSkills,
    loadingObservations,
    scorePreview,
    submitting,
    submitError,
    submit,
  };
}
