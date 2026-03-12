'use client';

// ============================================================================
// PARENT SLOT PICKER (Flight-Style)
// components/booking/SlotPicker.tsx
// ============================================================================
// 
// Two-step booking flow:
// 1. Select time bucket (Early Morning, Morning, Afternoon, Evening, Night)
// 2. Select specific slot within that bucket
//
// Features:
// - Mobile-first design
// - Shows slot availability per bucket
// - Recommends best bucket
// - Smooth animations
//
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Sunrise,
  Sun,
  CloudSun,
  Sunset,
  Moon,
} from 'lucide-react';
import { formatDateRelative, formatTime12 } from '@/lib/utils/date-format';
import { Spinner } from '@/components/ui/spinner';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';

const BUCKET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sunrise, Sun, CloudSun, Sunset, Moon,
};

// ============================================================================
// TYPES
// ============================================================================

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
  icon: string;
  startHour: number;
  endHour: number;
  totalSlots: number;
  slots: TimeSlot[];
}

interface SlotPickerProps {
  sessionType?: 'discovery' | 'coaching';
  childAge?: number;
  onSlotSelect: (slot: TimeSlot) => void;
  selectedSlot?: TimeSlot | null;
  coachId?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SlotPicker({
  sessionType = 'discovery',
  childAge,
  onSlotSelect,
  selectedSlot,
  coachId,
}: SlotPickerProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<TimeBucket[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [recommendedBucket, setRecommendedBucket] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  
  // UI State
  const [step, setStep] = useState<'bucket' | 'slot'>('bucket');
  const [selectedBucket, setSelectedBucket] = useState<TimeBucket | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    fetchSlots();
  }, [sessionType, childAge, coachId]);

  async function fetchSlots() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sessionType,
        days: '14',
      });
      
      if (childAge) params.append('childAge', String(childAge));
      if (coachId) params.append('coachId', coachId);

      const response = await fetch(`/api/scheduling/slots?${params}`);
      const data = await response.json();

      if (data.success) {
        setBuckets(data.slotsByBucket || []);
        setSlotsByDate(data.slotsByDate || {});
        setRecommendedBucket(data.summary?.recommendedBucket || '');
        setDurationMinutes(data.durationMinutes || 30);
      } else {
        setError(data.error || 'Failed to load available times');
      }
    } catch (err) {
      setError('Failed to load available times. Please try again.');
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  function getTodayISTString(): string {
    const now = new Date();
    const istMs = now.getTime() + (5.5 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000);
    const ist = new Date(istMs);
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function handleBucketSelect(bucket: TimeBucket) {
    if (bucket.totalSlots === 0) return;

    setSelectedBucket(bucket);

    // Find first future date with available slots in this bucket
    const todayIST = getTodayISTString();
    const dates = Object.keys(slotsByDate).filter(d => d >= todayIST).sort();
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

  // ============================================================================
  // HELPERS
  // ============================================================================

  function getAvailableDates(): string[] {
    if (!selectedBucket) return [];
    const todayIST = getTodayISTString();
    return Object.keys(slotsByDate)
      .filter(date => date >= todayIST && slotsByDate[date]?.some(s => s.bucketName === selectedBucket.name))
      .sort();
  }

  function getSlotsForSelectedDate(): TimeSlot[] {
    if (!selectedBucket || !selectedDate) return [];
    
    return (slotsByDate[selectedDate] || [])
      .filter(s => s.bucketName === selectedBucket.name)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getTotalAvailableSlots(): number {
    return buckets.reduce((sum, b) => sum + b.totalSlots, 0);
  }

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
        <Spinner size="xl" className="text-[#00ABFF] mb-4" />
        <p className="text-gray-400">Finding available times...</p>
      </div>
    );
  }

  // ============================================================================
  // RENDER - ERROR
  // ============================================================================

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
        <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-red-400 text-center mb-4">{error}</p>
        <button
          onClick={fetchSlots}
          className="px-4 py-2 bg-[#00ABFF] hover:bg-[#0095e0] text-white rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ============================================================================
  // RENDER - NO SLOTS
  // ============================================================================

  if (getTotalAvailableSlots() === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-center">
        <Calendar className="w-10 h-10 text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Available Times</h3>
        <p className="text-gray-400 mb-4">
          We're fully booked for the next 2 weeks. Please check back later or contact us directly.
        </p>
        <WhatsAppButton
          label="Contact on WhatsApp"
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 1: BUCKET SELECTION
  // ============================================================================

  if (step === 'bucket') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-white mb-1">
            When would you prefer?
          </h3>
          <p className="text-gray-400 text-sm">
            {sessionType === 'discovery' ? '30-minute' : `${durationMinutes}-minute`} session
          </p>
        </div>

        {/* Bucket Cards */}
        <div className="space-y-3">
          {buckets.map((bucket) => {
            const isRecommended = bucket.name === recommendedBucket;
            const hasSlots = bucket.totalSlots > 0;
            
            return (
              <button
                key={bucket.name}
                onClick={() => handleBucketSelect(bucket)}
                disabled={!hasSlots}
                className={`w-full p-4 rounded-xl border transition-all text-left relative ${
                  hasSlots
                    ? 'bg-[#1a1a24] border-gray-700 hover:border-[#00ABFF] hover:bg-[#1a1a24]/80 cursor-pointer'
                    : 'bg-gray-800/50 border-gray-800 cursor-not-allowed opacity-50'
                } ${isRecommended && hasSlots ? 'ring-2 ring-[#00ABFF]/50' : ''}`}
              >
                {/* Recommended Badge */}
                {isRecommended && hasSlots && (
                  <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 bg-[#00ABFF] text-white text-xs font-medium rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Best availability
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    {(() => { const Icon = BUCKET_ICONS[bucket.icon] || Clock; return <Icon className="w-6 h-6 text-[#00ABFF]" />; })()}
                    
                    {/* Details */}
                    <div>
                      <div className="font-medium text-white">
                        {bucket.displayName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {bucket.startHour > 12 
                          ? `${bucket.startHour - 12} PM` 
                          : bucket.startHour === 12 
                            ? '12 PM'
                            : `${bucket.startHour} AM`
                        }
                        {' - '}
                        {bucket.endHour > 12 
                          ? `${bucket.endHour - 12} PM` 
                          : bucket.endHour === 12 
                            ? '12 PM'
                            : `${bucket.endHour} AM`
                        }
                      </div>
                    </div>
                  </div>

                  {/* Slot Count */}
                  <div className="flex items-center gap-2">
                    <div className={`text-right ${hasSlots ? 'text-emerald-400' : 'text-gray-500'}`}>
                      <div className="text-lg font-bold">{bucket.totalSlots}</div>
                      <div className="text-xs">slots</div>
                    </div>
                    {hasSlots && (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Availability Bar */}
                {hasSlots && (
                  <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (bucket.totalSlots / 20) * 100)}%` 
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Total Slots Info */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {getTotalAvailableSlots()} slots available over the next 2 weeks
        </p>
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 2: SLOT SELECTION
  // ============================================================================

  const availableDates = getAvailableDates();
  const slotsForDate = getSlotsForSelectedDate();

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-700 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {(() => { const Icon = selectedBucket?.icon ? (BUCKET_ICONS[selectedBucket.icon] || Clock) : Clock; return <Icon className="w-5 h-5 text-[#00ABFF]" />; })()}
            {selectedBucket?.displayName}
          </h3>
          <p className="text-gray-400 text-sm">
            Select a specific time
          </p>
        </div>
      </div>

      {/* Date Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {availableDates.map((date) => {
          const slotsCount = (slotsByDate[date] || [])
            .filter(s => s.bucketName === selectedBucket?.name).length;

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl border transition-colors snap-start ${
                selectedDate === date
                  ? 'bg-[#00ABFF] border-[#00ABFF] text-white'
                  : 'bg-[#1a1a24] border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{formatDateRelative(date)}</div>
              <div className="text-xs opacity-75">{slotsCount} slots</div>
            </button>
          );
        })}
      </div>

      {/* Time Slots Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slotsForDate.map((slot) => {
          const isSelected = selectedSlot?.datetime === slot.datetime;
          
          return (
            <button
              key={slot.datetime}
              onClick={() => handleSlotSelect(slot)}
              className={`p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#00ABFF] border-[#00ABFF] text-white'
                  : 'bg-[#1a1a24] border-gray-700 text-white hover:border-[#00ABFF] hover:bg-[#1a1a24]/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {formatTime12(slot.time)}
                </div>
                {isSelected && (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <div className="text-xs opacity-75 mt-1">
                to {formatTime12(slot.endTime)}
              </div>
            </button>
          );
        })}
      </div>

      {/* No Slots Message */}
      {slotsForDate.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No slots available for this date
        </div>
      )}

      {/* Selected Slot Confirmation */}
      {selectedSlot && (
        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="font-medium text-white">
                {formatDateRelative(selectedSlot.date)} at {formatTime12(selectedSlot.time)}
              </div>
              <div className="text-sm text-emerald-400">
                {durationMinutes}-minute {sessionType} session
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
