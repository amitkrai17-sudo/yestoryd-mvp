// app/admin/in-person-requests/page.tsx
// Admin page for reviewing and approving/rejecting pending in-person session requests

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  User,
  Calendar,
  FileText,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface OfflineRequest {
  id: string;
  session_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  reason: string | null;
  reason_detail: string | null;
  location: string | null;
  location_type: string | null;
  requested_at: string;
  child_name: string;
  child_age: number | null;
  coach_id: string;
  coach_name: string;
  coach_email: string | null;
  enrollment_id: string | null;
  offline_count: number;
  max_offline: number;
  total_sessions: number;
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getReasonLabel(reason: string | null): string {
  switch (reason) {
    case 'travel': return 'Home visit / Travel';
    case 'parent_preference': return 'Parent preference';
    case 'connectivity': return 'Internet issues';
    case 'other': return 'Other';
    default: return reason || 'Not specified';
  }
}

function getLocationTypeLabel(type: string | null): string {
  switch (type) {
    case 'home_visit': return 'Home visit';
    case 'school': return 'School / Partnership';
    case 'center': return 'Learning center';
    case 'other': return 'Other';
    default: return type || '—';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function InPersonRequestsPage() {
  const [requests, setRequests] = useState<OfflineRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sessions/offline-requests');
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(sessionId: string, decision: 'approve' | 'reject') {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/offline-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== sessionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="bg-surface-0 min-h-screen">
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
                  In-Person Session Requests
                </h1>
                <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">
                  Review and approve coach requests to switch sessions to in-person
                </p>
              </div>
            </div>
            <button
              onClick={fetchRequests}
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
        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Loading requests...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={fetchRequests}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && requests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Pending Requests</h2>
            <p className="text-text-tertiary text-sm max-w-sm mx-auto">
              All in-person session requests have been processed. New requests from coaches will appear here.
            </p>
          </div>
        )}

        {/* Requests List */}
        {!loading && !error && requests.length > 0 && (
          <div className="space-y-3 max-w-4xl">
            {/* Count badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-500/30">
                {requests.length} pending
              </span>
            </div>

            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-surface-1 rounded-xl border border-border hover:border-border p-4 sm:p-5 transition-colors"
              >
                {/* Top row: Coach + Child + Time */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {req.coach_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{req.coach_name}</p>
                      <p className="text-xs text-text-tertiary truncate">{req.coach_email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary flex-shrink-0">{timeAgo(req.requested_at)}</span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <User className="w-3 h-3 text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary font-medium">Student</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate">{req.child_name}</p>
                    {req.child_age && (
                      <p className="text-[10px] text-text-tertiary">Age {req.child_age}</p>
                    )}
                  </div>

                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Calendar className="w-3 h-3 text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary font-medium">Session</span>
                    </div>
                    <p className="text-xs text-white font-medium">
                      {req.session_number ? `#${req.session_number}` : '—'}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {formatDate(req.scheduled_date)} {formatTime(req.scheduled_time)}
                    </p>
                  </div>

                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <FileText className="w-3 h-3 text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary font-medium">Reason</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate">{getReasonLabel(req.reason)}</p>
                    {req.reason_detail && (
                      <p className="text-[10px] text-text-tertiary truncate">{req.reason_detail}</p>
                    )}
                  </div>

                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <MapPin className="w-3 h-3 text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary font-medium">Location</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate">{getLocationTypeLabel(req.location_type)}</p>
                    {req.location && (
                      <p className="text-[10px] text-text-tertiary truncate">{req.location}</p>
                    )}
                  </div>
                </div>

                {/* Offline usage bar + actions */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-24 sm:w-32 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            req.offline_count >= req.max_offline ? 'bg-red-500' :
                            req.offline_count >= req.max_offline * 0.75 ? 'bg-amber-500' :
                            'bg-purple-500'
                          }`}
                          style={{ width: `${req.max_offline > 0 ? Math.min((req.offline_count / req.max_offline) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        req.offline_count >= req.max_offline ? 'text-red-400' : 'text-text-secondary'
                      }`}>
                        {req.offline_count}/{req.max_offline} in-person
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDecision(req.id, 'reject')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Reject
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'approve')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
