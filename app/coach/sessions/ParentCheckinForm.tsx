// file: app/coach/sessions/ParentCheckinForm.tsx
// Parent Check-in Session Completion Form
// Captures parent sentiment, home practice, concerns, and renewal signals

'use client';

import { useState, useRef } from 'react';
import {
  X, Mic, Square, Trash2, CheckCircle, Loader2,
  AlertCircle, Calendar, Flag, ChevronRight,
  ChevronLeft, User, Home, MessageSquare, Target
} from 'lucide-react';

interface ParentCheckinFormProps {
  sessionId: string;
  coachId: string;
  childId: string;
  childName: string;
  parentName: string;
  onComplete?: (data: any) => void;
  onClose?: () => void;
}

// Sentiment options with emojis
const SENTIMENT_OPTIONS = [
  { value: 'very_happy', label: 'Very Happy', emoji: '😊', color: 'bg-green-500' },
  { value: 'happy', label: 'Happy', emoji: '🙂', color: 'bg-green-400' },
  { value: 'neutral', label: 'Neutral', emoji: '😐', color: 'bg-yellow-400' },
  { value: 'concerned', label: 'Concerned', emoji: '😟', color: 'bg-orange-400' },
  { value: 'unhappy', label: 'Unhappy', emoji: '😠', color: 'bg-red-400' },
];

// Practice frequency options
const PRACTICE_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Every day or almost every day' },
  { value: '3-4x/week', label: '3-4 times/week', description: 'Regular practice' },
  { value: '1-2x/week', label: '1-2 times/week', description: 'Occasional practice' },
  { value: 'rarely', label: 'Rarely', description: 'Little to no practice' },
];

// Who helps at home
const HOME_HELPERS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'no_one', label: 'No one' },
];

// Progress perception
const PROGRESS_OPTIONS = [
  { value: 'yes', label: '👍 Yes, seeing improvement', color: 'border-green-500 bg-green-50' },
  { value: 'not_sure', label: '🤷 Not sure yet', color: 'border-yellow-500 bg-yellow-50' },
  { value: 'no', label: '👎 No change seen', color: 'border-red-500 bg-red-50' },
];

// Common concerns
const CONCERN_OPTIONS = [
  { value: 'no_concerns', label: 'No concerns' },
  { value: 'progress_slow', label: 'Progress too slow' },
  { value: 'child_not_interested', label: 'Child not interested' },
  { value: 'scheduling_issues', label: 'Scheduling issues' },
  { value: 'wants_more_sessions', label: 'Wants more sessions' },
  { value: 'considering_stopping', label: 'Considering stopping' },
  { value: 'homework_difficult', label: 'Homework too difficult' },
  { value: 'other', label: 'Other' },
];

// Renewal likelihood
const RENEWAL_OPTIONS = [
  { value: 'high', label: '🟢 High', description: 'Very likely to renew', color: 'bg-green-500' },
  { value: 'medium', label: '🟡 Medium', description: 'May renew with nudge', color: 'bg-yellow-500' },
  { value: 'low', label: '🔴 Low', description: 'Unlikely to renew', color: 'bg-red-500' },
];

export default function ParentCheckinForm({
  sessionId,
  coachId,
  childId,
  childName,
  parentName,
  onComplete,
  onClose,
}: ParentCheckinFormProps) {
  // Step tracking
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form state - Step 1: Parent Sentiment
  const [parentSentiment, setParentSentiment] = useState('');
  const [parentSeesProgress, setParentSeesProgress] = useState('');

  // Form state - Step 2: Home Practice
  const [homePracticeFrequency, setHomePracticeFrequency] = useState('');
  const [homeHelpers, setHomeHelpers] = useState<string[]>([]);

  // Form state - Step 3: Concerns & Feedback
  const [concernsRaised, setConcernsRaised] = useState<string[]>([]);
  const [concernDetails, setConcernDetails] = useState('');
  const [actionItems, setActionItems] = useState('');

  // Form state - Step 4: Voice Note & Renewal
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [escalateToAdmin, setEscalateToAdmin] = useState(false);
  const [renewalLikelihood, setRenewalLikelihood] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Toggle helper selection
  const toggleHelper = (helper: string) => {
    if (homeHelpers.includes(helper)) {
      setHomeHelpers(homeHelpers.filter(h => h !== helper));
    } else {
      setHomeHelpers([...homeHelpers, helper]);
    }
  };

  // Toggle concern selection
  const toggleConcern = (concern: string) => {
    if (concernsRaised.includes(concern)) {
      setConcernsRaised(concernsRaised.filter(c => c !== concern));
    } else {
      // If selecting "no_concerns", clear other selections
      if (concern === 'no_concerns') {
        setConcernsRaised(['no_concerns']);
      } else {
        // Remove "no_concerns" if selecting something else
        setConcernsRaised([...concernsRaised.filter(c => c !== 'no_concerns'), concern]);
      }
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
          if (prev >= 120) { // 2 minute limit
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

  // Form validation for each step
  const canProceed = () => {
    switch (step) {
      case 1:
        return parentSentiment && parentSeesProgress;
      case 2:
        return homePracticeFrequency && homeHelpers.length > 0;
      case 3:
        return concernsRaised.length > 0;
      case 4:
        return renewalLikelihood;
      default:
        return true;
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!renewalLikelihood) {
      setError('Please select renewal likelihood');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let voiceNoteBase64 = '';
      if (audioBlob) {
        voiceNoteBase64 = await blobToBase64(audioBlob);
      }

      const response = await fetch('/api/sessions/parent-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          coachId,
          childId,
          
          // Step 1
          parentSentiment,
          parentSeesProgress,
          
          // Step 2
          homePracticeFrequency,
          homeHelpers,
          
          // Step 3
          concernsRaised,
          concernDetails: concernDetails || null,
          actionItems: actionItems || null,
          
          // Step 4
          followUpNeeded,
          followUpDate: followUpDate || null,
          escalateToAdmin,
          renewalLikelihood,
          voiceNote: voiceNoteBase64 || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save check-in');
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check-in Saved!</h2>
          <p className="text-gray-600 mb-6">
            Parent check-in for {childName} has been recorded.
          </p>
          {escalateToAdmin && (
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mb-4">
              🚨 This has been flagged for admin review
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#e6008a] transition"
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
                <User className="w-5 h-5 text-[#00ABFF]" />
                Parent Check-in
              </h2>
              <p className="text-sm text-gray-500">{parentName} • {childName}</p>
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

          {/* Step 1: Parent Sentiment */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How did {parentName} seem during the call?
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {SENTIMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setParentSentiment(option.value)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition ${
                        parentSentiment === option.value
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl mb-1">{option.emoji}</span>
                      <span className="text-xs text-gray-600 text-center">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Does parent see improvement in {childName}?
                </label>
                <div className="space-y-2">
                  {PROGRESS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setParentSeesProgress(option.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition ${
                        parentSeesProgress === option.value
                          ? option.color + ' border-current'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="font-medium text-gray-900">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Home Practice */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Home className="w-4 h-4 inline mr-1" />
                  How often is {childName} practicing at home?
                </label>
                <div className="space-y-2">
                  {PRACTICE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHomePracticeFrequency(option.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition ${
                        homePracticeFrequency === option.value
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-900">{option.label}</span>
                      <span className="text-sm text-gray-500 block">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Who helps with reading at home?
                </label>
                <div className="flex flex-wrap gap-2">
                  {HOME_HELPERS.map((helper) => (
                    <button
                      key={helper.value}
                      type="button"
                      onClick={() => toggleHelper(helper.value)}
                      className={`px-4 py-2 rounded-full border transition ${
                        homeHelpers.includes(helper.value)
                          ? 'bg-[#00ABFF] text-white border-[#00ABFF]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {helper.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Concerns */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Any concerns raised by parent?
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONCERN_OPTIONS.map((concern) => (
                    <button
                      key={concern.value}
                      type="button"
                      onClick={() => toggleConcern(concern.value)}
                      className={`px-4 py-2 rounded-full border transition ${
                        concernsRaised.includes(concern.value)
                          ? concern.value === 'no_concerns'
                            ? 'bg-green-500 text-white border-green-500'
                            : concern.value === 'considering_stopping'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-orange-400 text-white border-orange-400'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {concern.label}
                    </button>
                  ))}
                </div>
              </div>

              {concernsRaised.includes('other') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe the concern:
                  </label>
                  <textarea
                    value={concernDetails}
                    onChange={(e) => setConcernDetails(e.target.value)}
                    placeholder="What specific concern did the parent raise?"
                    className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                    rows={3}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action items agreed (optional):
                </label>
                <textarea
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  placeholder="What did you agree to do? E.g., Send extra worksheets, schedule extra session..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 4: Voice Note, Follow-up & Renewal */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Voice Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Voice note summary (optional):
                </label>
                <div className="bg-gray-50 rounded-xl p-4">
                  {!audioBlob ? (
                    <div className="text-center">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition ${
                          isRecording
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                            : 'bg-[#FF0099] hover:bg-[#e6008a]'
                        }`}
                      >
                        {isRecording ? (
                          <Square className="w-6 h-6 text-white" />
                        ) : (
                          <Mic className="w-6 h-6 text-white" />
                        )}
                      </button>
                      <p className="text-sm text-gray-500 mt-2">
                        {isRecording
                          ? `Recording... ${formatTime(recordingTime)}`
                          : 'Tap to record'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
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
              </div>

              {/* Follow-up */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-700">Follow-up needed?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followUpNeeded}
                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#FF0099]/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF0099]"></div>
                </label>
              </div>

              {followUpNeeded && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Follow-up by:
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                  />
                </div>
              )}

              {/* Escalate */}
              <div className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-orange-700">Escalate to Rucha?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={escalateToAdmin}
                    onChange={(e) => setEscalateToAdmin(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-orange-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* Renewal Likelihood */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Target className="w-4 h-4 inline mr-1" />
                  Likelihood to renew program:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RENEWAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRenewalLikelihood(option.value)}
                      className={`p-4 rounded-xl border-2 text-center transition ${
                        renewalLikelihood === option.value
                          ? 'border-[#FF0099] bg-[#FF0099]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{option.label.split(' ')[0]}</span>
                      <p className="text-sm text-gray-600 mt-1">{option.label.split(' ')[1]}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
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
                disabled={loading || !canProceed()}
                className="flex-1 py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#e6008a] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Check-in
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
