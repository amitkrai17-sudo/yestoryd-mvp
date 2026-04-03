'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Check, X, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface RescheduleRequest {
  id: string;
  sessionId: string;
  changeType: string;
  reason: string;
  originalDate: string | null;
  requestedDate: string | null;
  createdAt: string;
  childName: string;
  parentName: string;
  sessionNumber: number | null;
  sessionType: string | null;
  currentDate: string | null;
  currentTime: string | null;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Not specified';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) + ' ' + d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PendingRescheduleRequests() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/reschedule-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/sessions/change-request/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch {
      // Silently fail
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">
          Pending Reschedule Requests
        </h3>
        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400 font-medium">
          {requests.length}
        </span>
      </div>

      <div className="space-y-2">
        {requests.map(req => (
          <div
            key={req.id}
            className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {req.childName}
                  {req.sessionNumber && (
                    <span className="text-gray-400 font-normal"> — Session #{req.sessionNumber}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {req.parentName} wants to reschedule
                </p>
                {req.reason && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Reason: {req.reason}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {timeAgo(req.createdAt)}
              </div>
            </div>

            {/* Date change */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-gray-400 line-through">
                {formatDateTime(req.originalDate)}
              </span>
              <span className="text-gray-600">to</span>
              <span className="text-amber-400 font-medium">
                {formatDateTime(req.requestedDate)}
              </span>
            </div>

            {/* Actions */}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleAction(req.id, 'approve')}
                disabled={processing === req.id}
                className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                {processing === req.id ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </>
                )}
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                disabled={processing === req.id}
                className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
