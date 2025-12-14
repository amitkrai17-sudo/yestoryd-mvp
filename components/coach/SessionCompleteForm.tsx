'use client';

import { useState, useRef } from 'react';
import {
  CheckCircle,
  Mic,
  MicOff,
  Send,
  Loader2,
  BookOpen,
  TrendingUp,
  Users,
  ClipboardList,
  Sparkles,
  Square,
} from 'lucide-react';

interface SessionCompleteFormProps {
  sessionId: string;
  childId: string;
  childName: string;
  childAge: number;
  sessionTitle: string;
  coachId: string;
  onComplete?: (result: any) => void;
  onClose?: () => void;
}

const FOCUS_AREAS = [
  'Phonics - Letter Sounds',
  'Phonics - Blending',
  'Phonics - CVC Words',
  'Fluency - Speed',
  'Fluency - Expression',
  'Comprehension - Literal',
  'Comprehension - Inferential',
  'Vocabulary Building',
  'Sight Words',
  'Reading Aloud Practice',
  'Story Discussion',
  'Writing Practice',
];

const PROGRESS_RATINGS = [
  { value: 'significant_improvement', label: 'Significant Improvement', emoji: '🚀' },
  { value: 'good_progress', label: 'Good Progress', emoji: '📈' },
  { value: 'steady', label: 'Steady / As Expected', emoji: '➡️' },
  { value: 'needs_more_practice', label: 'Needs More Practice', emoji: '🔄' },
  { value: 'struggling', label: 'Struggling - Attention Needed', emoji: '⚠️' },
];

const ENGAGEMENT_LEVELS = [
  { value: 'highly_engaged', label: 'Highly Engaged', emoji: '🌟' },
  { value: 'engaged', label: 'Engaged', emoji: '😊' },
  { value: 'moderate', label: 'Moderate', emoji: '😐' },
  { value: 'distracted', label: 'Distracted', emoji: '😕' },
  { value: 'disengaged', label: 'Disengaged', emoji: '😴' },
];

const QUIZ_TOPICS = [
  'Phonics - CVC Words',
  'Phonics - Blends',
  'Phonics - Digraphs',
  'Sight Words - Level 1',
  'Sight Words - Level 2',
  'Reading Comprehension',
  'Vocabulary',
  'Story Sequencing',
];

export default function SessionCompleteForm({
  sessionId,
  childId,
  childName,
  childAge,
  sessionTitle,
  coachId,
  onComplete,
  onClose,
}: SessionCompleteFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [focusArea, setFocusArea] = useState('');
  const [progressRating, setProgressRating] = useState('');
  const [engagementLevel, setEngagementLevel] = useState('');
  const [homeworkAssigned, setHomeworkAssigned] = useState(false);
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [generateQuiz, setGenerateQuiz] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Could not access microphone');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Clear recording
  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Submit form
  const handleSubmit = async () => {
    if (!focusArea || !progressRating || !engagementLevel) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let voiceNoteBase64 = '';
      if (audioBlob) {
        voiceNoteBase64 = await blobToBase64(audioBlob);
      }

      const response = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          coachId,
          focusArea,
          progressRating,
          engagementLevel,
          homeworkAssigned,
          homeworkDescription: homeworkAssigned ? homeworkDescription : null,
          voiceNote: voiceNoteBase64 || null,
          quizTopic: quizTopic || null,
          generateQuiz,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete session');
      }

      setSuccess(true);
      onComplete?.(data);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Session Completed!</h2>
        <p className="text-gray-500 mb-6">
          {childName}'s progress has been recorded and saved.
        </p>
        {quizTopic && (
          <p className="text-sm text-purple-600 mb-4">
            📝 Quiz on "{quizTopic}" will be sent to the parent.
          </p>
        )}
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
        <h2 className="text-lg font-semibold">Complete Session</h2>
        <p className="text-purple-200 text-sm">{sessionTitle} • {childName}</p>
      </div>

      {/* Progress Steps */}
      <div className="flex border-b border-gray-100">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              step === s
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {s === 1 && '📊 Progress'}
            {s === 2 && '🎤 Voice Note'}
            {s === 3 && '📝 Quiz'}
          </button>
        ))}
      </div>

      {/* Form Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Structured Data */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Focus Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Focus Area *
              </label>
              <select
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select focus area...</option>
                {FOCUS_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Progress Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Progress *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PROGRESS_RATINGS.map((rating) => (
                  <button
                    key={rating.value}
                    type="button"
                    onClick={() => setProgressRating(rating.value)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      progressRating === rating.value
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-2">{rating.emoji}</span>
                    {rating.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Engagement Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Engagement *
              </label>
              <div className="flex flex-wrap gap-2">
                {ENGAGEMENT_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setEngagementLevel(level.value)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      engagementLevel === level.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level.emoji} {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Homework */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeworkAssigned}
                  onChange={(e) => setHomeworkAssigned(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  <ClipboardList className="w-4 h-4 inline mr-1" />
                  Homework Assigned
                </span>
              </label>
              {homeworkAssigned && (
                <textarea
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="Describe the homework..."
                  className="mt-2 w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={2}
                />
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!focusArea || !progressRating || !engagementLevel}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Voice Note
            </button>
          </div>
        )}

        {/* Step 2: Voice Note */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">
                Record a quick voice note about {childName}'s session (optional)
              </p>

              {!audioBlob ? (
                <div className="space-y-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </button>
                  {isRecording && (
                    <p className="text-red-500 font-medium">
                      Recording... {formatTime(recordingTime)}
                    </p>
                  )}
                  {!isRecording && (
                    <p className="text-gray-400 text-sm">Tap to record</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-100 rounded-xl p-4 inline-flex items-center gap-3">
                    <Mic className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-700">
                      Voice note recorded ({formatTime(recordingTime)})
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={clearRecording}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Delete and re-record
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                {audioBlob ? 'Next: Quiz' : 'Skip to Quiz'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Quiz Assignment */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Sparkles className="w-4 h-4 inline mr-1" />
                Assign Quiz for {childName} (optional)
              </label>
              <select
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No quiz</option>
                {QUIZ_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>

            {quizTopic && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateQuiz}
                  onChange={(e) => setGenerateQuiz(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-600">
                  Generate new quiz using AI (if not in quiz bank)
                </span>
              </label>
            )}

            <div className="bg-purple-50 rounded-xl p-4 text-sm text-purple-700">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="space-y-1 text-purple-600">
                <li>✓ Session progress saved to {childName}'s history</li>
                {audioBlob && <li>✓ Voice note will be transcribed</li>}
                {quizTopic && <li>✓ Quiz link sent to parent via WhatsApp</li>}
                <li>✓ Parent can ask AI about this session</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Complete Session
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
