// ============================================================
// StructuredCaptureForm — Chat-first capture:
// Phase 1: Conversational debrief with rAI (CaptureChat)
// Phase 2: Form review (3 cards: Skills+Obs → Artifact → Review+Submit)
// Coach can skip chat and go straight to form.
// ============================================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Bot, ClipboardList, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapture } from './useCapture';
import { CaptureChat, type ExtractedCaptureData } from './CaptureChat';
import type { CaptureFormProps, CaptureFormState } from './types';

// Card components (form phase)
import { SkillsObservationsCard } from './cards/SkillsObservationsCard';
import { ChildArtifactCard } from './cards/ChildArtifactCard';
import { ReviewSubmitCard } from './cards/ReviewSubmitCard';

const FORM_CARDS = 3;
const FORM_CARD_TITLES = ['Skills', 'Artifact', 'Review'];
const SWIPE_THRESHOLD = 50;

export default function StructuredCaptureForm(props: CaptureFormProps) {
  const { onClose, onComplete, childName, childAge, sessionId, sessionNumber, modality, isAiPrefilled, coachId, childId, initialData } = props;

  // Determine starting phase:
  // - AI pre-filled or initialData → skip straight to form
  // - Otherwise → show choice screen (Talk to rAI vs Skip to form)
  const skipChat = isAiPrefilled || !!initialData;
  const [phase, setPhase] = useState<'choose' | 'chat' | 'form'>(skipChat ? 'form' : 'choose');
  const [chatPrefill, setChatPrefill] = useState<Partial<CaptureFormState> | null>(null);

  // Form hook — initialized with either chat prefill, initialData, or empty
  const mergedInitialData = chatPrefill || initialData;
  const captureProps = chatPrefill ? { ...props, initialData: { ...initialData, ...chatPrefill } } : props;

  const {
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
  } = useCapture(captureProps);

  const [currentCard, setCurrentCard] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Chat context for CaptureChat
  const [childProfile, setChildProfile] = useState<any>(null);

  // Load child profile for chat context
  useEffect(() => {
    if ((phase !== 'chat' && phase !== 'choose') || !childId) return;
    async function loadContext() {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data } = await supabase
          .from('child_intelligence_profiles')
          .select('narrative_profile, skill_ratings')
          .eq('child_id', childId)
          .maybeSingle();
        setChildProfile(data);
      } catch {}
    }
    loadContext();
  }, [phase, childId]);

  // Navigation guards
  const canProceed = useCallback((fromCard: number): boolean => {
    switch (fromCard) {
      case 0: return state.selectedSkillIds.length > 0 && state.selectedSkillIds.some(id => state.skillPerformances[id]?.rating != null);
      case 1: return true; // artifact optional
      default: return true;
    }
  }, [state]);

  const goTo = useCallback((card: number) => {
    if (card < 0 || card >= FORM_CARDS) return;
    if (card > currentCard && !canProceed(currentCard)) return;
    setDirection(card > currentCard ? 1 : -1);
    setCurrentCard(card);
  }, [currentCard, canProceed]);

  const handleNext = useCallback(() => goTo(currentCard + 1), [currentCard, goTo]);
  const handlePrev = useCallback(() => goTo(currentCard - 1), [currentCard, goTo]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) handleNext();
    else handlePrev();
  }, [handleNext, handlePrev]);

  const handleSubmit = useCallback(async () => {
    try {
      const result = await submit();
      onComplete(result);
    } catch {}
  }, [submit, onComplete]);

  const handleChatComplete = useCallback((data: ExtractedCaptureData) => {
    // Apply chat extraction to form state
    const { _fromChat, ...formData } = data;
    setChatPrefill(formData);

    // Also directly update the live form state
    updateState(formData);

    setPhase('form');
  }, [updateState]);

  // --- CHOOSE PHASE (fork: Talk to rAI vs Skip to form) ---
  if (phase === 'choose') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
        <div className="flex-shrink-0 bg-gradient-to-r from-[#00ABFF] to-[#7C3AED] px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base truncate">Session Capture</h2>
              <p className="text-white/70 text-xs truncate">
                {childName} ({childAge}y){sessionNumber ? ` | Session #${sessionNumber}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {(microObsCount > 0 || activityLogCount > 0) && (
            <p className="text-white/40 text-xs text-center">
              {microObsCount > 0 ? `${microObsCount} notes` : ''}
              {microObsCount > 0 && activityLogCount > 0 ? ' + ' : ''}
              {activityLogCount > 0 ? `${activityLogCount} activities` : ''} captured during session
            </p>
          )}

          <p className="text-white/60 text-sm text-center max-w-xs">
            How would you like to complete your session capture?
          </p>

          <div className="w-full max-w-sm space-y-3">
            {/* Talk to rAI */}
            <button
              onClick={() => setPhase('chat')}
              className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-left hover:bg-white/10 active:scale-[0.98] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#00ABFF]/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-[#00ABFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Talk to rAI</p>
                <p className="text-white/40 text-xs mt-0.5">Quick voice debrief, AI fills the form for you</p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/40 flex-shrink-0" />
            </button>

            {/* Skip to form */}
            <button
              onClick={() => setPhase('form')}
              className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-left hover:bg-white/10 active:scale-[0.98] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Skip to form</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {microObsCount > 0
                    ? 'Pre-filled from your notes, review and submit'
                    : 'Fill skills, observations, and submit manually'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/40 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CHAT PHASE ---
  if (phase === 'chat') {
    return (
      <CaptureChat
        sessionId={sessionId}
        childId={childId}
        childName={childName}
        childAge={childAge}
        coachId={coachId}
        sessionModality={modality || 'online_1on1'}
        childProfile={childProfile}
        activeContinuations={(continuations || []).map(c => ({ id: c.id, observation_text: c.observation_text }))}
        skillCategories={modules.map(m => ({ id: m.module.id, label: m.module.name, skills: m.skills }))}
        onComplete={handleChatComplete}
        onCancel={() => setPhase('form')}
      />
    );
  }

  // --- FORM PHASE (3 cards: Skills → Artifact → Review) ---
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const isFromChat = !!chatPrefill;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Banners */}
      {isAiPrefilled && (
        <div className="flex-shrink-0 bg-amber-500/90 px-4 py-2 text-center">
          <p className="text-white text-xs font-medium">Pre-filled by AI from session transcript. Review and confirm.</p>
        </div>
      )}
      {isFromChat && !isAiPrefilled && (
        <div className="flex-shrink-0 bg-[#00ABFF]/90 px-4 py-2 text-center">
          <p className="text-white text-xs font-medium">Pre-filled from your voice debrief. Review, add photos, and submit.</p>
        </div>
      )}
      {(microObsCount > 0 || activityLogCount > 0 || recallPrefillAvailable) && !isFromChat && !isAiPrefilled && (
        <div className="flex-shrink-0 bg-[#00ABFF]/90 px-4 py-1.5 text-center">
          <p className="text-white text-[11px] font-medium">
            Pre-filled from{microObsCount > 0 ? ` ${microObsCount} notes` : ''}{microObsCount > 0 && (activityLogCount > 0 || recallPrefillAvailable) ? ' + ' : ''}{activityLogCount > 0 ? `${activityLogCount} activities` : ''}{activityLogCount > 0 && recallPrefillAvailable ? ' + ' : ''}{recallPrefillAvailable ? 'session recording' : ''}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#00ABFF] to-[#7C3AED] px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-base truncate">Session Capture</h2>
            <p className="text-white/70 text-xs truncate">
              {childName} ({childAge}y){sessionNumber ? ` | Session #${sessionNumber}` : ''}
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex gap-1">
          {Array.from({ length: FORM_CARDS }).map((_, i) => (
            <button key={i} onClick={() => goTo(i)} className="flex-1 h-1.5 rounded-full transition-all"
              style={{ backgroundColor: i <= currentCard ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {FORM_CARD_TITLES.map((title, i) => (
            <span key={title} className={cn('text-[9px] font-medium', i === currentCard ? 'text-white' : 'text-white/40')}>{title}</span>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div key={currentCard} custom={direction} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-y-auto px-4 py-4">

            {currentCard === 0 && (
              <SkillsObservationsCard state={state} onUpdate={updateState}
                modules={modules} observations={observations} continuations={continuations}
                loadingSkills={loadingSkills} loadingObservations={loadingObservations}
                isFromChat={isFromChat} />
            )}
            {currentCard === 1 && (
              <ChildArtifactCard state={state} onUpdate={updateState}
                sessionId={sessionId} isOnline={!modality || modality.startsWith('online')} modules={modules} />
            )}
            {currentCard === 2 && (
              <ReviewSubmitCard state={state} onUpdate={updateState}
                childName={childName} childAge={childAge} modules={modules}
                voiceSegments={null} scorePreview={scorePreview}
                submitting={submitting} submitError={submitError} onSubmit={handleSubmit}
                selectedSkillSlugs={modules.flatMap(m => m.skills).filter(s => state.selectedSkillIds.includes(s.id)).map(s => s.skillTag)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 bg-surface-1 border-t border-border px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={handlePrev} disabled={currentCard === 0}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
              currentCard === 0 ? 'text-text-tertiary cursor-not-allowed' : 'bg-surface-2 text-white hover:bg-surface-3 active:scale-[0.98]')}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-text-tertiary text-xs">{currentCard + 1} / {FORM_CARDS}</span>
          {currentCard < FORM_CARDS - 1 && (
            <button type="button" onClick={handleNext} disabled={!canProceed(currentCard)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
                canProceed(currentCard) ? 'bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 active:scale-[0.98]' : 'bg-surface-3 text-text-tertiary cursor-not-allowed')}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {currentCard === FORM_CARDS - 1 && <div className="w-[88px]" />}
        </div>
      </div>
    </div>
  );
}
