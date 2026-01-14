// components/shared/RescheduleModal.tsx
// Shared reschedule modal for Coach, Admin, and Parent portals
// HARDENED: Full TypeScript, validation, error handling, accessible

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// ============================================================
// CONSTANTS
// ============================================================

const MIN_RESCHEDULE_HOURS = 1; // Minimum hours in future for rescheduling
const DEFAULT_TIME = '10:00';

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
  /** Custom API endpoint (default: /api/sessions) */
  apiEndpoint?: string;
  /** Custom title prefix */
  titlePrefix?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatDateForInput(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function formatTimeForInput(timeStr: string): string {
  if (!timeStr) return DEFAULT_TIME;
  // Handle HH:MM:SS or HH:MM format
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return DEFAULT_TIME;
}

function getMinDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function validateReschedule(date: string, time: string): ValidationResult {
  // Check required fields
  if (!date || date.trim() === '') {
    return { valid: false, error: 'Please select a date' };
  }

  if (!time || time.trim() === '') {
    return { valid: false, error: 'Please select a time' };
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Validate time format
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(time)) {
    return { valid: false, error: 'Invalid time format' };
  }

  // Create datetime and validate
  const newDateTime = new Date(`${date}T${time}:00`);
  if (isNaN(newDateTime.getTime())) {
    return { valid: false, error: 'Invalid date/time combination' };
  }

  // Check if in the future (with buffer)
  const minDateTime = new Date();
  minDateTime.setHours(minDateTime.getHours() + MIN_RESCHEDULE_HOURS);

  if (newDateTime < minDateTime) {
    return { 
      valid: false, 
      error: `Please select a time at least ${MIN_RESCHEDULE_HOURS} hour(s) from now` 
    };
  }

  // Check reasonable future limit (1 year)
  const maxDateTime = new Date();
  maxDateTime.setFullYear(maxDateTime.getFullYear() + 1);

  if (newDateTime > maxDateTime) {
    return { valid: false, error: 'Date cannot be more than 1 year in the future' };
  }

  return { valid: true };
}

// ============================================================
// COMPONENT
// ============================================================

export default function RescheduleModal({
  session,
  isOpen,
  onClose,
  onSuccess,
  apiEndpoint = '/api/sessions',
  titlePrefix = 'Reschedule',
}: RescheduleModalProps) {
  // State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with session data
  useEffect(() => {
    if (isOpen && session) {
      setDate(formatDateForInput(session.scheduled_date));
      setTime(formatTimeForInput(session.scheduled_time));
      setSubmitState('idle');
      setErrorMessage('');
      setValidationError('');

      // Focus date input after render
      setTimeout(() => {
        dateInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, session]);

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

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && submitState !== 'loading') {
        onClose();
      }
    },
    [onClose, submitState]
  );

  // Validate on input change
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDate(newDate);
    setValidationError('');
    
    if (newDate && time) {
      const validation = validateReschedule(newDate, time);
      if (!validation.valid) {
        setValidationError(validation.error || '');
      }
    }
  }, [time]);

  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    setValidationError('');
    
    if (date && newTime) {
      const validation = validateReschedule(date, newTime);
      if (!validation.valid) {
        setValidationError(validation.error || '');
      }
    }
  }, [date]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validate
    const validation = validateReschedule(date, time);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid input');
      return;
    }

    setSubmitState('loading');
    setErrorMessage('');
    setValidationError('');

    try {
      const newDateTime = new Date(`${date}T${time}:00`);

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
  }, [date, time, session.id, apiEndpoint, onSuccess, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    if (submitState !== 'loading') {
      onClose();
    }
  }, [onClose, submitState]);

  // Don't render if not open
  if (!isOpen) return null;

  const sessionLabel = session.session_number
    ? `Session #${session.session_number}`
    : 'Session';

  const isSubmitDisabled = 
    submitState === 'loading' || 
    submitState === 'success' ||
    !date || 
    !time || 
    !!validationError;

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
        className="bg-[#1a1f2e] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 id="reschedule-modal-title" className="text-xl font-bold text-white">
            {titlePrefix} {sessionLabel}
          </h2>
          <button
            onClick={handleClose}
            disabled={submitState === 'loading'}
            className="p-2 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Session Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-5 border border-gray-700">
            <p className="text-white font-medium">{session.child_name}</p>
            <p className="text-gray-400 text-sm mt-1">
              Current: {session.scheduled_date} at {formatTimeForInput(session.scheduled_time)}
            </p>
          </div>

          {/* Date Input */}
          <div className="mb-4">
            <label htmlFor="reschedule-date" className="block text-sm text-gray-400 mb-2">
              <Calendar className="w-4 h-4 inline-block mr-2" />
              New Date
            </label>
            <input
              ref={dateInputRef}
              id="reschedule-date"
              type="date"
              value={date}
              onChange={handleDateChange}
              min={getMinDate()}
              disabled={submitState === 'loading' || submitState === 'success'}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-describedby={validationError ? 'reschedule-error' : undefined}
            />
          </div>

          {/* Time Input */}
          <div className="mb-4">
            <label htmlFor="reschedule-time" className="block text-sm text-gray-400 mb-2">
              <Clock className="w-4 h-4 inline-block mr-2" />
              New Time
            </label>
            <input
              id="reschedule-time"
              type="time"
              value={time}
              onChange={handleTimeChange}
              disabled={submitState === 'loading' || submitState === 'success'}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <div
              id="reschedule-error"
              className="flex items-center gap-2 text-yellow-400 text-sm mb-4 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/30"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {validationError}
            </div>
          )}

          {/* API Error */}
          {submitState === 'error' && errorMessage && (
            <div
              className="flex items-center gap-2 text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-xl border border-red-500/30"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errorMessage}
            </div>
          )}

          {/* Success Message */}
          {submitState === 'success' && (
            <div
              className="flex items-center gap-2 text-emerald-400 text-sm mb-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30"
              role="status"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Session rescheduled successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={submitState === 'loading'}
            className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="flex-1 py-3 bg-yellow-500 text-black rounded-xl font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              'Reschedule'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
