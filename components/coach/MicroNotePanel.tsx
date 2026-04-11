// ============================================================
// MicroNotePanel — Unified during-session observation capture
// Serves BOTH online (sidebar, 320px) and offline (fullscreen)
// Activity-driven (with session plan) or skill-driven (fallback)
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Star, AlertTriangle, Type, Mic, X, ArrowLeft, Check, Plus,
  ArrowRight, ChevronDown, Clock, Play, SkipForward, Users,
} from 'lucide-react';
import type { SessionActivity, MicroNoteLayout } from './live-session/types';

// ---- Props ----

export interface MicroNotePanelProps {
  sessionId: string;
  childId: string;
  childName: string;
  coachId: string;
  sessionStartTime: Date;
  quickStrengths: { id: string; text: string }[];
  quickStruggles: { id: string; text: string }[];
  onClose: () => void;
  onNoteAdded?: () => void;
  onEndSession?: () => void;
  // Unified layout system
  layout: MicroNoteLayout;
  sessionPlan?: SessionActivity[];
  // Batch support
  childIds?: string[];
  childNames?: string[];
  isBatch?: boolean;
}

interface SavedNote {
  type: 'strength' | 'struggle' | 'word' | 'note' | 'activity_complete';
  label: string;
  minutesIn: number;
}

// ---- Formatters ----

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- Component ----

export function MicroNotePanel({
  sessionId, childId, childName, coachId, sessionStartTime,
  quickStrengths, quickStruggles,
  onClose, onNoteAdded, onEndSession,
  layout, sessionPlan,
  childIds, childNames, isBatch,
}: MicroNotePanelProps) {
  const isSidebar = layout === 'sidebar';
  const hasPlan = sessionPlan && sessionPlan.length > 0;

  // -- Core state --
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tappedIds, setTappedIds] = useState<Set<string>>(new Set());
  const [minutesIn, setMinutesIn] = useState(0);
  const [showTimeline, setShowTimeline] = useState(!isSidebar);
  const recognitionRef = useRef<any>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // -- Activity state (activity-driven mode) --
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [activityStartTime, setActivityStartTime] = useState<Date | null>(
    hasPlan ? new Date() : null
  );
  const [activityElapsed, setActivityElapsed] = useState(0);
  const [completedActivities, setCompletedActivities] = useState<Set<number>>(new Set());

  // -- Batch state --
  const [batchSelections, setBatchSelections] = useState<Record<string, Record<string, string>>>({});
  // batchSelections[questionKey][childId] = answerId

  // -- Skill selector (skill-driven mode) --
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string }[]>([]);

  // Load available skills for skill-driven mode
  useEffect(() => {
    if (hasPlan) return; // Activity mode handles skills via plan
    import('@/lib/supabase/client').then(({ supabase }) => {
      supabase
        .from('el_skills')
        .select('id, name')
        .eq('is_active', true)
        .in('scope', ['observation', 'both'])
        .order('order_index', { ascending: true })
        .limit(15)
        .then(({ data }) => {
          if (data) setAvailableSkills(data);
        });
    });
  }, [hasPlan]);

  // Current activity (activity-driven mode)
  const currentActivity = hasPlan ? sessionPlan![currentActivityIndex] : null;

  // -- Timers --
  useEffect(() => {
    const update = () => setMinutesIn(Math.floor((Date.now() - sessionStartTime.getTime()) / 60000));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Activity elapsed timer (updates every second)
  useEffect(() => {
    if (!activityStartTime) return;
    const interval = setInterval(() => {
      setActivityElapsed(Math.floor((Date.now() - activityStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activityStartTime]);

  // -- Save micro observation --
  const saveMicroObs = useCallback(async (data: Record<string, any>) => {
    try {
      await fetch('/api/intelligence/micro-observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, childId, coachId,
          minutesIntoSession: minutesIn,
          ...data,
        }),
      });
      const label = data.wordText || data.noteText?.substring(0, 40) ||
        data.activityName ||
        (data.observationType === 'strength' ? 'Strength noted' : 'Struggle noted');
      const noteType = data.captureMode === 'activity_complete' ? 'activity_complete' : data.observationType;
      setSavedNotes(prev => [{ type: noteType, label, minutesIn }, ...prev]);
      onNoteAdded?.();
    } catch (err) {
      console.error('[MicroNote] Save failed:', err);
    }
  }, [sessionId, childId, coachId, minutesIn, onNoteAdded]);

  // -- Observation chip tap --
  const handleQuickObs = (type: 'strength' | 'struggle', obsId: string) => {
    if (tappedIds.has(obsId)) return;
    setTappedIds(prev => new Set(prev).add(obsId));
    saveMicroObs({
      observationType: type,
      observationId: obsId,
      captureMode: 'full_grid',
      ...(currentActivity ? {
        activityName: currentActivity.name,
        activityIndex: currentActivity.index,
        skillId: currentActivity.skill_id,
      } : {}),
    });
  };

  // -- Word save --
  const handleWordSave = (status: 'mastered' | 'struggled') => {
    const word = wordInput.trim().toLowerCase();
    if (!word) return;
    saveMicroObs({
      observationType: 'word',
      wordText: word,
      wordStatus: status,
      captureMode: 'word_capture',
      ...(currentActivity ? {
        activityName: currentActivity.name,
        activityIndex: currentActivity.index,
        skillId: currentActivity.skill_id,
      } : {}),
    });
    setWordInput('');
    wordInputRef.current?.focus();
  };

  // -- Note save --
  const handleNoteSave = () => {
    const text = noteInput.trim();
    if (!text) return;
    saveMicroObs({
      observationType: 'note',
      noteText: text,
      captureMode: 'free_note',
      ...(currentActivity ? {
        activityName: currentActivity.name,
        activityIndex: currentActivity.index,
        skillId: currentActivity.skill_id,
      } : {}),
    });
    setNoteInput('');
    setShowNoteInput(false);
  };

  // -- Voice note (fullscreen only) --
  const handleVoiceNote = () => {
    if (isSidebar) return; // No voice in sidebar — mic conflict with Meet
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const win = window as any;
    const SpeechRecognitionCtor = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      saveMicroObs({
        observationType: 'note',
        noteText: text,
        captureMode: 'voice_moment',
        ...(currentActivity ? {
          activityName: currentActivity.name,
          activityIndex: currentActivity.index,
        } : {}),
      });
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // -- Activity advance (activity-driven mode) --
  const advanceToNext = useCallback(async () => {
    if (!hasPlan || !currentActivity) return;

    // Save activity_complete micro-observation
    saveMicroObs({
      observationType: 'note',
      captureMode: 'activity_complete',
      activityName: currentActivity.name,
      activityIndex: currentActivity.index,
      skillId: currentActivity.skill_id,
      durationSeconds: activityElapsed,
      noteText: `Completed: ${currentActivity.name} (${formatElapsed(activityElapsed)})`,
    });

    // Write to session_activity_log for backward compat
    try {
      await fetch(`/api/coach/sessions/${sessionId}/activity-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activities: [{
            activity_index: currentActivity.index,
            activity_name: currentActivity.name,
            activity_purpose: currentActivity.purpose,
            status: 'completed',
            planned_duration_minutes: currentActivity.planned_minutes,
            actual_duration_seconds: activityElapsed,
            skill_id: currentActivity.skill_id,
            started_at: activityStartTime?.getTime(),
            completed_at: Date.now(),
          }],
          source: 'micronote_panel',
          partial: true, // Signal this is a single-activity write, not session-end
        }),
      });
    } catch {
      // Non-blocking — data saved via micro_observations as backup
    }

    setCompletedActivities(prev => new Set(prev).add(currentActivityIndex));

    // Advance to next
    const next = currentActivityIndex + 1;
    if (next < sessionPlan!.length) {
      setCurrentActivityIndex(next);
      setActivityStartTime(new Date());
      setActivityElapsed(0);
    }
  }, [hasPlan, currentActivity, activityElapsed, activityStartTime, currentActivityIndex, sessionPlan, sessionId, saveMicroObs]);

  // -- Jump to activity --
  const jumpToActivity = (index: number) => {
    if (completedActivities.has(index)) return;
    // Save timing for current before jumping
    if (activityStartTime && currentActivity && !completedActivities.has(currentActivityIndex)) {
      // Don't auto-complete — just switch
    }
    setCurrentActivityIndex(index);
    setActivityStartTime(new Date());
    setActivityElapsed(0);
  };

  // -- Render: Observation chips section --
  const renderObservationChips = () => {
    if (quickStrengths.length === 0 && quickStruggles.length === 0) return null;

    return (
      <>
        {quickStrengths.length > 0 && (
          <div>
            <p className="text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
              <Star className="w-3 h-3" /> Strengths
            </p>
            <div className={isSidebar ? 'space-y-1.5' : 'flex flex-wrap gap-1.5'}>
              {quickStrengths.map(obs => (
                <button
                  key={obs.id}
                  onClick={() => handleQuickObs('strength', obs.id)}
                  disabled={tappedIds.has(obs.id)}
                  className={`text-xs px-3 py-2 rounded-xl transition-all min-h-[40px] ${
                    isSidebar ? 'block w-full text-left' : ''
                  } ${
                    tappedIds.has(obs.id)
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-white/5 text-white/70 border border-white/10 active:bg-green-500/20 active:scale-95'
                  }`}
                >
                  {tappedIds.has(obs.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {obs.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {quickStruggles.length > 0 && (
          <div>
            <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Areas for Growth
            </p>
            <div className={isSidebar ? 'space-y-1.5' : 'flex flex-wrap gap-1.5'}>
              {quickStruggles.map(obs => (
                <button
                  key={obs.id}
                  onClick={() => handleQuickObs('struggle', obs.id)}
                  disabled={tappedIds.has(obs.id)}
                  className={`text-xs px-3 py-2 rounded-xl transition-all min-h-[40px] ${
                    isSidebar ? 'block w-full text-left' : ''
                  } ${
                    tappedIds.has(obs.id)
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-white/70 border border-white/10 active:bg-amber-500/20 active:scale-95'
                  }`}
                >
                  {tappedIds.has(obs.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {obs.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  // -- Render: Word capture section --
  const renderWordCapture = () => (
    <div>
      <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
        <Type className="w-3 h-3" /> Words
      </p>
      <div className="flex gap-1.5">
        <input
          ref={wordInputRef}
          type="text"
          value={wordInput}
          onChange={e => setWordInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleWordSave('mastered'); }}
          placeholder="Type a word..."
          className="flex-1 bg-white/5 text-white text-sm px-3 py-2.5 rounded-xl border border-white/10 focus:border-blue-500/50 outline-none min-h-[44px]"
        />
        <button
          onClick={() => handleWordSave('mastered')}
          disabled={!wordInput.trim()}
          className="bg-green-600 px-3 rounded-xl text-white text-xs font-medium min-h-[44px] disabled:opacity-30"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleWordSave('struggled')}
          disabled={!wordInput.trim()}
          className="bg-red-600 px-3 rounded-xl text-white text-xs font-medium min-h-[44px] disabled:opacity-30"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-white/20 mt-1 px-1">
        <Check className="w-2.5 h-2.5 inline text-green-400" /> mastered
        {' '}<X className="w-2.5 h-2.5 inline text-red-400" /> struggled
      </p>
    </div>
  );

  // -- Render: Notes section --
  const renderNotes = () => (
    <div>
      <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">Notes</p>
      {showNoteInput ? (
        <div className="space-y-1.5">
          <input
            type="text"
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNoteSave()}
            placeholder="Quick observation..."
            className="w-full bg-white/5 text-white text-sm px-3 py-2.5 rounded-xl border border-white/10 focus:border-white/30 outline-none min-h-[44px]"
            autoFocus
          />
          <div className="flex gap-1.5">
            <button onClick={handleNoteSave} disabled={!noteInput.trim()}
              className="flex-1 bg-white/10 text-white text-xs py-2.5 rounded-xl font-medium min-h-[44px] disabled:opacity-30">
              Save Note
            </button>
            <button onClick={() => { setShowNoteInput(false); setNoteInput(''); }}
              className="bg-white/5 text-white/40 px-4 py-2.5 rounded-xl text-xs min-h-[44px]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => setShowNoteInput(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 text-white/60 py-2.5 rounded-xl text-xs border border-white/10 min-h-[44px] active:bg-white/10">
            <Plus className="w-3.5 h-3.5" /> Quick note
          </button>
          {/* Voice only in fullscreen — mic conflict with Meet in sidebar */}
          {!isSidebar && (
            <button onClick={handleVoiceNote}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs min-h-[44px] ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-white/5 text-white/60 border border-white/10 active:bg-white/10'
              }`}>
              <Mic className="w-3.5 h-3.5" />
              {isRecording ? 'Stop' : 'Voice'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  // -- Render: Timeline --
  const renderTimeline = () => {
    if (savedNotes.length === 0) return null;

    const timelineContent = (
      <div className="space-y-1">
        {savedNotes.map((note, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-white/40 px-1">
            <span className="text-white/20 font-mono text-[10px] w-8 flex-shrink-0">{note.minutesIn}m</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              note.type === 'strength' ? 'bg-green-400'
              : note.type === 'struggle' ? 'bg-amber-400'
              : note.type === 'word' ? 'bg-blue-400'
              : note.type === 'activity_complete' ? 'bg-indigo-400'
              : 'bg-white/30'
            }`} />
            <span className="truncate">{note.label}</span>
          </div>
        ))}
      </div>
    );

    if (isSidebar) {
      // Collapsed by default in sidebar
      return (
        <div>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="text-[10px] text-white/30 uppercase tracking-wider font-semibold flex items-center gap-1"
          >
            {savedNotes.length} notes
            <ChevronDown className={`w-3 h-3 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
          </button>
          {showTimeline && <div className="mt-2">{timelineContent}</div>}
        </div>
      );
    }

    return (
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">
          Captured ({savedNotes.length})
        </p>
        {timelineContent}
      </div>
    );
  };

  // -- Render: Activity navigator (activity-driven mode) --
  const renderActivityNavigator = () => {
    if (!hasPlan || !sessionPlan) return null;

    return (
      <div className="space-y-2">
        {sessionPlan.map((activity, idx) => {
          const isCurrent = idx === currentActivityIndex;
          const isComplete = completedActivities.has(idx);

          if (isCurrent) {
            // Expanded current activity
            return (
              <div
                key={idx}
                className="p-3.5 border border-indigo-500/20 rounded-xl bg-indigo-500/[0.04]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{activity.name}</p>
                    {activity.skill_name && (
                      <span className="text-[10px] text-indigo-400">{activity.skill_name}</span>
                    )}
                  </div>
                  <span className="text-white/40 text-xs font-mono flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatElapsed(activityElapsed)}
                  </span>
                </div>

                {activity.purpose && (
                  <p className="text-white/30 text-[11px] mb-3">{activity.purpose}</p>
                )}

                {/* Observation chips for current activity */}
                <div className="space-y-3">
                  {renderObservationChips()}
                </div>

                {/* Quick actions */}
                <div className="flex gap-1.5 mt-3">
                  <button onClick={() => setShowNoteInput(true)}
                    className="flex-1 flex items-center justify-center gap-1 bg-white/5 text-white/60 py-2 rounded-xl text-xs border border-white/10 min-h-[40px] active:bg-white/10">
                    <Plus className="w-3 h-3" /> Note
                  </button>
                  <button onClick={() => wordInputRef.current?.focus()}
                    className="flex-1 flex items-center justify-center gap-1 bg-white/5 text-white/60 py-2 rounded-xl text-xs border border-white/10 min-h-[40px] active:bg-white/10">
                    <Type className="w-3 h-3" /> Word
                  </button>
                </div>

                {/* Done → next */}
                <button
                  onClick={advanceToNext}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-medium min-h-[44px] active:bg-indigo-700 transition-colors"
                >
                  {idx < sessionPlan.length - 1 ? (
                    <>Done <SkipForward className="w-3.5 h-3.5" /> next</>
                  ) : (
                    <>Done (last activity)</>
                  )}
                </button>
              </div>
            );
          }

          // Collapsed activity row
          return (
            <button
              key={idx}
              onClick={() => !isComplete && jumpToActivity(idx)}
              disabled={isComplete}
              className={`w-full text-left px-3.5 py-2.5 border-b border-white/[0.04] flex items-center gap-2 ${
                isComplete ? 'opacity-40' : 'opacity-60 cursor-pointer active:opacity-80'
              }`}
            >
              {isComplete ? (
                <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              ) : (
                <Play className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
              <span className="text-white/70 text-xs truncate flex-1">{activity.name}</span>
              {activity.skill_name && (
                <span className="text-[10px] text-white/20 flex-shrink-0">{activity.skill_name}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // -- Render: Skill selector (skill-driven mode, no plan) --
  const renderSkillSelector = () => {
    if (hasPlan) return null;
    if (availableSkills.length === 0) return null;

    return (
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">Skill Focus</p>
        <div className={isSidebar ? 'space-y-1' : 'flex flex-wrap gap-1.5'}>
          {availableSkills.map(skill => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkillId(skill.id === selectedSkillId ? null : skill.id)}
              className={`text-xs px-3 py-2 rounded-xl transition-all min-h-[36px] ${
                isSidebar ? 'block w-full text-left' : ''
              } ${
                selectedSkillId === skill.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 active:bg-white/10'
              }`}
            >
              {skill.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // -- Render: Batch header --
  const renderBatchHeader = () => {
    if (!isBatch || !childNames?.length) return null;
    return (
      <div className="flex items-center gap-1.5 px-1 mb-1">
        <Users className="w-3 h-3 text-white/30" />
        <span className="text-[10px] text-white/30">
          Batch: {childNames.length} children
        </span>
      </div>
    );
  };

  // ================================================================
  // SIDEBAR LAYOUT (Online sessions, ~320px alongside Meet)
  // ================================================================
  if (isSidebar) {
    return (
      <div className="w-80 h-screen overflow-hidden bg-[#151a22] border-l border-white/[0.06] flex flex-col">
        {/* Header — compact */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
          <button onClick={onClose} className="p-1 -ml-1">
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {isBatch ? `Batch (${childNames?.length || 0})` : childName}
            </p>
            <p className="text-white/30 text-[10px]">
              {minutesIn > 0 ? `${minutesIn} min` : 'Starting'} &middot; {savedNotes.length} notes
            </p>
          </div>
          <span className="text-white/20 text-[10px] font-mono w-6 text-right">{savedNotes.length}</span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {renderBatchHeader()}

          {/* Activity navigator or skill selector */}
          {hasPlan ? renderActivityNavigator() : (
            <>
              {renderSkillSelector()}
              {renderObservationChips()}
            </>
          )}

          {/* Word capture (always below activity/observations) */}
          {!hasPlan && renderWordCapture()}

          {/* Note input (shown when toggled via quick action) */}
          {showNoteInput && (
            <div className="space-y-1.5">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNoteSave()}
                placeholder="Quick observation..."
                className="w-full bg-white/5 text-white text-sm px-3 py-2.5 rounded-xl border border-white/10 focus:border-white/30 outline-none min-h-[44px]"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={handleNoteSave} disabled={!noteInput.trim()}
                  className="flex-1 bg-white/10 text-white text-xs py-2 rounded-xl font-medium min-h-[40px] disabled:opacity-30">
                  Save
                </button>
                <button onClick={() => { setShowNoteInput(false); setNoteInput(''); }}
                  className="bg-white/5 text-white/40 px-3 py-2 rounded-xl text-xs min-h-[40px]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Word input for activity mode — inline below activity */}
          {hasPlan && (
            <div>
              <div className="flex gap-1.5">
                <input
                  ref={wordInputRef}
                  type="text"
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleWordSave('mastered'); }}
                  placeholder="Word..."
                  className="flex-1 bg-white/5 text-white text-xs px-2.5 py-2 rounded-xl border border-white/10 focus:border-blue-500/50 outline-none min-h-[40px]"
                />
                <button onClick={() => handleWordSave('mastered')} disabled={!wordInput.trim()}
                  className="bg-green-600 px-2.5 rounded-xl text-white min-h-[40px] disabled:opacity-30">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleWordSave('struggled')} disabled={!wordInput.trim()}
                  className="bg-red-600 px-2.5 rounded-xl text-white min-h-[40px] disabled:opacity-30">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Timeline — collapsed by default */}
          {renderTimeline()}
        </div>

        {/* Footer: End session */}
        <div className="border-t border-white/10 px-3 py-2.5">
          <button
            onClick={onEndSession}
            className="w-full flex items-center justify-center gap-2 bg-[#00ABFF] text-white py-2.5 rounded-xl text-xs font-medium min-h-[44px] active:bg-[#0090DD] transition-colors"
          >
            End Session
            <ArrowRight className="w-3.5 h-3.5" />
            Talk to rAI
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // FULLSCREEN LAYOUT (Offline sessions, phone)
  // ================================================================
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="text-center">
          <p className="text-white text-sm font-medium">
            {isBatch ? `Batch (${childNames?.length || 0})` : childName}
          </p>
          <p className="text-white/40 text-[10px]">
            {minutesIn > 0 ? `${minutesIn} min into session` : 'Session starting'}
            {hasPlan && currentActivity && ` \u00B7 ${currentActivity.name}`}
          </p>
        </div>
        <span className="text-white/30 text-xs font-mono">{savedNotes.length}</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {renderBatchHeader()}

        {/* Activity navigator or skill selector */}
        {hasPlan ? renderActivityNavigator() : (
          <>
            {renderSkillSelector()}
            {renderObservationChips()}
          </>
        )}

        {/* Word capture */}
        {renderWordCapture()}

        {/* Notes (with voice in fullscreen) */}
        {renderNotes()}

        {/* Timeline */}
        {renderTimeline()}
      </div>

      {/* Footer: End Session */}
      <div className="border-t border-white/10 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          onClick={onEndSession}
          className="w-full flex items-center justify-center gap-2 bg-[#00ABFF] text-white py-3 rounded-xl text-sm font-medium min-h-[48px] active:bg-[#0090DD] transition-colors"
        >
          End Session
          <ArrowRight className="w-4 h-4" />
          Fill Report
        </button>
      </div>
    </div>
  );
}
