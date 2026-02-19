'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, Info, Bot, Play, Video, StopCircle, X, Timer } from 'lucide-react';
import SessionHeader from './SessionHeader';
import ActivityTab from './ActivityTab';
import InfoTab from './InfoTab';
import RaiTab from './RaiTab';
import ActionButton from './ActionButton';
import SessionComplete from './SessionComplete';
import type {
  LiveSessionData, SessionPhase, LiveTab,
  TrackedActivity, ActivityStatus,
} from './types';

interface LiveSessionPanelProps {
  data: LiveSessionData;
}

// --- Persistence helpers ---
const STORAGE_PREFIX = 'yestoryd_live_session_';
const STALE_HOURS = 24;

interface PersistedState {
  phase: SessionPhase;
  currentIndex: number;
  activities: TrackedActivity[];
  elapsedSeconds: number;
  savedAt: number; // Date.now()
}

function loadPersistedState(sessionId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    // Check staleness
    const ageHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
    if (ageHours > STALE_HOURS) {
      localStorage.removeItem(STORAGE_PREFIX + sessionId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(sessionId: string, state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

function clearPersistedState(sessionId: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + sessionId);
  } catch {
    // non-critical
  }
}

function clearStaleEntries() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const ageHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
        if (ageHours > STALE_HOURS) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // non-critical
  }
}

export default function LiveSessionPanel({ data }: LiveSessionPanelProps) {
  const { session, child, template } = data;

  // --- Restore persisted state on mount ---
  const persisted = useRef<PersistedState | null>(null);
  if (persisted.current === null) {
    persisted.current = loadPersistedState(session.id) || undefined as any;
    clearStaleEntries();
  }

  const hasResumableState = persisted.current && persisted.current.phase === 'live';

  // --- Phase state ---
  const [phase, setPhase] = useState<SessionPhase>(
    hasResumableState ? 'live' : 'pre'
  );
  const [activeTab, setActiveTab] = useState<LiveTab>('flow');
  const [showResumeBanner, setShowResumeBanner] = useState(!!hasResumableState);

  // --- Timer ---
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (hasResumableState && persisted.current) {
      // Add time since last save
      const timeSince = Math.round((Date.now() - persisted.current.savedAt) / 1000);
      return persisted.current.elapsedSeconds + timeSince;
    }
    return 0;
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Activities ---
  const [activities, setActivities] = useState<TrackedActivity[]>(() => {
    if (hasResumableState && persisted.current) {
      return persisted.current.activities;
    }
    return (template?.activity_flow || []).map((step, i) => ({
      ...step,
      index: i,
      status: null,
      startedAt: null,
      completedAt: null,
      actualSeconds: null,
      coachNote: null,
      resolved_content: data.resolved_content?.[i] || undefined,
    }));
  });
  const [currentIndex, setCurrentIndex] = useState(
    hasResumableState && persisted.current ? persisted.current.currentIndex : 0
  );
  const activityStartRef = useRef<number | null>(
    hasResumableState ? Date.now() : null
  );

  // --- Auto-start countdown ---
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Wake lock ---
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // non-critical
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && phase === 'live') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [releaseWakeLock]);

  // Start timer when entering live (including resume)
  useEffect(() => {
    if (phase === 'live' && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
      requestWakeLock();
    }
    return () => {
      // Don't clear on unmount — handled separately
    };
  }, [phase, requestWakeLock]);

  // --- Persist state every 10 seconds during live ---
  useEffect(() => {
    if (phase !== 'live') return;
    const interval = setInterval(() => {
      savePersistedState(session.id, {
        phase,
        currentIndex,
        activities,
        elapsedSeconds,
        savedAt: Date.now(),
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [phase, currentIndex, activities, elapsedSeconds, session.id]);

  // --- Mark status as in_progress on server ---
  const markSessionStarted = useCallback(async () => {
    try {
      await fetch(`/api/coach/sessions/${session.id}/live`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Non-blocking — session data is still tracked locally
    }
  }, [session.id]);

  // --- Start session ---
  const startSession = useCallback(() => {
    // Cancel any countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
    setShowResumeBanner(false);

    setPhase('live');
    activityStartRef.current = Date.now();

    markSessionStarted();

    // Persist immediately
    savePersistedState(session.id, {
      phase: 'live',
      currentIndex: 0,
      activities,
      elapsedSeconds: 0,
      savedAt: Date.now(),
    });
  }, [activities, markSessionStarted, session.id]);

  // --- Open Meet + auto-start countdown ---
  const openMeetAndCountdown = useCallback(() => {
    window.open(session.google_meet_link!, '_blank');

    // Start 30-second countdown
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up — auto-start
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          // Use setTimeout to avoid state update during render
          setTimeout(() => startSession(), 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [session.google_meet_link, startSession]);

  // --- Cancel countdown ---
  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  // --- Handle activity action ---
  const handleActivityAction = useCallback((status: ActivityStatus) => {
    const now = Date.now();
    const startedAt = activityStartRef.current || now;
    const actualSeconds = Math.round((now - startedAt) / 1000);

    setActivities((prev) => {
      const next = [...prev];
      if (next[currentIndex]) {
        next[currentIndex] = {
          ...next[currentIndex],
          status,
          startedAt,
          completedAt: now,
          actualSeconds,
        };
      }
      return next;
    });

    const nextIndex = currentIndex + 1;
    if (nextIndex >= activities.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      releaseWakeLock();
      setPhase('complete');
    } else {
      setCurrentIndex(nextIndex);
      activityStartRef.current = Date.now();
    }

    // Persist after activity change
    savePersistedState(session.id, {
      phase: 'live',
      currentIndex: nextIndex >= activities.length ? currentIndex : nextIndex,
      activities: activities.map((a, i) =>
        i === currentIndex ? { ...a, status, startedAt, completedAt: now, actualSeconds } : a
      ),
      elapsedSeconds,
      savedAt: Date.now(),
    });
  }, [currentIndex, activities, elapsedSeconds, releaseWakeLock, session.id]);

  // --- End session early ---
  const endSession = useCallback(() => {
    const now = Date.now();
    setActivities((prev) =>
      prev.map((a, i) => {
        if (i >= currentIndex && a.status === null) {
          return {
            ...a,
            status: i === currentIndex ? 'partial' : 'skipped',
            startedAt: i === currentIndex ? (activityStartRef.current || now) : null,
            completedAt: now,
            actualSeconds: i === currentIndex
              ? Math.round((now - (activityStartRef.current || now)) / 1000)
              : 0,
          };
        }
        return a;
      })
    );

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    releaseWakeLock();
    setPhase('complete');
  }, [currentIndex, releaseWakeLock]);

  // --- Clear persistence on successful save ---
  const handleSaved = useCallback(() => {
    clearPersistedState(session.id);
  }, [session.id]);

  // --- PRE-SESSION ---
  if (phase === 'pre') {
    return (
      <div className="min-h-screen bg-[#0f1419] flex flex-col">
        <SessionHeader session={session} child={child} elapsedSeconds={0} isLive={false} coachSessionsLogged={data.coach_sessions_logged} />

        <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full space-y-4">
          {/* Auto-start countdown toast */}
          {countdown !== null && (
            <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/30 rounded-xl p-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-[#00ABFF] flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    Session starting in {countdown}s...
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">Meet opened in new tab</p>
                </div>
                <button
                  onClick={startSession}
                  className="px-3 py-1.5 bg-[#00ABFF] text-white text-xs font-medium rounded-lg active:scale-95"
                >
                  Start Now
                </button>
              </div>
              <button
                onClick={cancelCountdown}
                className="mt-2 text-white/30 text-xs flex items-center gap-1 active:text-white/50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          )}

          {/* Template preview */}
          {template && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h2 className="text-white font-semibold text-sm mb-1">
                {template.template_code}: {template.title}
              </h2>
              {template.description && (
                <p className="text-white/50 text-xs mb-3">{template.description}</p>
              )}

              {template.skill_dimensions && template.skill_dimensions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.skill_dimensions.map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ABFF]/10 text-[#00ABFF] border border-[#00ABFF]/20">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {template.activity_flow && template.activity_flow.length > 0 && (
                <div className="space-y-1">
                  <div className="grid grid-cols-[50px_1fr_1fr] gap-2 text-[10px] text-white/30 font-medium pb-1 border-b border-white/10">
                    <span>Time</span><span>Activity</span><span>Purpose</span>
                  </div>
                  {template.activity_flow.map((step, i) => (
                    <div key={i} className="grid grid-cols-[50px_1fr_1fr] gap-2 text-xs py-1.5">
                      <span className="text-[#00ABFF] font-mono text-[11px]">{step.time}</span>
                      <span className="text-white/80">{step.activity}</span>
                      <span className="text-white/40">{step.purpose}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!template && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-white/40 text-sm">No session template assigned</p>
              <p className="text-white/20 text-xs mt-1">You can still track time and add notes</p>
            </div>
          )}

          <InfoTab data={data} />
        </div>

        {/* Start buttons */}
        <div className="sticky bottom-0 bg-[#1a1f26] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3 max-w-2xl mx-auto w-full space-y-2">
            {session.google_meet_link && (
              <button
                onClick={openMeetAndCountdown}
                disabled={countdown !== null}
                className="w-full py-3 bg-[#00ABFF] text-white rounded-xl font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform min-h-[48px] disabled:opacity-50"
              >
                <Video className="w-5 h-5" />
                Open Google Meet
              </button>
            )}
            <button
              onClick={startSession}
              className="w-full py-4 bg-[#00ABFF] text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform min-h-[56px]"
            >
              <Play className="w-5 h-5" />
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- COMPLETE ---
  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-[#0f1419] flex flex-col">
        <SessionHeader session={session} child={child} elapsedSeconds={elapsedSeconds} isLive={false} coachSessionsLogged={data.coach_sessions_logged} />
        <div className="flex-1 max-w-2xl mx-auto w-full">
          <SessionComplete
            sessionId={session.id}
            activities={activities}
            elapsedSeconds={elapsedSeconds}
            onBack={() => setPhase('live')}
            onSaved={handleSaved}
            nextSessionId={data.next_session_id}
          />
        </div>
      </div>
    );
  }

  // --- LIVE ---
  const TABS: { key: LiveTab; icon: React.ReactNode; label: string }[] = [
    { key: 'flow', icon: <ClipboardList className="w-4 h-4" />, label: 'Flow' },
    { key: 'info', icon: <Info className="w-4 h-4" />, label: 'Info' },
    { key: 'rai', icon: <Bot className="w-4 h-4" />, label: 'rAI' },
  ];

  return (
    <div className="h-screen bg-[#0f1419] flex flex-col overflow-hidden">
      <SessionHeader session={session} child={child} elapsedSeconds={elapsedSeconds} isLive coachSessionsLogged={data.coach_sessions_logged} />

      {/* Resume banner */}
      {showResumeBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-xs flex-1">Session resumed</p>
          <button
            onClick={() => setShowResumeBanner(false)}
            className="text-amber-400/50 active:text-amber-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-[#1a1f26]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors min-h-[44px] ${
              activeTab === tab.key
                ? 'text-[#00ABFF] border-b-2 border-[#00ABFF]'
                : 'text-white/40'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'flow' && (
          <ActivityTab
            activities={activities}
            currentIndex={currentIndex}
            materials={template?.materials_needed || null}
          />
        )}
        {activeTab === 'info' && <InfoTab data={data} />}
        {activeTab === 'rai' && (
          <RaiTab childId={child.id} child={child} />
        )}
      </div>

      {/* Footer action button (flow tab only) */}
      {activeTab === 'flow' && activities.length > 0 && (
        <div>
          <ActionButton
            onAction={handleActivityAction}
            isLastActivity={currentIndex >= activities.length - 1}
            disabled={currentIndex >= activities.length}
          />
        </div>
      )}

      {/* End session — always visible on flow tab */}
      {activeTab === 'flow' && (
        <div className="bg-[#1a1f26] px-4 pb-2">
          <button
            onClick={endSession}
            className="w-full py-2 text-white/30 text-xs font-medium flex items-center justify-center gap-1 active:text-white/50"
          >
            <StopCircle className="w-3 h-3" />
            End Session Early
          </button>
        </div>
      )}
    </div>
  );
}
