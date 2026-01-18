// ============================================================
// FILE: app/parent/book-skill-booster/[sessionId]/page.tsx
// PURPOSE: Parent books skill booster session slot
// V2: Two-step date/time picker with "Skill Booster" branding
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, Clock, Sparkles, Check, Loader2,
  ArrowLeft, AlertCircle, CheckCircle, Video,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react';

// 4-Point Star Icon Component (Yestoryd branding)
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

// Focus area labels mapping
const FOCUS_AREA_LABELS: Record<string, string> = {
  phonics: 'Phonics & Decoding',
  fluency: 'Reading Fluency',
  vocabulary: 'Vocabulary Building',
  comprehension: 'Reading Comprehension',
  grammar: 'Grammar & Sentence Structure',
  writing: 'Writing Skills',
  spelling: 'Spelling Practice',
  general: 'General Reading Support'
};

interface SessionData {
  id: string;
  childName: string;
  coachName: string;
  focusArea: string;
  focusAreaLabel: string;
  coachNotes?: string;
}

interface TimeSlot {
  datetime: string;
  date: string;
  time: string;
  dateLabel: string;
  timeLabel: string;
  dayOfWeek: string;
  dayShort: string;
  dayNum: string;
  monthShort: string;
}

// Helper to format date nicely
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-IN', options);
}

// Helper to format time nicely (24h to 12h)
function formatTimeLabel(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Helper to get day of week
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
}

// Helper to get short day
function getDayShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'short' });
}

// Helper to get day number
function getDayNum(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate().toString();
}

// Helper to get month short
function getMonthShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { month: 'short' });
}

export default function BookSkillBoosterPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [meetLink, setMeetLink] = useState('');

  useEffect(() => {
    fetchSessionAndSlots();
  }, [sessionId]);

  const fetchSessionAndSlots = async () => {
    try {
      const response = await fetch(`/api/skill-booster/${sessionId}/booking-options`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load booking options');
      }

      const data = await response.json();
      
      // Transform session data
      const transformedSession: SessionData = {
        id: data.session?.id || sessionId,
        childName: data.child?.name || 'Your Child',
        coachName: data.coach?.name || 'Coach',
        focusArea: data.session?.focus_area || 'general',
        focusAreaLabel: FOCUS_AREA_LABELS[data.session?.focus_area] || 'Reading Support',
        coachNotes: data.session?.coach_notes || undefined
      };
      
      // Transform slots with extra date info
      const transformedSlots: TimeSlot[] = (data.availableSlots || []).map((slot: any) => ({
        datetime: slot.datetime,
        date: slot.date,
        time: slot.time,
        dateLabel: formatDateLabel(slot.date),
        timeLabel: formatTimeLabel(slot.time),
        dayOfWeek: getDayOfWeek(slot.date),
        dayShort: getDayShort(slot.date),
        dayNum: getDayNum(slot.date),
        monthShort: getMonthShort(slot.date)
      }));

      setSessionData(transformedSession);
      setAvailableSlots(transformedSlots);
      
      // Auto-select first date
      if (transformedSlots.length > 0) {
        setSelectedDate(transformedSlots[0].date);
      }
    } catch (err: any) {
      console.error('Failed to fetch booking options:', err);
      setError(err.message || 'Failed to load booking options');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot) return;

    setIsBooking(true);
    setError('');

    try {
      const response = await fetch('/api/skill-booster/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          selectedSlot
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      setBookingSuccess(true);
      setMeetLink(data.meetLink);

    } catch (err: any) {
      setError(err.message || 'Failed to book session. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  // Get unique dates
  const uniqueDates = Array.from(new Set(availableSlots.map(s => s.date)));
  
  // Get slots for selected date
  const slotsForSelectedDate = availableSlots.filter(s => s.date === selectedDate);
  
  // Get display info for selected date
  const selectedDateInfo = availableSlots.find(s => s.date === selectedDate);

  // Handle date selection (reset time selection)
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available slots...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Success State
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-lg">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Booked! 🎉</h2>
          <p className="text-gray-500 mb-6">
            Your Skill Booster session for {sessionData?.childName} has been confirmed.
            You'll receive a confirmation on WhatsApp.
          </p>

          {meetLink && (
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-medium mb-4 w-full justify-center"
            >
              <Video className="w-5 h-5" />
              Save Meet Link
            </a>
          )}

          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium w-full justify-center hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/parent/dashboard"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-lg flex items-center justify-center">
                <StarIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Yestoryd</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Page Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-yellow-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Book Skill Booster Session
          </h1>
          <p className="text-gray-500 text-sm">
            For <span className="font-medium text-gray-700">{sessionData?.childName}</span> with Coach <span className="font-medium text-gray-700">{sessionData?.coachName}</span>
          </p>
        </div>

        {/* Focus Area Card - Compact */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#7b008b]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-[#7b008b]" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Session Focus</p>
              <p className="font-semibold text-gray-900">
                {sessionData?.focusAreaLabel}
              </p>
            </div>
          </div>
        </div>

        {/* STEP 1: Date Selection - Horizontal Scroll */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[#7b008b]" />
              Step 1: Pick a Date
            </h2>
          </div>
          
          <div className="p-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {uniqueDates.map((date) => {
                const dateInfo = availableSlots.find(s => s.date === date);
                const isSelected = selectedDate === date;
                
                return (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`flex-shrink-0 w-16 py-3 rounded-xl border-2 transition-all text-center
                      ${isSelected
                        ? 'border-[#7b008b] bg-[#7b008b] text-white'
                        : 'border-gray-200 hover:border-[#7b008b]/50 bg-white'
                      }`}
                  >
                    <p className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {dateInfo?.dayShort}
                    </p>
                    <p className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {dateInfo?.dayNum}
                    </p>
                    <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                      {dateInfo?.monthShort}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 2: Time Selection - Grid for Selected Date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#7b008b]" />
              Step 2: Pick a Time
            </h2>
            {selectedDateInfo && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {selectedDateInfo.dateLabel}
              </span>
            )}
          </div>

          {slotsForSelectedDate.length === 0 ? (
            <div className="p-6 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No slots available</p>
            </div>
          ) : (
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {slotsForSelectedDate.map((slot) => {
                  const isSelected = selectedSlot === slot.datetime;
                  
                  return (
                    <button
                      key={slot.datetime}
                      onClick={() => setSelectedSlot(slot.datetime)}
                      className={`h-12 rounded-xl border-2 transition-all relative
                        ${isSelected
                          ? 'border-[#7b008b] bg-[#7b008b]/5'
                          : 'border-gray-200 hover:border-[#7b008b]/50'
                        }`}
                    >
                      <span className={`font-semibold text-sm ${
                        isSelected ? 'text-[#7b008b]' : 'text-gray-700'
                      }`}>
                        {slot.timeLabel}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#7b008b] absolute top-1 right-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Summary */}
        {selectedSlot && selectedDateInfo && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <span className="font-medium">Selected:</span>{' '}
              {availableSlots.find(s => s.datetime === selectedSlot)?.dateLabel} at{' '}
              {availableSlots.find(s => s.datetime === selectedSlot)?.timeLabel}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Book Button */}
        <button
          onClick={handleBook}
          disabled={!selectedSlot || isBooking}
          className="w-full py-4 px-6 bg-gradient-to-r from-[#ff0099] to-[#7b008b]
                   text-white font-semibold rounded-xl hover:opacity-90
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all
                   flex items-center justify-center gap-2 shadow-lg shadow-[#ff0099]/20"
        >
          {isBooking ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Confirm Booking
            </>
          )}
        </button>

        {/* Free Notice */}
        <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
          Included in your program at no extra cost
        </p>
      </main>
    </div>
  );
}
