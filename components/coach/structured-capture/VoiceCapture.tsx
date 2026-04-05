// ============================================================
// VoiceCapture — 4-question guided voice recording for coach
// Uses Web Speech API (Chrome/Edge). Falls back gracefully.
// ============================================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, SkipForward, Check, X } from 'lucide-react';
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

export function VoiceCapture({ childName, prompts, onComplete, onCancel }: VoiceCaptureProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<string[]>(['', '', '', '']);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questions = [
    prompts.q1.replace(/\{childName\}/g, childName),
    prompts.q2.replace(/\{childName\}/g, childName),
    prompts.q3.replace(/\{childName\}/g, childName),
    prompts.q4.replace(/\{childName\}/g, childName),
  ];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    setIsRecording(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const advanceToNext = useCallback(() => {
    stopRecording();
    setLiveTranscript('');
    if (currentQuestion < 3) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setDone(true);
    }
  }, [currentQuestion, stopRecording]);

  const startRecording = useCallback(() => {
    const win = window as any;
    const SpeechRecognitionCtor = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert('Voice input is not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    const qIdx = currentQuestion; // Capture in closure

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
        setSegments(prev => {
          const updated = [...prev];
          updated[qIdx] = (updated[qIdx] + ' ' + finalText).trim();
          return updated;
        });
      }
      setLiveTranscript(interim);

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        advanceToNext();
      }, 3000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        advanceToNext();
      } else {
        console.error('[VoiceCapture] Error:', event.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [currentQuestion, advanceToNext]);

  const handleProcess = async () => {
    stopRecording();
    setIsProcessing(true);

    try {
      const res = await fetch('/api/intelligence/extract-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName,
          segments: {
            skills: segments[0],
            strengths: segments[1],
            struggles: segments[2],
            homework: segments[3],
          },
        }),
      });
      const data = await res.json();

      onComplete({
        fullTranscript: segments.join(' ').trim(),
        segments: { skills: segments[0], strengths: segments[1], struggles: segments[2], homework: segments[3] },
        extracted: data.data || null,
      });
    } catch {
      onComplete({
        fullTranscript: segments.join(' ').trim(),
        segments: { skills: segments[0], strengths: segments[1], struggles: segments[2], homework: segments[3] },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- DONE SCREEN: show transcript, allow editing, process ---
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex flex-col p-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full flex-1 space-y-4 py-8">
          <h2 className="text-white text-lg font-semibold text-center">Review Your Notes</h2>
          {['Skills covered', 'Went well', 'Struggled with', 'Home practice'].map((label, i) => (
            <div key={i}>
              <label className="text-text-tertiary text-xs mb-1 block">{label}</label>
              <textarea
                value={segments[i]}
                onChange={e => {
                  const updated = [...segments];
                  updated[i] = e.target.value;
                  setSegments(updated);
                }}
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 border border-gray-600 text-gray-300 py-3 rounded-xl text-sm font-medium h-12"
            >
              Cancel
            </button>
            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="flex-1 bg-[#00ABFF] text-white py-3 rounded-xl text-sm font-medium h-12 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}
              {isProcessing ? 'Processing...' : 'Use These Notes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RECORDING SCREEN ---
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-3 h-3 rounded-full transition-all ${
            i === currentQuestion ? 'bg-[#00ABFF] scale-125' :
            i < currentQuestion ? 'bg-green-500' : 'bg-gray-600'
          }`} />
        ))}
      </div>

      {/* Current question */}
      <p className="text-white text-xl text-center max-w-md mb-8 leading-relaxed font-display">
        {questions[currentQuestion]}
      </p>

      {/* Live transcript */}
      <div className="bg-white/10 rounded-2xl p-4 w-full max-w-md min-h-[100px] mb-8">
        {segments[currentQuestion] || liveTranscript ? (
          <p className="text-white/80 text-sm">
            {segments[currentQuestion]}
            {liveTranscript && <span className="text-[#00ABFF]"> {liveTranscript}</span>}
          </p>
        ) : (
          <p className="text-white/30 text-sm text-center">
            {isRecording ? 'Listening...' : 'Tap the mic to start speaking'}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button onClick={onCancel} className="text-white/40 p-3 hover:text-white/60">
          <X className="w-6 h-6" />
        </button>

        {!isRecording ? (
          <button
            onClick={startRecording}
            className="bg-red-500 p-6 rounded-full hover:bg-red-600 transition-colors"
          >
            <Mic className="w-8 h-8 text-white" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-600 p-6 rounded-full animate-pulse"
          >
            <MicOff className="w-8 h-8 text-white" />
          </button>
        )}

        <button onClick={advanceToNext} className="text-white/40 p-3 hover:text-white/60">
          {currentQuestion < 3 ? (
            <SkipForward className="w-6 h-6" />
          ) : (
            <Check className="w-6 h-6" />
          )}
        </button>
      </div>

      <p className="text-white/30 text-xs mt-4">
        {currentQuestion + 1} of 4
      </p>
    </div>
  );
}
