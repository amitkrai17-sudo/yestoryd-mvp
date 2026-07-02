// components/shared/BatchRescheduleModal.tsx
// 2G-4 — reschedule a WHOLE batch occurrence (all kids that share the same
// (batch, date, time) slot) to a new date/time. Distinct from the single-session
// RescheduleModal: free date/time entry (DateInput + TimePicker) instead of the
// available-slot picker, and it posts to /api/sessions/reschedule-occurrence.
// Session-mutating → pre-action confirm states the blast radius (N students, this date).

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Users, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { DateInput } from '@/components/ui/date-input';
import TimePicker from '@/components/shared/TimePicker';
import { formatTime12, formatDateLong } from '@/lib/utils/date-format';

export interface BatchRescheduleSession {
  id: string;
  child_name: string;
  scheduled_date: string;
  scheduled_time: string;
}

interface OccurrencePreview {
  batchId: string | null;
  count: number;
  childNames: string[];
  scheduledDate: string;
  scheduledTime: string;
}

interface BatchRescheduleModalProps {
  session: BatchRescheduleSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BatchRescheduleModal({ session, isOpen, onClose, onSuccess }: BatchRescheduleModalProps) {
  const [preview, setPreview] = useState<OccurrencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNewDate('');
    setNewTime('');
    setFeedback(null);
    setPreview(null);
    setLoading(true);
    fetch(`/api/sessions/reschedule-occurrence?sessionId=${session.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('preview failed'))))
      .then((d) => setPreview(d))
      .catch(() => setFeedback({ type: 'error', text: 'Couldn’t load the class roster. Please retry.' }))
      .finally(() => setLoading(false));
  }, [isOpen, session.id]);

  const handleSubmit = useCallback(async () => {
    if (!newDate || !newTime || !preview) return;
    const count = preview.count;
    const dayLabel = formatDateLong(session.scheduled_date);
    const newLabel = `${formatDateLong(newDate)} at ${formatTime12(newTime)}`;
    if (!window.confirm(
      `Reschedule the whole ${dayLabel} class (${count} student${count === 1 ? '' : 's'}) to ${newLabel}? Moves all of them this date. Past sessions and balances are untouched.`
    )) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/sessions/reschedule-occurrence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, newDate, newTime }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        onSuccess();
        onClose();
      } else if (res.status === 207) {
        const failed = Array.isArray(d.failures) ? d.failures.length : 0;
        setFeedback({ type: 'error', text: `Partial — moved ${d.moved ?? 0}, ${failed} failed. Retry to complete.` });
      } else if (res.status === 403) {
        setFeedback({ type: 'error', text: 'You can only reschedule your own batch’s classes.' });
      } else {
        setFeedback({ type: 'error', text: d.error === 'not_batched' ? 'This isn’t a batched session.' : (d.error || 'Failed to reschedule the class. Please retry.') });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please retry.' });
    } finally {
      setSaving(false);
    }
  }, [newDate, newTime, preview, session.id, session.scheduled_date, onSuccess, onClose]);

  if (!isOpen) return null;

  const canSubmit = !!newDate && !!newTime && !saving && !loading;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="absolute inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center lg:p-4">
        <div className="bg-[#1a1a1a] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-md max-h-[85vh] lg:max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
          <div className="flex items-center justify-between p-4 lg:p-5 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Reschedule whole class</h2>
            <button onClick={() => !saving && onClose()} disabled={saving} aria-label="Close"
              className="p-2 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-4 lg:p-5 space-y-4">
            {loading ? (
              <div className="py-10 flex justify-center"><Spinner size="lg" className="text-[#00ABFF]" /></div>
            ) : (
              <>
                {/* Roster / blast radius */}
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Users className="w-4 h-4" />
                    {preview?.count ?? 0} student{preview?.count === 1 ? '' : 's'} in this class
                  </div>
                  <p className="text-gray-300 text-sm">{preview?.childNames?.join(', ') || session.child_name}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Current: {formatDateLong(session.scheduled_date)} at {formatTime12(session.scheduled_time)}
                  </p>
                </div>

                {/* New date */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">New date</label>
                  <DateInput value={newDate} onChange={setNewDate} min={todayISO()} />
                </div>

                {/* New time */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">New time</label>
                  <TimePicker tone="dark" value={newTime} onChange={setNewTime} />
                </div>

                {feedback && (
                  <div className="flex items-start gap-2 text-red-300 text-sm p-3 bg-red-500/10 rounded-xl border border-red-500/30" role="alert">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                  <button type="button" onClick={() => !saving && onClose()}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={!canSubmit}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                    {saving ? <Spinner size="sm" /> : <ArrowRight className="w-4 h-4" />}
                    Move whole class
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
