// =============================================================================
// FILE: app/instructor/session/[sessionId]/SessionConsoleClient.tsx
// PURPOSE: 4-state session console for live group class instruction
// =============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, ExternalLink, Play, ChevronLeft, ChevronRight,
  Clock, Users, AlertCircle, CheckCircle, Square,
  MessageSquare, Mic, MicOff, X, Send, Copy, Check,
  BookOpen, Video, Palette, Star, Award,
} from 'lucide-react';
import type {
  BlueprintSegment, IndividualMomentConfig, AgeBand, SegmentType,
} from '@/types/group-classes';

// =============================================================================
// TYPES
// =============================================================================

type ConsoleState = 'PRE_SESSION' | 'DURING_SESSION' | 'INDIVIDUAL_MOMENT' | 'POST_SESSION';

interface ChildProfile {
  id: string;
  name: string;
  age: number | null;
  learning_profile: Record<string, unknown> | null;
  learning_style: string | null;
  learning_challenges: string[] | null;
}

interface Participant {
  id: string;
  child_id: string | null;
  payment_status: string | null;
  attendance_status: string | null;
  participation_rating: number | null;
  participation_notes: string | null;
  child: ChildProfile | null;
}

interface ClassType {
  id: string;
  name: string;
  slug: string;
  icon_emoji: string | null;
  color_hex: string | null;
  duration_minutes: number;
}

interface SessionData {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  age_min: number | null;
  age_max: number | null;
  google_meet_link: string | null;
  status: string | null;
  blueprint_id: string | null;
  class_type: ClassType | null;
}

interface Blueprint {
  id: string;
  name: string;
  age_band: AgeBand;
  segments: BlueprintSegment[];
  individual_moment_config: IndividualMomentConfig;
  content_refs: { content_item_id: string; segment_index: number; type: string; title?: string }[] | null;
  skill_tags: string[] | null;
}

interface ContentItemMap {
  [id: string]: { id: string; title: string; content_type: string; thumbnail_url: string | null };
}

interface ParticipantRating {
  childId: string;
  participantId: string;
  engagement: 'low' | 'medium' | 'high';
  skillTags: string[];
  note: string;
  voiceNoteUrl: string;
}

interface ActivityLink {
  token: string;
  url: string;
  childName: string;
}

interface TypedResponse {
  child_id: string;
  child_name: string;
  response_text: string;
  submitted_at: string;
}

// Observation tags for verbal moments
// TODO: Connect to el_skills table for dynamic tags
const OBSERVATION_TAGS = [
  'Clear speech', 'Hesitant', 'Good vocabulary', 'Needs prompting',
  'Story sequence correct', 'Confused sequence', 'Creative additions',
];

const SEGMENT_ICONS: Record<SegmentType, typeof Video> = {
  content_playback: Video,
  group_discussion: MessageSquare,
  individual_moment: Star,
  creative_activity: Palette,
  wrap_up: Award,
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function getChildContext(child: ChildProfile | null): string {
  if (!child) return '';
  const profile = child.learning_profile as Record<string, unknown> | null;
  if (profile) {
    const struggle = profile.struggle_area || profile.last_struggle || profile.reading_level;
    if (struggle) return String(struggle);
  }
  if (child.learning_challenges?.length) return child.learning_challenges[0];
  if (child.learning_style) return child.learning_style;
  return '';
}

// =============================================================================
// QUICK NOTE MODAL
// =============================================================================

function QuickNoteModal({
  childName,
  childId,
  currentNote,
  onSave,
  onClose,
}: {
  childName: string;
  childId: string;
  currentNote: string;
  onSave: (childId: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(currentNote);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Note for {childName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>
        <textarea
          ref={inputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quick observation..."
          className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted text-sm resize-none"
          rows={3}
        />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border text-text-secondary rounded-xl text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={() => { onSave(childId, note); onClose(); }}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// VOICE RECORDER
// =============================================================================

function VoiceRecorder({
  sessionId,
  childId,
  onRecorded,
}: {
  sessionId: string;
  childId: string;
  onRecorded: (url: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadVoiceNote(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadVoiceNote = async (blob: Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, `${childId}.webm`);
      formData.append('childId', childId);

      const res = await fetch(`/api/instructor/session/${sessionId}/voice-note`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        onRecorded(data.publicUrl || data.path);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      disabled={uploading}
      className={`p-2 rounded-lg transition-all ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : uploading
            ? 'bg-surface-2 text-text-tertiary'
            : 'bg-surface-2 text-text-secondary hover:text-white'
      }`}
      title={recording ? 'Stop recording' : uploading ? 'Uploading...' : 'Record voice note'}
    >
      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}

// =============================================================================
// MAIN CONSOLE COMPONENT
// =============================================================================

export default function SessionConsoleClient() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  // Core data
  const [session, setSession] = useState<SessionData | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [contentItems, setContentItems] = useState<ContentItemMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Console state
  const [consoleState, setConsoleState] = useState<ConsoleState>('PRE_SESSION');
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  // Timer
  const [segmentElapsed, setSegmentElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick notes per child (childId → note text)
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>({});
  const [quickNoteChild, setQuickNoteChild] = useState<{ id: string; name: string } | null>(null);

  // Discussion checklist (segment index → set of checked question indices)
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, Set<number>>>({});

  // Individual moment state (verbal observations: childId → { tags: string[], note: string })
  const [verbalObservations, setVerbalObservations] = useState<Record<string, { tags: string[]; note: string }>>({});
  const [currentObservationChildIdx, setCurrentObservationChildIdx] = useState(0);

  // Post-session ratings
  const [ratings, setRatings] = useState<Record<string, ParticipantRating>>({});
  const [sessionNotes, setSessionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Activity links + typed response polling
  const [activityLinks, setActivityLinks] = useState<Record<string, ActivityLink>>({});
  const [typedResponses, setTypedResponses] = useState<TypedResponse[]>([]);
  const [responsesCount, setResponsesCount] = useState(0);
  const [linksCopied, setLinksCopied] = useState(false);

  // ─── FETCH SESSION DATA ───
  useEffect(() => {
    fetchSessionData();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSessionData = async () => {
    try {
      const res = await fetch(`/api/instructor/session/${sessionId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load session');

      setSession(data.session);
      setBlueprint(data.blueprint);
      setParticipants(data.participants || []);
      setContentItems(data.contentItems || {});
      setActivityLinks(data.activityLinks || {});

      // Initialize ratings for each participant
      const initialRatings: Record<string, ParticipantRating> = {};
      for (const p of data.participants || []) {
        if (p.child_id && p.child) {
          initialRatings[p.child_id] = {
            childId: p.child_id,
            participantId: p.id,
            engagement: 'medium',
            skillTags: [],
            note: '',
            voiceNoteUrl: '',
          };
        }
      }
      setRatings(initialRatings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // ─── TIMER ───
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setSegmentElapsed(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  // ─── SEGMENT NAVIGATION ───
  const segments = blueprint?.segments || [];
  const currentSegment = segments[currentSegmentIndex];
  const segmentDurationSec = (currentSegment?.duration_minutes || 0) * 60;
  const segmentRemaining = segmentDurationSec - segmentElapsed;

  // ─── TYPED RESPONSE POLLING ───
  const isTypedMoment = consoleState === 'INDIVIDUAL_MOMENT' &&
    currentSegment?.type === 'individual_moment' &&
    blueprint?.individual_moment_config?.type !== 'verbal' &&
    blueprint?.age_band !== '4-6';

  useEffect(() => {
    if (!isTypedMoment) return;

    const pollResponses = async () => {
      try {
        const res = await fetch(`/api/group-classes/activity/responses/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTypedResponses(data.responses || []);
        setResponsesCount(data.submitted_count || 0);
      } catch {
        // Silently fail — will retry on next interval
      }
    };

    pollResponses();
    const interval = setInterval(pollResponses, 5000);
    return () => clearInterval(interval);
  }, [isTypedMoment, sessionId]);

  const goToSegment = useCallback((idx: number) => {
    if (idx >= 0 && idx < segments.length) {
      setCurrentSegmentIndex(idx);
      setSegmentElapsed(0);
      setTimerRunning(true);

      // Switch to INDIVIDUAL_MOMENT state if needed
      const seg = segments[idx];
      if (seg?.type === 'individual_moment') {
        setConsoleState('INDIVIDUAL_MOMENT');
        setCurrentObservationChildIdx(0);
      } else if (consoleState === 'INDIVIDUAL_MOMENT') {
        setConsoleState('DURING_SESSION');
      }
    }
  }, [segments, consoleState]);

  const handleStartSession = () => {
    setConsoleState('DURING_SESSION');
    setCurrentSegmentIndex(0);
    setSegmentElapsed(0);
    setTimerRunning(true);
  };

  const handleEndSession = () => {
    setTimerRunning(false);
    // Pre-populate rating notes from quick notes
    setRatings(prev => {
      const updated = { ...prev };
      for (const [childId, note] of Object.entries(quickNotes)) {
        if (updated[childId]) {
          updated[childId] = { ...updated[childId], note: note };
        }
      }
      return updated;
    });
    setConsoleState('POST_SESSION');
  };

  // ─── QUICK NOTE ───
  const saveQuickNote = (childId: string, note: string) => {
    setQuickNotes(prev => ({ ...prev, [childId]: note }));
  };

  // ─── DISCUSSION CHECKLIST ───
  const toggleQuestion = (segIdx: number, qIdx: number) => {
    setCheckedQuestions(prev => {
      const set = new Set(prev[segIdx] || []);
      if (set.has(qIdx)) set.delete(qIdx); else set.add(qIdx);
      return { ...prev, [segIdx]: set };
    });
  };

  // ─── VERBAL OBSERVATIONS ───
  const toggleObservationTag = (childId: string, tag: string) => {
    setVerbalObservations(prev => {
      const current = prev[childId] || { tags: [], note: '' };
      const tags = current.tags.includes(tag)
        ? current.tags.filter(t => t !== tag)
        : [...current.tags, tag];
      return { ...prev, [childId]: { ...current, tags } };
    });
  };

  const setObservationNote = (childId: string, note: string) => {
    setVerbalObservations(prev => {
      const current = prev[childId] || { tags: [], note: '' };
      return { ...prev, [childId]: { ...current, note } };
    });
  };

  // ─── SUBMIT RATINGS ───
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ratingsArray = Object.values(ratings);
      const res = await fetch(`/api/group-classes/session/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings: ratingsArray,
          sessionNotes,
          quickNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Session completed successfully!');
      window.close();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── LOADING / ERROR ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium">{error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  // =============================================================================
  // STATE 1: PRE-SESSION
  // =============================================================================
  if (consoleState === 'PRE_SESSION') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Session Info Header */}
        <div className="bg-surface-1 rounded-2xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
              {session.class_type?.icon_emoji || '📚'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{session.title}</h1>
              <p className="text-text-secondary mt-1">{session.class_type?.name || 'Group Class'}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-text-tertiary flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
                </span>
                <span>{session.duration_minutes} min</span>
                {session.age_min && session.age_max && (
                  <span>Ages {session.age_min}-{session.age_max}</span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {participants.length} participants
                </span>
              </div>
            </div>
          </div>

          {session.google_meet_link && (
            <a
              href={session.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-colors"
            >
              <Video className="w-4 h-4" />
              Open Google Meet
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Participants Table */}
        <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-text-tertiary" />
              Participants ({participants.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {participants.map((p) => {
              const child = p.child;
              const context = getChildContext(child);
              const isPaid = p.payment_status === 'paid' || p.payment_status === 'free';

              return (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-2 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {child?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{child?.name || 'Unknown'}</p>
                      <p className="text-xs text-text-tertiary">
                        {child?.age ? `Age ${child.age}` : ''}
                        {context ? ` · ${context}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isPaid
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {isPaid ? 'Enrolled' : p.payment_status || 'Pending'}
                  </span>
                </div>
              );
            })}
            {participants.length === 0 && (
              <div className="px-6 py-8 text-center text-text-tertiary">No participants registered yet</div>
            )}
          </div>
        </div>

        {/* Activity Links (for typed response collection) */}
        {Object.keys(activityLinks).length > 0 && (
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Activity Links</h2>
                <p className="text-xs text-text-tertiary mt-0.5">Share with parents for typed responses during Individual Moment</p>
              </div>
              <button
                onClick={async () => {
                  const lines = Object.values(activityLinks).map(
                    (link) => `${link.childName}: ${link.url}`
                  );
                  await navigator.clipboard.writeText(lines.join('\n'));
                  setLinksCopied(true);
                  setTimeout(() => setLinksCopied(false), 2000);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  linksCopied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white'
                }`}
              >
                {linksCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy All Links</>}
              </button>
            </div>
            <div className="divide-y divide-border max-h-48 overflow-y-auto">
              {Object.entries(activityLinks).map(([childId, link]) => (
                <div key={childId} className="px-6 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-white">{link.childName}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(link.url)}
                    className="text-xs text-text-tertiary hover:text-[#ff0099] transition-colors"
                  >
                    Copy link
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blueprint Segments */}
        {blueprint && segments.length > 0 && (
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-white">Session Plan</h2>
              <p className="text-sm text-text-tertiary mt-0.5">{blueprint.name} · {blueprint.age_band} yrs</p>
            </div>
            <div className="divide-y divide-border">
              {segments.map((seg, idx) => {
                const Icon = SEGMENT_ICONS[seg.type] || BookOpen;
                const contentRef = blueprint.content_refs?.find(r => r.segment_index === idx);
                const content = contentRef ? contentItems[contentRef.content_item_id] : null;

                return (
                  <div key={idx} className="px-6 py-3 flex items-center gap-4">
                    <span className="w-7 h-7 bg-surface-2 rounded-lg flex items-center justify-center text-xs font-bold text-text-secondary flex-shrink-0">
                      {idx + 1}
                    </span>
                    <Icon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{seg.name || seg.type.replace('_', ' ')}</p>
                      {content && (
                        <p className="text-xs text-[#ff0099]">{content.title}</p>
                      )}
                    </div>
                    <span className="text-xs text-text-tertiary flex-shrink-0">{seg.duration_minutes}m</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartSession}
          className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:shadow-xl transition-shadow"
        >
          <Play className="w-6 h-6" />
          Start Session
        </button>
      </div>
    );
  }

  // =============================================================================
  // STATE 3: INDIVIDUAL MOMENT
  // =============================================================================
  if (consoleState === 'INDIVIDUAL_MOMENT' && currentSegment) {
    const momentConfig = blueprint?.individual_moment_config;
    const isVerbal = momentConfig?.type === 'verbal' || blueprint?.age_band === '4-6';
    const activeParticipants = participants.filter(p => p.child);

    // VERBAL OBSERVATION VIEW
    if (isVerbal) {
      const observationChild = activeParticipants[currentObservationChildIdx];
      const childId = observationChild?.child_id || '';
      const obs = verbalObservations[childId] || { tags: [], note: '' };

      return (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Header */}
          <div className="bg-surface-1 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Individual Moment — Verbal Observation
              </h2>
              <span className="text-sm text-text-tertiary">
                {currentObservationChildIdx + 1}/{activeParticipants.length}
              </span>
            </div>
            {momentConfig && (
              <p className="text-sm text-text-secondary italic">
                Prompt: {momentConfig.prompts[blueprint?.age_band || '4-6'] || 'Ask each child...'}
              </p>
            )}
          </div>

          {/* Current Child */}
          {observationChild?.child && (
            <div className="bg-surface-1 rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-lg font-bold text-white">
                  {observationChild.child.name.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{observationChild.child.name}</p>
                  <p className="text-sm text-text-tertiary">Age {observationChild.child.age || '?'}</p>
                </div>
              </div>

              {/* Observation Tags */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-2 block">Observation Tags</label>
                <div className="flex flex-wrap gap-2">
                  {OBSERVATION_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleObservationTag(childId, tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        obs.tags.includes(tag)
                          ? 'bg-[#ff0099]/20 text-[#ff0099] border-[#ff0099]/40'
                          : 'bg-surface-2 text-text-secondary border-border'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick text note */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Note</label>
                <input
                  type="text"
                  value={obs.note}
                  onChange={(e) => setObservationNote(childId, e.target.value)}
                  placeholder="Quick note..."
                  className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted text-sm"
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentObservationChildIdx(Math.max(0, currentObservationChildIdx - 1))}
                  disabled={currentObservationChildIdx === 0}
                  className="flex-1 py-2.5 border border-border text-text-secondary rounded-xl text-sm font-medium disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (currentObservationChildIdx < activeParticipants.length - 1) {
                      setCurrentObservationChildIdx(currentObservationChildIdx + 1);
                    } else {
                      // Done with all children, return to segment view
                      setConsoleState('DURING_SESSION');
                    }
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl text-sm font-bold"
                >
                  {currentObservationChildIdx < activeParticipants.length - 1 ? 'Next Child' : 'Done'}
                </button>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <BottomBar
            onEndSession={handleEndSession}
            timerText={formatTimer(segmentRemaining)}
            segmentName={currentSegment.name}
            isOvertime={segmentRemaining < 0}
          />
        </div>
      );
    }

    // TYPED RESPONSE VIEW (7-9, 10-12)
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-surface-1 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Individual Moment — Typed Responses
            </h2>
            <span className="text-sm text-text-tertiary">
              {responsesCount}/{activeParticipants.length} responses
            </span>
          </div>
          {momentConfig && (
            <p className="text-sm text-text-secondary italic">
              Prompt: {momentConfig.prompts[blueprint?.age_band || '7-9'] || 'Children typing...'}
            </p>
          )}
        </div>

        {/* Response Feed */}
        <div className="bg-surface-1 rounded-xl border border-border divide-y divide-border">
          {activeParticipants.map((p) => {
            const childResponse = typedResponses.find(r => r.child_id === p.child_id);
            return (
              <div key={p.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      childResponse ? 'bg-green-500' : 'bg-surface-2'
                    }`}>
                      {childResponse ? <Check className="w-4 h-4" /> : (p.child?.name?.charAt(0) || '?')}
                    </div>
                    <span className="text-sm text-white">{p.child?.name}</span>
                  </div>
                  <span className={`text-xs ${childResponse ? 'text-green-400' : 'text-text-tertiary'}`}>
                    {childResponse ? 'Submitted' : 'Waiting...'}
                  </span>
                </div>
                {childResponse && (
                  <p className="mt-2 ml-11 text-sm text-text-secondary bg-surface-2/50 rounded-lg p-3">
                    {childResponse.response_text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setConsoleState('DURING_SESSION')}
          className="w-full py-3 border border-border text-text-secondary rounded-xl font-medium hover:bg-surface-2"
        >
          Back to Segments
        </button>

        <BottomBar
          onEndSession={handleEndSession}
          timerText={formatTimer(segmentRemaining)}
          segmentName={currentSegment.name}
          isOvertime={segmentRemaining < 0}
        />
      </div>
    );
  }

  // =============================================================================
  // STATE 2: DURING SESSION
  // =============================================================================
  if (consoleState === 'DURING_SESSION') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Timer + Current Segment */}
        {currentSegment && (
          <div className={`bg-surface-1 rounded-2xl border p-5 ${
            segmentRemaining < 0 ? 'border-red-500/50' : segmentRemaining < 60 ? 'border-yellow-500/50' : 'border-border'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-lg flex items-center justify-center text-sm font-bold text-white">
                  {currentSegmentIndex + 1}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">{currentSegment.name || currentSegment.type.replace('_', ' ')}</h2>
                  <p className="text-xs text-text-tertiary capitalize">{currentSegment.type.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Timer */}
              <div className="text-right">
                <p className={`text-2xl font-mono font-bold ${
                  segmentRemaining < 0 ? 'text-red-400' : segmentRemaining < 60 ? 'text-yellow-400' : 'text-white'
                }`}>
                  {formatTimer(segmentRemaining)}
                </p>
                <p className="text-xs text-text-tertiary">{formatTimer(segmentElapsed)} elapsed</p>
              </div>
            </div>

            {/* Instructions */}
            {currentSegment.instructions && (
              <p className="text-sm text-text-secondary bg-surface-2/50 rounded-lg p-3 mb-3">{currentSegment.instructions}</p>
            )}

            {/* Instructor Notes */}
            {currentSegment.instructor_notes && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                <p className="text-xs font-medium text-yellow-400 mb-1">Instructor Notes</p>
                <p className="text-sm text-yellow-200/80">{currentSegment.instructor_notes}</p>
              </div>
            )}

            {/* Content ref */}
            {currentSegment.type === 'content_playback' && currentSegment.content_item_id && (
              <div className="flex items-center gap-2 bg-surface-2/50 rounded-lg p-3 mb-3">
                <Video className="w-4 h-4 text-[#ff0099]" />
                <span className="text-sm text-white">
                  {contentItems[currentSegment.content_item_id]?.title || 'Content linked'}
                </span>
              </div>
            )}

            {/* Group Discussion: Guided Questions */}
            {currentSegment.type === 'group_discussion' && currentSegment.guided_questions && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-text-secondary">Discussion Questions</p>
                {currentSegment.guided_questions.map((q, qIdx) => {
                  const isChecked = checkedQuestions[currentSegmentIndex]?.has(qIdx) || false;
                  return (
                    <button
                      key={qIdx}
                      onClick={() => toggleQuestion(currentSegmentIndex, qIdx)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isChecked ? 'bg-green-500/10 border border-green-500/20' : 'bg-surface-2/50 border border-transparent'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                      )}
                      <span className={`text-sm ${isChecked ? 'text-green-300 line-through' : 'text-white'}`}>{q}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Segment Navigation */}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <button
                onClick={() => goToSegment(currentSegmentIndex - 1)}
                disabled={currentSegmentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary hover:text-white bg-surface-2 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              {/* Segment dots */}
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {segments.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSegment(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === currentSegmentIndex
                        ? 'bg-[#ff0099] w-5'
                        : idx < currentSegmentIndex
                          ? 'bg-green-400'
                          : 'bg-surface-2'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => goToSegment(currentSegmentIndex + 1)}
                disabled={currentSegmentIndex >= segments.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary hover:text-white bg-surface-2 rounded-lg disabled:opacity-30"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* All Segments Overview */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-text-secondary">All Segments</h3>
          </div>
          <div className="divide-y divide-border">
            {segments.map((seg, idx) => {
              const Icon = SEGMENT_ICONS[seg.type] || BookOpen;
              const isCurrent = idx === currentSegmentIndex;
              const isPast = idx < currentSegmentIndex;

              return (
                <button
                  key={idx}
                  onClick={() => goToSegment(idx)}
                  className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors ${
                    isCurrent ? 'bg-[#ff0099]/10' : 'hover:bg-surface-2'
                  }`}
                >
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                    isCurrent ? 'bg-[#ff0099] text-white' : isPast ? 'bg-green-500/20 text-green-400' : 'bg-surface-2 text-text-tertiary'
                  }`}>
                    {isPast ? '✓' : idx + 1}
                  </span>
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#ff0099]' : 'text-text-tertiary'}`} />
                  <span className={`text-sm flex-1 ${isCurrent ? 'text-white font-medium' : 'text-text-secondary'}`}>
                    {seg.name || seg.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-text-tertiary">{seg.duration_minutes}m</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Note Bar */}
        <div className="bg-surface-1 rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-text-secondary mb-2">Quick Note — tap a child</p>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => {
              const hasNote = !!(p.child_id && quickNotes[p.child_id]);
              return (
                <button
                  key={p.id}
                  onClick={() => p.child && p.child_id && setQuickNoteChild({ id: p.child_id, name: p.child.name })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    hasNote
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-surface-2 text-text-secondary border-border hover:border-text-tertiary'
                  }`}
                >
                  {p.child?.name?.split(' ')[0] || '?'}
                  {hasNote && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Note Modal */}
        {quickNoteChild && (
          <QuickNoteModal
            childName={quickNoteChild.name}
            childId={quickNoteChild.id}
            currentNote={quickNotes[quickNoteChild.id] || ''}
            onSave={saveQuickNote}
            onClose={() => setQuickNoteChild(null)}
          />
        )}

        {/* Bottom Bar */}
        <BottomBar
          onEndSession={handleEndSession}
          timerText={formatTimer(segmentRemaining)}
          segmentName={currentSegment?.name || ''}
          isOvertime={(segmentRemaining || 0) < 0}
        />
      </div>
    );
  }

  // =============================================================================
  // STATE 4: POST-SESSION RATING
  // =============================================================================
  if (consoleState === 'POST_SESSION') {
    const skillTags = blueprint?.skill_tags || OBSERVATION_TAGS;

    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-32">
        <div className="bg-surface-1 rounded-2xl border border-border p-5">
          <h1 className="text-xl font-bold text-white mb-1">Session Complete</h1>
          <p className="text-sm text-text-tertiary">Rate each participant and add notes</p>
        </div>

        {/* Per-child rating cards */}
        {participants.map((p) => {
          if (!p.child || !p.child_id) return null;
          const rating = ratings[p.child_id];
          if (!rating) return null;
          const isPaid = p.payment_status === 'paid' || p.payment_status === 'free';

          return (
            <div key={p.id} className="bg-surface-1 rounded-xl border border-border p-5 space-y-4">
              {/* Child header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center font-bold text-white">
                    {p.child.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{p.child.name}</p>
                    <p className="text-xs text-text-tertiary">Age {p.child.age || '?'}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {isPaid ? 'Enrolled' : 'Pending'}
                </span>
              </div>

              {/* Engagement */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-2 block">Engagement</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setRatings(prev => ({
                        ...prev,
                        [p.child_id!]: { ...prev[p.child_id!], engagement: level },
                      }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${
                        rating.engagement === level
                          ? level === 'high' ? 'bg-green-500/20 text-green-400 border-green-500/40'
                            : level === 'medium' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'bg-surface-2 text-text-secondary border-border'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Tags */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-2 block">Skills Observed</label>
                <div className="flex flex-wrap gap-1.5">
                  {skillTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setRatings(prev => {
                        const current = prev[p.child_id!];
                        const tags = current.skillTags.includes(tag)
                          ? current.skillTags.filter(t => t !== tag)
                          : [...current.skillTags, tag];
                        return { ...prev, [p.child_id!]: { ...current, skillTags: tags } };
                      })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        rating.skillTags.includes(tag)
                          ? 'bg-[#ff0099]/20 text-[#ff0099] border-[#ff0099]/40'
                          : 'bg-surface-2 text-text-tertiary border-border'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note + Voice */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rating.note}
                  onChange={(e) => setRatings(prev => ({
                    ...prev,
                    [p.child_id!]: { ...prev[p.child_id!], note: e.target.value },
                  }))}
                  placeholder="Optional note..."
                  className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-white text-sm placeholder:text-text-muted"
                />
                <VoiceRecorder
                  sessionId={sessionId}
                  childId={p.child_id}
                  onRecorded={(url) => setRatings(prev => ({
                    ...prev,
                    [p.child_id!]: { ...prev[p.child_id!], voiceNoteUrl: url },
                  }))}
                />
              </div>

              {/* Voice note indicator */}
              {rating.voiceNoteUrl && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <Mic className="w-3 h-3" /> Voice note recorded
                </p>
              )}
            </div>
          );
        })}

        {/* Session-level notes */}
        <div className="bg-surface-1 rounded-xl border border-border p-5">
          <label className="text-sm font-bold text-white mb-2 block">Session Notes (optional)</label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Overall session observations, areas to improve..."
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted text-sm resize-none"
            rows={3}
          />
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border p-4 z-40">
          <div className="max-w-4xl mx-auto flex gap-3">
            <button
              onClick={() => setConsoleState('DURING_SESSION')}
              className="px-5 py-3 border border-border text-text-secondary rounded-xl font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> Submit & Close</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// =============================================================================
// BOTTOM BAR (shared across active states)
// =============================================================================

function BottomBar({
  onEndSession,
  timerText,
  segmentName,
  isOvertime,
}: {
  onEndSession: () => void;
  timerText: string;
  segmentName: string;
  isOvertime: boolean;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border z-40">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-text-tertiary truncate max-w-[200px]">{segmentName}</p>
          <p className={`text-sm font-mono font-bold ${isOvertime ? 'text-red-400' : 'text-white'}`}>{timerText}</p>
        </div>
        <button
          onClick={onEndSession}
          className="px-5 py-2.5 bg-red-500/90 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors"
        >
          End Session &rarr; Rate
        </button>
      </div>
    </div>
  );
}
