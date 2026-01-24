// =============================================================================
// FILE: components/coach/session-form/index.tsx
// PURPOSE: Main Session Completion Form (v2.0)
// USAGE: <SessionForm sessionId="..." childName="..." ... />
// =============================================================================

'use client';

import { useState } from 'react';
import { X, BookOpen, Sparkles } from 'lucide-react';
import { SessionFormProps, SessionFormState, createInitialFormState } from './types';
import { BRAND_COLORS } from './constants';
import {
  mapFormToEventData,
  mapFormToChildSummary,
  buildContentForEmbedding,
  validateFormState,
} from './utils/mapToEventData';

// Step Components
import Step1QuickPulse from './steps/Step1QuickPulse';
import Step2DeepDive from './steps/Step2DeepDive';
import Step3Planning from './steps/Step3Planning';
import Step4Review from './steps/Step4Review';

const TOTAL_STEPS = 4;

const STEP_TITLES = [
  'Quick Pulse',
  'Deep Dive',
  'Planning',
  'Review',
];

export default function SessionForm({
  sessionId,
  childId,
  childName,
  childAge,
  coachId,
  sessionNumber,
  onClose,
  onComplete,
}: SessionFormProps) {
  const [step, setStep] = useState(1);
  const [formState, setFormState] = useState<SessionFormState>(createInitialFormState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = (step / TOTAL_STEPS) * 100;

  const handleUpdate = (updates: Partial<SessionFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    const validation = validateFormState(formState);
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Map form data to API format
      const eventData = mapFormToEventData(formState, sessionId, sessionNumber, 'coaching');
      const childSummary = mapFormToChildSummary(formState);
      const contentForEmbedding = buildContentForEmbedding(formState, childName);

      // Debug logging (remove in production)
      console.log('=== SESSION FORM SUBMISSION ===');
      console.log('Session ID:', sessionId);
      console.log('Child:', childName, `(Age ${childAge})`);
      console.log('Session #:', sessionNumber);
      console.log('---');
      console.log('Form State:', formState);
      console.log('---');
      console.log('Event Data (for learning_events):', eventData);
      console.log('---');
      console.log('Child Summary (for children cache):', childSummary);
      console.log('---');
      console.log('Content for Embedding (for RAG):', contentForEmbedding);
      console.log('================================');

      // Submit to API
      const response = await fetch(`/api/coach/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Session status
          status: 'completed',
          completedAt: new Date().toISOString(),

          // Learning event data (for learning_events table)
          eventData,
          contentForEmbedding,

          // Child summary cache (for children table)
          childSummary,

          // Raw form data for backwards compatibility
          focusArea: formState.primaryFocus,
          progressRating: formState.focusProgress,
          engagementLevel: formState.engagementLevel,
          sessionHighlights: formState.highlights,
          sessionStruggles: formState.challenges,
          skillsWorkedOn: formState.skillsPracticed,
          homeworkAssigned: formState.homeworkAssigned,
          homeworkDescription: formState.homeworkItems.join('; '),
          nextSessionFocus: [formState.nextSessionFocus],
          parentUpdateNeeded: formState.parentUpdateNeeded,
          coachNotes: formState.additionalNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete session');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${BRAND_COLORS.dark} 0%, ${BRAND_COLORS.darkGray} 50%, ${BRAND_COLORS.dark} 100%)`,
          border: `1px solid ${BRAND_COLORS.mediumGray}`,
        }}
      >
        {/* Header */}
        <div
          className="relative p-6"
          style={{
            background: `linear-gradient(135deg, ${BRAND_COLORS.hotPink} 0%, ${BRAND_COLORS.deepPurple} 50%, ${BRAND_COLORS.electricBlue} 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Session Complete
                  <Sparkles className="w-5 h-5" style={{ color: BRAND_COLORS.yellow }} />
                </h2>
                <p className="text-white/80 text-sm">
                  {childName} ({childAge} years) | Session #{sessionNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-all"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-white/70">
                Step {step}: {STEP_TITLES[step - 1]}
              </span>
              <span className="text-xs font-medium text-white/70">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${BRAND_COLORS.yellow} 0%, ${BRAND_COLORS.hotPink} 100%)`,
                }}
              />
            </div>
            {/* Step indicators */}
            <div className="flex justify-between mt-2">
              {STEP_TITLES.map((title, index) => (
                <div
                  key={title}
                  className={`text-xs ${index + 1 <= step ? 'text-white' : 'text-white/40'}`}
                >
                  {index + 1}. {title}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
          {error && (
            <div
              className="mb-4 p-4 rounded-xl flex items-start gap-3"
              style={{
                background: `${BRAND_COLORS.errorRed}15`,
                border: `1px solid ${BRAND_COLORS.errorRed}40`,
              }}
            >
              <X className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BRAND_COLORS.errorRed }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.errorRed }}>{error}</p>
            </div>
          )}

          {/* Step 1: Quick Pulse */}
          {step === 1 && (
            <Step1QuickPulse
              formState={formState}
              childAge={childAge}
              onUpdate={handleUpdate}
              onNext={handleNext}
            />
          )}

          {/* Step 2: Deep Dive */}
          {step === 2 && (
            <Step2DeepDive
              formState={formState}
              childAge={childAge}
              onUpdate={handleUpdate}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 3: Planning */}
          {step === 3 && (
            <Step3Planning
              formState={formState}
              childId={childId}
              childName={childName}
              childAge={childAge}
              sessionNumber={sessionNumber}
              onUpdate={handleUpdate}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <Step4Review
              formState={formState}
              childName={childName}
              sessionNumber={sessionNumber}
              onUpdate={handleUpdate}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export types for external use
export * from './types';
export * from './constants';
export * from './utils/mapToEventData';
