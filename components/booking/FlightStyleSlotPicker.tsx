// ============================================================
// FILE: components/booking/FlightStyleSlotPicker.tsx
// ============================================================
// Two-step booking flow for parents:
// Step 1: Choose time preference (bucket) - reduces overwhelm
// Step 2: Pick specific slot within bucket
// 
// Mobile-first, AIDA principles, minimal decision fatigue
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, AlertCircle, Sparkles, RefreshCw
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface TimeSlot {
  date: string;
  time: string;
  datetime: string;
  endTime: string;
  available: boolean;
  bucketName: string;
}

interface TimeBucket {
  name: string;
  displayName: string;
  emoji: string;
  startHour: number;
  endHour: number;
  totalSlots: number;
}

interface SlotsByDate {
  [date: string]: TimeSlot[];
}

interface FlightStyleSlotPickerProps {
  sessionType?: 'discovery' | 'coaching' | 'parent_checkin';
  childAge?: number;
  coachId?: string;
  onSlotSelect: (slot: TimeSlot) => void;
  selectedSlot?: TimeSlot | null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function FlightStyleSlotPicker({
  sessionType = 'discovery',
  childAge,
  coachId,
  onSlotSelect,
  selectedSlot,
}: FlightStyleSlotPickerProps) {
  // Data state
  const [buckets, setBuckets] = useState<TimeBucket[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<SlotsByDate>({});
  const [recommendedBucket, setRecommendedBucket] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'bucket' | 'slot'>('bucket');
  const [selectedBucket, setSelectedBucket] = useState<TimeBucket | null>(null);
  const [selectedDate, setSelectedDate] = useState('');

  // ============================================================
  // DATA FETCHING
  // ============================================================

  useEffect(() => {
    fetchSlots();
  }, [sessionType, childAge, coachId]);

  async function fetchSlots() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ sessionType, days: '14' });
      if (childAge) params.append('childAge', String(childAge));
      if (coachId) params.append('coachId', coachId);

      const res = await fetch(`/api/scheduling/slots?${params}`);
      const data = await res.json();

      if (data.success) {
        setBuckets(data.slotsByBucket || []);
        setSlotsByDate(data.slotsByDate || {});
        setRecommendedBucket(data.summary?.recommendedBucket || '');
        setDurationMinutes(data.durationMinutes || 30);
      } else {
        setError(data.error || 'Failed to load times');
      }
    } catch (err) {
      setError('Failed to load available times');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  function handleBucketSelect(bucket: TimeBucket) {
    if (bucket.totalSlots === 0) return;

    setSelectedBucket(bucket);

    // Find first date with slots in this bucket
    const dates = Object.keys(slotsByDate).sort();
    for (const date of dates) {
      const hasSlots = slotsByDate[date]?.some(s => s.bucketName === bucket.name);
      if (hasSlots) {
        setSelectedDate(date);
        break;
      }
    }

    setStep('slot');
  }

  function handleSlotSelect(slot: TimeSlot) {
    onSlotSelect(slot);
  }

  function handleBack() {
    setStep('bucket');
    setSelectedBucket(null);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(dateStr + 'T00:00:00');
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  function getAvailableDates(): string[] {
    if (!selectedBucket) return [];
    return Object.keys(slotsByDate)
      .filter(date => slotsByDate[date]?.some(s => s.bucketName === selectedBucket.name))
      .sort();
  }

  function getSlotsForDate(): TimeSlot[] {
    if (!selectedBucket || !selectedDate) return [];
    return (slotsByDate[selectedDate] || [])
      .filter(s => s.bucketName === selectedBucket.name)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getTotalSlots(): number {
    return buckets.reduce((sum, b) => sum + b.totalSlots, 0);
  }

  // ============================================================
  // RENDER - LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-10 h-10 animate-spin text-[#ff0099] mb-4" />
        <p className="text-gray-500">Finding available times...</p>
      </div>
    );
  }

  // ============================================================
  // RENDER - ERROR
  // ============================================================

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchSlots}
          className="flex items-center gap-2 px-4 py-2 bg-[#ff0099] text-white rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  // ============================================================
  // RENDER - NO SLOTS
  // ============================================================

  if (getTotalSlots() === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-10 h-10 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Available Times</h3>
        <p className="text-gray-500 text-sm">
          Please contact us on WhatsApp to schedule
        </p>
      </div>
    );
  }

  // ============================================================
  // RENDER - STEP 1: BUCKET SELECTION
  // ============================================================

  if (step === 'bucket') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center mb-2">
          <p className="text-gray-600 text-sm">
            When do you prefer? ({durationMinutes} min session)
          </p>
        </div>

        {/* Bucket Cards */}
        <div className="space-y-2">
          {buckets.map((bucket) => {
            const isRecommended = bucket.name === recommendedBucket && bucket.totalSlots > 0;
            const hasSlots = bucket.totalSlots > 0;

            return (
              <button
                key={bucket.name}
                onClick={() => handleBucketSelect(bucket)}
                disabled={!hasSlots}
                className={`
                  w-full p-4 rounded-xl border text-left transition-all relative
                  ${hasSlots
                    ? 'bg-white border-gray-200 hover:border-[#ff0099] hover:shadow-md active:scale-[0.99]'
                    : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
                  }
                  ${isRecommended ? 'ring-2 ring-[#ff0099]/30' : ''}
                `}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 bg-[#ff0099] text-white text-xs font-medium rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Most Available
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {/* Left: Emoji + Info */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{bucket.emoji}</span>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {bucket.displayName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {bucket.startHour > 12 ? bucket.startHour - 12 : bucket.startHour}
                        {bucket.startHour >= 12 ? ' PM' : ' AM'}
                        {' - '}
                        {bucket.endHour > 12 ? bucket.endHour - 12 : bucket.endHour}
                        {bucket.endHour >= 12 ? ' PM' : ' AM'}
                      </div>
                    </div>
                  </div>

                  {/* Right: Slot count + Arrow */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${hasSlots ? 'text-[#ff0099]' : 'text-gray-300'}`}>
                        {bucket.totalSlots}
                      </div>
                      <div className="text-xs text-gray-400">slots</div>
                    </div>
                    {hasSlots && (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Availability Bar */}
                {hasSlots && (
                  <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#ff0099] to-[#ff66c4] rounded-full"
                      style={{ width: `${Math.min(100, (bucket.totalSlots / 30) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Total */}
        <p className="text-center text-xs text-gray-400">
          {getTotalSlots()} slots available over the next 2 weeks
        </p>
      </div>
    );
  }

  // ============================================================
  // RENDER - STEP 2: SLOT SELECTION
  // ============================================================

  const availableDates = getAvailableDates();
  const slotsForDate = getSlotsForDate();

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            <span>{selectedBucket?.emoji}</span>
            {selectedBucket?.displayName}
          </div>
          <p className="text-sm text-gray-500">Pick a specific time</p>
        </div>
      </div>

      {/* Date Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {availableDates.slice(0, 10).map((date) => {
          const slotsCount = (slotsByDate[date] || [])
            .filter(s => s.bucketName === selectedBucket?.name).length;
          const isSelected = selectedDate === date;

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-lg text-center transition-all min-w-[80px] snap-start
                ${isSelected
                  ? 'bg-[#ff0099] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              <div className="font-medium text-sm">{formatDate(date)}</div>
              <div className="text-xs opacity-75">{slotsCount} slots</div>
            </button>
          );
        })}
      </div>

      {/* Time Slots Grid */}
      <div className="grid grid-cols-3 gap-2">
        {slotsForDate.map((slot) => {
          const isSelected = selectedSlot?.datetime === slot.datetime;

          return (
            <button
              key={slot.datetime}
              onClick={() => handleSlotSelect(slot)}
              className={`
                py-3 px-2 rounded-xl text-center transition-all
                ${isSelected
                  ? 'bg-[#ff0099] text-white shadow-lg ring-2 ring-[#ff0099]/30'
                  : 'bg-gray-50 text-gray-800 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              <div className="font-semibold">{formatTime(slot.time)}</div>
              <div className="text-xs opacity-75 mt-0.5">
                to {formatTime(slot.endTime)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {slotsForDate.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No slots available for this date
        </div>
      )}

      {/* Selected Confirmation */}
      {selectedSlot && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <div className="font-medium text-green-800">
              {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)}
            </div>
            <div className="text-sm text-green-600">
              {durationMinutes}-minute {sessionType} session
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
