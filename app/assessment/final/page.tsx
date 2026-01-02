// =============================================================================
// FILE: app/assessment/final/page.tsx
// PURPOSE: Final assessment page for program completion
// UI/UX: Warm, celebratory, guides parent through final reading recording
// =============================================================================

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Mic, Square, Play, Pause, RotateCcw, Send, 
  CheckCircle, Clock, Volume2, BookOpen, Sparkles,
  Award, ArrowRight, Loader2, AlertCircle
} from 'lucide-react';

// Sample reading passages for final assessment
const READING_PASSAGES = [
  {
    id: 1,
    title: 'The Little Explorer',
    ageRange: '4-6',
    text: `Sam loved to explore. Every day, Sam would go to the garden. The flowers were pretty. The birds sang songs. Sam found a little bug. The bug was green. Sam watched it crawl on a leaf. "Hello, little bug!" said Sam. The bug wiggled its tiny legs. Sam smiled and waved goodbye.`,
    wordCount: 62,
  },
  {
    id: 2,
    title: 'The Magic Library',
    ageRange: '7-9',
    text: `Maya discovered something wonderful in the old library. Behind the dusty shelves, there was a secret door. When she opened it, the room sparkled with golden light. Books floated gently in the air, their pages turning by themselves. "Welcome, young reader," whispered a voice. Maya couldn't believe her eyes. She had found the legendary Magic Library that her grandmother had told her about. Every book here could take you on an adventure.`,
    wordCount: 78,
  },
  {
    id: 3,
    title: 'The Science Fair',
    ageRange: '10-12',
    text: `The gymnasium buzzed with excitement as students from across the district gathered for the annual Science Fair. Priya stood nervously beside her project—a working model of a solar-powered water purifier. She had spent three months researching, designing, and building it. The judges approached, clipboards in hand. "Tell us about your invention," they said. Priya took a deep breath and began explaining how sunlight could make dirty water safe to drink. As she spoke, her nervousness transformed into enthusiasm.`,
    wordCount: 86,
  },
];

function FinalAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get('enrollment');
  
  const [step, setStep] = useState<'intro' | 'recording' | 'processing' | 'complete'>('intro');
  const [enrollmentData, setEnrollmentData] = useState<{
    childName: string;
    age: number;
    coachName: string;
  } | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<typeof READING_PASSAGES[0] | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (enrollmentId) {
      fetchEnrollmentData();
    }
  }, [enrollmentId]);

  useEffect(() => {
    // Select appropriate passage based on child's age
    if (enrollmentData?.age) {
      const age = enrollmentData.age;
      if (age <= 6) {
        setSelectedPassage(READING_PASSAGES[0]);
      } else if (age <= 9) {
        setSelectedPassage(READING_PASSAGES[1]);
      } else {
        setSelectedPassage(READING_PASSAGES[2]);
      }
    }
  }, [enrollmentData]);

  const fetchEnrollmentData = async () => {
    try {
      const response = await fetch(`/api/assessment/final/data?enrollment=${enrollmentId}`);
      const data = await response.json();
      setEnrollmentData(data);
    } catch (error) {
      console.error('Failed to fetch enrollment:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Unable to access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitAssessment = async () => {
    if (!audioBlob || !enrollmentId) return;

    setStep('processing');
    setProcessing(true);

    try {
      // Upload audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'final-assessment.webm');
      formData.append('enrollmentId', enrollmentId);
      formData.append('passageId', selectedPassage?.id.toString() || '1');
      formData.append('passageText', selectedPassage?.text || '');

      const response = await fetch('/api/assessment/final/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setStep('complete');
        // Redirect to completion page after 3 seconds
        setTimeout(() => {
          router.push(`/completion/${enrollmentId}`);
        }, 3000);
      } else {
        setError(data.error || 'Failed to process assessment');
        setStep('recording');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Failed to submit assessment. Please try again.');
      setStep('recording');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Final Assessment</h1>
              <p className="text-xs text-gray-500">
                {enrollmentData?.childName}'s Reading Journey
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Intro Step */}
        {step === 'intro' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Celebration Banner */}
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-yellow-300" />
              <h2 className="text-xl font-bold mb-2">
                Congratulations! 🎉
              </h2>
              <p className="text-pink-100">
                {enrollmentData?.childName} has completed all coaching sessions with Coach {enrollmentData?.coachName}!
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                One Last Step: Final Reading
              </h3>
              <p className="text-gray-600 mb-6">
                Let's see how much {enrollmentData?.childName} has improved! Record them reading the passage below, just like in the first assessment.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Volume2, text: 'Find a quiet place with no background noise' },
                  { icon: BookOpen, text: 'Show the passage to your child on screen' },
                  { icon: Mic, text: 'Tap record and let them read aloud' },
                  { icon: Clock, text: 'Take your time - there\'s no rush!' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('recording')}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              Start Final Assessment
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Recording Step */}
        {step === 'recording' && selectedPassage && (
          <div className="space-y-6 animate-fadeIn">
            {/* Passage Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-purple-50 px-6 py-3 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-900">{selectedPassage.title}</span>
                  </div>
                  <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                    {selectedPassage.wordCount} words
                  </span>
                </div>
              </div>
              <div className="p-6">
                <p className="text-lg leading-relaxed text-gray-800 font-serif">
                  {selectedPassage.text}
                </p>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {/* Timer */}
              <div className="text-center mb-6">
                <div className="text-4xl font-mono font-bold text-gray-900 mb-1">
                  {formatTime(recordingTime)}
                </div>
                <p className="text-sm text-gray-500">
                  {isRecording ? 'Recording...' : audioUrl ? 'Recording ready' : 'Ready to record'}
                </p>
              </div>

              {/* Audio Playback */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {!audioUrl ? (
                  // Recording controls
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-105'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </button>
                ) : (
                  // Playback controls
                  <>
                    <button
                      onClick={resetRecording}
                      className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                    >
                      <RotateCcw className="w-6 h-6 text-gray-600" />
                    </button>
                    <button
                      onClick={togglePlayback}
                      className="w-20 h-20 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center hover:scale-105 transition-all"
                    >
                      {isPlaying ? (
                        <Pause className="w-8 h-8 text-white" />
                      ) : (
                        <Play className="w-8 h-8 text-white ml-1" />
                      )}
                    </button>
                    <button
                      onClick={submitAssessment}
                      disabled={processing}
                      className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      <Send className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}
              </div>

              {/* Instructions */}
              <p className="text-center text-sm text-gray-500 mt-6">
                {!audioUrl
                  ? isRecording
                    ? 'Tap the stop button when done reading'
                    : 'Tap the microphone to start recording'
                  : 'Play to review, or tap send to submit'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="text-center py-20 animate-fadeIn">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-pink-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Analyzing Reading...
            </h2>
            <p className="text-gray-600">
              Our AI is comparing {enrollmentData?.childName}'s progress
            </p>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center py-12 animate-fadeIn">
            <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Assessment Complete! 🎉
            </h2>
            <p className="text-gray-600 mb-6">
              Redirecting to {enrollmentData?.childName}'s achievement page...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Please wait...
            </div>
          </div>
        )}
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function FinalAssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FinalAssessmentContent />
    </Suspense>
  );
}
