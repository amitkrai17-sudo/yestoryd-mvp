'use client';

// ============================================================
// Parent Call Card — "Request Coach Call" for parent dashboard
// ============================================================

import { useState } from 'react';
import { Phone, Clock, CheckCircle, Loader2, X, Calendar } from 'lucide-react';

interface ParentCallData {
  id: string;
  status: string;
  initiated_by: string;
  requested_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  google_meet_link: string | null;
  notes: string | null;
}

interface ParentCallCardProps {
  enrollmentId: string;
  coachName: string;
  calls: ParentCallData[];
  quota: { used: number; max: number; remaining: number };
  onRefresh: () => void;
}

export default function ParentCallCard({
  enrollmentId,
  coachName,
  calls,
  quota,
  onRefresh,
}: ParentCallCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const activeCalls = calls.filter(c => c.status === 'requested' || c.status === 'scheduled');
  const hasActiveCall = activeCalls.length > 0;
  const canRequest = quota.remaining > 0 && !hasActiveCall;

  async function handleRequest() {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/parent-call/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          initiated_by: 'parent',
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitResult({ success: true, message: 'Request sent! Coach will confirm within 24 hours.' });
        setNotes('');
        setTimeout(() => {
          setShowModal(false);
          setSubmitResult(null);
          onRefresh();
        }, 2000);
      } else {
        setSubmitResult({ success: false, message: data.message || data.error || 'Failed to request call' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Get next month name for "next available" label
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthName = nextMonth.toLocaleString('en-IN', { month: 'long' });

  return (
    <>
      {/* Card */}
      <div className="bg-surface-1 rounded-2xl p-5 shadow-lg shadow-black/20 shadow-[#7b008b]/5 border border-[#7b008b]/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white">Parent Call</h3>
            <p className="text-xs text-text-tertiary">15-min call with Coach {coachName}</p>
          </div>
        </div>

        {/* Active call status */}
        {hasActiveCall && (
          <div className="mb-3">
            {activeCalls.map(call => (
              <div key={call.id} className="bg-surface-2 rounded-xl p-3 border border-white/[0.08]">
                {call.status === 'requested' && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-sm text-yellow-400">Awaiting coach confirmation</span>
                  </div>
                )}
                {call.status === 'scheduled' && call.scheduled_at && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-green-400">Scheduled</span>
                    </div>
                    <p className="text-sm text-white ml-6">
                      {new Date(call.scheduled_at).toLocaleString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit', hour12: true,
                      })}
                    </p>
                    {call.google_meet_link && (
                      <a
                        href={call.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 ml-6 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors"
                      >
                        Join Meet
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Request button or limit message */}
        {canRequest ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all min-h-[44px]"
          >
            Request a Call with Coach
          </button>
        ) : !hasActiveCall ? (
          <div className="text-center py-2">
            <p className="text-xs text-text-tertiary">
              Next call available in <span className="text-blue-400 font-medium">{nextMonthName}</span>
            </p>
          </div>
        ) : null}

        {/* Recent history */}
        {calls.filter(c => c.status === 'completed').length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.08]">
            <p className="text-xs text-text-tertiary mb-2">Recent calls</p>
            {calls
              .filter(c => c.status === 'completed')
              .slice(0, 2)
              .map(call => (
                <div key={call.id} className="flex items-center gap-2 text-xs text-text-secondary py-1">
                  <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span>
                    {call.completed_at
                      ? new Date(call.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : 'Completed'}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-surface-1 rounded-t-2xl sm:rounded-2xl p-6 border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Request Coach Call</h3>
              <button onClick={() => { setShowModal(false); setSubmitResult(null); }} className="p-1 hover:bg-surface-2 rounded-lg">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            <p className="text-sm text-text-tertiary mb-4">
              Request a 15-minute call with Coach {coachName} to discuss your child&apos;s progress.
            </p>

            <label className="block text-sm text-text-secondary mb-1.5">
              What would you like to discuss? <span className="text-text-tertiary">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., homework struggles, reading at home, progress questions..."
              rows={3}
              className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white placeholder:text-text-muted focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />

            {submitResult && (
              <div className={`mt-3 p-3 rounded-xl text-sm ${submitResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {submitResult.message}
              </div>
            )}

            <button
              onClick={handleRequest}
              disabled={submitting}
              className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Request...
                </>
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
