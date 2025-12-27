// =============================================================================
// FILE: components/parent/PauseEnrollmentCard.tsx
// PURPOSE: Parent self-service pause/resume with AIDA-optimized CRO design
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  PauseCircle, PlayCircle, Calendar, Clock, AlertCircle,
  CheckCircle, ChevronDown, ChevronUp, Loader2, Info,
  GraduationCap, Plane, Heart, HelpCircle, X
} from 'lucide-react';

interface PauseEnrollmentCardProps {
  enrollmentId: string;
  childName: string;
  onStatusChange?: () => void;
}

interface PauseStatus {
  enrollmentId: string;
  childName: string;
  status: string;
  isPaused: boolean;
  currentPause: {
    startDate: string;
    endDate: string;
    reason: string;
  } | null;
  pauseStats: {
    totalPauseDaysUsed: number;
    remainingPauseDays: number;
    maxSinglePause: number;
    pauseCount: number;
  };
  canPause: boolean;
  programEndDate: string;
}

const PAUSE_REASONS = [
  { id: 'exams', label: 'School Exams', icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
  { id: 'travel', label: 'Family Travel', icon: Plane, color: 'text-purple-600 bg-purple-50' },
  { id: 'illness', label: 'Health / Illness', icon: Heart, color: 'text-red-600 bg-red-50' },
  { id: 'other', label: 'Other Reason', icon: HelpCircle, color: 'text-gray-600 bg-gray-50' },
];

export default function PauseEnrollmentCard({ enrollmentId, childName, onStatusChange }: PauseEnrollmentCardProps) {
  const [pauseStatus, setPauseStatus] = useState<PauseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pause form state
  const [pauseStartDate, setPauseStartDate] = useState('');
  const [pauseEndDate, setPauseEndDate] = useState('');
  const [pauseReason, setPauseReason] = useState('');

  useEffect(() => {
    fetchPauseStatus();
  }, [enrollmentId]);

  async function fetchPauseStatus() {
    try {
      const res = await fetch(`/api/enrollment/pause?enrollmentId=${enrollmentId}`);
      if (res.ok) {
        const data = await res.json();
        setPauseStatus(data.data);
      }
    } catch (err) {
      console.error('Error fetching pause status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePauseRequest() {
    if (!pauseStartDate || !pauseEndDate || !pauseReason) {
      setError('Please fill all fields');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enrollment/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          action: 'pause',
          pauseStartDate,
          pauseEndDate,
          pauseReason,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(`Program paused! Sessions rescheduled. New end date: ${data.data.newProgramEnd}`);
        setShowPauseForm(false);
        fetchPauseStatus();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to pause program');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResumeRequest() {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enrollment/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          action: 'early_resume',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(`Program resumed! ${data.data.sessionsRescheduled} sessions rescheduled.`);
        fetchPauseStatus();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to resume program');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  // Calculate min dates
  const minStartDate = new Date();
  minStartDate.setDate(minStartDate.getDate() + 3); // 48hr+ notice = 3 days to be safe
  const minStartDateStr = minStartDate.toISOString().split('T')[0];

  const maxEndDate = new Date();
  maxEndDate.setDate(maxEndDate.getDate() + (pauseStatus?.pauseStats.maxSinglePause || 30) + 3);
  const maxEndDateStr = maxEndDate.toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#7b008b]" />
        </div>
      </div>
    );
  }

  if (!pauseStatus) return null;

  const { isPaused, currentPause, pauseStats, canPause } = pauseStatus;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isPaused 
              ? 'bg-amber-100' 
              : 'bg-gradient-to-br from-[#7b008b]/10 to-[#ff0099]/10'
          }`}>
            {isPaused ? (
              <PauseCircle className="w-6 h-6 text-amber-600" />
            ) : (
              <PlayCircle className="w-6 h-6 text-[#7b008b]" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">
              {isPaused ? '⏸️ Program Paused' : '▶️ Program Active'}
            </h3>
            <p className="text-sm text-gray-500">
              {isPaused 
                ? `Resumes ${new Date(currentPause!.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                : `${pauseStats.remainingPauseDays} pause days available`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPaused && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Paused
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Success/Error Messages */}
          {success && (
            <div className="mx-5 mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-800 text-sm font-medium">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mx-5 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Currently Paused State */}
          {isPaused && currentPause && (
            <div className="p-5">
              {/* Pause Info Card */}
              <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <PauseCircle className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-800">Current Pause</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-amber-600">Started</p>
                    <p className="font-medium text-amber-900">
                      {new Date(currentPause.startDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-600">Ends</p>
                    <p className="font-medium text-amber-900">
                      {new Date(currentPause.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-amber-600 text-sm">Reason</p>
                  <p className="font-medium text-amber-900 capitalize">{currentPause.reason}</p>
                </div>
              </div>

              {/* Resume Early Button */}
              <button
                onClick={handleResumeRequest}
                disabled={actionLoading}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    Resume Program Now
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                Sessions will be rescheduled starting tomorrow
              </p>
            </div>
          )}

          {/* Can Pause State */}
          {!isPaused && canPause && !showPauseForm && (
            <div className="p-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#7b008b]">{pauseStats.remainingPauseDays}</p>
                  <p className="text-xs text-gray-500">Days Available</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{pauseStats.maxSinglePause}</p>
                  <p className="text-xs text-gray-500">Max Per Pause</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{pauseStats.pauseCount}</p>
                  <p className="text-xs text-gray-500">Pauses Used</p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Need a break?</p>
                    <p>Pause for exams, travel, or illness. Your program automatically extends by the pause duration. Sessions are rescheduled - no sessions lost!</p>
                  </div>
                </div>
              </div>

              {/* Pause Button */}
              <button
                onClick={() => setShowPauseForm(true)}
                className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-200 transition-all flex items-center justify-center gap-2"
              >
                <PauseCircle className="w-5 h-5" />
                Request Pause
              </button>
            </div>
          )}

          {/* Pause Form */}
          {!isPaused && showPauseForm && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800">Pause {childName}'s Program</h4>
                <button
                  onClick={() => setShowPauseForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reason Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why do you need to pause?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAUSE_REASONS.map((reason) => {
                    const Icon = reason.icon;
                    const isSelected = pauseReason === reason.id;
                    return (
                      <button
                        key={reason.id}
                        onClick={() => setPauseReason(reason.id)}
                        className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-[#7b008b] bg-[#7b008b]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${reason.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-[#7b008b]' : 'text-gray-700'}`}>
                          {reason.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={pauseStartDate}
                    onChange={(e) => setPauseStartDate(e.target.value)}
                    min={minStartDateStr}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#7b008b] focus:border-[#7b008b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pauseEndDate}
                    onChange={(e) => setPauseEndDate(e.target.value)}
                    min={pauseStartDate || minStartDateStr}
                    max={maxEndDateStr}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#7b008b] focus:border-[#7b008b] text-sm"
                  />
                </div>
              </div>

              {/* Duration Preview */}
              {pauseStartDate && pauseEndDate && (
                <div className="bg-[#7b008b]/5 rounded-xl p-3 mb-4 border border-[#7b008b]/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Pause Duration</span>
                    <span className="font-semibold text-[#7b008b]">
                      {Math.ceil((new Date(pauseEndDate).getTime() - new Date(pauseStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handlePauseRequest}
                disabled={actionLoading || !pauseStartDate || !pauseEndDate || !pauseReason}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <PauseCircle className="w-5 h-5" />
                    Confirm Pause
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-3">
                ⚠️ Requires 48 hours notice. Sessions during pause will be rescheduled.
              </p>
            </div>
          )}

          {/* Cannot Pause State */}
          {!isPaused && !canPause && (
            <div className="p-5">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">No pause days remaining</p>
                <p className="text-sm text-gray-500 mt-1">
                  You've used all {45 - pauseStats.remainingPauseDays} available pause days.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
