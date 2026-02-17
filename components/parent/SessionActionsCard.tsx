'use client';

import { Database } from '@/lib/supabase/database.types';
import { useState, useEffect } from 'react';
import {
  XCircle, CalendarClock, AlertCircle, CheckCircle,
  ChevronDown, ChevronUp, Loader2, X,
  Thermometer, CalendarX, HelpCircle,
} from 'lucide-react';

interface SessionActionsCardProps {
  session: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
  };
  childId: string;
  onRequestSubmitted?: () => void;
}

interface PendingRequest {
  id: string;
  request_type: 'cancel' | 'reschedule';
  status: string;
  reason: string;
  requested_date?: string;
  requested_time?: string;
  created_at: string;
}

const CANCEL_REASONS = [
  { id: 'illness', label: 'Illness', icon: Thermometer },
  { id: 'schedule_conflict', label: 'Schedule Conflict', icon: CalendarX },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

export default function SessionActionsCard({ session, childId, onRequestSubmitted }: SessionActionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'idle' | 'cancel' | 'reschedule'>('idle');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);

  useEffect(() => {
    checkPendingRequest();
  }, [session.id]);

  async function checkPendingRequest() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data } = await supabase
        .from('session_change_requests')
        .select('*')
        .eq('session_id', session.id)
        .eq('status', 'pending')
        .maybeSingle();

      setPendingRequest(data || null);
    } catch {
      // Ignore - table might not exist yet
    } finally {
      setCheckingPending(false);
    }
  }

  async function handleSubmit() {
    const finalReason = reason === 'other' ? customReason : reason;
    if (!finalReason) {
      setError('Please select or enter a reason');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === 'cancel'
        ? `/api/sessions/${session.id}/cancel-request`
        : `/api/sessions/${session.id}/reschedule-request`;

      const body: Record<string, string> = { reason: finalReason };
      if (mode === 'reschedule') {
        if (preferredDate) body.preferredDate = preferredDate;
        if (preferredTime) body.preferredTime = preferredTime;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(mode === 'cancel'
          ? 'Cancel request submitted! We will review it shortly.'
          : 'Reschedule request submitted! We will review it shortly.');
        setMode('idle');
        checkPendingRequest();
        onRequestSubmitted?.();
      } else {
        setError(data.error || 'Failed to submit request');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Don't render for non-scheduled or past sessions
  const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
  if (session.status !== 'scheduled' || sessionDate <= new Date()) {
    return null;
  }

  if (checkingPending) return null;

  // Show pending request status
  if (pendingRequest) {
    return (
      <div className="mt-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            {pendingRequest.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} request pending review
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {/* Success/Error */}
      {success && (
        <div className="mb-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-400 text-sm flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {mode === 'idle' && !success && (
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('cancel'); setReason(''); setCustomReason(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Request Cancel
          </button>
          <button
            onClick={() => { setMode('reschedule'); setReason(''); setCustomReason(''); setPreferredDate(''); setPreferredTime(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Request Reschedule
          </button>
        </div>
      )}

      {/* Cancel Form */}
      {mode === 'cancel' && (
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Request Cancellation</h4>
            <button onClick={() => setMode('idle')} className="text-text-tertiary hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mb-3">
            {CANCEL_REASONS.map((r) => {
              const Icon = r.icon;
              const selected = reason === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                    selected
                      ? 'border-[#FF0099]/50 bg-[#FF0099]/10 text-white'
                      : 'border-border bg-surface-1 text-text-secondary hover:border-border/80'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{r.label}</span>
                </button>
              );
            })}
          </div>

          {reason === 'other' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please specify reason..."
              className="w-full px-3 py-2 mb-3 bg-surface-1 border border-border rounded-lg text-sm text-white placeholder:text-text-muted focus:ring-1 focus:ring-[#FF0099] focus:border-[#FF0099]"
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (!reason || (reason === 'other' && !customReason))}
            className="w-full py-2.5 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Cancel Request'}
          </button>
        </div>
      )}

      {/* Reschedule Form */}
      {mode === 'reschedule' && (
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Request Reschedule</h4>
            <button onClick={() => setMode('idle')} className="text-text-tertiary hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mb-3">
            {CANCEL_REASONS.map((r) => {
              const Icon = r.icon;
              const selected = reason === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                    selected
                      ? 'border-[#FF0099]/50 bg-[#FF0099]/10 text-white'
                      : 'border-border bg-surface-1 text-text-secondary hover:border-border/80'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{r.label}</span>
                </button>
              );
            })}
          </div>

          {reason === 'other' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please specify reason..."
              className="w-full px-3 py-2 mb-3 bg-surface-1 border border-border rounded-lg text-sm text-white placeholder:text-text-muted focus:ring-1 focus:ring-[#FF0099] focus:border-[#FF0099]"
            />
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Preferred Date (optional)</label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-surface-1 border border-border rounded-lg text-sm text-white focus:ring-1 focus:ring-[#FF0099] focus:border-[#FF0099]"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Preferred Time (optional)</label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3 py-2 bg-surface-1 border border-border rounded-lg text-sm text-white focus:ring-1 focus:ring-[#FF0099] focus:border-[#FF0099]"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || (!reason || (reason === 'other' && !customReason))}
            className="w-full py-2.5 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Reschedule Request'}
          </button>
        </div>
      )}
    </div>
  );
}
