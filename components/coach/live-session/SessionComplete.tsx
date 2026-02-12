'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, SkipForward, CircleX, Loader2, PartyPopper, Clock, MessageSquare, ArrowRight } from 'lucide-react';
import type { TrackedActivity } from './types';

interface SessionCompleteProps {
  sessionId: string;
  activities: TrackedActivity[];
  elapsedSeconds: number;
  onBack: () => void;
  onSaved?: () => void;
  nextSessionId?: string | null;
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  completed: { icon: <Check className="w-4 h-4" />, label: 'Done', color: 'text-green-400 bg-green-500/10' },
  partial: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Partial', color: 'text-amber-400 bg-amber-500/10' },
  skipped: { icon: <SkipForward className="w-4 h-4" />, label: 'Skipped', color: 'text-white/40 bg-white/5' },
  struggled: { icon: <CircleX className="w-4 h-4" />, label: 'Struggled', color: 'text-red-400 bg-red-500/10' },
};

export default function SessionComplete({ sessionId, activities, elapsedSeconds, onBack, onSaved, nextSessionId }: SessionCompleteProps) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Per-activity notes
  const [activityNotes, setActivityNotes] = useState<Record<number, string>>({});
  const [expandedNote, setExpandedNote] = useState<number | null>(null);

  const counts = {
    completed: activities.filter((a) => a.status === 'completed').length,
    partial: activities.filter((a) => a.status === 'partial').length,
    skipped: activities.filter((a) => a.status === 'skipped').length,
    struggled: activities.filter((a) => a.status === 'struggled').length,
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      const payload = {
        activities: activities.map((a) => ({
          activity_index: a.index,
          activity_name: a.activity,
          activity_purpose: a.purpose,
          status: a.status || 'skipped',
          planned_duration_minutes: null,
          actual_duration_seconds: a.actualSeconds,
          coach_note: activityNotes[a.index]?.trim() || a.coachNote || null,
          started_at: a.startedAt,
          completed_at: a.completedAt,
        })),
        session_elapsed_seconds: elapsedSeconds,
        coach_notes: notes.trim() || null,
      };

      const res = await fetch(`/api/coach/sessions/${sessionId}/activity-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      setDone(true);
      onSaved?.();
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Session Logged!</h2>
        <p className="text-white/50 text-sm mb-6">
          {activities.length} activities tracked in {formatElapsed(elapsedSeconds)}
        </p>
        <button
          onClick={() => router.push(`/coach/sessions/${sessionId}`)}
          className="w-full max-w-xs px-6 py-3 bg-[#FF0099] text-white rounded-xl font-medium active:scale-95 transition-transform"
        >
          View Session Summary
        </button>
        {nextSessionId && (
          <button
            onClick={() => router.push(`/coach/sessions/${nextSessionId}`)}
            className="mt-3 w-full max-w-xs px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Next Session
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => router.push('/coach/sessions')}
          className="mt-3 text-white/40 text-sm active:text-white/60"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="text-center py-2">
        <PartyPopper className="w-10 h-10 text-[#FF0099] mx-auto mb-2" />
        <h2 className="text-white text-lg font-bold">Session Complete</h2>
        <p className="text-white/40 text-sm flex items-center justify-center gap-1 mt-1">
          <Clock className="w-3.5 h-3.5" />
          {formatElapsed(elapsedSeconds)}
        </p>
      </div>

      {/* Status summary grid */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
          const config = STATUS_CONFIG[status];
          return (
            <div key={status} className={`rounded-xl p-3 text-center ${config.color}`}>
              <div className="flex justify-center mb-1">{config.icon}</div>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] opacity-60">{config.label}</p>
            </div>
          );
        })}
      </div>

      {/* Activity breakdown with per-activity notes */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/10">
          <h3 className="text-white text-sm font-medium">Activity Breakdown</h3>
        </div>
        <div className="divide-y divide-white/5">
          {activities.map((a) => {
            const config = a.status ? STATUS_CONFIG[a.status] : STATUS_CONFIG.skipped;
            const isExpanded = expandedNote === a.index;
            const hasNote = !!activityNotes[a.index]?.trim();

            return (
              <div key={a.index}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className={config.color.split(' ')[0]}>{config.icon}</span>
                  <span className="flex-1 text-sm text-white/70 truncate">{a.activity}</span>
                  <button
                    type="button"
                    onClick={() => setExpandedNote(isExpanded ? null : a.index)}
                    className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded active:opacity-70 ${
                      hasNote ? 'text-[#00ABFF]' : 'text-white/30'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    note
                  </button>
                  {a.actualSeconds != null && (
                    <span className="text-[10px] text-white/30 font-mono">{formatElapsed(a.actualSeconds)}</span>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-2.5">
                    <input
                      type="text"
                      value={activityNotes[a.index] || ''}
                      onChange={(e) => setActivityNotes((prev) => ({
                        ...prev,
                        [a.index]: e.target.value.slice(0, 150),
                      }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') setExpandedNote(null); }}
                      onBlur={() => setExpandedNote(null)}
                      autoFocus
                      maxLength={150}
                      placeholder="Quick note about this activity..."
                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
                    />
                    <p className="text-right text-[9px] text-white/20 mt-0.5">
                      {(activityNotes[a.index] || '').length}/150
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Coach notes */}
      <div>
        <label className="block text-xs text-white/40 font-medium mb-1.5">Session Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="How did the session go? Any breakthroughs or concerns?"
          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#FF0099] resize-y min-h-[60px]"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 bg-[#FF0099] text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[56px]"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Save Session Log
            </>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={saving}
          className="w-full py-2.5 text-white/40 text-sm font-medium active:text-white/60"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
