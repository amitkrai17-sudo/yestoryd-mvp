// ============================================================
// Reading Progress Check — Child reads passage aloud, scored by Gemini
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, ArrowLeft, Star, Share2, BookOpen } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

type Stage = 'loading' | 'ready' | 'recording' | 'processing' | 'results' | 'error';

interface PassageData {
  id: string;
  title: string;
  content: string;
  wordCount: number;
}

interface TestResult {
  score: number;
  clarity: number;
  fluency: number;
  speed: number;
  wpm: number;
  fluency_rating: string;
  xp_earned: number;
  progress: { previous_score: number; previous_date: string; improvement: number } | null;
}

export default function ReadingTestPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState('');
  const [childName, setChildName] = useState('');
  const [passage, setPassage] = useState<PassageData | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  // Recording state
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load task + passage
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/parent/reading-test?taskId=${taskId}`);
        const data = await res.json();
        if (!data.success) { setError(data.error || 'Not found'); setStage('error'); return; }
        setChildName(data.childName);
        setPassage(data.passage);
        setStage('ready');
      } catch { setError('Failed to load'); setStage('error'); }
    }
    load();
  }, [taskId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => submitRecording();

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setStage('recording');
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);

      // Auto-stop after 3 minutes
      setTimeout(() => { if (recorder.state === 'recording') stopRecording(); }, 180000);
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
      setStage('error');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const submitRecording = async () => {
    setStage('processing');
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const res = await fetch('/api/parent/reading-test/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          passageId: passage!.id,
          passageText: passage!.content,
          audioBase64: base64,
          audioDurationSeconds: recordingTime,
        }),
      });

      const data = await res.json();
      if (!data.success) { setError(data.error || 'Analysis failed'); setStage('error'); return; }
      setResult(data);
      setStage('results');
    } catch { setError('Submission failed'); setStage('error'); }
  };

  const handleShare = () => {
    if (!result) return;
    const firstName = childName.split(' ')[0];
    const progressText = result.progress
      ? `${firstName} improved from ${result.progress.previous_score}/10 to ${result.score}/10!`
      : `${firstName} scored ${result.score}/10 on their reading check!`;

    const shareText = `${progressText}\n\nGet your child's FREE reading score at Yestoryd:\nhttps://yestoryd.com/assessment`;

    if (navigator.share) {
      navigator.share({ title: `${firstName}'s Reading Progress`, text: shareText, url: 'https://yestoryd.com/assessment' }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // --- RENDER ---

  if (stage === 'loading') {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  }

  if (stage === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4 text-center">
        <div>
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-[#FF0099] font-medium text-sm">Go Back</button>
        </div>
      </div>
    );
  }

  if (stage === 'ready' && passage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Reading Progress Check</h1>
            <p className="text-gray-500 text-sm mt-1">Read the passage below out loud. Take your time!</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 font-reading">{passage.title}</h2>
            <p className="text-gray-700 text-base leading-relaxed font-reading whitespace-pre-line">{passage.content}</p>
            <p className="text-gray-400 text-xs mt-3">{passage.wordCount} words</p>
          </div>
          <button
            onClick={startRecording}
            className="w-full bg-[#FF0099] text-white rounded-xl h-12 text-base font-medium flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            Start Reading
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'recording') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Mic className="w-12 h-12 text-white" />
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-1">{formatTime(recordingTime)}</p>
        <p className="text-gray-500 text-sm mb-8">Recording... Read the passage aloud</p>
        <button
          onClick={stopRecording}
          className="bg-red-500 text-white rounded-xl h-12 px-8 text-base font-medium flex items-center gap-2"
        >
          <MicOff className="w-5 h-5" />
          I'm Done
        </button>
      </div>
    );
  }

  if (stage === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
        <Spinner size="lg" className="mb-4" />
        <p className="text-gray-900 font-medium">Analyzing your reading...</p>
        <p className="text-gray-500 text-sm mt-1">This takes a few seconds</p>
      </div>
    );
  }

  if (stage === 'results' && result) {
    const improved = result.progress && result.progress.improvement > 0;
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Score */}
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              result.score >= 7 ? 'bg-emerald-100' : result.score >= 5 ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              <Star className={`w-10 h-10 ${
                result.score >= 7 ? 'text-emerald-500' : result.score >= 5 ? 'text-amber-500' : 'text-red-500'
              }`} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{result.score}/10</h1>
            <p className="text-gray-500 mt-1">
              {result.fluency_rating} Reader · {result.wpm} WPM
            </p>
          </div>

          {/* Progress */}
          {result.progress && (
            <div className={`rounded-2xl p-4 text-center ${improved ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className="text-sm font-medium text-gray-900">
                {improved
                  ? `+${result.progress.improvement} points improvement!`
                  : 'Keep practicing — improvement takes time!'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Previous: {result.progress.previous_score}/10
              </p>
            </div>
          )}

          {/* Breakdown */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{result.clarity}</p>
                <p className="text-xs text-gray-500">Clarity</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{result.fluency}</p>
                <p className="text-xs text-gray-500">Fluency</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{result.speed}</p>
                <p className="text-xs text-gray-500">Speed</p>
              </div>
            </div>
          </div>

          {/* XP */}
          <p className="text-center text-[#FF0099] font-medium">+{result.xp_earned} XP earned</p>

          {/* Share */}
          <button onClick={handleShare}
            className="w-full bg-[#25D366] text-white rounded-xl h-12 text-base font-medium flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Progress
          </button>

          <button onClick={() => router.push('/parent/dashboard')}
            className="w-full text-gray-500 text-sm text-center py-2">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
