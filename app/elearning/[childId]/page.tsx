// ============================================================
// E-Learning Session Page
// ============================================================
// Voice-guided interactive reading session for children.
// State machine: LOADING → WELCOME → WARMUP → READING →
//   COMPREHENSION → CREATIVE → CELEBRATION → DONE
//
// Mobile-first, full-screen, no nav bar.
// Voice: useTTS hook (Google Cloud TTS → Web Speech fallback).
// Audio recording: MediaRecorder for pronunciation practice.
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useTTS } from '@/hooks/useTTS';
import { playSound, playFeedback, playHaptic } from '@/lib/sounds';
import type {
  SessionPlan,
  WarmUpSegment,
  ReadingSegment,
  ComprehensionSegment,
  CreativeSegment,
  WarmUpWord,
} from '@/lib/elearning/types';
import {
  Volume2, VolumeX, Mic, MicOff, Square, ArrowRight, ArrowLeft,
  Sparkles, Star, BookOpen, PenTool, X, Camera, Check,
  RefreshCw, ChevronRight, Home, Frown, PartyPopper, Zap,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────

type SessionState =
  | 'LOADING'
  | 'WELCOME'
  | 'WARMUP'
  | 'READING'
  | 'COMPREHENSION'
  | 'CREATIVE'
  | 'CELEBRATION'
  | 'DONE';

interface InteractResponse {
  success: boolean;
  score: number;
  feedback: string;
  encouragement: string;
  details: Record<string, unknown>;
  xp_earned: number;
  session_progress: {
    segments_completed: number;
    total_segments: number;
    is_complete: boolean;
  };
}

// ─── Constants ────────────────────────────────────────────────

// Infrastructure: auto-end session after inactivity to prevent stale state
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const STATE_ORDER: SessionState[] = [
  'LOADING', 'WELCOME', 'WARMUP', 'READING', 'COMPREHENSION', 'CREATIVE', 'CELEBRATION', 'DONE',
];

const SEGMENT_INDEX_MAP: Record<string, number> = {
  WARMUP: 0,
  READING: 1,
  COMPREHENSION: 2,
  CREATIVE: 3,
};

// ─── Helper: detect supported audio MIME type ─────────────────

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

// ─── Page Component ───────────────────────────────────────────

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default function ELearningSessionPage({ params }: PageProps) {
  const { childId } = use(params);
  const router = useRouter();

  // ─── Core state ───
  const [state, setState] = useState<SessionState>('LOADING');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [totalXP, setTotalXP] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);

  // ─── Warmup state ───
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [warmupFeedback, setWarmupFeedback] = useState<{ score: number; feedback: string; encouragement: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // ─── Comprehension state ───
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [compFeedback, setCompFeedback] = useState<{ score: number; feedback: string; encouragement: string } | null>(null);

  // ─── Creative state ───
  const [creativeText, setCreativeText] = useState('');
  const [creativeFeedback, setCreativeFeedback] = useState<{ score: number; feedback: string; encouragement: string } | null>(null);

  // ─── Loading/submitting ───
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Refs ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  // ─── TTS ───
  const childAge = plan?.child_age || 8;
  const childName = plan?.child_name || 'Reader';
  const { speak, stop: stopTTS, isPlaying: isSpeaking } = useTTS({ age: childAge });

  // ─── Voice helper (respects voiceEnabled) ───
  const voice = useCallback(
    async (text: string) => {
      if (voiceEnabled && text) {
        try {
          await speak(text);
        } catch {
          // Voice failed silently — text-only mode
        }
      }
    },
    [voiceEnabled, speak],
  );

  // ─── Inactivity timeout ───
  const resetInactivity = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      stopTTS();
      setState('DONE');
    }, INACTIVITY_TIMEOUT_MS);
  }, [stopTTS]);

  useEffect(() => {
    resetInactivity();
    return () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [state, resetInactivity]);

  // ─── Detect MIME type on mount ───
  useEffect(() => {
    mimeTypeRef.current = getSupportedMimeType();
  }, []);

  // ─── Generate or resume session ───
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Check auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/parent/login');
          return;
        }

        // Check for existing active session
        const { data: existing } = await supabase
          .from('elearning_sessions' as any)
          .select('id, session_plan, segments_completed, total_segments, started_at')
          .eq('child_id', childId)
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!cancelled && existing && (existing as any[]).length > 0) {
          const session = (existing as any[])[0];
          setSessionId(session.id);
          setPlan(session.session_plan as SessionPlan);

          // Resume from where we left off
          const completed = session.segments_completed || 0;
          if (completed === 0) {
            setState('WELCOME');
          } else if (completed < session.total_segments) {
            // Find the next incomplete segment
            const segmentStates: SessionState[] = ['WARMUP', 'READING', 'COMPREHENSION', 'CREATIVE'];
            setState(segmentStates[Math.min(completed, segmentStates.length - 1)]);
          } else {
            setState('CELEBRATION');
          }
          return;
        }

        // Generate new session
        const res = await fetch('/api/elearning/session/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ child_id: childId }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to generate session: ${res.status}`);
        }

        const data = await res.json();
        if (!cancelled) {
          setSessionId(data.session_id);
          setPlan(data.session_plan);
          setState('WELCOME');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load session');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [childId, router]);

  // ─── Speak welcome on entering WELCOME state ───
  useEffect(() => {
    if (state === 'WELCOME' && plan) {
      voice(`Hi ${plan.child_name}! I picked a great story for you today. Let's warm up first!`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, plan?.child_name]);

  // ─── API call helper ───
  async function interact(
    segmentIndex: number,
    responseType: string,
    responseData: Record<string, unknown>,
  ): Promise<InteractResponse | null> {
    if (!sessionId) return null;
    resetInactivity();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/elearning/session/${sessionId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_index: segmentIndex,
          response_type: responseType,
          response_data: responseData,
        }),
      });

      if (!res.ok) {
        throw new Error(`Interaction failed: ${res.status}`);
      }

      const data: InteractResponse = await res.json();
      setTotalXP(prev => prev + data.xp_earned);
      setTotalScore(prev => prev + data.score);
      setInteractionCount(prev => prev + 1);
      return data;
    } catch (err) {
      console.error('Interaction error:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── State transition ───
  function goToNext() {
    resetInactivity();
    const currentIdx = STATE_ORDER.indexOf(state);
    if (currentIdx >= 0 && currentIdx < STATE_ORDER.length - 1) {
      const next = STATE_ORDER[currentIdx + 1];
      setState(next);
      // Reset segment-specific state
      if (next === 'COMPREHENSION') {
        setQuestionIndex(0);
        setAnswerText('');
        setSelectedOption(null);
        setCompFeedback(null);
      }
      if (next === 'CREATIVE') {
        setCreativeText('');
        setCreativeFeedback(null);
      }
    }
  }

  // ─── Recording helpers ───
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeTypeRef.current,
        audioBitsPerSecond: 128000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        // Convert to base64 and send to API
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]; // strip data URL prefix
          await submitPronunciation(base64);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWarmupFeedback(null);
      playSound('start');

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      setWarmupFeedback({
        score: 0,
        feedback: 'Could not access microphone. Please allow microphone permission.',
        encouragement: 'Tap the settings icon in your browser to enable microphone.',
      });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function submitPronunciation(audioBase64: string) {
    const warmup = plan?.segments[0] as WarmUpSegment | undefined;
    if (!warmup) return;

    const result = await interact(SEGMENT_INDEX_MAP.WARMUP, 'pronunciation', {
      word_index: warmupIndex,
      audio_base64: audioBase64,
      audio_mime_type: mimeTypeRef.current,
    });

    if (result) {
      setWarmupFeedback({
        score: result.score,
        feedback: result.feedback,
        encouragement: result.encouragement,
      });

      if (result.score >= 7) {
        playFeedback('success', 'light');
      } else {
        playSound('click');
      }

      voice(result.feedback);
    }
  }

  // ─── Comprehension submit ───
  async function submitComprehension() {
    const comp = plan?.segments[2] as ComprehensionSegment | undefined;
    if (!comp) return;

    const question = comp.questions[questionIndex];
    if (!question) return;

    const answer = question.options ? selectedOption : answerText;
    if (!answer || answer.trim().length === 0) return;

    const result = await interact(SEGMENT_INDEX_MAP.COMPREHENSION, 'comprehension', {
      question_index: questionIndex,
      answer: answer.trim(),
    });

    if (result) {
      setCompFeedback({
        score: result.score,
        feedback: result.feedback,
        encouragement: result.encouragement,
      });

      if (result.score >= 7) playFeedback('success', 'light');
      voice(result.feedback);
    }
  }

  // ─── Creative submit ───
  async function submitCreative() {
    if (!creativeText.trim()) return;

    const result = await interact(SEGMENT_INDEX_MAP.CREATIVE, 'creative', {
      text: creativeText.trim(),
    });

    if (result) {
      setCreativeFeedback({
        score: result.score,
        feedback: result.feedback,
        encouragement: result.encouragement,
      });
      playFeedback('complete', 'medium');
      voice(result.encouragement);
    }
  }

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      stopTTS();
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render helpers ─────────────────────────────────────────

  const warmup = plan?.segments.find(s => s.type === 'warmup') as WarmUpSegment | undefined;
  const reading = plan?.segments.find(s => s.type === 'reading') as ReadingSegment | undefined;
  const comprehension = plan?.segments.find(s => s.type === 'comprehension') as ComprehensionSegment | undefined;
  const creative = plan?.segments.find(s => s.type === 'creative') as CreativeSegment | undefined;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-white flex flex-col">
      {/* ─── Top bar (voice toggle + exit) ─── */}
      {state !== 'LOADING' && (
        <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <button
            onClick={() => { stopTTS(); router.back(); }}
            className="flex items-center gap-1 text-gray-500 text-sm"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {['WARMUP', 'READING', 'COMPREHENSION', 'CREATIVE'].map((s, i) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  STATE_ORDER.indexOf(state) > STATE_ORDER.indexOf(s as SessionState)
                    ? 'bg-green-400 scale-110'
                    : state === s
                      ? 'bg-[#FF0099] scale-125'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* XP counter */}
            {totalXP > 0 && (
              <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full">
                {totalXP} XP
              </span>
            )}
            <button
              onClick={() => {
                setVoiceEnabled(v => !v);
                if (voiceEnabled) stopTTS();
              }}
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5 text-[#7b008b]" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
        </div>
      )}

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* ═══ LOADING ═══ */}
          {state === 'LOADING' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              {error ? (
                <div className="space-y-4">
                  <div className="flex justify-center"><Frown className="w-12 h-12 text-gray-400" /></div>
                  <p className="text-gray-600 text-lg">{error}</p>
                  <button
                    onClick={() => { setError(null); window.location.reload(); }}
                    className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#FF0099] text-white rounded-2xl font-semibold"
                  >
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="inline-block"
                  >
                    <Sparkles className="w-12 h-12 text-[#FF0099]" />
                  </motion.div>
                  <p className="text-lg text-gray-600 font-medium">
                    Preparing your reading adventure...
                  </p>
                  <Spinner className="mx-auto" />
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ WELCOME ═══ */}
          {state === 'WELCOME' && plan && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="text-center space-y-6 py-8"
            >
              {/* Character */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center"
              >
                <BookOpen className="w-20 h-20 text-[#FF0099]" />
              </motion.div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FF0099] to-[#7b008b] bg-clip-text text-transparent">
                  Hi {childName}!
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed px-4">
                  I picked a great story for you today.
                  <br />
                  Let&apos;s warm up first!
                </p>
              </div>

              {/* Session preview */}
              <div className="flex justify-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Sparkles className="w-4 h-4 text-amber-400" /> Warm-up</span>
                <span className="flex items-center gap-1"><BookOpen className="w-4 h-4 text-blue-400" /> Story</span>
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-green-400" /> Quiz</span>
                <span className="flex items-center gap-1"><PenTool className="w-4 h-4 text-purple-400" /> Create</span>
              </div>

              <p className="text-sm text-gray-400">
                About {plan.estimated_minutes} minutes
              </p>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  playFeedback('start', 'light');
                  goToNext();
                }}
                className="px-10 py-4 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white text-xl font-bold rounded-full shadow-lg shadow-pink-200 active:shadow-md transition-shadow"
              >
                Let&apos;s Start!
              </motion.button>
            </motion.div>
          )}

          {/* ═══ WARMUP ═══ */}
          {state === 'WARMUP' && warmup && (
            <motion.div
              key="warmup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-6 py-4"
            >
              <div className="text-center">
                <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  Warm-up ({warmupIndex + 1}/{warmup.words.length})
                </span>
                <p className="text-sm text-gray-500 mt-2">{warmup.instructions}</p>
              </div>

              {/* Word card */}
              <WordCard
                word={warmup.words[warmupIndex]}
                voiceEnabled={voiceEnabled}
                speak={voice}
                isSpeaking={isSpeaking}
              />

              {/* Recording controls */}
              <div className="flex flex-col items-center gap-4">
                {!isRecording ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={startRecording}
                    disabled={isSubmitting}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
                  >
                    <Mic className="w-8 h-8" />
                  </motion.button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      onClick={stopRecording}
                      className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"
                    >
                      <Square className="w-6 h-6 fill-white" />
                    </motion.button>
                    <span className="text-sm text-red-500 font-mono">{recordingTime}s</span>
                  </div>
                )}

                {!isRecording && !warmupFeedback && !isSubmitting && (
                  <p className="text-sm text-gray-400">Tap to record yourself saying the word</p>
                )}

                {isSubmitting && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner size="sm" /> Listening...
                  </div>
                )}
              </div>

              {/* Feedback */}
              {warmupFeedback && (
                <FeedbackCard
                  score={warmupFeedback.score}
                  feedback={warmupFeedback.feedback}
                  encouragement={warmupFeedback.encouragement}
                />
              )}

              {/* Next word / Next section */}
              {warmupFeedback && (
                <div className="flex justify-center">
                  {warmupIndex < warmup.words.length - 1 ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setWarmupIndex(i => i + 1);
                        setWarmupFeedback(null);
                        playSound('click');
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-full font-semibold"
                    >
                      Next Word <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        playFeedback('success', 'medium');
                        voice("Great warm-up! Now let's read a story together.");
                        goToNext();
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white rounded-full font-semibold"
                    >
                      On to the Story! <BookOpen className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              )}

              {/* Skip option */}
              {!warmupFeedback && !isRecording && !isSubmitting && (
                <button
                  onClick={() => {
                    if (warmupIndex < warmup.words.length - 1) {
                      setWarmupIndex(i => i + 1);
                    } else {
                      goToNext();
                    }
                  }}
                  className="text-sm text-gray-400 underline mx-auto block"
                >
                  Skip this word
                </button>
              )}
            </motion.div>
          )}

          {/* ═══ READING ═══ */}
          {state === 'READING' && reading && (
            <motion.div
              key="reading"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-5 py-4"
            >
              <div className="text-center">
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Reading Time
                </span>
              </div>

              <h2 className="text-2xl font-bold text-center text-gray-800">
                {reading.title}
              </h2>

              {/* Passage with tap-to-hear words */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <ReadingPassage
                  passage={reading.passage}
                  voiceEnabled={voiceEnabled}
                  speak={voice}
                  childAge={childAge}
                />
              </div>

              {/* Read aloud button */}
              <div className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => voice(reading.passage)}
                  disabled={isSpeaking}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium disabled:opacity-50"
                >
                  <Volume2 className="w-4 h-4" />
                  {isSpeaking ? 'Reading...' : 'Read to Me'}
                </motion.button>
              </div>

              <p className="text-xs text-center text-gray-400">
                {reading.word_count} words · Tap any word to hear it
              </p>

              {/* Continue */}
              <div className="flex justify-center pt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    playSound('click');
                    voice("Great reading! Now let's see how well you understood the story.");
                    goToNext();
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white rounded-full font-semibold"
                >
                  I&apos;m Done Reading <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ COMPREHENSION ═══ */}
          {state === 'COMPREHENSION' && comprehension && (
            <motion.div
              key="comprehension"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-5 py-4"
            >
              <div className="text-center">
                <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  Question {questionIndex + 1} of {comprehension.questions.length}
                </span>
              </div>

              {(() => {
                const q = comprehension.questions[questionIndex];
                if (!q) return null;
                const useMCQ = q.options && q.options.length > 0 && childAge <= 6;

                return (
                  <div className="space-y-4">
                    {/* Question */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <p className="text-lg font-medium text-gray-800 leading-relaxed">
                        {q.question}
                      </p>

                      {/* Hear question */}
                      <button
                        onClick={() => voice(q.question)}
                        className="mt-2 text-sm text-[#7b008b] flex items-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Hear question
                      </button>
                    </div>

                    {/* MCQ for young children */}
                    {useMCQ ? (
                      <div className="space-y-2">
                        {q.options!.map((opt, i) => (
                          <motion.button
                            key={i}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedOption(opt);
                              playHaptic('light');
                            }}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 text-base font-medium transition-all ${
                              selectedOption === opt
                                ? 'border-[#FF0099] bg-pink-50 text-[#FF0099]'
                                : 'border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            {opt}
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      /* Text input for older children */
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Type your answer here..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#FF0099] focus:ring-0 outline-none text-base resize-none"
                      />
                    )}

                    {/* Submit */}
                    {!compFeedback && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={submitComprehension}
                        disabled={isSubmitting || (!selectedOption && !answerText.trim())}
                        className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? <Spinner color="white" /> : <Check className="w-5 h-5" />}
                        {isSubmitting ? 'Checking...' : 'Submit Answer'}
                      </motion.button>
                    )}

                    {/* Feedback */}
                    {compFeedback && (
                      <>
                        <FeedbackCard
                          score={compFeedback.score}
                          feedback={compFeedback.feedback}
                          encouragement={compFeedback.encouragement}
                        />
                        <div className="flex justify-center">
                          {questionIndex < comprehension.questions.length - 1 ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setQuestionIndex(i => i + 1);
                                setAnswerText('');
                                setSelectedOption(null);
                                setCompFeedback(null);
                                playSound('click');
                              }}
                              className="flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-full font-semibold"
                            >
                              Next Question <ChevronRight className="w-4 h-4" />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                playFeedback('success', 'medium');
                                voice("Awesome answers! Now it's your turn to be creative!");
                                goToNext();
                              }}
                              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white rounded-full font-semibold"
                            >
                              Time to Create! <PenTool className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ═══ CREATIVE ═══ */}
          {state === 'CREATIVE' && creative && (
            <motion.div
              key="creative"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-5 py-4"
            >
              <div className="text-center">
                <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  Your Turn to Create!
                </span>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-lg text-gray-800 leading-relaxed">
                  {creative.prompt_text}
                </p>
                <button
                  onClick={() => voice(creative.prompt_text)}
                  className="mt-2 text-sm text-[#7b008b] flex items-center gap-1"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Hear prompt
                </button>
              </div>

              {!creativeFeedback ? (
                <>
                  <textarea
                    value={creativeText}
                    onChange={e => setCreativeText(e.target.value)}
                    placeholder="Write your response here..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-0 outline-none text-base resize-none"
                  />

                  <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                    <span>{creativeText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>Aim for ~{creative.word_limit_hint} words</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={submitCreative}
                    disabled={isSubmitting || !creativeText.trim()}
                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Spinner color="white" /> : <PenTool className="w-5 h-5" />}
                    {isSubmitting ? 'Reading your work...' : 'Submit'}
                  </motion.button>
                </>
              ) : (
                <>
                  <FeedbackCard
                    score={creativeFeedback.score}
                    feedback={creativeFeedback.feedback}
                    encouragement={creativeFeedback.encouragement}
                  />
                  <div className="flex justify-center">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        playFeedback('complete', 'heavy');
                        goToNext();
                      }}
                      className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white rounded-full font-bold text-lg"
                    >
                      See My Results! <Sparkles className="w-5 h-5" />
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ═══ CELEBRATION ═══ */}
          {state === 'CELEBRATION' && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6 py-8 relative"
            >
              {/* Confetti particles */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                {[...Array(40)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-3 h-3 rounded-full"
                    style={{
                      background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#FF0099', '#00ABFF'][i % 6],
                      left: `${Math.random() * 100}%`,
                      top: '-10px',
                    }}
                    animate={{
                      y: ['0vh', '110vh'],
                      x: [0, (Math.random() - 0.5) * 200],
                      rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                      opacity: [1, 1, 0],
                    }}
                    transition={{
                      duration: 2.5 + Math.random() * 2,
                      delay: Math.random() * 1.5,
                      ease: 'easeIn',
                    }}
                  />
                ))}
              </div>

              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: 3 }}
                className="flex justify-center relative z-10"
              >
                <PartyPopper className="w-20 h-20 text-amber-400" />
              </motion.div>

              <div className="relative z-10 space-y-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FF0099] to-[#7b008b] bg-clip-text text-transparent">
                  Amazing Job, {childName}!
                </h1>

                <p className="text-lg text-gray-600">
                  You completed your reading session!
                </p>

                {/* Stats */}
                <div className="flex justify-center gap-6 pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{totalXP}</div>
                    <div className="text-xs text-gray-400 mt-1">XP Earned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#FF0099]">
                      {interactionCount > 0 ? Math.round(totalScore / interactionCount) : 0}/10
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">{interactionCount}</div>
                    <div className="text-xs text-gray-400 mt-1">Activities</div>
                  </div>
                </div>

                {/* Stars */}
                <div className="flex justify-center gap-1 pt-3">
                  {[1, 2, 3, 4, 5].map(i => {
                    const avgScore = interactionCount > 0 ? totalScore / interactionCount : 5;
                    const filled = i <= Math.round(avgScore / 2);
                    return (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3 + i * 0.15 }}
                      >
                        <Star
                          className={`w-8 h-8 ${filled ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  voice(`Great job today ${childName}! See you next time!`);
                  setState('DONE');
                }}
                className="relative z-10 px-8 py-4 bg-gradient-to-r from-[#FF0099] to-[#7b008b] text-white rounded-full font-bold text-lg shadow-lg"
              >
                Done!
              </motion.button>
            </motion.div>
          )}

          {/* ═══ DONE ═══ */}
          {state === 'DONE' && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-6 py-12"
            >
              <div className="flex justify-center"><BookOpen className="w-16 h-16 text-[#FF0099]" /></div>
              <h2 className="text-2xl font-bold text-gray-800">See you next time!</h2>
              <p className="text-gray-500">Your progress has been saved.</p>

              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push('/parent/dashboard')}
                  className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#FF0099] text-white rounded-full font-semibold"
                >
                  <Home className="w-4 h-4" /> Back to Dashboard
                </motion.button>

                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-[#7b008b] underline"
                >
                  Start Another Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

// ─── Word Card ────────────────────────────────────────────────

function WordCard({
  word,
  voiceEnabled,
  speak,
  isSpeaking,
}: {
  word: WarmUpWord;
  voiceEnabled: boolean;
  speak: (text: string) => void;
  isSpeaking: boolean;
}) {
  useEffect(() => {
    // Auto-pronounce word when card appears
    if (voiceEnabled) speak(word.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.word]);

  const difficultyColors = {
    easy: 'from-green-400 to-emerald-500',
    medium: 'from-amber-400 to-orange-500',
    hard: 'from-red-400 to-pink-500',
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 text-center"
    >
      <div className="flex justify-between items-start mb-4">
        <span className={`text-xs font-medium text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${difficultyColors[word.difficulty]}`}>
          {word.difficulty}
        </span>
        <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
          {word.phonics_focus}
        </span>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => speak(word.word)}
        className="w-full"
      >
        <p className="text-5xl font-bold text-gray-800 py-6 tracking-wide">
          {word.word}
        </p>
      </motion.button>

      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={() => speak(word.word)}
          disabled={isSpeaking}
          className="p-2 rounded-full bg-[#FF0099]/10 text-[#FF0099] disabled:opacity-50"
        >
          <Volume2 className="w-5 h-5" />
        </button>
        <span className="text-sm text-gray-400">{word.hint}</span>
      </div>
    </motion.div>
  );
}

// ─── Reading Passage with tap-to-hear ─────────────────────────

function ReadingPassage({
  passage,
  voiceEnabled,
  speak,
  childAge,
}: {
  passage: string;
  voiceEnabled: boolean;
  speak: (text: string) => void;
  childAge: number;
}) {
  const fontSize = childAge <= 6 ? 'text-2xl' : childAge <= 9 ? 'text-xl' : 'text-lg';

  return (
    <p className={`${fontSize} leading-relaxed text-gray-800`}>
      {passage.split(/(\s+)/).map((chunk, i) => {
        if (/^\s+$/.test(chunk)) return <span key={i}>{chunk}</span>;

        return (
          <span
            key={i}
            className="cursor-pointer hover:bg-pink-50 hover:text-[#FF0099] rounded px-0.5 transition-colors active:bg-pink-100"
            onClick={() => {
              if (voiceEnabled) speak(chunk.replace(/[.,!?;:]/g, ''));
            }}
          >
            {chunk}
          </span>
        );
      })}
    </p>
  );
}

// ─── Feedback Card ────────────────────────────────────────────

function FeedbackCard({
  score,
  feedback,
  encouragement,
}: {
  score: number;
  feedback: string;
  encouragement: string;
}) {
  const isGood = score >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border ${
        isGood
          ? 'bg-green-50 border-green-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0">{isGood ? <Star className="w-6 h-6 text-amber-400 fill-amber-400" /> : <Zap className="w-6 h-6 text-amber-500" />}</span>
        <div className="flex-1">
          <p className={`font-medium ${isGood ? 'text-green-700' : 'text-amber-700'}`}>
            {feedback}
          </p>
          <p className="text-sm text-gray-500 mt-1">{encouragement}</p>
        </div>
        <span className={`text-sm font-bold px-2 py-1 rounded-full ${
          isGood ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {score}/10
        </span>
      </div>
    </motion.div>
  );
}
