// =============================================================================
// FILE: components/coach/CoachAvailabilityCard.tsx
// PURPOSE: Coach self-service availability management + Exit workflow
// UPDATED: Fixed exit API URL + More prominent exit section styling
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  CalendarOff, Calendar, AlertTriangle, CheckCircle, ChevronDown,
  ChevronUp, Loader2, Info, X, Users, Clock, Plane, Heart,
  GraduationCap, Briefcase, AlertCircle, Eye, LogOut, DoorOpen
} from 'lucide-react';

interface CoachAvailabilityCardProps {
  coachId: string;
  coachEmail: string;
  onStatusChange?: () => void;
}

interface AvailabilityData {
  coach: {
    id: string;
    name: string;
    email: string;
    isAvailable: boolean;
    capacity: {
      max: number;
      current: number;
      available: number;
    };
    exit_status?: string | null;
    exit_date?: string | null;
    exit_reason?: string | null;
  };
  unavailabilities: Array<{
    id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    affected_sessions: number;
  }>;
  activeStudents: Array<{
    enrollmentId: string;
    childName: string;
  }>;
  upcomingSessions: Array<{
    id: string;
    date: string;
    type: string;
    childName: string;
  }>;
}

interface ImpactPreview {
  duration: number;
  sessionsAffected: number;
  studentsAffected: number;
  students: Array<{ name: string; sessions: number }>;
  resolution: string;
  recommendation: string;
}

interface ExitPreview {
  activeStudents: number;
  scheduledSessions: number;
  pendingPayouts: number;
  students: Array<{ name: string; remainingSessions: number }>;
}

const ABSENCE_REASONS = [
  { id: 'vacation', label: 'Vacation', icon: Plane, color: 'text-blue-600 bg-blue-50', description: 'Planned time off' },
  { id: 'medical', label: 'Medical', icon: Heart, color: 'text-red-600 bg-red-50', description: 'Health-related absence' },
  { id: 'training', label: 'Training', icon: GraduationCap, color: 'text-purple-600 bg-purple-50', description: 'Professional development' },
  { id: 'personal', label: 'Personal', icon: Briefcase, color: 'text-gray-600 bg-gray-50', description: 'Personal matters' },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50', description: 'Urgent situation' },
];

const EXIT_REASONS = [
  { id: 'personal', label: 'Personal reasons' },
  { id: 'career_change', label: 'Career change' },
  { id: 'health', label: 'Health reasons' },
  { id: 'relocation', label: 'Relocation' },
  { id: 'time_constraints', label: 'Time constraints' },
  { id: 'other', label: 'Other' },
];

export default function CoachAvailabilityCard({ coachId, coachEmail, onStatusChange }: CoachAvailabilityCardProps) {
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [impactPreview, setImpactPreview] = useState<ImpactPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [notifyParents, setNotifyParents] = useState(true);

  // Exit state
  const [showExitSection, setShowExitSection] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [showExitPreview, setShowExitPreview] = useState(false);
  const [exitPreview, setExitPreview] = useState<ExitPreview | null>(null);
  const [exitLoading, setExitLoading] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, [coachId]);

  // Set exit toggle state based on existing data
  useEffect(() => {
    if (availabilityData?.coach?.exit_status === 'pending') {
      setShowExitSection(true);
      setExitDate(availabilityData.coach.exit_date || '');
      setExitReason(availabilityData.coach.exit_reason || '');
    }
  }, [availabilityData]);

  async function fetchAvailability() {
    try {
      const res = await fetch(`/api/coach/availability?coachId=${coachId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailabilityData(data.data);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchImpactPreview() {
    if (!startDate || !endDate) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/coach/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, startDate, endDate }),
      });

      if (res.ok) {
        const data = await res.json();
        setImpactPreview(data.preview);
        setShowPreview(true);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitUnavailability() {
    if (!startDate || !endDate || !reason) {
      setError('Please fill all required fields');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          type: 'unavailable',
          startDate,
          endDate,
          reason,
          notifyParents,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(`Unavailability recorded! ${data.data.affectedSessions} sessions will be ${data.data.resolutionType === 'reschedule' ? 'rescheduled' : 'handled'}.`);
        setShowForm(false);
        setShowPreview(false);
        resetForm();
        fetchAvailability();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to record unavailability');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelUnavailability(unavailabilityId: string) {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/coach/availability?id=${unavailabilityId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess('Unavailability cancelled successfully!');
        fetchAvailability();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to cancel');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  // ============================================
  // EXIT FUNCTIONS
  // ============================================
  async function fetchExitPreview() {
    if (!exitDate) return;

    setExitLoading(true);
    setError(null);
    
    try {
      // FIXED: Use correct API endpoint (GET /api/coach/exit)
      const res = await fetch(`/api/coach/exit?coachId=${coachId}&exitDate=${exitDate}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setExitPreview(data.preview);
        setShowExitPreview(true);
      } else {
        setError(data.error || 'Failed to fetch exit preview');
      }
    } catch (err) {
      console.error('Error fetching exit preview:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setExitLoading(false);
    }
  }

  async function handleConfirmExit() {
    if (!exitDate || !exitReason) {
      setError('Please select a last working date and reason');
      return;
    }

    setExitLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          exitDate,
          exitReason,
          initiatedBy: 'coach',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess('Exit request submitted. Admin will handle student reassignment.');
        setShowExitPreview(false);
        fetchAvailability();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to submit exit request');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setExitLoading(false);
    }
  }

  async function handleCancelExit() {
    setExitLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/exit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess('Exit request cancelled. Welcome back!');
        setExitDate('');
        setExitReason('');
        setShowExitPreview(false);
        fetchAvailability();
        onStatusChange?.();
      } else {
        setError(data.error || 'Failed to cancel exit');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setExitLoading(false);
    }
  }

  function resetForm() {
    setStartDate('');
    setEndDate('');
    setReason('');
    setNotifyParents(true);
    setImpactPreview(null);
  }

  // Calculate min dates
  const minStartDate = new Date();
  minStartDate.setDate(minStartDate.getDate() + 1);
  const minStartDateStr = minStartDate.toISOString().split('T')[0];

  const maxEndDate = new Date();
  maxEndDate.setDate(maxEndDate.getDate() + 90);
  const maxEndDateStr = maxEndDate.toISOString().split('T')[0];

  // Exit date constraints (min 14 days notice)
  const minExitDate = new Date();
  minExitDate.setDate(minExitDate.getDate() + 14);
  const minExitDateStr = minExitDate.toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#00abff]" />
        </div>
      </div>
    );
  }

  if (!availabilityData) return null;

  const { coach, unavailabilities, activeStudents, upcomingSessions } = availabilityData;
  const upcomingUnavailabilities = unavailabilities.filter(u => u.status === 'upcoming');
  const activeUnavailabilities = unavailabilities.filter(u => u.status === 'active');
  const hasUnavailability = upcomingUnavailabilities.length > 0 || activeUnavailabilities.length > 0;
  const isExiting = coach.exit_status === 'pending';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isExiting
              ? 'bg-red-100'
              : hasUnavailability
                ? 'bg-amber-100'
                : 'bg-gradient-to-br from-[#00abff]/10 to-[#0066cc]/10'
          }`}>
            {isExiting ? (
              <DoorOpen className="w-6 h-6 text-red-600" />
            ) : hasUnavailability ? (
              <CalendarOff className="w-6 h-6 text-amber-600" />
            ) : (
              <Calendar className="w-6 h-6 text-[#00abff]" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">
              {isExiting 
                ? '🚪 Leaving Yestoryd'
                : hasUnavailability 
                  ? '📅 Upcoming Time Off' 
                  : '✅ Fully Available'
              }
            </h3>
            <p className="text-sm text-gray-500">
              {isExiting
                ? `Last day: ${new Date(coach.exit_date!).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
                : hasUnavailability
                  ? `${upcomingUnavailabilities.length + activeUnavailabilities.length} scheduled absence(s)`
                  : `${activeStudents.length} active students • ${upcomingSessions.length} upcoming sessions`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExiting && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              Exit Pending
            </span>
          )}
          {activeUnavailabilities.length > 0 && !isExiting && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              Currently Away
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

          {/* Current Unavailabilities */}
          {(activeUnavailabilities.length > 0 || upcomingUnavailabilities.length > 0) && !showForm && (
            <div className="p-5">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-amber-600" />
                Scheduled Time Off
              </h4>
              <div className="space-y-3">
                {[...activeUnavailabilities, ...upcomingUnavailabilities].map((unavail) => {
                  const reasonConfig = ABSENCE_REASONS.find(r => r.id === unavail.reason) || ABSENCE_REASONS[3];
                  const Icon = reasonConfig.icon;
                  const isActive = unavail.status === 'active';

                  return (
                    <div
                      key={unavail.id}
                      className={`rounded-xl p-4 border ${
                        isActive ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reasonConfig.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 capitalize">{unavail.reason}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                isActive ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isActive ? 'Active Now' : 'Upcoming'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {new Date(unavail.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              {' → '}
                              {new Date(unavail.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {unavail.affected_sessions > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                {unavail.affected_sessions} session(s) affected
                              </p>
                            )}
                          </div>
                        </div>
                        {unavail.status === 'upcoming' && (
                          <button
                            onClick={() => handleCancelUnavailability(unavail.id)}
                            disabled={actionLoading}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Overview */}
          {!showForm && !showExitSection && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users className="w-4 h-4 text-[#00abff]" />
                  </div>
                  <p className="text-xl font-bold text-gray-800">{activeStudents.length}</p>
                  <p className="text-xs text-gray-500">Active Students</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Calendar className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-800">{upcomingSessions.length}</p>
                  <p className="text-xs text-gray-500">Upcoming Sessions</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-800">{coach.capacity.available}</p>
                  <p className="text-xs text-gray-500">Slots Available</p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Planning time off?</p>
                    <p>Mark your unavailability in advance. We'll automatically reschedule or assign backup for your students. Parents will be notified.</p>
                  </div>
                </div>
              </div>

              {/* Add Unavailability Button */}
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-4 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                <CalendarOff className="w-5 h-5" />
                Mark Time Off
              </button>

              {/* ============================================ */}
              {/* EXIT SECTION - MORE PROMINENT STYLING */}
              {/* ============================================ */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowExitSection(!showExitSection)}
                  className={`w-full flex items-center justify-between text-left p-4 rounded-xl border-2 transition-all ${
                    isExiting 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isExiting ? 'bg-red-100' : 'bg-red-50'
                    }`}>
                      <LogOut className={`w-6 h-6 ${isExiting ? 'text-red-600' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-base ${isExiting ? 'text-red-700' : 'text-red-600'}`}>
                        {isExiting ? '🚪 Exit Scheduled' : '🚪 Leaving Yestoryd?'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {isExiting 
                          ? `Last day: ${new Date(coach.exit_date!).toLocaleDateString('en-IN', { dateStyle: 'long' })}`
                          : 'Plan your departure from the platform'
                        }
                      </p>
                    </div>
                  </div>
                  {showExitSection ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Unavailability Form */}
          {showForm && !showPreview && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800">Schedule Time Off</h4>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reason Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for absence
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ABSENCE_REASONS.map((r) => {
                    const Icon = r.icon;
                    const isSelected = reason === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setReason(r.id)}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-[#00abff] bg-[#00abff]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.color} mb-2`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-sm font-medium block ${isSelected ? 'text-[#00abff]' : 'text-gray-700'}`}>
                          {r.label}
                        </span>
                        <span className="text-xs text-gray-500">{r.description}</span>
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={minStartDateStr}
                    max={maxEndDateStr}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00abff] focus:border-[#00abff] text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || minStartDateStr}
                    max={maxEndDateStr}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00abff] focus:border-[#00abff] text-sm text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Notify Parents Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Notify affected parents</span>
                </div>
                <button
                  onClick={() => setNotifyParents(!notifyParents)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    notifyParents ? 'bg-[#00abff]' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    notifyParents ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Preview Button */}
              <button
                onClick={fetchImpactPreview}
                disabled={actionLoading || !startDate || !endDate || !reason}
                className="w-full py-4 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Preview Impact
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-3">
                {reason === 'emergency' || reason === 'medical'
                  ? '⚡ Emergency/Medical: 1 day notice minimum'
                  : '⚠️ Requires 7 days advance notice'
                }
              </p>
            </div>
          )}

          {/* Impact Preview */}
          {showPreview && impactPreview && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800">Impact Preview</h4>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Impact Stats */}
              <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{impactPreview.duration}</p>
                    <p className="text-xs text-amber-600">Days</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{impactPreview.sessionsAffected}</p>
                    <p className="text-xs text-amber-600">Sessions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{impactPreview.studentsAffected}</p>
                    <p className="text-xs text-amber-600">Students</p>
                  </div>
                </div>
              </div>

              {/* Affected Students */}
              {impactPreview.students.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Affected Students:</p>
                  <div className="flex flex-wrap gap-2">
                    {impactPreview.students.map((student, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                      >
                        {student.name} ({student.sessions} sessions)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Info */}
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                <p className="font-medium text-blue-800 mb-1">What will happen:</p>
                <p className="text-sm text-blue-700">{impactPreview.resolution}</p>
                <p className="text-xs text-blue-600 mt-2">💡 {impactPreview.recommendation}</p>
              </div>

              {/* Confirm / Cancel Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Go Back
                </button>
                <button
                  onClick={handleSubmitUnavailability}
                  disabled={actionLoading}
                  className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* EXIT SECTION EXPANDED */}
          {/* ============================================ */}
          {showExitSection && !showForm && (
            <div className="px-5 pb-5">
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 border-2 border-red-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-800 text-lg">Leaving Yestoryd?</h4>
                    <p className="text-sm text-red-700 mt-1">
                      We're sad to see you go. Your students will be reassigned to another qualified coach.
                    </p>
                  </div>
                </div>

                {isExiting ? (
                  // Already exiting - show status
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Last Working Date</span>
                        <span className="font-semibold text-red-700">
                          {new Date(coach.exit_date!).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Reason</span>
                        <span className="text-gray-600 capitalize">
                          {EXIT_REASONS.find(r => r.id === coach.exit_reason)?.label || coach.exit_reason}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-sm text-amber-800">
                        ⏳ Admin is handling student reassignment. You'll receive your final payout within 30 days of your last session.
                      </p>
                    </div>

                    <button
                      onClick={handleCancelExit}
                      disabled={exitLoading}
                      className="w-full py-3 border-2 border-green-500 text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                    >
                      {exitLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Cancel Exit & Stay
                        </>
                      )}
                    </button>
                  </div>
                ) : showExitPreview && exitPreview ? (
                  // Show exit preview
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-red-700">{exitPreview.activeStudents}</p>
                          <p className="text-xs text-gray-600">Students to Reassign</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-700">{exitPreview.scheduledSessions}</p>
                          <p className="text-xs text-gray-600">Sessions to Transfer</p>
                        </div>
                      </div>
                    </div>

                    {exitPreview.students && exitPreview.students.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Your Students:</p>
                        <div className="flex flex-wrap gap-2">
                          {exitPreview.students.map((student, idx) => (
                            <span key={idx} className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border">
                              {student.name} ({student.remainingSessions} sessions left)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">📋 What happens next:</p>
                      <ul className="text-sm text-blue-700 mt-2 space-y-1">
                        <li>• Admin will reassign your students</li>
                        <li>• Parents will be notified of coach change</li>
                        <li>• You'll complete sessions until {new Date(exitDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</li>
                        <li>• Final payout within 30 days after last session</li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowExitPreview(false)}
                        className="py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={handleConfirmExit}
                        disabled={exitLoading}
                        className="py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {exitLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <DoorOpen className="w-5 h-5" />
                            Confirm Exit
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Exit form
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Working Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={exitDate}
                        onChange={(e) => setExitDate(e.target.value)}
                        min={minExitDateStr}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Minimum 14 days notice required</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for leaving <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={exitReason}
                        onChange={(e) => setExitReason(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 bg-white"
                      >
                        <option value="">Select a reason</option>
                        {EXIT_REASONS.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={fetchExitPreview}
                      disabled={exitLoading || !exitDate || !exitReason}
                      className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exitLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Eye className="w-5 h-5" />
                          Preview & Continue
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowExitSection(false)}
                      className="w-full py-2 text-gray-600 text-sm hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}