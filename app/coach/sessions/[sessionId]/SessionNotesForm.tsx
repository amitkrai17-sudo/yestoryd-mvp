// file: app/coach/sessions/[sessionId]/SessionNotesForm.tsx
// Polished Session Notes Form - Required fields, validation, mobile-optimized
// Used after coaching sessions (not parent check-ins)

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, Mic, Square, Trash2, CheckCircle, Loader2,
  AlertCircle, ChevronRight, ChevronLeft, 
  BookOpen, TrendingUp, Zap, ClipboardList,
  Flag, Sparkles, Volume2, Star, Send, Home
} from 'lucide-react';

interface SessionNotesFormProps {
  sessionId: string;
  coachId: string;
  childId: string;
  childName: string;
  childAge: number;
  sessionNumber: number;
  totalSessions: number;
  onComplete?: (data: any) => void;
  onClose?: () => void;
}

// Predefined options for structured data
const FOCUS_AREAS = [
  { code: 'phonics', label: 'Phonics', icon: '🔤' },
  { code: 'fluency', label: 'Reading Fluency', icon: '📖' },
  { code: 'comprehension', label: 'Comprehension', icon: '🧠' },
  { code: 'vocabulary', label: 'Vocabulary', icon: '📝' },
  { code: 'sight_words', label: 'Sight Words', icon: '👀' },
  { code: 'pronunciation', label: 'Pronunciation', icon: '🗣️' },
  { code: 'confidence', label: 'Reading Confidence', icon: '💪' },
  { code: 'speed', label: 'Reading Speed', icon: '⚡' },
];

const PROGRESS_OPTIONS = [
  { value: 'excellent', label: 'Excellent Progress', emoji: '🌟', color: 'bg-green-100 border-green-500 text-green-700' },
  { value: 'good', label: 'Good Progress', emoji: '👍', color: 'bg-blue-100 border-blue-500 text-blue-700' },
  { value: 'steady', label: 'Steady', emoji: '📊', color: 'bg-yellow-100 border-yellow-500 text-yellow-700' },
  { value: 'needs_work', label: 'Needs More Work', emoji: '💪', color: 'bg-orange-100 border-orange-500 text-orange-700' },
];

const ENGAGEMENT_OPTIONS = [
  { value: 'very_engaged', label: 'Very Engaged', emoji: '🔥', description: 'Actively participating, asking questions' },
  { value: 'engaged', label: 'Engaged', emoji: '😊', description: 'Following along, responding well' },
  { value: 'moderate', label: 'Moderate', emoji: '😐', description: 'Some attention, needed prompting' },
  { value: 'distracted', label: 'Distracted', emoji: '😔', description: 'Had trouble focusing today' },
];

const SKILLS_WORKED_ON = [
  { code: 'letter_sounds', label: 'Letter Sounds' },
  { code: 'blending', label: 'Blending' },
  { code: 'digraphs', label: 'Digraphs (th, sh, ch)' },
  { code: 'vowel_sounds', label: 'Vowel Sounds' },
  { code: 'word_families', label: 'Word Families' },
  { code: 'sentence_reading', label: 'Sentence Reading' },
  { code: 'paragraph_reading', label: 'Paragraph Reading' },
  { code: 'story_comprehension', label: 'Story Comprehension' },
  { code: 'inference', label: 'Making Inferences' },
  { code: 'expression', label: 'Reading with Expression' },
];

export default function SessionNotesForm({
  sessionId,
  coachId,
  childId,
  childName,
  childAge,
  sessionNumber,
  totalSessions,
  onComplete,
  onClose,
}: SessionNotesFormProps) {
  // Form state
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [focusArea, setFocusArea] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [engagement, setEngagement] = useState<string>('');
  const [skillsWorkedOn, setSkillsWorkedOn] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(3);
  
  // Voice note
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Homework & flags
  const [homeworkAssigned, setHomeworkAssigned] = useState(false);
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [flagForAttention, setFlagForAttention] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [breakthroughMoment, setBreakthroughMoment] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!focusArea) newErrors.focusArea = 'Please select a focus area';
      if (!progress) newErrors.progress = 'Please rate the progress';
    }

    if (stepNum === 2) {
      if (!engagement) newErrors.engagement = 'Please select engagement level';
      if (skillsWorkedOn.length === 0) newErrors.skills = 'Please select at least one skill';
    }

    if (stepNum === 3) {
      if (homeworkAssigned && !homeworkDescription.trim()) {
        newErrors.homework = 'Please describe the homework';
      }
      if (flagForAttention && !flagReason.trim()) {
        newErrors.flag = 'Please explain the concern';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 120) { // Max 2 minutes
            stopRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert audio to base64 if exists
      let voiceNoteBase64 = '';
      if (audioBlob) {
        const reader = new FileReader();
        voiceNoteBase64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const response = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          coachId,
          childId,
          sessionType: 'coaching',
          focusArea,
          progressRating: progress,
          engagementLevel: engagement,
          confidenceLevel,
          skillsWorkedOn,
          voiceNote: voiceNoteBase64 || undefined,
          homeworkAssigned,
          homeworkDescription: homeworkAssigned ? homeworkDescription : undefined,
          flaggedForAttention: flagForAttention,
          flagReason: flagForAttention ? flagReason : undefined,
          breakthroughMoment: breakthroughMoment || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save session notes');
      }

      setSuccess(true);
      setTimeout(() => {
        onComplete?.(data);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Notes Saved!</h2>
          <p className="text-gray-600 mb-4">
            Great job coaching {childName} today. The parent will receive a summary shortly.
          </p>
          <button
            onClick={() => onClose?.()}
            className="w-full py-3 bg-[#00abff] text-white rounded-xl font-semibold hover:bg-[#0095e0] transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff0099] to-[#7B008B] p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Session Notes</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/80">
            {childName} • Session {sessionNumber}/{totalSessions}
          </p>
          {/* Progress indicator */}
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Focus & Progress */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What did you focus on today? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map((area) => (
                    <button
                      key={area.code}
                      type="button"
                      onClick={() => setFocusArea(area.code)}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        focusArea === area.code
                          ? 'border-[#00abff] bg-[#00abff]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{area.icon}</span>
                      <span className="block text-sm font-medium mt-1">{area.label}</span>
                    </button>
                  ))}
                </div>
                {errors.focusArea && (
                  <p className="text-red-500 text-sm mt-2">{errors.focusArea}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How was {childName}'s progress today? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {PROGRESS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProgress(option.value)}
                      className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition ${
                        progress === option.value
                          ? option.color + ' border-2'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{option.emoji}</span>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
                {errors.progress && (
                  <p className="text-red-500 text-sm mt-2">{errors.progress}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Engagement & Skills */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How engaged was {childName}? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {ENGAGEMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEngagement(option.value)}
                      className={`w-full p-3 rounded-xl border-2 text-left transition ${
                        engagement === option.value
                          ? 'border-[#00abff] bg-[#00abff]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{option.emoji}</span>
                        <div>
                          <span className="font-medium">{option.label}</span>
                          <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.engagement && (
                  <p className="text-red-500 text-sm mt-2">{errors.engagement}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Skills worked on <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS_WORKED_ON.map((skill) => (
                    <button
                      key={skill.code}
                      type="button"
                      onClick={() => {
                        setSkillsWorkedOn(prev =>
                          prev.includes(skill.code)
                            ? prev.filter(s => s !== skill.code)
                            : [...prev, skill.code]
                        );
                      }}
                      className={`px-3 py-2 rounded-full text-sm border transition ${
                        skillsWorkedOn.includes(skill.code)
                          ? 'bg-[#00abff] text-white border-[#00abff]'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {skill.label}
                    </button>
                  ))}
                </div>
                {errors.skills && (
                  <p className="text-red-500 text-sm mt-2">{errors.skills}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Confidence Level: {confidenceLevel}/5
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConfidenceLevel(level)}
                      className={`flex-1 py-3 rounded-xl border-2 transition ${
                        confidenceLevel >= level
                          ? 'bg-yellow-100 border-yellow-400'
                          : 'border-gray-200'
                      }`}
                    >
                      <Star
                        className={`w-6 h-6 mx-auto ${
                          confidenceLevel >= level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Notes, Homework & Flags */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Voice Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Voice Note (optional - up to 2 min)
                </label>
                <div className="bg-gray-50 rounded-xl p-4">
                  {!audioUrl ? (
                    <div className="flex justify-center">
                      {isRecording ? (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                            <Mic className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-lg font-mono mb-2">{formatTime(recordingTime)}</p>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg flex items-center gap-2 mx-auto"
                          >
                            <Square className="w-4 h-4" /> Stop
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex flex-col items-center gap-2 p-4 hover:bg-gray-100 rounded-xl transition"
                        >
                          <div className="w-14 h-14 bg-[#ff0099] rounded-full flex items-center justify-center">
                            <Mic className="w-7 h-7 text-white" />
                          </div>
                          <span className="text-sm text-gray-600">Tap to record</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <audio src={audioUrl} controls className="flex-1 h-10" />
                      <button
                        type="button"
                        onClick={deleteRecording}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Homework */}
              <div>
                <label className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={homeworkAssigned}
                    onChange={(e) => setHomeworkAssigned(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#00abff] focus:ring-[#00abff]"
                  />
                  <span className="text-sm font-medium text-gray-700">Homework assigned</span>
                </label>
                {homeworkAssigned && (
                  <textarea
                    value={homeworkDescription}
                    onChange={(e) => setHomeworkDescription(e.target.value)}
                    placeholder="What should they practice at home?"
                    rows={2}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00abff] focus:border-transparent"
                  />
                )}
                {errors.homework && (
                  <p className="text-red-500 text-sm mt-1">{errors.homework}</p>
                )}
              </div>

              {/* Breakthrough moment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Sparkles className="w-4 h-4 inline mr-1 text-yellow-500" />
                  Breakthrough moment (optional)
                </label>
                <input
                  type="text"
                  value={breakthroughMoment}
                  onChange={(e) => setBreakthroughMoment(e.target.value)}
                  placeholder="Any exciting progress or 'aha' moment?"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00abff] focus:border-transparent"
                />
              </div>

              {/* Flag for attention */}
              <div className="bg-orange-50 rounded-xl p-4">
                <label className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={flagForAttention}
                    onChange={(e) => setFlagForAttention(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-orange-700">
                    <Flag className="w-4 h-4 inline mr-1" />
                    Flag for admin attention
                  </span>
                </label>
                {flagForAttention && (
                  <textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="What's the concern? (Admin will be notified)"
                    rows={2}
                    className="w-full p-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  />
                )}
                {errors.flag && (
                  <p className="text-red-500 text-sm mt-1">{errors.flag}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 py-3 bg-[#00abff] text-white rounded-xl font-semibold hover:bg-[#0095e0] transition flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#ff0099] text-white rounded-xl font-semibold hover:bg-[#e6008a] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Notes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
