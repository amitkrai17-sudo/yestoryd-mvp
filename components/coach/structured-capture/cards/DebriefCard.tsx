// ============================================================
// Card 1: Debrief — Guided voice capture (optional, can skip)
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { Mic, SkipForward, CheckCircle } from 'lucide-react';
import { VoiceCapture, type VoiceCaptureResult } from '../VoiceCapture';
import type { CaptureFormState } from '../types';

interface DebriefCardProps {
  childName: string;
  voicePrompts: { q1: string; q2: string; q3: string; q4: string } | null;
  onVoiceComplete: (segments: { skills: string; strengths: string; struggles: string; homework: string }) => void;
  onSkip: () => void;
  state: CaptureFormState;
  onUpdate: (updates: Partial<CaptureFormState>) => void;
}

export function DebriefCard({ childName, voicePrompts, onVoiceComplete, onSkip, state, onUpdate }: DebriefCardProps) {
  const [showVoice, setShowVoice] = useState(false);
  const [debriefDone, setDebriefDone] = useState(false);

  const handleVoiceComplete = useCallback((result: VoiceCaptureResult) => {
    setShowVoice(false);
    setDebriefDone(true);

    // Pass segments up for use in Review card
    onVoiceComplete(result.segments);

    // Pre-fill form fields from voice
    const updates: Partial<CaptureFormState> = {};
    if (result.segments.strengths) updates.customStrengthNote = result.segments.strengths;
    if (result.segments.struggles) updates.customStruggleNote = result.segments.struggles;

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
      if (result.extracted.engagementLevel) {
        const levelMap: Record<string, string> = { high: 'high', medium: 'moderate', low: 'low' };
        const mapped = levelMap[result.extracted.engagementLevel.toLowerCase()];
        if (mapped) updates.engagementLevel = mapped as any;
      }
    }

    if (Object.keys(updates).length > 0) onUpdate(updates);
  }, [state.wordsMastered, state.wordsStruggled, onUpdate, onVoiceComplete]);

  if (showVoice) {
    return (
      <VoiceCapture
        childName={childName}
        prompts={voicePrompts || {
          q1: 'What did you work on with {childName} today?',
          q2: 'What went well?',
          q3: 'What did they find difficult?',
          q4: 'What should they practice at home?',
        }}
        onComplete={handleVoiceComplete}
        onCancel={() => setShowVoice(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/20 rounded-2xl p-3">
        <p className="text-[#00ABFF] text-xs leading-relaxed">
          Speak for ~1 minute. AI will generate your session summary, observations, and homework automatically. You can edit everything on the review page.
        </p>
      </div>

      <div>
        <h3 className="text-white font-semibold text-base mb-1">Session Debrief</h3>
        <p className="text-text-tertiary text-xs">
          Quick voice debrief while the session is fresh. You can also skip and fill manually.
        </p>
      </div>

      {debriefDone ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
          <p className="text-white font-medium">Debrief recorded</p>
          <p className="text-text-tertiary text-xs">
            Your notes have been captured and will pre-fill the next steps.
          </p>
          <button
            onClick={() => setShowVoice(true)}
            className="text-[#00ABFF] text-xs font-medium"
          >
            Redo voice debrief
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary CTA: Voice */}
          <button
            onClick={() => setShowVoice(true)}
            className="w-full bg-[#00ABFF] text-white rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-[#00ABFF]/90 transition-colors active:scale-[0.98]"
          >
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <p className="font-semibold text-base">Voice Debrief</p>
              <p className="text-white/70 text-xs mt-0.5">4 guided questions, ~1 minute</p>
            </div>
          </button>

          {/* Secondary: Skip */}
          <button
            onClick={onSkip}
            className="w-full flex items-center justify-center gap-2 text-text-tertiary text-sm py-3 hover:text-white transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Skip, I'll fill manually
          </button>
        </div>
      )}
    </div>
  );
}
