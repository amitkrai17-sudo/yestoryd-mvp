// =============================================================================
// REPLACE: app/lets-talk/LetsTalkClient.tsx
// PURPOSE: Native discovery booking (replaces Cal.com embed)
// CHANGES: Keeps all existing design, replaces only the calendar section
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MessageCircle, 
  CheckCircle, 
  Clock, 
  Heart, 
  Sparkles,
  ArrowRight,
  Calendar,
  Phone,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SiteSettings {
  [key: string]: string;
}

interface LetsTalkClientProps {
  settings: SiteSettings;
}

interface Slot {
  date: string;
  time: string;
  datetime: string;
  available: boolean;
}

export default function LetsTalkClient({ settings }: LetsTalkClientProps) {
  const searchParams = useSearchParams();
  
  const whatsappNumber = settings.whatsapp_number?.replace(/[^0-9]/g, '') || '918976287997';
  const calUsername = settings.cal_username || 'yestoryd';

  // Consultative messaging (keep existing)
  const pageTitle = settings.lets_talk_title || "Let's Talk About Your Child";
  const pageIntro = settings.lets_talk_intro || "This isn't a sales call. It's a conversation to:";
  const benefits = [
    settings.lets_talk_benefit_1 || "Understand your child's unique learning style",
    settings.lets_talk_benefit_2 || "Discuss the assessment findings in depth",
    settings.lets_talk_benefit_3 || "Explore what success looks like for your family",
    settings.lets_talk_benefit_4 || "See if our approach is the right fit"
  ];
  const coachPromise = settings.coach_promise || '"If we\'re not the right fit, I\'ll recommend other resources that might help."';
  const coachName = settings.default_coach_name || 'Rucha';
  const coachTitle = settings.default_coach_title || 'Founder & Lead Reading Coach';
  const coachExperience = settings.default_coach_experience || '10+ years';

  // =========================================================================
  // BOOKING STATE (NEW)
  // =========================================================================
  
  // Pre-fill from URL params (from assessment results)
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
    childId: searchParams.get('childId') || '',
  });

  const [step, setStep] = useState<'form' | 'slots' | 'success'>('form');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingResult, setBookingResult] = useState<{
    meetLink: string;
    date: string;
    time: string;
  } | null>(null);

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);
  
  const dates = Object.keys(slotsByDate).sort();
  const currentDateIndex = dates.indexOf(selectedDate);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const fetchSlots = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/discovery/slots');
      const data = await res.json();
      
      if (data.success && data.slots) {
        setSlots(data.slots);
        // Auto-select first date with available slots
        const firstAvailableDate = data.slots.find((s: Slot) => s.available)?.date;
        if (firstAvailableDate) {
          setSelectedDate(firstAvailableDate);
        } else if (data.slots.length > 0) {
          setSelectedDate(data.slots[0].date);
        }
        setStep('slots');
      } else {
        setError(data.error || 'Failed to load available times');
      }
    } catch (err) {
      setError('Failed to load available times. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.parentName || !formData.parentEmail || !formData.parentPhone || 
        !formData.childName || !formData.childAge) {
      setError('Please fill all fields');
      return;
    }
    
    // Validate phone
    const cleanPhone = formData.parentPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    
    fetchSlots();
  };

  const handleBooking = async () => {
    if (!selectedSlot) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/discovery/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          slotDate: selectedSlot.date,
          slotTime: selectedSlot.time,
          source: searchParams.get('source') || 'lets-talk',
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setBookingResult({
          meetLink: data.booking.meetLink,
          date: formatDateDisplay(selectedSlot.date),
          time: formatTimeDisplay(selectedSlot.time),
        });
        setStep('success');
      } else {
        setError(data.error || 'Booking failed. Please try again.');
      }
    } catch (err) {
      setError('Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format helpers
  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTimeDisplay = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const whatsappMessage = encodeURIComponent(
    `Hi Rucha! I'd like to schedule a conversation about my child${formData.childName ? ` ${formData.childName}` : ''}'s reading.`
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Navigation - UNCHANGED */}
      <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <Image 
                src="/images/logo.png" 
                alt="Yestoryd" 
                width={140} 
                height={40}
                className="h-8 lg:h-10 w-auto"
              />
            </Link>
            <Link 
              href="/assessment" 
              className="text-[#ff0099] font-medium hover:underline"
            >
              Take Free Assessment First →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Content - UNCHANGED */}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {pageTitle}
            </h1>
            
            <p className="text-xl text-gray-300 mb-8">
              {pageIntro}
            </p>

            {/* Benefits */}
            <ul className="space-y-4 mb-10">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#ff0099]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-[#ff0099]" />
                  </div>
                  <span className="text-lg text-gray-200">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Conversation Details */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center">
                  <span className="text-xl text-white font-bold">{coachName.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">{coachName}</h3>
                  <p className="text-gray-400">{coachTitle}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-[#00abff]" />
                  <span>20 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone className="w-4 h-4 text-[#00abff]" />
                  <span>Video call</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Heart className="w-4 h-4 text-[#ff0099]" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Sparkles className="w-4 h-4 text-[#7b008b]" />
                  <span>{coachExperience} experience</span>
                </div>
              </div>
            </div>

            {/* Coach Promise */}
            <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#00abff]/10 rounded-xl p-6 border border-gray-700">
              <blockquote className="text-gray-200 italic">
                {coachPromise}
              </blockquote>
              <p className="text-gray-400 mt-2 text-sm">— {coachName}, Founder</p>
            </div>
          </div>

          {/* Right Content - NATIVE BOOKING (REPLACED) */}
          <div className="bg-gray-800 rounded-3xl shadow-xl p-6 md:p-8 border border-gray-700">
            
            {/* ============================================================ */}
            {/* STEP 1: FORM */}
            {/* ============================================================ */}
            {step === 'form' && (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Book Your Free Call
                </h2>
                <p className="text-gray-400 mb-6">
                  Tell us about yourself and we'll find a time that works.
                </p>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        value={formData.parentName}
                        onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#ff0099] focus:border-transparent"
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={formData.parentPhone}
                        onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#ff0099] focus:border-transparent"
                        placeholder="9876543210"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.parentEmail}
                      onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#ff0099] focus:border-transparent"
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Child's Name *
                      </label>
                      <input
                        type="text"
                        value={formData.childName}
                        onChange={e => setFormData({ ...formData, childName: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#ff0099] focus:border-transparent"
                        placeholder="Child's name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Age *
                      </label>
                      <select
                        value={formData.childAge}
                        onChange={e => setFormData({ ...formData, childAge: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#ff0099] focus:border-transparent"
                        required
                      >
                        <option value="">Select</option>
                        {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(age => (
                          <option key={age} value={age}>{age} years</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {error && (
                    <p className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">{error}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#ff0099] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e0087f] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                    ) : (
                      <>Choose a Time <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>

                {/* WhatsApp Alternative */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <p className="text-gray-400 text-center mb-4">
                    Prefer to message directly?
                  </p>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#25d366] text-white py-3 rounded-full font-medium hover:bg-[#20bd5a] transition-all"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Message on WhatsApp
                  </a>
                </div>
              </>
            )}

            {/* ============================================================ */}
            {/* STEP 2: SLOT SELECTION */}
            {/* ============================================================ */}
            {step === 'slots' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Choose a Time
                    </h2>
                    <p className="text-gray-400 text-sm">
                      for {formData.childName}
                    </p>
                  </div>
                  <button
                    onClick={() => { setStep('form'); setSelectedSlot(null); }}
                    className="text-[#ff0099] text-sm hover:underline flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSelectedDate(dates[Math.max(0, currentDateIndex - 1)])}
                    disabled={currentDateIndex <= 0}
                    className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-2 pb-2">
                      {dates.slice(0, 7).map(date => {
                        const hasAvailable = slotsByDate[date]?.some(s => s.available);
                        return (
                          <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              selectedDate === date
                                ? 'bg-[#ff0099] text-white'
                                : hasAvailable
                                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                : 'bg-gray-700/50 text-gray-500'
                            }`}
                          >
                            {formatDateShort(date)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedDate(dates[Math.min(dates.length - 1, currentDateIndex + 1)])}
                    disabled={currentDateIndex >= dates.length - 1}
                    className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Time Slots */}
                <div className="grid grid-cols-3 gap-2 mb-6 max-h-[280px] overflow-y-auto pr-2">
                  {slotsByDate[selectedDate]?.map(slot => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      onClick={() => slot.available && setSelectedSlot(slot)}
                      disabled={!slot.available}
                      className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
                        !slot.available
                          ? 'bg-gray-700/30 text-gray-600 cursor-not-allowed'
                          : selectedSlot?.datetime === slot.datetime
                          ? 'bg-[#ff0099] text-white ring-2 ring-[#ff0099] ring-offset-2 ring-offset-gray-800'
                          : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      }`}
                    >
                      {formatTimeDisplay(slot.time)}
                    </button>
                  ))}
                </div>

                {/* Selected Time Summary */}
                {selectedSlot && (
                  <div className="bg-gray-700/50 rounded-xl p-4 mb-4">
                    <p className="text-gray-400 text-sm mb-1">Selected time:</p>
                    <p className="text-white font-medium">
                      {formatDateDisplay(selectedSlot.date)} at {formatTimeDisplay(selectedSlot.time)}
                    </p>
                  </div>
                )}
                
                {error && (
                  <p className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg mb-4">{error}</p>
                )}
                
                <button
                  onClick={handleBooking}
                  disabled={!selectedSlot || loading}
                  className="w-full bg-[#ff0099] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e0087f] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Booking...</>
                  ) : (
                    <>Confirm Booking <Check className="w-5 h-5" /></>
                  )}
                </button>
              </>
            )}

            {/* ============================================================ */}
            {/* STEP 3: SUCCESS */}
            {/* ============================================================ */}
            {step === 'success' && bookingResult && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">
                  You're All Set! 🎉
                </h2>
                
                <p className="text-gray-400 mb-6">
                  Your discovery call with {coachName} is confirmed.
                </p>
                
                <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-6 text-gray-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      <span>{bookingResult.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#ff0099]" />
                      <span>{bookingResult.time}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-400 text-sm mb-6">
                  You'll receive a confirmation on WhatsApp with the Google Meet link.
                </p>
                
                {bookingResult.meetLink && (
                  <a
                    href={bookingResult.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#ff0099] text-white px-6 py-3 rounded-full font-medium hover:bg-[#e0087f] transition-all"
                  >
                    <Calendar className="w-5 h-5" />
                    Add to Calendar
                  </a>
                )}
                
                <div className="mt-8 pt-6 border-t border-gray-700">
                  <Link 
                    href="/"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Note - UNCHANGED */}
        <div className="text-center mt-16">
          <p className="text-gray-400">
            Haven't taken the assessment yet?{' '}
            <Link href="/assessment" className="text-[#ff0099] font-medium hover:underline">
              Start with the free 5-minute assessment
            </Link>
            {' '}to get personalized insights before we talk.
          </p>
        </div>
      </div>
    </div>
  );
}
