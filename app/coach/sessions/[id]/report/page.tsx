// app/coach/sessions/[id]/report/page.tsx
// Post-session report form for offline sessions
// Mobile-first — 80%+ users are on phone after a home visit

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CoachLayout from '@/components/layouts/CoachLayout';
import { AudioRecorder } from '@/components/coach/AudioRecorder';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Mic,
  FileText,
  MapPin,
  Timer,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ActivityStep {
  time: string;
  activity: string;
  purpose: string;
  activity_id?: string;
  activity_name?: string;
  planned_duration_minutes?: number;
}

interface SessionData {
  id: string;
  child_id: string;
  child_name: string;
  child_age: number;
  session_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  session_mode: string;
  offline_request_status: string | null;
  report_submitted_at: string | null;
  report_deadline: string | null;
  coach_voice_note_path: string | null;
  child_reading_clip_path: string | null;
  session_template_id: string | null;
  status: string;
  activities: ActivityStep[];
}

type ActivityStatus = 'completed' | 'partial' | 'skipped';

interface ActivityEntry {
  activity_index: number;
  activity_name: string;
  activity_purpose?: string;
  status: ActivityStatus | null;
  coach_note: string;
  planned_duration_minutes?: number;
}

interface UnplannedActivity {
  name: string;
  purpose: string;
}

// ============================================================
// HELPERS
// ============================================================

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getDeadlineInfo(deadline: string | null): { text: string; isLate: boolean; isPast: boolean } {
  if (!deadline) return { text: '', isLate: false, isPast: false };

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const isPast = now > deadlineDate;

  if (isPast) {
    return { text: 'Past deadline — report will be marked late', isLate: true, isPast: true };
  }

  // Calculate time remaining
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return {
      text: `Submit by ${deadlineDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })} today (${diffHours}h ${diffMins}m left)`,
      isLate: false,
      isPast: false,
    };
  }

  return { text: `${diffMins} minutes left to submit`, isLate: false, isPast: false };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function OfflineReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  // Data state
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  // Form state
  const [voiceNoteUploaded, setVoiceNoteUploaded] = useState(false);
  const [voiceNotePath, setVoiceNotePath] = useState<string | null>(null);
  const [readingClipUploaded, setReadingClipUploaded] = useState(false);
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [textFallback, setTextFallback] = useState('');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [unplannedActivities, setUnplannedActivities] = useState<UnplannedActivity[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityPurpose, setNewActivityPurpose] = useState('');
  const [wordsStruggled, setWordsStruggled] = useState<string[]>([]);
  const [wordsMastered, setWordsMastered] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [masteredInput, setMasteredInput] = useState('');
  const [actualStartTime, setActualStartTime] = useState('');
  const [actualEndTime, setActualEndTime] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [adherenceScore, setAdherenceScore] = useState<number | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadSession = useCallback(async () => {
    try {
      // Fetch session data
      const res = await fetch(`/api/coach/sessions/${sessionId}/report-data`);
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = '/coach/login';
          return;
        }
        if (res.status === 403 || res.status === 400) {
          setAccessDenied(data.error || 'Access denied');
          return;
        }
        throw new Error(data.error || 'Failed to load session');
      }

      const data = await res.json();
      setSession(data.session);

      // Already submitted?
      if (data.session.report_submitted_at) {
        setSubmitted(true);
        return;
      }

      // Pre-fill times from scheduled
      setActualStartTime(data.session.scheduled_time || '');
      // Default end time: scheduled_time + 30min
      if (data.session.scheduled_time) {
        const [h, m] = data.session.scheduled_time.split(':').map(Number);
        const endDate = new Date(2000, 0, 1, h, m + 30);
        setActualEndTime(
          `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
        );
      }

      // Pre-fill voice note status if already uploaded
      if (data.session.coach_voice_note_path) {
        setVoiceNoteUploaded(true);
        setVoiceNotePath(data.session.coach_voice_note_path);
      }
      if (data.session.child_reading_clip_path) {
        setReadingClipUploaded(true);
      }

      // Initialize activities from template
      const activitySteps: ActivityStep[] = data.session.activities || [];
      setActivities(
        activitySteps.map((step, index) => ({
          activity_index: index,
          activity_name: step.activity_name || step.activity,
          activity_purpose: step.purpose,
          status: null,
          coach_note: '',
          planned_duration_minutes: step.planned_duration_minutes,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const updateActivityStatus = (index: number, status: ActivityStatus) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.activity_index === index
          ? { ...a, status: a.status === status ? null : status }
          : a
      )
    );
  };

  const updateActivityNote = (index: number, note: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.activity_index === index ? { ...a, coach_note: note } : a))
    );
  };

  const addUnplannedActivity = () => {
    if (!newActivityName.trim()) return;
    setUnplannedActivities((prev) => [
      ...prev,
      { name: newActivityName.trim(), purpose: newActivityPurpose.trim() },
    ]);
    setNewActivityName('');
    setNewActivityPurpose('');
    setShowAddActivity(false);
  };

  const removeUnplannedActivity = (index: number) => {
    setUnplannedActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const addWord = (type: 'struggled' | 'mastered') => {
    const input = type === 'struggled' ? wordInput : masteredInput;
    const word = input.trim();
    if (!word) return;
    if (type === 'struggled') {
      if (!wordsStruggled.includes(word)) setWordsStruggled((prev) => [...prev, word]);
      setWordInput('');
    } else {
      if (!wordsMastered.includes(word)) setWordsMastered((prev) => [...prev, word]);
      setMasteredInput('');
    }
  };

  const removeWord = (type: 'struggled' | 'mastered', word: string) => {
    if (type === 'struggled') {
      setWordsStruggled((prev) => prev.filter((w) => w !== word));
    } else {
      setWordsMastered((prev) => prev.filter((w) => w !== word));
    }
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const validate = (): string | null => {
    // Voice note or text fallback required
    if (!voiceNoteUploaded && !useTextFallback) {
      return 'Please record a voice note or use the text fallback';
    }
    if (useTextFallback && textFallback.trim().length < 100) {
      return 'Text summary must be at least 100 characters';
    }

    // At least one activity with a status
    const hasActivityStatus = activities.some((a) => a.status !== null);
    if (!hasActivityStatus && activities.length > 0) {
      return 'Please mark at least one activity status';
    }

    if (!actualStartTime || !actualEndTime) {
      return 'Please fill in the session start and end times';
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Build activities payload
      const scheduledDate = session?.scheduled_date || new Date().toISOString().split('T')[0];
      const activitiesPayload = activities
        .filter((a) => a.status !== null)
        .map((a) => ({
          activity_index: a.activity_index,
          activity_name: a.activity_name,
          activity_purpose: a.activity_purpose,
          status: a.status,
          planned_duration_minutes: a.planned_duration_minutes,
          coach_note: a.coach_note || undefined,
        }));

      const additionalActivities = unplannedActivities.map((a, i) => ({
        activity_index: activities.length + i,
        activity_name: a.name,
        activity_purpose: a.purpose,
        status: 'completed' as const,
      }));

      const body = {
        actual_start_time: `${scheduledDate}T${actualStartTime}:00`,
        actual_end_time: `${scheduledDate}T${actualEndTime}:00`,
        activities: activitiesPayload,
        additional_activities: additionalActivities.length > 0 ? additionalActivities : undefined,
        words_struggled: wordsStruggled.length > 0 ? wordsStruggled : undefined,
        words_mastered: wordsMastered.length > 0 ? wordsMastered : undefined,
        coach_notes: useTextFallback ? textFallback.trim() : undefined,
      };

      const res = await fetch(`/api/coach/sessions/${sessionId}/offline-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setAdherenceScore(data.adherence_score);
      setSubmitted(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/coach/sessions');
      }, 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RENDER: LOADING
  // ============================================================

  if (loading) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF] mx-auto mb-4" />
            <p className="text-text-tertiary">Loading report form...</p>
          </div>
        </div>
      </CoachLayout>
    );
  }

  // ============================================================
  // RENDER: ACCESS DENIED
  // ============================================================

  if (accessDenied) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <p className="text-white text-lg mb-2">Cannot Submit Report</p>
            <p className="text-text-tertiary text-sm mb-4">{accessDenied}</p>
            <button
              onClick={() => router.push('/coach/sessions')}
              className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg text-sm hover:bg-[#00ABFF]/90 transition-colors"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  // ============================================================
  // RENDER: ERROR
  // ============================================================

  if (error || !session) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-4">{error || 'Session not found'}</p>
            <button
              onClick={loadSession}
              className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg text-sm hover:bg-[#00ABFF]/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  // ============================================================
  // RENDER: SUBMITTED STATE
  // ============================================================

  if (submitted) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-sm">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Report Submitted</h2>
            {adherenceScore !== null && (
              <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
                <p className="text-text-tertiary text-xs mb-1">Adherence Score</p>
                <p className="text-3xl font-bold text-white">{Math.round(adherenceScore * 100)}%</p>
              </div>
            )}
            <p className="text-text-tertiary text-sm mb-4">
              {session.report_submitted_at
                ? 'This report was already submitted.'
                : 'Redirecting to sessions...'}
            </p>
            <button
              onClick={() => router.push('/coach/sessions')}
              className="px-6 py-3 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors min-h-[48px]"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  // ============================================================
  // RENDER: REPORT FORM
  // ============================================================

  const deadlineInfo = getDeadlineInfo(session.report_deadline);
  const hasAtLeastOneStatus = activities.some((a) => a.status !== null);
  const canSubmit = (voiceNoteUploaded || (useTextFallback && textFallback.trim().length >= 100))
    && (hasAtLeastOneStatus || activities.length === 0)
    && actualStartTime && actualEndTime;

  return (
    <CoachLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8">
        {/* ============================================================
            HEADER
            ============================================================ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span className="text-purple-400 text-xs font-medium">In-Person Session Report</span>
          </div>
          <h1 className="text-lg lg:text-xl font-bold text-white">
            Session #{session.session_number} — {session.child_name}
            {session.child_age > 0 && (
              <span className="text-text-tertiary font-normal text-sm"> (Age {session.child_age})</span>
            )}
          </h1>

          {/* Deadline countdown */}
          {deadlineInfo.text && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              deadlineInfo.isLate
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
            }`}>
              {deadlineInfo.isLate
                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                : <Timer className="w-3.5 h-3.5 flex-shrink-0" />
              }
              <span>{deadlineInfo.text}</span>
            </div>
          )}
        </div>

        {/* ============================================================
            SECTION A: VOICE SUMMARY (PRIMARY INPUT)
            ============================================================ */}
        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-brand-primary/20 rounded-lg flex items-center justify-center">
              <Mic className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">Voice Summary</h2>
              <p className="text-text-tertiary text-[11px]">Required</p>
            </div>
          </div>

          {!useTextFallback ? (
            <>
              <AudioRecorder
                sessionId={sessionId}
                audioType="voice_note"
                onUploadComplete={(path) => {
                  setVoiceNoteUploaded(true);
                  setVoiceNotePath(path);
                }}
                promptText="Tell us about the in-person session — what worked, what surprised you, what the child struggled with"
              />
              <button
                onClick={() => setUseTextFallback(true)}
                className="mt-3 text-text-tertiary text-xs hover:text-text-secondary transition-colors underline"
              >
                Can&apos;t record? Type instead
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-xs">Text summary (min 100 characters)</span>
                </div>
                <textarea
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                  placeholder="Tell us about the in-person session — what worked, what surprised you, what the child struggled with..."
                  className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary resize-none min-h-[120px]"
                  rows={5}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] ${textFallback.length >= 100 ? 'text-green-400' : 'text-text-tertiary'}`}>
                    {textFallback.length}/100 min
                  </span>
                  <button
                    onClick={() => setUseTextFallback(false)}
                    className="text-text-tertiary text-xs hover:text-text-secondary transition-colors underline"
                  >
                    Switch to voice recording
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ============================================================
            SECTION B: CHILD READING CLIP (OPTIONAL)
            ============================================================ */}
        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white text-sm font-semibold">Child Reading Clip</h2>
                <p className="text-text-tertiary text-[11px]">Optional — improves profile quality</p>
              </div>
            </div>
          </div>

          <AudioRecorder
            sessionId={sessionId}
            audioType="reading_clip"
            onUploadComplete={() => setReadingClipUploaded(true)}
            maxDurationSeconds={120}
            promptText="Record 1-2 min of the child reading. This helps our AI track their reading progress accurately."
          />
        </section>

        {/* ============================================================
            SECTION C: ACTIVITIES
            ============================================================ */}
        {activities.length > 0 && (
          <section className="bg-surface-1 border border-border rounded-xl p-4">
            <h2 className="text-white text-sm font-semibold mb-3">Activities</h2>

            <div className="space-y-2">
              {activities.map((activity, idx) => (
                <div
                  key={activity.activity_index}
                  className="bg-surface-2 border border-border rounded-lg overflow-hidden"
                >
                  {/* Activity header */}
                  <button
                    onClick={() => setExpandedActivity(expandedActivity === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{activity.activity_name}</p>
                      {activity.activity_purpose && (
                        <p className="text-text-tertiary text-[11px] truncate">{activity.activity_purpose}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activity.status && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          activity.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          activity.status === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {activity.status === 'completed' ? 'Done' :
                           activity.status === 'partial' ? 'Partial' : 'Skip'}
                        </span>
                      )}
                      {expandedActivity === idx
                        ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                        : <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      }
                    </div>
                  </button>

                  {/* Expanded: status buttons + note */}
                  {expandedActivity === idx && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                      {/* Status buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateActivityStatus(idx, 'completed')}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                            activity.status === 'completed'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-surface-3 text-text-secondary hover:bg-surface-4 border border-transparent'
                          }`}
                        >
                          Done
                        </button>
                        <button
                          onClick={() => updateActivityStatus(idx, 'partial')}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                            activity.status === 'partial'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-surface-3 text-text-secondary hover:bg-surface-4 border border-transparent'
                          }`}
                        >
                          Partial
                        </button>
                        <button
                          onClick={() => updateActivityStatus(idx, 'skipped')}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                            activity.status === 'skipped'
                              ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              : 'bg-surface-3 text-text-secondary hover:bg-surface-4 border border-transparent'
                          }`}
                        >
                          Skip
                        </button>
                      </div>

                      {/* Quick note */}
                      <input
                        type="text"
                        value={activity.coach_note}
                        onChange={(e) => updateActivityNote(idx, e.target.value)}
                        placeholder="Quick note (optional)"
                        className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[40px]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Unplanned activities */}
            {unplannedActivities.map((activity, idx) => (
              <div key={`unplanned-${idx}`} className="bg-surface-2 border border-amber-500/20 rounded-lg p-3 mt-2 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{activity.name}</p>
                  {activity.purpose && <p className="text-text-tertiary text-[11px]">{activity.purpose}</p>}
                  <span className="text-[10px] text-amber-400">Unplanned</span>
                </div>
                <button
                  onClick={() => removeUnplannedActivity(idx)}
                  className="p-1 text-text-tertiary hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Add unplanned activity */}
            {showAddActivity ? (
              <div className="bg-surface-2 border border-border rounded-lg p-3 mt-2 space-y-2">
                <input
                  type="text"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="Activity name"
                  className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                />
                <input
                  type="text"
                  value={newActivityPurpose}
                  onChange={(e) => setNewActivityPurpose(e.target.value)}
                  placeholder="Purpose (optional)"
                  className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddActivity(false)}
                    className="flex-1 py-2 bg-surface-3 text-text-secondary rounded-lg text-xs hover:bg-surface-4 transition-colors min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addUnplannedActivity}
                    disabled={!newActivityName.trim()}
                    className="flex-1 py-2 bg-brand-primary text-white rounded-lg text-xs font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 min-h-[40px]"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddActivity(true)}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-surface-2 border border-dashed border-border rounded-lg text-text-secondary text-xs hover:border-border-strong transition-colors min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Unplanned Activity
              </button>
            )}
          </section>
        )}

        {/* ============================================================
            SECTION D: WORDS TO WATCH
            ============================================================ */}
        <section className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-white text-sm font-semibold">Words to Watch <span className="text-text-tertiary font-normal">(optional)</span></h2>

          {/* Struggled words */}
          <div>
            <label className="text-red-400 text-xs font-medium mb-1.5 block">Struggled</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord('struggled'); } }}
                placeholder="Type a word and press Enter"
                className="flex-1 bg-surface-0 text-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
              />
              <button
                onClick={() => addWord('struggled')}
                className="px-3 bg-surface-3 text-text-secondary rounded-lg text-sm hover:bg-surface-4 transition-colors min-h-[44px]"
              >
                Add
              </button>
            </div>
            {wordsStruggled.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {wordsStruggled.map((word) => (
                  <span key={word} className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full text-xs">
                    {word}
                    <button onClick={() => removeWord('struggled', word)} className="hover:text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mastered words */}
          <div>
            <label className="text-green-400 text-xs font-medium mb-1.5 block">Mastered</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={masteredInput}
                onChange={(e) => setMasteredInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord('mastered'); } }}
                placeholder="Type a word and press Enter"
                className="flex-1 bg-surface-0 text-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
              />
              <button
                onClick={() => addWord('mastered')}
                className="px-3 bg-surface-3 text-text-secondary rounded-lg text-sm hover:bg-surface-4 transition-colors min-h-[44px]"
              >
                Add
              </button>
            </div>
            {wordsMastered.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {wordsMastered.map((word) => (
                  <span key={word} className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full text-xs">
                    {word}
                    <button onClick={() => removeWord('mastered', word)} className="hover:text-green-300">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
            SECTION E: SESSION TIME
            ============================================================ */}
        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <h2 className="text-white text-sm font-semibold mb-3">Session Time</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Start Time</label>
              <input
                type="time"
                value={actualStartTime}
                onChange={(e) => setActualStartTime(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[48px] [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">End Time</label>
              <input
                type="time"
                value={actualEndTime}
                onChange={(e) => setActualEndTime(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[48px] [color-scheme:dark]"
              />
            </div>
          </div>
          <p className="text-text-tertiary text-[11px] mt-2">
            Scheduled: {formatTime(session.scheduled_time)} on {new Date(session.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </section>

        {/* ============================================================
            SUBMIT
            ============================================================ */}
        {submitError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{submitError}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full bg-brand-primary text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-h-[52px] shadow-lg shadow-brand-primary/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting Report...
            </>
          ) : (
            'Submit Report'
          )}
        </button>

        {/* Validation hints */}
        {!canSubmit && (
          <div className="text-text-tertiary text-[11px] text-center space-y-0.5">
            {!voiceNoteUploaded && !useTextFallback && <p>Voice note required (or switch to text)</p>}
            {useTextFallback && textFallback.trim().length < 100 && <p>Text summary needs {100 - textFallback.trim().length} more characters</p>}
            {activities.length > 0 && !hasAtLeastOneStatus && <p>Mark at least one activity status</p>}
          </div>
        )}
      </div>
    </CoachLayout>
  );
}
