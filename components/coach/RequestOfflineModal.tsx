// components/coach/RequestOfflineModal.tsx
// Modal for coaches to request converting a session to offline mode

'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, MapPin } from 'lucide-react';

type OfflineReason = 'travel' | 'parent_preference' | 'connectivity' | 'other';
type LocationType = 'home_visit' | 'school' | 'center' | 'other';

interface SessionInfo {
  id: string;
  child_name: string;
  session_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  enrollment_id: string | null;
}

interface RequestOfflineModalProps {
  isOpen: boolean;
  session: SessionInfo;
  onClose: () => void;
  onSuccess: (result: { status: string; report_deadline?: string }) => void;
}

const REASON_OPTIONS: { value: OfflineReason; label: string }[] = [
  { value: 'travel', label: 'Home visit / Travel' },
  { value: 'parent_preference', label: 'Parent preference' },
  { value: 'connectivity', label: 'Internet issues' },
  { value: 'other', label: 'Other' },
];

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'home_visit', label: 'Home visit' },
  { value: 'school', label: 'School / Partnership' },
  { value: 'center', label: 'Learning center' },
  { value: 'other', label: 'Other' },
];

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

export function RequestOfflineModal({ isOpen, session, onClose, onSuccess }: RequestOfflineModalProps) {
  const [reason, setReason] = useState<OfflineReason | ''>('');
  const [detail, setDetail] = useState('');
  const [locationType, setLocationType] = useState<LocationType | ''>('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/coach/sessions/${session.id}/request-offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          detail: detail.trim() || undefined,
          location: location.trim() || undefined,
          location_type: locationType || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to switch to in-person');
      }

      setResult({ status: data.status, message: data.message });
      onSuccess({ status: data.status, report_deadline: data.report_deadline });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
      <div className="bg-surface-1 rounded-t-2xl lg:rounded-xl max-w-md w-full border border-border max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface-1 rounded-t-2xl lg:rounded-t-xl z-10">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Switch to In-Person Session</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-white rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success state */}
        {result ? (
          <div className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-2">
              {result.status === 'auto_approved' ? 'Approved!' : 'Request Submitted'}
            </p>
            <p className="text-text-secondary text-sm mb-4">{result.message}</p>
            <button
              onClick={onClose}
              className="w-full bg-brand-primary text-white py-3 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors min-h-[48px]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Session info */}
            <div className="bg-surface-2 rounded-lg p-3">
              <p className="text-white text-sm font-medium">
                {session.child_name} — Session #{session.session_number}
              </p>
              <p className="text-text-tertiary text-xs mt-0.5">
                {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-text-secondary text-xs mb-2 font-medium">
                Why in-person? <span className="text-red-400">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as OfflineReason);
                  setError(null);
                }}
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[48px]"
              >
                <option value="">Select reason...</option>
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Detail (if other) */}
            {reason === 'other' && (
              <div>
                <label className="block text-text-secondary text-xs mb-2 font-medium">Details</label>
                <input
                  type="text"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Please specify..."
                  className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[48px]"
                />
              </div>
            )}

            {/* Location type */}
            <div>
              <label className="block text-text-secondary text-xs mb-2 font-medium">Location type</label>
              <div className="grid grid-cols-2 gap-2">
                {LOCATION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLocationType(opt.value === locationType ? '' : opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-colors min-h-[44px] ${
                      locationType === opt.value
                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                        : 'bg-surface-2 border-border text-text-secondary hover:border-border-strong'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location text */}
            <div>
              <label className="block text-text-secondary text-xs mb-2 font-medium">Location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Student's home, JP Nagar"
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder:text-text-tertiary min-h-[48px]"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Info note */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
              <p className="text-amber-400/80 text-xs">
                In-person sessions require a post-session report with a voice note summary.
                Max 25% of sessions per enrollment can be in-person.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !reason}
              className="w-full bg-brand-primary text-white py-3 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                'Switch to In-Person'
              )}
            </button>

            {/* Safe area for mobile */}
            <div className="h-2 lg:hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
