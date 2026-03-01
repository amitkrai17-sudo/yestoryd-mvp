'use client';

// ============================================================
// Coach Parent Call Section — Schedule & manage parent calls
// ============================================================

import { useState, useEffect } from 'react';
import {
  Phone, Calendar, Clock, CheckCircle, Loader2,
  X, Plus, MessageCircle,
} from 'lucide-react';

interface ParentCallData {
  id: string;
  status: string;
  initiated_by: string;
  requested_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  google_meet_link: string | null;
  recall_bot_id: string | null;
  notes: string | null;
}

interface Quota {
  used: number;
  max: number;
  remaining: number;
}

interface ParentCallSectionProps {
  enrollmentId: string;
  childName: string;
  coachId: string;
  onSuccess?: () => void;
}

export default function ParentCallSection({
  enrollmentId,
  childName,
  coachId,
  onSuccess,
}: ParentCallSectionProps) {
  const [calls, setCalls] = useState<ParentCallData[]>([]);
  const [quota, setQuota] = useState<Quota>({ used: 0, max: 1, remaining: 1 });
  const [loading, setLoading] = useState(true);

  // Schedule modal
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleCallId, setScheduleCallId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Complete modal
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchCalls();
  }, [enrollmentId]);

  async function fetchCalls() {
    try {
      const res = await fetch(`/api/parent-call/${enrollmentId}`);
      const data = await res.json();
      if (data.success) {
        setCalls(data.calls || []);
        setQuota(data.quota || { used: 0, max: 1, remaining: 1 });
      }
    } catch (err) {
      console.error('Failed to fetch parent calls:', err);
    } finally {
      setLoading(false);
    }
  }

  // Coach initiates a new call (auto-scheduled)
  async function handleInitiateCall() {
    if (!scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setActionResult(null);
    try {
      const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;

      const res = await fetch('/api/parent-call/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          initiated_by: 'coach',
          preferred_time: scheduledAt,
          notes: scheduleNotes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Now create calendar event via schedule endpoint
        const schedRes = await fetch('/api/parent-call/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_id: data.call.id,
            scheduled_at: scheduledAt,
          }),
        });
        const schedData = await schedRes.json();

        if (schedRes.ok && schedData.success) {
          setActionResult({ success: true, message: 'Call scheduled. Calendar invite sent.' });
        } else {
          setActionResult({ success: true, message: 'Call created but calendar event failed. You can retry.' });
        }

        setShowSchedule(false);
        setScheduleDate('');
        setScheduleTime('');
        setScheduleNotes('');
        fetchCalls();
        onSuccess?.();
      } else {
        setActionResult({ success: false, message: data.message || data.error || 'Failed to create call' });
      }
    } catch {
      setActionResult({ success: false, message: 'Network error' });
    } finally {
      setScheduling(false);
    }
  }

  // Coach confirms a parent-requested call
  async function handleConfirmCall() {
    if (!scheduleCallId || !scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/parent-call/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: scheduleCallId,
          scheduled_at: `${scheduleDate}T${scheduleTime}:00`,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionResult({ success: true, message: 'Call confirmed. Calendar invite sent.' });
        setShowSchedule(false);
        setScheduleCallId(null);
        setScheduleDate('');
        setScheduleTime('');
        fetchCalls();
        onSuccess?.();
      } else {
        setActionResult({ success: false, message: data.error || 'Failed to schedule' });
      }
    } catch {
      setActionResult({ success: false, message: 'Network error' });
    } finally {
      setScheduling(false);
    }
  }

  // Mark call as completed
  async function handleComplete() {
    if (!completingId) return;
    setCompleting(true);
    try {
      const res = await fetch('/api/parent-call/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: completingId,
          notes: completeNotes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCompletingId(null);
        setCompleteNotes('');
        fetchCalls();
        onSuccess?.();
      }
    } catch {
      // silently fail
    } finally {
      setCompleting(false);
    }
  }

  const pendingCalls = calls.filter(c => c.status === 'requested');
  const scheduledCalls = calls.filter(c => c.status === 'scheduled');
  const completedCalls = calls.filter(c => c.status === 'completed');

  // Minimum schedule date: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  if (loading) return null;

  return (
    <section className="bg-surface-1 rounded-2xl p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Parent Calls</h3>
          <span className="text-xs text-text-tertiary">({quota.used}/{quota.max} this month)</span>
        </div>
        {quota.remaining > 0 && (
          <button
            onClick={() => { setShowSchedule(true); setScheduleCallId(null); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Schedule Call
          </button>
        )}
      </div>

      {/* Action result toast */}
      {actionResult && (
        <div className={`mb-3 p-2.5 rounded-lg text-xs ${actionResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {actionResult.message}
        </div>
      )}

      {/* Pending calls (parent-initiated, awaiting confirmation) */}
      {pendingCalls.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-yellow-400 font-medium">Awaiting your confirmation</p>
          {pendingCalls.map(call => (
            <div key={call.id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Parent requested a call</span>
                  </div>
                  {call.notes && (
                    <p className="text-xs text-text-secondary mt-1 flex items-start gap-1">
                      <MessageCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {call.notes}
                    </p>
                  )}
                  <p className="text-[10px] text-text-tertiary mt-1">
                    {call.requested_at ? new Date(call.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setShowSchedule(true); setScheduleCallId(call.id); }}
                  className="px-3 py-1.5 bg-yellow-500 text-black rounded-lg text-xs font-semibold hover:bg-yellow-400 transition-colors flex-shrink-0"
                >
                  Set Time
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled calls */}
      {scheduledCalls.length > 0 && (
        <div className="space-y-2 mb-3">
          {scheduledCalls.map(call => (
            <div key={call.id} className="bg-surface-2 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">Scheduled</span>
                  </div>
                  {call.scheduled_at && (
                    <p className="text-xs text-white mt-1">
                      {new Date(call.scheduled_at).toLocaleString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit', hour12: true,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {call.google_meet_link && (
                    <a
                      href={call.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors"
                    >
                      Meet
                    </a>
                  )}
                  <button
                    onClick={() => setCompletingId(call.id)}
                    className="px-2.5 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed calls */}
      {completedCalls.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-text-tertiary">Past calls</p>
          {completedCalls.slice(0, 3).map(call => (
            <div key={call.id} className="flex items-center gap-2 py-1 text-xs text-text-secondary">
              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span>
                {call.completed_at
                  ? new Date(call.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : 'Completed'}
              </span>
              {call.notes && <span className="text-text-tertiary truncate">— {call.notes}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {calls.length === 0 && (
        <p className="text-xs text-text-tertiary py-2">No parent calls yet this month.</p>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-surface-1 rounded-t-2xl sm:rounded-2xl p-6 border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {scheduleCallId ? 'Confirm Parent Call' : 'Schedule Parent Call'}
              </h3>
              <button onClick={() => { setShowSchedule(false); setScheduleCallId(null); setActionResult(null); }} className="p-1 hover:bg-surface-2 rounded-xl">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            <p className="text-sm text-text-tertiary mb-4">
              {scheduleCallId
                ? `Set a time for the parent call with ${childName}'s parent.`
                : `Schedule a 15-min call with ${childName}'s parent.`}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  min={minDate}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!scheduleCallId && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Notes <span className="text-text-tertiary">(optional)</span></label>
                  <textarea
                    value={scheduleNotes}
                    onChange={e => setScheduleNotes(e.target.value)}
                    placeholder="Discussion topics..."
                    rows={2}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white placeholder:text-text-muted focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
            </div>

            <button
              onClick={scheduleCallId ? handleConfirmCall : handleInitiateCall}
              disabled={scheduling || !scheduleDate || !scheduleTime}
              className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
            >
              {scheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {scheduleCallId ? 'Confirming...' : 'Scheduling...'}
                </>
              ) : (
                scheduleCallId ? 'Confirm & Send Invite' : 'Schedule & Send Invite'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-surface-1 rounded-t-2xl sm:rounded-2xl p-6 border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Mark Call Complete</h3>
              <button onClick={() => setCompletingId(null)} className="p-1 hover:bg-surface-2 rounded-xl">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            <label className="block text-sm text-text-secondary mb-1">Call notes <span className="text-text-tertiary">(optional)</span></label>
            <textarea
              value={completeNotes}
              onChange={e => setCompleteNotes(e.target.value)}
              placeholder="Key takeaways, action items..."
              rows={3}
              className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white placeholder:text-text-muted focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full mt-4 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-500 transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
            >
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {completing ? 'Saving...' : 'Mark as Completed'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
