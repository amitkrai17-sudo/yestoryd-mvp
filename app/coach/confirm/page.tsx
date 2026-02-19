'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, User, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const TIME_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
];

interface EnrollmentData {
  id: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  preferredDay: number | null;
  preferredTime: string | null;
  coachName: string;
  createdAt: string;
}

export default function ConfirmSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.enrollmentId as string;

  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    fetchEnrollment();
  }, [enrollmentId]);

  async function fetchEnrollment() {
    try {
      const res = await fetch(`/api/enrollment/${enrollmentId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load enrollment');
        return;
      }

      setEnrollment(data);
      setSelectedDay(data.preferredDay);
      setSelectedTime(data.preferredTime);
    } catch (err) {
      setError('Failed to load enrollment details');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (selectedDay === null || !selectedTime) {
      setError('Please select day and time');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const res = await fetch('/api/sessions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          childId: enrollment?.id,
          preferredDay: selectedDay,
          preferredTime: selectedTime,
          confirmedBy: 'coach',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to confirm schedule');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Failed to confirm schedule');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00ABFF] animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="bg-surface-1 rounded-2xl p-8 max-w-md w-full text-center border border-border">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Schedule Confirmed!</h1>
          <p className="text-text-tertiary mb-6">
            All sessions have been created. Calendar invites sent to parent and you.
          </p>
          <p className="text-sm text-text-tertiary">
            {DAY_OPTIONS.find(d => d.value === selectedDay)?.label}s at{' '}
            {TIME_OPTIONS.find(t => t.value === selectedTime)?.label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-2xl font-bold text-white mb-2">Confirm Schedule</h1>
          <p className="text-text-tertiary">New enrollment needs your confirmation</p>
        </div>

        {/* Enrollment Details */}
        {enrollment && (
          <div className="bg-surface-1 rounded-xl p-6 mb-6 border border-border">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#00ABFF]" />
              Enrollment Details
            </h2>
            <div className="space-y-3 text-text-secondary">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Child</span>
                <span className="font-medium">{enrollment.childName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Parent</span>
                <span>{enrollment.parentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Email</span>
                <span className="text-sm">{enrollment.parentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Phone</span>
                <span>{enrollment.parentPhone}</span>
              </div>
              {enrollment.preferredDay !== null && (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-text-tertiary">Parent's Preference</span>
                  <span className="text-blue-400">
                    {DAY_OPTIONS.find(d => d.value === enrollment.preferredDay)?.label}{' '}
                    {TIME_OPTIONS.find(t => t.value === enrollment.preferredTime)?.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Selection */}
        <div className="bg-surface-1 rounded-xl p-6 mb-6 border border-border">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Select Weekly Slot
          </h2>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="text-sm text-text-tertiary mb-2 block">Day</label>
            <div className="grid grid-cols-4 gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDay(day.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDay === day.value
                      ? 'bg-[#00ABFF] text-white'
                      : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div>
            <label className="text-sm text-text-tertiary mb-2 block flex items-center gap-1">
              <Clock className="w-4 h-4" /> Time
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OPTIONS.map((time) => (
                <button
                  key={time.value}
                  onClick={() => setSelectedTime(time.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedTime === time.value
                      ? 'bg-[#00ABFF] text-white'
                      : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  {time.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-400 text-sm">
            Sessions will be created at this slot based on the enrollment plan.
            Rescheduling individual sessions can be done directly in Google Calendar.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={confirming || selectedDay === null || !selectedTime}
          className="w-full bg-[#00ABFF] hover:bg-[#00ABFF] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {confirming ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Sessions...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Confirm & Create Sessions
            </>
          )}
        </button>
      </div>
    </div>
  );
}
