// file: app/coach/sessions/CoachingSessionForm.tsx
// Enhanced Coaching Session Completion Form
// Captures structured data, voice notes, skills, homework, and flags

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, Mic, Square, Trash2, CheckCircle, Loader2,
  AlertCircle, ChevronRight, ChevronLeft, 
  BookOpen, TrendingUp, Zap, ClipboardList,
  Flag, Sparkles, Volume2, Star
} from 'lucide-react';

interface CoachingSessionFormProps {
  sessionId: string;
  coachId: string;
  childId: string;
  childName: string;
  childAge: number;
  sessionType?: 'coaching' | 'remedial' | 'trial';
  onComplete?: (data: any) => void;
  onClose?: () => void;
}

// Focus area options
const FOCUS_AREAS = [
  { value: 'phonics', label: 'Phonics', icon: '🔤', description: 'Letter sounds, blending' },
  { value: 'fluency', label: 'Fluency', icon: '🎯', description: 'Speed, phrasing' },
  { value: 'comprehension', label: 'Comprehension', icon: '🧠', description: 'Understanding, inference' },
  { value: 'vocabulary', label: 'Vocabulary', icon: '📚', description: 'Word meanings, usage' },
  { value: 'expression', label: 'Expression', icon: '🎭', description: 'Tone, emotion, prosody' },
];

// Progress options
const PROGRESS_OPTIONS = [
  { value: 'improved', label: '📈 Improved', color: 'bg-green-500', bgColor: 'bg-green-50 border-green-500' },
  { value: 'same', label: '➡️ Same', color: 'bg-yellow-500', bgColor: 'bg-yellow-50 border-yellow-500' },
  { value: 'struggled', label: '📉 Struggled', color: 'bg-red-500', bgColor: 'bg-red-50 border-red-500' },
];

// Engagement levels
const ENGAGEMENT_LEVELS = [
  { value: 'high', label: '🔥 High', description: 'Very engaged and participative' },
  { value: 'medium', label: '😊 Medium', description: 'Generally attentive' },
  { value: 'low', label: '😔 Low', description: 'Distracted or uninterested' },
];

// Skills by category (simplified for quick selection)
const SKILLS_BY_CATEGORY: Record<string, { code: string; name: string }[]> = {
  phonics: [
    { code: 'PHO_01', name: 'Letter Recognition' },
    { code: 'PHO_02', name: 'Letter Sounds' },
    { code: 'PHO_03', name: 'Consonant Blends' },
    { code: 'PHO_04', name: 'Digraphs' },
    { code: 'PHO_05', name: 'Silent Letters' },
  ],
  fluency: [
    { code: 'FLU_01', name: 'Sight Words' },
    { code: 'FLU_02', name: 'Reading Speed' },
    { code: 'FLU_03', name: 'Phrasing' },
    { code: 'FLU_04', name: 'Accuracy' },
  ],
  comprehension: [
    { code: 'COMP_01', name: 'Main Idea' },
    { code: 'COMP_02', name: 'Sequence' },
    { code: 'COMP_03', name: 'Inference' },
    { code: 'COMP_04', name: 'Cause & Effect' },
  ],
  vocabulary: [
    { code: 'VOC_01', name: 'Word Meaning' },
    { code: 'VOC_02', name: 'Word Parts' },
  ],
  expression: [
    { code: 'EXP_01', name: 'Expression' },
    { code: 'EXP_02', name: 'Punctuation' },
  ],
};

// Homework topics
const HOMEWORK_TOPICS = [
  'Phonics practice',
  'Sight word review',
  'Reading passage',
  'Comprehension questions',
  'Vocabulary words',
  'Writing practice',
  'Other',
];

// Quiz topics
const QUIZ_TOPICS = [
  { value: 'phonics_blends', label: 'Consonant Blends' },
  { value: 'phonics_digraphs', label: 'Digraphs' },
  { value: 'sight_words', label: 'Sight Words' },
  { value: 'comprehension_main_idea', label: 'Main Idea' },
  { value: 'comprehension_sequence', label: 'Sequence' },
  { value: 'vocabulary', label: 'Vocabulary' },
];

// Flag reasons
const FLAG_REASONS = [
  { value: 'struggling', label: 'Struggling significantly' },
  { value: 'behavior', label: 'Behavior concern' },
  { value: 'parent_concern', label: 'Parent raised concern' },
  { value: 'schedule_issue', label: 'Scheduling problem' },
  { value: 'breakthrough', label: '🌟 Breakthrough moment!' },
];

export default function CoachingSessionForm({
  sessionId,
  coachId,
  childId,
  childName,
  childAge,
  sessionType = 'coaching',
  onComplete,
  onClose,
}: CoachingSessionFormProps) {
  // Step tracking
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 1: Basic assessment
  const [focusArea, setFocusArea] = useState('');
  const [progressRating, setProgressRating] = useState('');
  const [engagementLevel, setEngagementLevel] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState(3);

  // Step 2: Skills worked on
  const [skillsWorkedOn, setSkillsWorkedOn] = useState<string[]>([]);

  // Step 3: Voice note
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 4: Homework, quiz, flags
  const [homeworkAssigned, setHomeworkAssigned] = useState(false);
  const [homeworkTopic, setHomeworkTopic] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [quizAssigned, setQuizAssigned] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [flaggedForAttention, setFlaggedForAttention] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [breakthroughMoment, setBreakthroughMoment] = useState('');
  const [concerns, setConcerns] = useState('');

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get relevant skills based on focus area
  const relevantSkills = focusArea ? SKILLS_BY_CATEGORY[focusArea] || [] : [];

  // Toggle skill selection
  const toggleSkill = (code: string) => {
    if (skillsWorkedOn.includes(code)) {
      setSkillsWorkedOn(skillsWorkedOn.filter(s => s !== code));
    } else {
      setSkillsWorkedOn([...skillsWorkedOn, code]);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setError('Could not access microphone');
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

  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

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

  // Form validation
  const canProceed = () => {
    switch (step) {
      case 1:
        return focusArea && progressRating && engagementLevel;
      case 2:
        return true; // Skills are optional
      case 3:
        return true; // Voice note is optional
      case 4:
        return true; // All step 4 items are optional
      default:
        return true;
    }
  };

  // Submit form
  const handleSubmit = async () => {
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
          sessionType,
          
          // Step 1
          focusArea,
          progressRating,
          engagementLevel,
          confidenceLevel,
          
          // Step 2
          skillsWorkedOn,
          
          // Step 3
          voiceNote: voiceNoteBase64 || null,
          
          // Step 4
          homeworkAssigned,
          homeworkTopic: homeworkAssigned ? homeworkTopic : null,
          homeworkDescription: homeworkAssigned ? homeworkDescription : null,
          quizAssigned,
          quizTopic: quizAssigned ? quizTopic : null,
          flaggedForAttention,
          flagReason: flaggedForAttention ? flagReason : null,
          breakthroughMoment: breakthroughMoment || null,
          concerns: concerns || null,
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

  // Success state
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Completed!</h2>
          <p className="text-gray-600 mb-4">
            {childName}'s progress has been recorded.
          </p>
          
          {homeworkAssigned && (
            <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg mb-3">
              📝 Homework on "{homeworkTopic}" assigned
            </p>
          )}
          
          {quizAssigned && (
            <p className="text-sm text-purple-600 bg-purple-50 p-3 rounded-lg mb-3">
              🧠 Quiz will be sent to parent
            </p>
          )}
          
          {flaggedForAttention && (
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mb-3">
              🚨 Flagged for admin review
            </p>
          )}
          
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#e6008a] transition mt-4"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#FF0099]" />
                Complete Session
              </h2>
              <p className="text-sm text-gray-500">
                {childName} (Age {childAge}) • {sessionType === 'remedial' ? 'Remedial' : 'Coaching'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-[#FF0099]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Step {step} of {totalSteps}</p>
        </div>

        {/* Form Content */}
        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Basic Assessment */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Focus Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What did you focus on today?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map((area) => (
                    <button
                      key={area.value}
                      type="button"
                      onClick={() => setFocusArea(area.value)}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        focusArea === area.value
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{area.icon}</span>
                      <p className="font-medium text-gray-900 text-sm">{area.label}</p>
                      <p className="text-xs text-gray-500">{area.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Progress vs. last session:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PROGRESS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProgressRating(option.value)}
                      className={`p-4 rounded-xl border-2 text-center transition ${
                        progressRating === option.value
                          ? option.bgColor
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Engagement Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Engagement level:
                </label>
                <div className="space-y-2">
                  {ENGAGEMENT_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setEngagementLevel(level.value)}
                      className={`w-full p-3 rounded-xl border-2 text-left transition ${
                        engagementLevel === level.value
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-900">{level.label}</span>
                      <span className="text-sm text-gray-500 ml-2">{level.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {childName}'s confidence today:
                </label>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConfidenceLevel(level)}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition ${
                        confidenceLevel === level
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Star className={`w-5 h-5 mx-auto ${confidenceLevel >= level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      <p className="text-xs text-gray-500 mt-1">{level === 1 ? 'Low' : level === 5 ? 'High' : ''}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Skills Worked On */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Zap className="w-4 h-4 inline mr-1" />
                  Skills worked on (optional):
                </label>
                
                {focusArea && relevantSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                      {focusArea.charAt(0).toUpperCase() + focusArea.slice(1)} Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {relevantSkills.map((skill) => (
                        <button
                          key={skill.code}
                          type="button"
                          onClick={() => toggleSkill(skill.code)}
                          className={`px-4 py-2 rounded-full border transition ${
                            skillsWorkedOn.includes(skill.code)
                              ? 'bg-[#FF0099] text-white border-[#FF0099]'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {skill.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show all other categories collapsed */}
                {Object.entries(SKILLS_BY_CATEGORY)
                  .filter(([cat]) => cat !== focusArea)
                  .map(([category, skills]) => (
                    <div key={category} className="mb-4">
                      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill) => (
                          <button
                            key={skill.code}
                            type="button"
                            onClick={() => toggleSkill(skill.code)}
                            className={`px-3 py-1.5 rounded-full border text-sm transition ${
                              skillsWorkedOn.includes(skill.code)
                                ? 'bg-[#00ABFF] text-white border-[#00ABFF]'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {skill.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                {skillsWorkedOn.length > 0 && (
                  <p className="text-sm text-green-600 mt-3">
                    ✓ {skillsWorkedOn.length} skill(s) selected
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Voice Note */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <Volume2 className="w-8 h-8 text-[#FF0099] mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 mb-2">Quick Voice Note</h3>
                <p className="text-sm text-gray-500 mb-6">
                  What went well? Any concerns? What to focus on next?
                </p>

                <div className="bg-gray-50 rounded-xl p-6">
                  {!audioBlob ? (
                    <div className="space-y-4">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition ${
                          isRecording
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                            : 'bg-[#FF0099] hover:bg-[#e6008a]'
                        }`}
                      >
                        {isRecording ? (
                          <Square className="w-8 h-8 text-white" />
                        ) : (
                          <Mic className="w-8 h-8 text-white" />
                        )}
                      </button>
                      <p className="text-sm text-gray-500">
                        {isRecording
                          ? `Recording... ${formatTime(recordingTime)}`
                          : 'Tap to record (optional)'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">Recording saved</p>
                          <p className="text-sm text-gray-500">{formatTime(recordingTime)}</p>
                        </div>
                      </div>
                      <button
                        onClick={clearRecording}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setStep(4)}
                  className="text-sm text-gray-400 hover:text-gray-600 mt-4"
                >
                  Skip voice note →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Homework, Quiz, Flags */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Homework */}
              <div className="border border-gray-200 rounded-xl p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-700">Assign Homework</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={homeworkAssigned}
                    onChange={(e) => setHomeworkAssigned(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#FF0099] focus:ring-[#FF0099]"
                  />
                </label>

                {homeworkAssigned && (
                  <div className="mt-4 space-y-3 pl-8">
                    <select
                      value={homeworkTopic}
                      onChange={(e) => setHomeworkTopic(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                    >
                      <option value="">Select topic...</option>
                      {HOMEWORK_TOPICS.map((topic) => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                    <textarea
                      value={homeworkDescription}
                      onChange={(e) => setHomeworkDescription(e.target.value)}
                      placeholder="Describe the homework..."
                      className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Quiz */}
              <div className="border border-gray-200 rounded-xl p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-700">Send Quiz to Child</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={quizAssigned}
                    onChange={(e) => setQuizAssigned(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#FF0099] focus:ring-[#FF0099]"
                  />
                </label>

                {quizAssigned && (
                  <div className="mt-4 pl-8">
                    <select
                      value={quizTopic}
                      onChange={(e) => setQuizTopic(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                    >
                      <option value="">Select quiz topic...</option>
                      {QUIZ_TOPICS.map((topic) => (
                        <option key={topic.value} value={topic.value}>{topic.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Flag for Attention */}
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Flag className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-orange-700">Flag for Attention</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={flaggedForAttention}
                    onChange={(e) => setFlaggedForAttention(e.target.checked)}
                    className="w-5 h-5 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                  />
                </label>

                {flaggedForAttention && (
                  <div className="mt-4 pl-8">
                    <select
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      className="w-full p-3 border border-orange-200 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    >
                      <option value="">Select reason...</option>
                      {FLAG_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>{reason.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Breakthrough Moment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🌟 Breakthrough moment? (optional)
                </label>
                <input
                  type="text"
                  value={breakthroughMoment}
                  onChange={(e) => setBreakthroughMoment(e.target.value)}
                  placeholder="E.g., Read a full sentence without help!"
                  className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                />
              </div>

              {/* Concerns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any concerns? (optional)
                </label>
                <textarea
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  placeholder="Note any concerns for follow-up..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 rounded-b-2xl">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            
            {step < totalSteps ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex-1 py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#e6008a] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#e6008a] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Session
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
