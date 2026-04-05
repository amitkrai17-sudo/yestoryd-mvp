// ============================================================
// VoiceCapture — 4-question guided voice with per-question
// Gemini interpretation + re-record per question
// ============================================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, SkipForward, Check, X, RefreshCw, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export interface VoiceCaptureResult {
  fullTranscript: string;
  segments: {
    skills: string;
    strengths: string;
    struggles: string;
    homework: string;
  };
  extracted?: {
    skillNames: string[];
    strengthNotes: string;
    struggleNotes: string;
    wordsMastered: string[];
    wordsStruggled: string[];
    engagementLevel: string;
    homeworkSuggestion: string;
  } | null;
}

interface VoiceCaptureProps {
  childName: string;
  prompts: { q1: string; q2: string; q3: string; q4: string };
  onComplete: (result: VoiceCaptureResult) => void;
  onCancel: () => void;
}

const QUESTION_TYPES = ['skills', 'strengths', 'struggles', 'homework'] as const;
const QUESTION_LABELS = ['Skills covered', 'What went well', 'Struggles', 'Home practice'];

interface SegmentInterpretation {
  raw: string;
  interpretation: string;
  extracted: Record<string, any>;
  status: 'empty' | 'recording' | 'interpreting' | 'done';
}

export function VoiceCapture({ childName, prompts, onComplete, onCancel }: VoiceCaptureProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [segmentData, setSegmentData] = useState<SegmentInterpretation[]>([
    { raw: '', interpretation: '', extracted: {}, status: 'empty' },
    { raw: '', interpretation: '', extracted: {}, status: 'empty' },
    { raw: '', interpretation: '', extracted: {}, status: 'empty' },
    { raw: '', interpretation: '', extracted: {}, status: 'empty' },
  ]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questions = [
    prompts.q1.replace(/\{childName\}/g, childName),
    prompts.q2.replace(/\{childName\}/g, childName),
    prompts.q3.replace(/\{childName\}/g, childName),
    prompts.q4.replace(/\{childName\}/g, childName),
  ];

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setIsRecording(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  // Interpret a segment via Gemini (lightweight, < 2s)
  const interpretSegment = useCallback(async (qIdx: number, text: string) => {
    if (!text.trim()) return;

    setSegmentData(prev => {
      const updated = [...prev];
      updated[qIdx] = { ...updated[qIdx], raw: text, status: 'interpreting' };
      return updated;
    });

    try {
      const res = await fetch('/api/intelligence/interpret-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionType: QUESTION_TYPES[qIdx], text, childName }),
      });
      const data = await res.json();

      setSegmentData(prev => {
        const updated = [...prev];
        updated[qIdx] = {
          raw: text,
          interpretation: data.interpretation || '',
          extracted: data.extracted || {},
          status: 'done',
        };
        return updated;
      });
    } catch {
      setSegmentData(prev => {
        const updated = [...prev];
        updated[qIdx] = { ...updated[qIdx], raw: text, status: 'done' };
        return updated;
      });
    }
  }, [childName]);

  const finishCurrentQuestion = useCallback(() => {
    stopRecording();
    setLiveTranscript('');

    // Get the raw text for this question and interpret it
    const rawText = segmentData[currentQuestion]?.raw || '';
    if (rawText.trim()) {
      interpretSegment(currentQuestion, rawText);
    } else {
      setSegmentData(prev => {
        const updated = [...prev];
        updated[currentQuestion] = { ...updated[currentQuestion], status: 'done' };
        return updated;
      });
    }
  }, [currentQuestion, stopRecording, segmentData, interpretSegment]);

  const goToQuestion = useCallback((qIdx: number) => {
    stopRecording();
    setLiveTranscript('');
    setCurrentQuestion(qIdx);
  }, [stopRecording]);

  const startRecording = useCallback(() => {
    const win = window as any;
    const SpeechRecognitionCtor = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert('Voice input is not supported in this browser. Please use Chrome.');
      return;
    }

    // Mark this question as recording
    setSegmentData(prev => {
      const updated = [...prev];
      updated[currentQuestion] = { raw: '', interpretation: '', extracted: {}, status: 'recording' };
      return updated;
    });

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    const qIdx = currentQuestion;

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        } else {
          interim = event.results[i][0].transcript;
        }
      }

      if (finalText) {
        setSegmentData(prev => {
          const updated = [...prev];
          updated[qIdx] = { ...updated[qIdx], raw: (updated[qIdx].raw + ' ' + finalText).trim() };
          return updated;
        });
      }
      setLiveTranscript(interim);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => finishCurrentQuestion(), 3000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') finishCurrentQuestion();
    };
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [currentQuestion, finishCurrentQuestion]);

  const handleReRecord = (qIdx: number) => {
    goToQuestion(qIdx);
    // Will start recording after state update
    setTimeout(() => startRecording(), 100);
  };

  const allDone = segmentData.every(s => s.status === 'done' || s.status === 'empty');
  const hasContent = segmentData.some(s => s.raw.trim().length > 0);

  // Process all segments and complete
  const handleFinalize = async () => {
    setIsProcessing(true);
    try {
      const segs = { skills: segmentData[0].raw, strengths: segmentData[1].raw, struggles: segmentData[2].raw, homework: segmentData[3].raw };

      const res = await fetch('/api/intelligence/extract-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childName, segments: segs }),
      });
      const data = await res.json();

      onComplete({
        fullTranscript: Object.values(segs).join(' ').trim(),
        segments: segs,
        extracted: data.data || null,
      });
    } catch {
      const segs = { skills: segmentData[0].raw, strengths: segmentData[1].raw, struggles: segmentData[2].raw, homework: segmentData[3].raw };
      onComplete({ fullTranscript: Object.values(segs).join(' ').trim(), segments: segs });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Check if current question has been answered (show review vs recording)
  const currentSegment = segmentData[currentQuestion];
  const isCurrentAnswered = currentSegment.status === 'done' || currentSegment.status === 'interpreting';

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center p-4 overflow-y-auto">
      {/* Progress dots */}
      <div className="flex gap-2 mt-8 mb-4">
        {[0, 1, 2, 3].map(i => (
          <button
            key={i}
            onClick={() => goToQuestion(i)}
            className={`w-3 h-3 rounded-full transition-all ${
              i === currentQuestion ? 'bg-[#00ABFF] scale-125' :
              segmentData[i].status === 'done' && segmentData[i].raw ? 'bg-green-500' :
              'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Question text */}
      <p className="text-white text-lg text-center max-w-md mb-4 leading-relaxed font-display">
        {questions[currentQuestion]}
      </p>

      {/* Main content area */}
      <div className="w-full max-w-md flex-1 space-y-4">
        {/* Recording area */}
        {!isCurrentAnswered && (
          <>
            <div className="bg-white/10 rounded-2xl p-4 min-h-[80px]">
              {currentSegment.raw || liveTranscript ? (
                <p className="text-white/80 text-sm">
                  {currentSegment.raw}
                  {liveTranscript && <span className="text-[#00ABFF]"> {liveTranscript}</span>}
                </p>
              ) : (
                <p className="text-white/30 text-sm text-center">
                  {isRecording ? 'Listening...' : 'Tap the mic to start speaking'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-6">
              <button onClick={onCancel} className="text-white/40 p-3 hover:text-white/60">
                <X className="w-5 h-5" />
              </button>
              {!isRecording ? (
                <button onClick={startRecording} className="bg-red-500 p-5 rounded-full hover:bg-red-600 transition-colors active:scale-95">
                  <Mic className="w-7 h-7 text-white" />
                </button>
              ) : (
                <button onClick={() => finishCurrentQuestion()} className="bg-red-600 p-5 rounded-full animate-pulse">
                  <MicOff className="w-7 h-7 text-white" />
                </button>
              )}
              <button onClick={() => { finishCurrentQuestion(); }} className="text-white/40 p-3 hover:text-white/60">
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {/* Interpretation result (after answering) */}
        {isCurrentAnswered && (
          <div className="space-y-3">
            {/* Raw text */}
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-white/80 text-sm">{currentSegment.raw || '(skipped)'}</p>
            </div>

            {/* Gemini interpretation */}
            {currentSegment.status === 'interpreting' ? (
              <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/20 rounded-2xl p-3 flex items-center gap-2">
                <Spinner size="sm" className="text-[#00ABFF]" />
                <span className="text-[#00ABFF] text-xs">Interpreting...</span>
              </div>
            ) : currentSegment.interpretation ? (
              <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/20 rounded-2xl p-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#00ABFF] flex-shrink-0 mt-0.5" />
                <p className="text-[#00ABFF] text-xs leading-relaxed">{currentSegment.interpretation}</p>
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleReRecord(currentQuestion)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-gray-600 text-gray-300 py-3 rounded-xl text-sm font-medium min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                Re-record
              </button>
              {currentQuestion < 3 ? (
                <button
                  onClick={() => goToQuestion(currentQuestion + 1)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#00ABFF] text-white py-3 rounded-xl text-sm font-medium min-h-[44px]"
                >
                  Next
                  <SkipForward className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinalize}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#00ABFF] text-white py-3 rounded-xl text-sm font-medium min-h-[44px] disabled:opacity-50"
                >
                  {isProcessing ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}
                  {isProcessing ? 'Processing...' : 'Use These Notes'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick overview of all segments (when on last question) */}
        {allDone && hasContent && currentQuestion === 3 && (
          <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
            <p className="text-white/30 text-[10px] uppercase tracking-wider">All answers:</p>
            {QUESTION_LABELS.map((label, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${segmentData[i].raw ? 'bg-green-500' : 'bg-gray-600'}`} />
                <div className="min-w-0">
                  <p className="text-white/40 text-[10px]">{label}</p>
                  <p className="text-white/60 text-xs truncate">{segmentData[i].raw || '(skipped)'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom label */}
      <p className="text-white/30 text-xs mt-4 mb-4">{currentQuestion + 1} of 4</p>
    </div>
  );
}
