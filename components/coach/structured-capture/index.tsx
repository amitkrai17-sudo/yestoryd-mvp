// ============================================================
// StructuredCaptureForm — Main 5-card swipe capture UI
// Fixed overlay modal with gradient header, AnimatePresence
// slide transitions, swipe detection, bottom-anchored nav
// ============================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapture } from './useCapture';
import type { CaptureFormProps } from './types';

// Card components
import { SkillsCoveredCard } from './cards/SkillsCoveredCard';
import { PerformanceCard } from './cards/PerformanceCard';
import { ChildArtifactCard } from './cards/ChildArtifactCard';
import { ObservationsCard } from './cards/ObservationsCard';
import { EngagementSubmitCard } from './cards/EngagementSubmitCard';

const TOTAL_CARDS = 5;
const CARD_TITLES = ['Skills', 'Performance', 'Artifact', 'Observations', 'Submit'];
const SWIPE_THRESHOLD = 50;

export default function StructuredCaptureForm(props: CaptureFormProps) {
  const { onClose, onComplete, childName, childAge, sessionId, sessionNumber } = props;

  const {
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
  } = useCapture(props);

  const [currentCard, setCurrentCard] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Navigation guards
  const canProceed = useCallback((fromCard: number): boolean => {
    switch (fromCard) {
      case 0: return state.selectedSkillIds.length > 0;
      case 1: return state.selectedSkillIds.some(id => state.skillPerformances[id]?.rating != null);
      case 2: return true; // artifact optional
      case 3: return true; // observations optional
      default: return true;
    }
  }, [state]);

  const goTo = useCallback((card: number) => {
    if (card < 0 || card >= TOTAL_CARDS) return;
    if (card > currentCard && !canProceed(currentCard)) return;
    setDirection(card > currentCard ? 1 : -1);
    setCurrentCard(card);
  }, [currentCard, canProceed]);

  const handleNext = useCallback(() => goTo(currentCard + 1), [currentCard, goTo]);
  const handlePrev = useCallback(() => goTo(currentCard - 1), [currentCard, goTo]);

  // Touch swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only handle horizontal swipes (not vertical scroll)
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) handleNext(); // swipe left = next
    else handlePrev(); // swipe right = prev
  }, [handleNext, handlePrev]);

  const handleSubmit = useCallback(async () => {
    try {
      const result = await submit();
      onComplete(result);
    } catch {
      // Error is displayed in the card via submitError
    }
  }, [submit, onComplete]);

  // Animation variants
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Header with gradient */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#00ABFF] to-[#7C3AED] px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-base truncate">Session Capture</h2>
            <p className="text-white/70 text-xs truncate">
              {childName} ({childAge}y){sessionNumber ? ` | Session #${sessionNumber}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* 5-segment progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: i <= currentCard ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {CARD_TITLES.map((title, i) => (
            <span
              key={title}
              className={cn(
                'text-[9px] font-medium transition-colors',
                i === currentCard ? 'text-white' : 'text-white/40',
              )}
            >
              {title}
            </span>
          ))}
        </div>
      </div>

      {/* Card content area */}
      <div
        className="flex-1 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentCard}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-y-auto px-4 py-4"
          >
            {currentCard === 0 && (
              <SkillsCoveredCard
                state={state}
                onUpdate={updateState}
                modules={modules}
                loading={loadingSkills}
              />
            )}
            {currentCard === 1 && (
              <PerformanceCard
                state={state}
                onUpdate={updateState}
                modules={modules}
              />
            )}
            {currentCard === 2 && (
              <ChildArtifactCard
                state={state}
                onUpdate={updateState}
                sessionId={sessionId}
              />
            )}
            {currentCard === 3 && (
              <ObservationsCard
                state={state}
                onUpdate={updateState}
                observations={observations}
                loading={loadingObservations}
              />
            )}
            {currentCard === 4 && (
              <EngagementSubmitCard
                state={state}
                onUpdate={updateState}
                scorePreview={scorePreview}
                submitting={submitting}
                submitError={submitError}
                onSubmit={handleSubmit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="flex-shrink-0 bg-surface-1 border-t border-border px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-between gap-3">
          {/* Previous button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentCard === 0}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
              currentCard === 0
                ? 'text-text-tertiary cursor-not-allowed'
                : 'bg-surface-2 text-white hover:bg-surface-3 active:scale-[0.98]',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {/* Card indicator */}
          <span className="text-text-tertiary text-xs">
            {currentCard + 1} / {TOTAL_CARDS}
          </span>

          {/* Next button (not shown on last card) */}
          {currentCard < TOTAL_CARDS - 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(currentCard)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
                canProceed(currentCard)
                  ? 'bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 active:scale-[0.98]'
                  : 'bg-surface-3 text-text-tertiary cursor-not-allowed',
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Spacer on last card to keep layout balanced */}
          {currentCard === TOTAL_CARDS - 1 && (
            <div className="w-[88px]" />
          )}
        </div>
      </div>
    </div>
  );
}
