// ============================================================
// MicroAssessmentCapture — Quick reading fluency check UI
// ============================================================
// Shows passage text, records child reading audio, captures
// comprehension answers, and submits to /api/intelligence/micro-assessment.
// Can be triggered during an individual moment in group class
// or as a standalone capture.
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Mic, Square, Play, CheckCircle2, AlertCircle, BookOpen, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface ReadingPassage {
  id: string;
  title: string;
  content: string;
  word_count: number;
}

interface ComprehensionQuestion {
  question: string;
  options?: string[];
  correctIndex?: number;
}

interface MicroAssessmentResult {
  fluencyRating: string;
  estimatedWpm: number;
  accuracyPercent: number;
  comprehensionScore: number | null;
  intelligenceScore: number;
  analysis: string;
  strengths: string[];
  areasToImprove: string[];
}

interface MicroAssessmentCaptureProps {
  childId: string;
  childName: string;
  childAge?: number;
  /** Pre-assigned passage (from pending micro-assessment) */
  passage?: ReadingPassage;
  /** Pre-assigned comprehension questions */
  comprehensionQuestions?: ComprehensionQuestion[];
  /** Pending micro-assessment ID to update */
  microAssessmentId?: string;
  /** Group session context */
  groupSessionId?: string;
  onComplete: (result: MicroAssessmentResult) => void;
  onCancel?: () => void;
}

// ============================================================
// Steps
// ============================================================

type Step = 'passage' | 'record' | 'comprehension' | 'submitting' | 'result';

// ============================================================
// Component
// ============================================================

export default function MicroAssessmentCapture({
  childId,
  childName,
  childAge,
  passage: initialPassage,
  comprehensionQuestions: initialQuestions,
  microAssessmentId,
  groupSessionId,
  onComplete,
  onCancel,
}: MicroAssessmentCaptureProps) {
  // ─── State ───
  const [step, setStep] = useState<Step>('passage');
  const [passage, setPassage] = useState<ReadingPassage | null>(initialPassage || null);
  const [questions, setQuestions] = useState<ComprehensionQuestion[]>(initialQuestions || []);
  const [loadingPassage, setLoadingPassage] = useState(!initialPassage);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Comprehension state
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // Submission state
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MicroAssessmentResult | null>(null);

  // ─── Fetch passage if not provided ───
  useEffect(() => {
    if (initialPassage) {
      setLoadingPassage(false);
      return;
    }

    // Fetch an age-appropriate passage
    const params = new URLSearchParams();
    if (childAge) params.set('age', String(childAge));
    params.set('limit', '1');

    fetch(`/api/intelligence/reading-passages?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data?.passages?.length > 0) {
          const p = data.passages[0];
          setPassage({ id: p.id, title: p.title, content: p.content, word_count: p.word_count });
          if (data.questions) setQuestions(data.questions);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPassage(false));
  }, [initialPassage, childAge]);

  // ─── Recording ───
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone access.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingDuration(0);
  }, [audioUrl]);

  // ─── Format time ───
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!audioBlob || !passage) return;
    setStep('submitting');
    setError(null);

    try {
      // Upload audio to Supabase storage first
      const formData = new FormData();
      formData.append('file', audioBlob, `micro-${childId}-${Date.now()}.webm`);
      formData.append('childId', childId);

      const uploadRes = await fetch('/api/upload/audio', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio recording. Please try again.');
      }
      const uploadData = await uploadRes.json();
      const uploadedUrl = uploadData.url || uploadData.path || '';
      if (!uploadedUrl) {
        throw new Error('Audio upload returned no URL. Please try again.');
      }

      // Build comprehension answers
      const comprehensionAnswers = questions.map((q, idx) => ({
        question: q.question,
        answer: q.options && answers[idx] != null ? q.options[answers[idx]] : '',
        correct: q.correctIndex != null && answers[idx] != null ? answers[idx] === q.correctIndex : undefined,
      }));

      // Submit micro-assessment
      const res = await fetch('/api/intelligence/micro-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          passage_id: passage.id,
          passage_text: passage.content,
          audio_url: uploadedUrl,
          comprehension_answers: comprehensionAnswers,
          group_session_id: groupSessionId,
          micro_assessment_id: microAssessmentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assessment failed');

      const assessmentResult: MicroAssessmentResult = {
        fluencyRating: data.microAssessment.fluencyRating,
        estimatedWpm: data.microAssessment.estimatedWpm,
        accuracyPercent: data.microAssessment.accuracyPercent,
        comprehensionScore: data.microAssessment.comprehensionScore,
        intelligenceScore: data.microAssessment.intelligenceScore,
        analysis: data.microAssessment.analysis,
        strengths: data.microAssessment.strengths || [],
        areasToImprove: data.microAssessment.areasToImprove || [],
      };

      setResult(assessmentResult);
      setStep('result');
      onComplete(assessmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setStep('record');
    }
  };

  // ─── Loading passage ───
  if (loadingPassage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-500">Loading passage...</p>
      </div>
    );
  }

  if (!passage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <AlertCircle className="w-8 h-8 text-orange-500" />
        <p className="text-sm text-gray-600">No reading passage available for this age group.</p>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-indigo-600 underline">Go back</button>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold">Reading Check</h1>
          <p className="text-sm opacity-90">{childName}{childAge ? ` · Age ${childAge}` : ''}</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b">
        {(['passage', 'record', 'comprehension'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={cn(
              'h-1.5 rounded-full flex-1 transition-all',
              step === s ? 'bg-emerald-500' :
              (['passage', 'record', 'comprehension'].indexOf(step) > i || step === 'submitting' || step === 'result') ? 'bg-emerald-300' : 'bg-gray-200',
            )} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* ─── Step 1: Show passage ─── */}
        {step === 'passage' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <BookOpen className="w-5 h-5" />
              <span className="font-medium">Step 1: Read this passage</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{passage.title}</h3>
              <p className="text-gray-800 leading-relaxed text-base">{passage.content}</p>
              <p className="text-xs text-gray-400 mt-3">{passage.word_count} words</p>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Show this passage to {childName.split(' ')[0]}, then tap Next to record their reading.
            </p>
            <button
              onClick={() => setStep('record')}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition"
            >
              Next: Record Reading
            </button>
          </div>
        )}

        {/* ─── Step 2: Record audio ─── */}
        {step === 'record' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <Mic className="w-5 h-5" />
              <span className="font-medium">Step 2: Record {childName.split(' ')[0]} reading</span>
            </div>

            {/* Passage reference (collapsed) */}
            <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <summary className="px-4 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                View passage text
              </summary>
              <div className="px-4 pb-3 text-sm text-gray-700 leading-relaxed">{passage.content}</div>
            </details>

            {/* Recording UI */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-4">
              {!audioBlob ? (
                <>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg',
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-emerald-500 hover:bg-emerald-600',
                    )}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </button>
                  <p className="text-sm text-gray-500">
                    {isRecording ? `Recording... ${formatTime(recordingDuration)}` : 'Tap to start recording'}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Recorded ({formatTime(recordingDuration)})
                    </span>
                  </div>
                  {audioUrl && (
                    <audio controls src={audioUrl} className="w-full max-w-xs" />
                  )}
                  <button
                    onClick={resetRecording}
                    className="text-sm text-red-500 underline"
                  >
                    Re-record
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('passage')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (questions.length > 0) {
                    setStep('comprehension');
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={!audioBlob}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold text-sm transition',
                  audioBlob
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                )}
              >
                {questions.length > 0 ? 'Next: Comprehension' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Comprehension ─── */}
        {step === 'comprehension' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <HelpCircle className="w-5 h-5" />
              <span className="font-medium">Step 3: Comprehension Questions</span>
            </div>
            <p className="text-sm text-gray-500">
              Ask {childName.split(' ')[0]} these questions about the passage.
            </p>

            {questions.map((q, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <p className="font-medium text-gray-800 text-sm">Q{idx + 1}: {q.question}</p>
                {q.options ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => setAnswers(prev => ({ ...prev, [idx]: optIdx }))}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-sm border transition-all',
                          answers[idx] === optIdx
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 font-medium'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Open-ended — mark as answered above</p>
                )}
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('record')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition"
              >
                Submit Assessment
              </button>
            </div>
          </div>
        )}

        {/* ─── Submitting ─── */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-gray-600 font-medium">Analyzing reading...</p>
            <p className="text-sm text-gray-400">This may take a few seconds</p>
          </div>
        )}

        {/* ─── Results ─── */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Assessment Complete</span>
            </div>

            {/* Score card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Fluency</span>
                <span className={cn(
                  'font-bold text-lg',
                  result.fluencyRating === 'Excellent' ? 'text-green-600' :
                  result.fluencyRating === 'Good' ? 'text-emerald-600' :
                  result.fluencyRating === 'Fair' ? 'text-yellow-600' : 'text-red-600',
                )}>
                  {result.fluencyRating}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Words/min</span>
                <span className="font-mono font-bold text-gray-900">{result.estimatedWpm}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Accuracy</span>
                <span className="font-mono font-bold text-gray-900">{result.accuracyPercent}%</span>
              </div>
              {result.comprehensionScore != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Comprehension</span>
                  <span className="font-mono font-bold text-gray-900">{result.comprehensionScore}%</span>
                </div>
              )}
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Intelligence Score</span>
                <span className={cn(
                  'font-mono font-bold text-lg',
                  result.intelligenceScore >= 70 ? 'text-green-600' :
                  result.intelligenceScore >= 40 ? 'text-yellow-600' : 'text-red-600',
                )}>
                  {result.intelligenceScore}/100
                </span>
              </div>
            </div>

            {/* Analysis */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{result.analysis}</p>
            </div>

            {/* Strengths & Areas */}
            {result.strengths.length > 0 && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <p className="text-xs font-medium text-green-700 uppercase mb-1">Strengths</p>
                <ul className="text-sm text-green-800 space-y-0.5">
                  {result.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
            {result.areasToImprove.length > 0 && (
              <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                <p className="text-xs font-medium text-orange-700 uppercase mb-1">Areas to Improve</p>
                <ul className="text-sm text-orange-800 space-y-0.5">
                  {result.areasToImprove.map((a, i) => <li key={i}>• {a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
