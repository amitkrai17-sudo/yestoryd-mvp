// ============================================================
// FILE: app/admin/sessions/mode-change/page.tsx
// PURPOSE: Admin UI to change session_mode on upcoming sessions.
//          Lists next 30 days grouped by date, opens a confirm
//          modal, posts to /api/admin/sessions/[id]/change-mode.
// SCOPE:   Online direction only. Offline radio is disabled
//          (matches the 501 gate on the backend).
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Calendar,
  Monitor,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Avatar } from '@/components/shared/Avatar';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';

interface UpcomingSession {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  session_mode: string;
  google_meet_link: string | null;
  child_name: string;
  coach_name: string;
}

interface ChangeResult {
  success?: boolean;
  no_change?: boolean;
  from?: string;
  to?: string;
  notifications?: { parent: string; coach: string };
  calendar_updated?: boolean;
  error?: string;
}

type ToastKind = 'success' | 'error';

function statusLabel(status: string | undefined): string {
  if (!status) return '—';
  if (status === 'sent') return 'notified';
  return status.replace(/_/g, ' ');
}

export default function ModeChangePage() {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UpcomingSession | null>(null);
  const [newMode, setNewMode] = useState<'online' | 'offline'>('online');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string; details?: string } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sessions/upcoming');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function openModal(session: UpcomingSession) {
    setSelected(session);
    setNewMode('online'); // Only online is enabled today; offline blocked by 501
  }

  function closeModal() {
    if (!submitting) setSelected(null);
  }

  async function submitChange() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${selected.id}/change-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_mode: newMode }),
      });
      const data: ChangeResult = await res.json();

      if (!res.ok) {
        setToast({
          kind: 'error',
          message: 'Change failed',
          details: data.error || `HTTP ${res.status}`,
        });
        setSubmitting(false);
        return;
      }

      if (data.no_change) {
        setToast({ kind: 'success', message: 'Already in that mode — no change applied' });
        setSelected(null);
        setSubmitting(false);
        return;
      }

      const parts: string[] = [
        `Parent ${statusLabel(data.notifications?.parent)}`,
        `Coach ${statusLabel(data.notifications?.coach)}`,
        data.calendar_updated ? 'Calendar updated' : 'Calendar not updated',
      ];

      setToast({
        kind: 'success',
        message: `Session switched ${data.from} → ${data.to}`,
        details: parts.join(' · '),
      });

      setSessions((prev) =>
        prev.map((s) => (s.id === selected.id && data.to ? { ...s, session_mode: data.to } : s))
      );
      setSelected(null);
    } catch (err) {
      setToast({
        kind: 'error',
        message: 'Change failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = sessions.reduce<Record<string, UpcomingSession[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-text-tertiary" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  Change Session Mode
                </h1>
                <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">
                  Upcoming sessions — switch between online (Meet) and in-person
                </p>
              </div>
            </div>
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-text-tertiary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {toast && (
          <div
            className={`mb-4 p-3 rounded-xl border max-w-4xl flex items-start gap-3 ${
              toast.kind === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {toast.kind === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${toast.kind === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                {toast.message}
              </p>
              {toast.details && <p className="text-xs text-text-tertiary mt-1">{toast.details}</p>}
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/5 rounded-lg flex-shrink-0"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <Spinner size="lg" color="muted" className="mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Loading sessions...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={fetchSessions}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-text-tertiary" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Upcoming Sessions</h2>
            <p className="text-text-tertiary text-sm max-w-sm mx-auto">
              No sessions scheduled in the next 30 days.
            </p>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-6 max-w-4xl">
            {Object.entries(grouped).map(([date, rows]) => (
              <div key={date}>
                <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
                  {formatDateShort(date)}
                </h2>
                <div className="space-y-2">
                  {rows.map((s) => (
                    <div
                      key={s.id}
                      className="bg-surface-1 rounded-xl border border-border p-3 sm:p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={s.child_name} size="md" portal="admin" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{s.child_name}</p>
                          <p className="text-xs text-text-tertiary truncate">
                            {formatTime12(s.scheduled_time.slice(0, 5))} · {s.coach_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border ${
                            s.session_mode === 'offline'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {s.session_mode === 'offline' ? (
                            <>
                              <MapPin className="w-3 h-3" /> In-person
                            </>
                          ) : (
                            <>
                              <Monitor className="w-3 h-3" /> Online
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => openModal(s)}
                          disabled={s.session_mode === 'online'}
                          title={s.session_mode === 'online' ? 'Already online — no change needed' : 'Change this session'}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-white/[0.08] border border-white/[0.08] rounded-xl hover:bg-white/[0.12] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Change Mode
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#121217] rounded-2xl border border-white/[0.08] shadow-xl w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">Change Session Mode</h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {selected.child_name} · {formatDateShort(selected.scheduled_date)}{' '}
                  {formatTime12(selected.scheduled_time.slice(0, 5))}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-1.5 hover:bg-white/5 rounded-lg flex-shrink-0 disabled:opacity-40"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>

            <div className="bg-surface-2 rounded-xl p-3 mb-4">
              <p className="text-xs text-text-tertiary">Current mode</p>
              <p className="text-sm text-white font-medium mt-0.5">
                {selected.session_mode === 'offline' ? 'In-person' : 'Online'}
              </p>
            </div>

            <div className="space-y-2 mb-5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">New mode</p>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  newMode === 'online'
                    ? 'bg-blue-500/10 border-blue-500/40'
                    : 'bg-surface-2 border-border hover:bg-surface-3'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="online"
                  checked={newMode === 'online'}
                  onChange={() => setNewMode('online')}
                  className="w-4 h-4 accent-blue-500"
                />
                <Monitor className="w-4 h-4 text-blue-300" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium">Online</p>
                  <p className="text-[11px] text-text-tertiary">
                    Google Meet link preserved · parent + coach notified
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/50 cursor-not-allowed opacity-60">
                <input type="radio" name="mode" value="offline" disabled className="w-4 h-4" />
                <MapPin className="w-4 h-4 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium">In-person</p>
                  <p className="text-[11px] text-text-tertiary">Coming soon · offline templates pending</p>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-2 rounded-xl hover:bg-surface-3 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitChange}
                disabled={submitting || newMode === selected.session_mode}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Spinner size="sm" />}
                {submitting ? 'Applying…' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
