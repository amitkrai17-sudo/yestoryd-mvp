// components/shared/RescheduleModal.tsx
// Progressive 3-step reschedule modal: Month → Date → Time
// Shows only available slots from coach's schedule

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Check,
  ArrowRight,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface RescheduleSession {
  id: string;
  child_name: string;
  session_number?: number | null;
  scheduled_date: string;
  scheduled_time: string;
}

export interface RescheduleModalProps {
  session: RescheduleSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Coach ID for fetching available slots */
  coachId?: string;
  /** Custom API endpoint (default: /api/sessions) */
  apiEndpoint?: string;
  /** Custom title prefix */
  titlePrefix?: string;
}

interface TimeSlot {
  date: string;
  time: string;
  datetime: string;
  endTime: string;
  available: boolean;
  bucketName: string;
}

interface SlotsResponse {
  success: boolean;
  slots: TimeSlot[];
  slotsByDate: Record<string, TimeSlot[]>;
  error?: string;
}

type Step = 1 | 2 | 3;
type SubmitState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================
// CONSTANTS
// ============================================================

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

const TIME_BUCKETS = [
  { name: 'morning', label: 'Morning', startHour: 6, endHour: 12 },
  { name: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 17 },
  { name: 'evening', label: 'Evening', startHour: 17, endHour: 22 },
] as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatCurrentDateTime(dateStr: string, timeStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();

    // Format time
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const timeFormatted = `${hour12}:${minutes} ${ampm}`;

    return `${day}, ${dayNum} ${month} ${year} at ${timeFormatted}`;
  } catch {
    return `${dateStr} at ${timeStr}`;
  }
}

function formatTime12(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatSelectedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = date.getDate();
  const suffix = getDaySuffix(dayNum);
  return `${day}, ${dayNum}${suffix}`;
}

function getDaySuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function getTimeHour(timeStr: string): number {
  const [hours] = timeStr.split(':');
  return parseInt(hours);
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

function isPastDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function isTodayDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return isSameDay(date, new Date());
}

function getMonthDays(year: number, month: number): { day: number; dateStr: string }[] {
  const days: { day: number; dateStr: string }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({ day, dateStr });
  }

  return days;
}

function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0-6 (Mon-Sun) for CSS grid alignment
  const dayOfWeek = new Date(year, month, 1).getDay();
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sun=0 to Sun=6
}

// ============================================================
// COMPONENT
// ============================================================

export default function RescheduleModal({
  session,
  isOpen,
  onClose,
  onSuccess,
  coachId,
  apiEndpoint = '/api/sessions',
  titlePrefix = 'Reschedule',
}: RescheduleModalProps) {
  // Step state
  const [step, setStep] = useState<Step>(1);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Data state
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const modalRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // FETCH AVAILABLE SLOTS
  // ============================================================
  const fetchSlots = useCallback(async () => {
    if (!coachId) {
      setSlotsError('Coach ID not available');
      return;
    }

    setLoadingSlots(true);
    setSlotsError(null);

    try {
      const response = await fetch(
        `/api/scheduling/slots?coachId=${coachId}&days=30&sessionType=coaching`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }

      const data: SlotsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch slots');
      }

      setSlots(data.slots || []);
      setSlotsByDate(data.slotsByDate || {});
    } catch (err) {
      console.error('Error fetching slots:', err);
      setSlotsError(err instanceof Error ? err.message : 'Failed to load available slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [coachId]);

  // ============================================================
  // EFFECTS
  // ============================================================

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedMonth(new Date());
      setSelectedDate(null);
      setSelectedTime(null);
      setSubmitState('idle');
      setErrorMessage('');
      fetchSlots();
    }
  }, [isOpen, fetchSlots]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && submitState !== 'loading') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, submitState]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Dates that have available slots in selected month
  const datesWithSlots = useMemo(() => {
    const set = new Set<string>();
    Object.keys(slotsByDate).forEach((date) => {
      if (slotsByDate[date]?.length > 0) {
        set.add(date);
      }
    });
    return set;
  }, [slotsByDate]);

  // Time slots for selected date, grouped by bucket
  const timeSlotsForDate = useMemo(() => {
    if (!selectedDate) return { morning: [], afternoon: [], evening: [] };

    const dateSlots = slotsByDate[selectedDate] || [];
    const grouped = {
      morning: [] as TimeSlot[],
      afternoon: [] as TimeSlot[],
      evening: [] as TimeSlot[],
    };

    dateSlots.forEach((slot) => {
      const hour = getTimeHour(slot.time);
      if (hour >= 6 && hour < 12) {
        grouped.morning.push(slot);
      } else if (hour >= 12 && hour < 17) {
        grouped.afternoon.push(slot);
      } else if (hour >= 17 && hour < 22) {
        grouped.evening.push(slot);
      }
    });

    return grouped;
  }, [selectedDate, slotsByDate]);

  const hasNoSlotsForDate = selectedDate &&
    timeSlotsForDate.morning.length === 0 &&
    timeSlotsForDate.afternoon.length === 0 &&
    timeSlotsForDate.evening.length === 0;

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && submitState !== 'loading') {
        onClose();
      }
    },
    [onClose, submitState]
  );

  const handleClose = useCallback(() => {
    if (submitState !== 'loading') {
      onClose();
    }
  }, [onClose, submitState]);

  const handlePrevMonth = useCallback(() => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);

    // Don't go before current month
    const today = new Date();
    if (newMonth.getFullYear() < today.getFullYear() ||
        (newMonth.getFullYear() === today.getFullYear() && newMonth.getMonth() < today.getMonth())) {
      return;
    }

    setSelectedMonth(newMonth);
  }, [selectedMonth]);

  const handleNextMonth = useCallback(() => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
  }, [selectedMonth]);

  const handleDateSelect = useCallback((dateStr: string) => {
    if (isPastDate(dateStr)) return;

    setSelectedDate(dateStr);
    setSelectedTime(null);
    setStep(3);
  }, []);

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time);
  }, []);

  const handleChangeMonth = useCallback(() => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTime(null);
  }, []);

  const handleChangeDate = useCallback(() => {
    setStep(2);
    setSelectedTime(null);
  }, []);

  const handleQuickSelect = useCallback((option: 'thisWeek' | 'nextWeek') => {
    const today = new Date();

    if (option === 'thisWeek') {
      // Find next available date this week
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        if (datesWithSlots.has(dateStr)) {
          setSelectedDate(dateStr);
          setStep(3);
          return;
        }
      }
    } else if (option === 'nextWeek') {
      // Find first available date next week
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() + (7 - today.getDay() + 1)); // Next Monday

      for (let i = 0; i < 7; i++) {
        const date = new Date(nextWeekStart);
        date.setDate(nextWeekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        if (datesWithSlots.has(dateStr)) {
          setSelectedDate(dateStr);
          setStep(3);
          return;
        }
      }
    }

    // If no slots found, just go to step 2
    setStep(2);
  }, [datesWithSlots]);

  const handleSubmit = useCallback(async () => {
    if (!selectedDate || !selectedTime) return;

    setSubmitState('loading');
    setErrorMessage('');

    try {
      const newDateTime = new Date(`${selectedDate}T${selectedTime}:00`);

      const response = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          newDateTime: newDateTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitState('error');
        setErrorMessage(data.error || 'Failed to reschedule session');
        return;
      }

      setSubmitState('success');

      // Close after brief success display
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Reschedule error:', error);
      setSubmitState('error');
      setErrorMessage('Network error. Please try again.');
    }
  }, [selectedDate, selectedTime, session.id, apiEndpoint, onSuccess, onClose]);

  // ============================================================
  // RENDER
  // ============================================================

  if (!isOpen) return null;

  const sessionLabel = session.session_number
    ? `Session #${session.session_number}`
    : 'Session';

  const canSubmit = selectedDate && selectedTime && submitState !== 'loading' && submitState !== 'success';

  // Check if prev month is disabled
  const today = new Date();
  const isPrevMonthDisabled =
    selectedMonth.getFullYear() === today.getFullYear() &&
    selectedMonth.getMonth() === today.getMonth();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-[#1a1a1a] rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-gray-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <h2 id="reschedule-modal-title" className="text-xl font-bold text-white">
            {titlePrefix} {sessionLabel}
          </h2>
          <button
            onClick={handleClose}
            disabled={submitState === 'loading'}
            className="p-2 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {/* Session Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-5 border border-gray-700">
            <p className="text-white font-medium">{session.child_name}</p>
            <p className="text-gray-400 text-sm mt-1">
              Current: {formatCurrentDateTime(session.scheduled_date, session.scheduled_time)}
            </p>
          </div>

          {/* Loading State */}
          {loadingSlots && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF0099] mb-4" />
              <p className="text-gray-400">Loading available slots...</p>
            </div>
          )}

          {/* Error State */}
          {slotsError && !loadingSlots && (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-white mb-2">Failed to load slots</p>
              <p className="text-gray-400 text-sm mb-4">{slotsError}</p>
              <button
                onClick={fetchSlots}
                className="px-4 py-2 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Step Content */}
          {!loadingSlots && !slotsError && (
            <>
              {/* Completed Steps Summary */}
              {step >= 2 && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-white text-sm">
                        {MONTHS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                      </span>
                    </div>
                    <button
                      onClick={handleChangeMonth}
                      className="text-[#00ABFF] text-sm hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {step >= 3 && selectedDate && (
                <div className="mb-4">
                  <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-white text-sm">{formatSelectedDate(selectedDate)}</span>
                    </div>
                    <button
                      onClick={handleChangeDate}
                      className="text-[#00ABFF] text-sm hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 1: Select Month */}
              {step === 1 && (
                <div>
                  <p className="text-gray-400 text-sm mb-4">Step 1 of 3: Select Month</p>

                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={handlePrevMonth}
                      disabled={isPrevMonthDisabled}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <h3 className="text-white font-semibold text-lg">
                      {MONTHS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#FF0099]/90 transition-colors flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Quick Select */}
                  <div className="mt-4">
                    <p className="text-gray-500 text-sm mb-2">or quick select:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQuickSelect('thisWeek')}
                        className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        This Week
                      </button>
                      <button
                        onClick={() => handleQuickSelect('nextWeek')}
                        className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        Next Week
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Select Date (Calendar) */}
              {step === 2 && (
                <div>
                  <p className="text-gray-400 text-sm mb-4">Step 2 of 3: Select Date</p>

                  {/* Mini Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePrevMonth}
                      disabled={isPrevMonthDisabled}
                      className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    <span className="text-white text-sm font-medium">
                      {MONTHS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="text-center text-gray-500 text-xs font-medium py-1">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty cells */}
                      {Array.from({ length: getFirstDayOfMonth(selectedMonth.getFullYear(), selectedMonth.getMonth()) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}

                      {/* Days of month */}
                      {getMonthDays(selectedMonth.getFullYear(), selectedMonth.getMonth()).map(({ day, dateStr }) => {
                        const hasSlots = datesWithSlots.has(dateStr);
                        const isPast = isPastDate(dateStr);
                        const isToday = isTodayDate(dateStr);
                        const isSunday = new Date(dateStr).getDay() === 0;

                        const isDisabled = isPast || !hasSlots;
                        const isClickable = !isPast && hasSlots;

                        return (
                          <button
                            key={day}
                            onClick={() => isClickable && handleDateSelect(dateStr)}
                            disabled={isDisabled}
                            className={`
                              aspect-square rounded-lg text-sm font-medium transition-all
                              flex items-center justify-center
                              ${isToday ? 'ring-2 ring-[#00ABFF]' : ''}
                              ${isClickable ? 'hover:bg-[#FF0099]/20 hover:border-[#FF0099] cursor-pointer' : ''}
                              ${hasSlots && !isPast ? 'text-white font-semibold' : ''}
                              ${isPast || isSunday ? 'text-gray-700 cursor-not-allowed' : ''}
                              ${!hasSlots && !isPast ? 'text-gray-600' : ''}
                            `}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-white/20" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded border-2 border-[#00ABFF]" />
                      <span>Today</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Select Time */}
              {step === 3 && (
                <div>
                  <p className="text-gray-400 text-sm mb-4">Step 3 of 3: Select Time</p>

                  {hasNoSlotsForDate ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-white mb-2">No slots available</p>
                      <p className="text-gray-400 text-sm mb-4">
                        No available times on this date
                      </p>
                      <button
                        onClick={handleChangeDate}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Choose Another Date
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {TIME_BUCKETS.map((bucket) => {
                        const bucketSlots = timeSlotsForDate[bucket.name as keyof typeof timeSlotsForDate];
                        if (bucketSlots.length === 0) return null;

                        return (
                          <div key={bucket.name}>
                            <p className="text-gray-400 text-sm mb-2">{bucket.label}</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {bucketSlots.map((slot) => (
                                <button
                                  key={slot.time}
                                  onClick={() => handleTimeSelect(slot.time)}
                                  className={`
                                    py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                                    min-h-[44px]
                                    ${selectedTime === slot.time
                                      ? 'bg-[#FF0099] text-white'
                                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-[#FF0099]'
                                    }
                                  `}
                                >
                                  {formatTime12(slot.time)}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* API Error */}
              {submitState === 'error' && errorMessage && (
                <div
                  className="flex items-center gap-2 text-red-400 text-sm mt-4 p-3 bg-red-500/10 rounded-xl border border-red-500/30"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errorMessage}
                </div>
              )}

              {/* Success Message */}
              {submitState === 'success' && (
                <div
                  className="flex items-center gap-2 text-emerald-400 text-sm mt-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30"
                  role="status"
                >
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Session rescheduled successfully!
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - fixed */}
        {step === 3 && !loadingSlots && !slotsError && (
          <div className="flex gap-3 p-5 border-t border-gray-800 flex-shrink-0">
            <button
              onClick={handleClose}
              disabled={submitState === 'loading'}
              className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#FF0099]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitState === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Rescheduling...
                </>
              ) : submitState === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Done!
                </>
              ) : (
                <>
                  Reschedule
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
