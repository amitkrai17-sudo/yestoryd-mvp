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
  X,
  Rocket,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Star,
  Smile,
  Meh,
  Frown,
  Moon,
  FileText,
  LucideIcon,
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

const PROGRESS_RATINGS: { value: string; label: string; Icon: LucideIcon; color: string }[] = [
  { value: 'significant_improvement', label: 'Significant Improvement', Icon: Rocket, color: '#10B981' },
  { value: 'good_progress', label: 'Good Progress', Icon: TrendingUp, color: '#00ABFF' },
  { value: 'steady', label: 'Steady / As Expected', Icon: ArrowRight, color: '#9CA3AF' },
  { value: 'needs_more_practice', label: 'Needs More Practice', Icon: RefreshCw, color: '#F59E0B' },
  { value: 'struggling', label: 'Struggling - Attention Needed', Icon: AlertTriangle, color: '#EF4444' },
];

const ENGAGEMENT_LEVELS: { value: string; label: string; Icon: LucideIcon; color: string }[] = [
  { value: 'highly_engaged', label: 'Highly Engaged', Icon: Star, color: '#FFDE00' },
  { value: 'engaged', label: 'Engaged', Icon: Smile, color: '#10B981' },
  { value: 'moderate', label: 'Moderate', Icon: Meh, color: '#9CA3AF' },
  { value: 'distracted', label: 'Distracted', Icon: Frown, color: '#F59E0B' },
  { value: 'disengaged', label: 'Disengaged', Icon: Moon, color: '#6B7280' },
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
            childId,
            sessionType: 'coaching',
            confidenceLevel: 3,
            skillsWorkedOn: [],
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
      <div className="bg-gray-800 rounded-2xl p-8 text-center max-w-md w-full mx-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Session Completed!</h2>
        <p className="text-gray-400 mb-6">
          {childName}'s progress has been recorded and saved.
        </p>
        {quizTopic && (
          <p className="text-sm text-purple-400 mb-4 flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Quiz on "{quizTopic}" will be sent to the parent.
          </p>
        )}
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Complete Session</h2>
          <p className="text-purple-200 text-sm">{sessionTitle} • {childName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex border-b border-gray-700">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              step === s
                ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s === 1 && <><TrendingUp className="w-4 h-4" /> Progress</>}
            {s === 2 && <><Mic className="w-4 h-4" /> Voice</>}
            {s === 3 && <><FileText className="w-4 h-4" /> Quiz</>}
          </button>
        ))}
      </div>

      {/* Form Content - Scrollable */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm border border-red-500/30">
            {error}
          </div>
        )}

        {/* Step 1: Structured Data */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Focus Area */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Focus Area *
              </label>
              <select
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select focus area...</option>
                {FOCUS_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Progress Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Progress *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PROGRESS_RATINGS.map((rating) => {
                  const isSelected = progressRating === rating.value;
                  return (
                    <button
                      key={rating.value}
                      type="button"
                      onClick={() => setProgressRating(rating.value)}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-purple-500/20 border border-purple-500 text-white'
                          : 'bg-gray-700 border border-transparent text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? `${rating.color}20` : 'rgba(107, 114, 128, 0.3)'
                        }}
                      >
                        <rating.Icon
                          className="w-4 h-4"
                          style={{ color: isSelected ? rating.color : '#9CA3AF' }}
                        />
                      </div>
                      <span className="font-medium">{rating.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Engagement Level */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Engagement *
              </label>
              <div className="flex flex-wrap gap-2">
                {ENGAGEMENT_LEVELS.map((level) => {
                  const isSelected = engagementLevel === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setEngagementLevel(level.value)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-purple-500/20 border border-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-transparent'
                      }`}
                    >
                      <level.Icon
                        className="w-4 h-4"
                        style={{ color: isSelected ? level.color : '#9CA3AF' }}
                      />
                      <span>{level.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Homework */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeworkAssigned}
                  onChange={(e) => setHomeworkAssigned(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-300">
                  <ClipboardList className="w-4 h-4 inline mr-1" />
                  Homework Assigned
                </span>
              </label>
              {homeworkAssigned && (
                <textarea
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="Describe the homework..."
                  className="mt-2 w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={2}
                />
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!focusArea || !progressRating || !engagementLevel}
              className="w-full py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Voice Note
            </button>
          </div>
        )}

        {/* Step 2: Voice Note */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center py-4">
              <p className="text-gray-400 mb-6">
                Record a quick voice note about {childName}'s session (optional)
              </p>

              {!audioBlob ? (
                <div className="space-y-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto transition-all ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-purple-500 hover:bg-purple-600'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-10 h-10 text-white" />
                    ) : (
                      <Mic className="w-10 h-10 text-white" />
                    )}
                  </button>
                  {isRecording && (
                    <p className="text-red-400 font-medium text-lg">
                      Recording... {formatTime(recordingTime)}
                    </p>
                  )}
                  {!isRecording && (
                    <p className="text-gray-500 text-sm">Tap to record</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-xl p-4 inline-flex items-center gap-3">
                    <Mic className="w-5 h-5 text-purple-400" />
                    <span className="text-white">
                      Voice note recorded ({formatTime(recordingTime)})
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={clearRecording}
                      className="text-red-400 text-sm hover:underline"
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
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Sparkles className="w-4 h-4 inline mr-1" />
                Assign Quiz for {childName} (optional)
              </label>
              <select
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-400">
                  Generate new quiz using AI (if not in quiz bank)
                </span>
              </label>
            )}

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-sm">
              <p className="font-medium text-purple-400 mb-2">What happens next?</p>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  Session progress saved to {childName}'s history
                </li>
                {audioBlob && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Voice note will be transcribed
                  </li>
                )}
                {quizTopic && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Quiz link sent to parent via WhatsApp
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  Parent can ask AI about this session
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Complete
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