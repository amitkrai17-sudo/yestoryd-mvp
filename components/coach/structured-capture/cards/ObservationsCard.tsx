// ============================================================
// Card 4: Observations — Strength/Struggle chips + custom notes
// With optional Web Speech API voice-to-text
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardProps, ObservationItem } from '../types';

interface ObservationsCardProps extends CardProps {
  observations: Record<string, ObservationItem[]>;
  loading: boolean;
}

// Flatten all observations into strength/struggle groups
function groupObservations(observations: Record<string, ObservationItem[]>) {
  const strengths: ObservationItem[] = [];
  const struggles: ObservationItem[] = [];

  for (const items of Object.values(observations)) {
    for (const obs of items) {
      if (obs.type === 'strength') strengths.push(obs);
      else if (obs.type === 'struggle') struggles.push(obs);
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

type SpeechField = 'customStrengthNote' | 'customStruggleNote';

export function ObservationsCard({ state, onUpdate, observations, loading }: ObservationsCardProps) {
  const [listeningField, setListeningField] = useState<SpeechField | null>(null);
  const recognitionRef = useRef<ReturnType<typeof Object.create> | null>(null);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const { strengths, struggles } = groupObservations(observations);

  const toggleObservation = (id: string, type: 'strength' | 'struggle') => {
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
        <Loader2 className="w-8 h-8 text-[#00ABFF] animate-spin mb-3" />
        <p className="text-text-tertiary text-sm">Loading observations...</p>
      </div>
    );
  }

  const noObservations = strengths.length === 0 && struggles.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Observations</h3>
        <p className="text-text-tertiary text-xs">
          Select observed strengths and areas for growth (optional)
        </p>
      </div>

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
              return (
                <button
                  key={obs.id}
                  type="button"
                  onClick={() => toggleObservation(obs.id, 'strength')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                    'active:scale-95',
                    selected
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                  )}
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
              return (
                <button
                  key={obs.id}
                  type="button"
                  onClick={() => toggleObservation(obs.id, 'struggle')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                    'active:scale-95',
                    selected
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                  )}
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
          onChange={e => onUpdate({ customStrengthNote: e.target.value })}
          placeholder="What went well..."
          rows={2}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
        />
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
          onChange={e => onUpdate({ customStruggleNote: e.target.value })}
          placeholder="What needs work..."
          rows={2}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
        />
      </div>
    </div>
  );
}
