// ============================================================
// Card 4: Observations — Strength/Struggle chips + custom notes
// With optional Web Speech API voice-to-text
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { Mic, MicOff, X, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '@/components/coach/AudioRecorder';
import { VoiceCapture, type VoiceCaptureResult } from '../VoiceCapture';
import type { CardProps, ObservationItem } from '../types';

interface ContinuationItem {
  id: string;
  observation_id: string;
  observation_text: string;
  observation_type: string;
  skill_id: string;
}

interface ObservationsCardProps extends CardProps {
  observations: Record<string, ObservationItem[]>;
  continuations?: ContinuationItem[];
  loading: boolean;
  sessionId: string;
  childName?: string;
  voicePrompts?: { q1: string; q2: string; q3: string; q4: string } | null;
}

// Flatten, performance-gate, and deduplicate observations
function groupObservations(
  observations: Record<string, ObservationItem[]>,
  skillRatings: Record<string, { rating: string | null; note: string }>,
) {
  const strengths: ObservationItem[] = [];
  const struggles: ObservationItem[] = [];

  for (const [skillId, items] of Object.entries(observations)) {
    const rating = skillRatings[skillId]?.rating || null;

    for (const obs of items) {
      // Performance gate: filter by visible_at_ratings
      if (rating && obs.visibleAtRatings && obs.visibleAtRatings.length > 0) {
        if (!obs.visibleAtRatings.some(r => r.toLowerCase() === rating.toLowerCase())) {
          continue; // Skip — not visible at this rating
        }
      }

      if (obs.type === 'strength') strengths.push(obs);
      else if (obs.type === 'struggle') struggles.push(obs);
      // neutrals: skip (not displayed as chips)
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const dedup = (arr: ObservationItem[]) => arr.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  return { strengths: dedup(strengths), struggles: dedup(struggles) };
}

// Check which observations are disabled due to conflict pair exclusion
function getConflictDisabledIds(
  allObs: ObservationItem[],
  selectedIds: string[],
): Set<string> {
  const disabled = new Set<string>();
  // Get conflict_pair_ids of selected observations
  const selectedPairIds = new Set(
    allObs
      .filter(o => selectedIds.includes(o.id) && o.conflictPairId)
      .map(o => o.conflictPairId!),
  );

  for (const obs of allObs) {
    if (
      obs.conflictPairId &&
      selectedPairIds.has(obs.conflictPairId) &&
      !selectedIds.includes(obs.id)
    ) {
      disabled.add(obs.id);
    }
  }
  return disabled;
}

// ============================================================
// WordTagInput — inline tag input for word lists
// ============================================================

function WordTagInput({
  label,
  words,
  onChange,
  placeholder,
  chipClassName,
}: {
  label: string;
  words: string[];
  onChange: (words: string[]) => void;
  placeholder: string;
  chipClassName: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addWord = () => {
    const word = inputValue.trim().toLowerCase();
    if (word && !words.includes(word)) {
      onChange([...words, word]);
    }
    setInputValue('');
  };

  const removeWord = (word: string) => {
    onChange(words.filter(w => w !== word));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  };

  return (
    <div>
      <label className="text-text-secondary text-xs font-medium mb-1.5 block">{label}</label>
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addWord}
        placeholder={placeholder}
        className="w-full h-10 bg-surface-2 border border-border rounded-lg px-3 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
      />
      {words.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {words.map(word => (
            <span
              key={word}
              className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border', chipClassName)}
            >
              {word}
              <button
                type="button"
                onClick={() => removeWord(word)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type SpeechField = 'customStrengthNote' | 'customStruggleNote';

export function ObservationsCard({ state, onUpdate, observations, continuations = [], loading, sessionId, childName, voicePrompts }: ObservationsCardProps) {
  const [listeningField, setListeningField] = useState<SpeechField | null>(null);
  const recognitionRef = useRef<ReturnType<typeof Object.create> | null>(null);
  const [continuationResponses, setContinuationResponses] = useState<Record<string, string>>({});
  const [showVoiceCapture, setShowVoiceCapture] = useState(false);

  const handleVoiceComplete = useCallback((result: VoiceCaptureResult) => {
    setShowVoiceCapture(false);

    // Pre-fill free text fields from voice segments
    const updates: Record<string, any> = {};
    if (result.segments.strengths) updates.customStrengthNote = result.segments.strengths;
    if (result.segments.struggles) updates.customStruggleNote = result.segments.struggles;

    // If Gemini extracted structured fields, use those too
    if (result.extracted) {
      if (result.extracted.wordsMastered?.length) {
        updates.wordsMastered = Array.from(new Set([...(state.wordsMastered || []), ...result.extracted.wordsMastered]));
      }
      if (result.extracted.wordsStruggled?.length) {
        updates.wordsStruggled = Array.from(new Set([...(state.wordsStruggled || []), ...result.extracted.wordsStruggled]));
      }
      if (result.extracted.homeworkSuggestion) {
        updates.homeworkDescription = result.extracted.homeworkSuggestion;
        updates.homeworkAssigned = true;
      }
    }

    if (Object.keys(updates).length > 0) onUpdate(updates);
  }, [state.wordsMastered, state.wordsStruggled, onUpdate]);

  // Gemini text suggestions (debounced)
  const [strengthSuggestions, setStrengthSuggestions] = useState<string[]>([]);
  const [struggleSuggestions, setStruggleSuggestions] = useState<string[]>([]);
  const strengthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const struggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (text: string, fieldType: 'strength' | 'struggle') => {
    if (text.length < 15) {
      if (fieldType === 'strength') setStrengthSuggestions([]);
      else setStruggleSuggestions([]);
      return;
    }
    try {
      const res = await fetch('/api/intelligence/suggest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childName, fieldType, partialText: text }),
      });
      const data = await res.json();
      if (fieldType === 'strength') setStrengthSuggestions(data.suggestions || []);
      else setStruggleSuggestions(data.suggestions || []);
    } catch { /* silent */ }
  }, [childName]);

  const handleStrengthNoteChange = useCallback((value: string) => {
    onUpdate({ customStrengthNote: value });
    if (strengthTimerRef.current) clearTimeout(strengthTimerRef.current);
    strengthTimerRef.current = setTimeout(() => fetchSuggestions(value, 'strength'), 800);
  }, [onUpdate, fetchSuggestions]);

  const handleStruggleNoteChange = useCallback((value: string) => {
    onUpdate({ customStruggleNote: value });
    if (struggleTimerRef.current) clearTimeout(struggleTimerRef.current);
    struggleTimerRef.current = setTimeout(() => fetchSuggestions(value, 'struggle'), 800);
  }, [onUpdate, fetchSuggestions]);

  const handleContinuation = async (contId: string, status: 'active' | 'improved' | 'resolved') => {
    setContinuationResponses(prev => ({ ...prev, [contId]: status }));
    try {
      const { supabase: clientSb } = await import('@/lib/supabase/client');
      await clientSb
        .from('observation_continuations')
        .update({
          continuation_status: status === 'active' ? 'active' : status,
          ...(status !== 'active' ? { resolved_at: new Date().toISOString() } : {}),
        })
        .eq('id', contId);
    } catch { /* Non-fatal */ }
  };

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const { strengths, struggles } = groupObservations(observations, state.skillPerformances);

  // Conflict exclusion: disable observations that conflict with selected ones
  const allSelectedIds = [...state.strengthObservationIds, ...state.struggleObservationIds];
  const allObs = [...strengths, ...struggles];
  const conflictDisabled = getConflictDisabledIds(allObs, allSelectedIds);

  const toggleObservation = (id: string, type: 'strength' | 'struggle') => {
    if (conflictDisabled.has(id)) return; // Don't allow toggling disabled items
    if (type === 'strength') {
      const current = state.strengthObservationIds;
      const updated = current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id];
      onUpdate({ strengthObservationIds: updated });
    } else {
      const current = state.struggleObservationIds;
      const updated = current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id];
      onUpdate({ struggleObservationIds: updated });
    }
  };

  const toggleVoice = useCallback((field: SpeechField) => {
    // Stop if already listening
    if (listeningField === field && recognitionRef.current) {
      recognitionRef.current.stop();
      setListeningField(null);
      return;
    }

    // Check browser support — use dynamic access to avoid TS errors
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new (SpeechRecognitionCtor as new () => Record<string, unknown>)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: Record<string, unknown>) => {
      const results = event.results as Array<Array<{ transcript: string }>> | undefined;
      const transcript = results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        const current = field === 'customStrengthNote' ? state.customStrengthNote : state.customStruggleNote;
        const updated = current ? `${current} ${transcript}` : transcript;
        onUpdate({ [field]: updated });
      }
    };

    recognition.onend = () => {
      setListeningField(null);
    };

    recognition.onerror = () => {
      setListeningField(null);
    };

    recognitionRef.current = recognition;
    (recognition.start as () => void)();
    setListeningField(field);
  }, [listeningField, state.customStrengthNote, state.customStruggleNote, onUpdate]);

  const hasSpeechSupport = typeof window !== 'undefined' &&
    Boolean((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" className="text-[#00ABFF] mb-3" />
        <p className="text-text-tertiary text-sm">Loading observations...</p>
      </div>
    );
  }

  const noObservations = strengths.length === 0 && struggles.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold text-base mb-1">Observations</h3>
          <p className="text-text-tertiary text-xs">
            Select observed strengths and areas for growth (optional)
          </p>
        </div>
        {childName && (
          <button
            onClick={() => setShowVoiceCapture(true)}
            className="flex items-center gap-1.5 text-xs text-[#00ABFF] px-3 py-1.5 rounded-xl border border-[#00ABFF]/30 hover:bg-[#00ABFF]/10 transition-colors flex-shrink-0"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice
          </button>
        )}
      </div>

      {/* Voice Capture Overlay */}
      {showVoiceCapture && childName && (
        <VoiceCapture
          childName={childName}
          prompts={voicePrompts || {
            q1: 'What did you work on with {childName} today?',
            q2: 'What went well?',
            q3: 'What did they find difficult?',
            q4: 'What should they practice at home?',
          }}
          onComplete={handleVoiceComplete}
          onCancel={() => setShowVoiceCapture(false)}
        />
      )}

      {/* Continuation prompts from previous sessions */}
      {continuations.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
          <p className="text-xs font-medium text-amber-400">From last session:</p>
          {continuations.filter(c => !continuationResponses[c.id]).map(cont => (
            <div key={cont.id} className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-amber-300 flex-1 min-w-0 truncate">
                &ldquo;{cont.observation_text}&rdquo;
              </span>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleContinuation(cont.id, 'active')}
                  className="text-[10px] px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                  Still an issue
                </button>
                <button onClick={() => handleContinuation(cont.id, 'improved')}
                  className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
                  Improved
                </button>
                <button onClick={() => handleContinuation(cont.id, 'resolved')}
                  className="text-[10px] px-2 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30">
                  Resolved
                </button>
              </div>
            </div>
          ))}
          {continuations.every(c => !!continuationResponses[c.id]) && (
            <p className="text-[10px] text-amber-400/60 text-center">All follow-ups reviewed</p>
          )}
        </div>
      )}

      {noObservations && state.selectedSkillIds.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 text-center">
          <p className="text-text-tertiary text-sm">No predefined observations for selected skills.</p>
          <p className="text-text-tertiary text-xs mt-1">Use the notes below to add custom observations.</p>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div>
          <h4 className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Strengths
          </h4>
          <div className="flex flex-wrap gap-2">
            {strengths.map(obs => {
              const selected = state.strengthObservationIds.includes(obs.id);
              const disabled = conflictDisabled.has(obs.id);
              return (
                <button
                  key={obs.id}
                  type="button"
                  onClick={() => toggleObservation(obs.id, 'strength')}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                    'active:scale-95',
                    disabled
                      ? 'bg-surface-3 text-text-tertiary border-border opacity-40 cursor-not-allowed line-through'
                      : selected
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                  )}
                  title={disabled ? 'Conflicts with a selected observation' : undefined}
                >
                  {obs.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Struggles / Areas for Growth */}
      {struggles.length > 0 && (
        <div>
          <h4 className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Areas for Growth
          </h4>
          <div className="flex flex-wrap gap-2">
            {struggles.map(obs => {
              const selected = state.struggleObservationIds.includes(obs.id);
              const disabled = conflictDisabled.has(obs.id);
              return (
                <button
                  key={obs.id}
                  type="button"
                  onClick={() => toggleObservation(obs.id, 'struggle')}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                    'active:scale-95',
                    disabled
                      ? 'bg-surface-3 text-text-tertiary border-border opacity-40 cursor-not-allowed line-through'
                      : selected
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                  )}
                  title={disabled ? 'Conflicts with a selected observation' : undefined}
                >
                  {obs.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom strength note */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-text-secondary text-xs font-medium">Custom Strength Note</label>
          {hasSpeechSupport && (
            <button
              type="button"
              onClick={() => toggleVoice('customStrengthNote')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                listeningField === 'customStrengthNote'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-text-tertiary hover:text-white',
              )}
            >
              {listeningField === 'customStrengthNote' ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        <textarea
          value={state.customStrengthNote}
          onChange={e => handleStrengthNoteChange(e.target.value)}
          placeholder="What went well..."
          rows={2}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
        />
        {strengthSuggestions.length > 0 && (
          <div className="mt-1 space-y-1">
            {strengthSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onUpdate({ customStrengthNote: state.customStrengthNote + ' ' + s }); setStrengthSuggestions([]); }}
                className="block w-full text-left text-[11px] text-[#00ABFF] bg-[#00ABFF]/10 px-3 py-1.5 rounded-lg hover:bg-[#00ABFF]/20 truncate"
              >
                ...{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom struggle note */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-text-secondary text-xs font-medium">Custom Growth Note</label>
          {hasSpeechSupport && (
            <button
              type="button"
              onClick={() => toggleVoice('customStruggleNote')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                listeningField === 'customStruggleNote'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-text-tertiary hover:text-white',
              )}
            >
              {listeningField === 'customStruggleNote' ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        <textarea
          value={state.customStruggleNote}
          onChange={e => handleStruggleNoteChange(e.target.value)}
          placeholder="What needs work..."
          rows={2}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
        />
        {struggleSuggestions.length > 0 && (
          <div className="mt-1 space-y-1">
            {struggleSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onUpdate({ customStruggleNote: state.customStruggleNote + ' ' + s }); setStruggleSuggestions([]); }}
                className="block w-full text-left text-[11px] text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-lg hover:bg-orange-500/20 truncate"
              >
                ...{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Words Watched */}
      <div className="pt-2 border-t border-border">
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">
          Words Watched (optional)
        </h4>

        {/* Words Struggled */}
        <WordTagInput
          label="Words Struggled"
          words={state.wordsStruggled || []}
          onChange={words => onUpdate({ wordsStruggled: words })}
          placeholder="Type a word and press Enter"
          chipClassName="bg-red-500/20 text-red-400 border-red-500/30"
        />

        {/* Words Mastered */}
        <div className="mt-3">
          <WordTagInput
            label="Words Mastered"
            words={state.wordsMastered || []}
            onChange={words => onUpdate({ wordsMastered: words })}
            placeholder="Type a word and press Enter"
            chipClassName="bg-green-500/20 text-green-400 border-green-500/30"
          />
        </div>
      </div>

      {/* Coach Voice Note */}
      <div className="pt-2 border-t border-border">
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-1">
          Quick Voice Note
        </h4>
        <p className="text-text-tertiary text-[11px] mb-3">
          Optional — helps capture nuance from in-person sessions
        </p>

        {state.coachVoiceNoteUrl ? (
          <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl p-3">
            <audio
              src={state.coachVoiceNoteUrl}
              controls
              className="flex-1 h-10 [&::-webkit-media-controls-panel]:bg-gray-700"
            />
            <button
              type="button"
              onClick={() => onUpdate({ coachVoiceNoteUrl: '' })}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <AudioRecorder
            sessionId={sessionId === 'new' ? 'capture-' + Date.now() : sessionId}
            audioType="voice_note"
            onUploadComplete={(storagePath) => onUpdate({ coachVoiceNoteUrl: storagePath })}
            maxDurationSeconds={120}
            promptText="Record a quick verbal debrief"
          />
        )}
      </div>
    </div>
  );
}
