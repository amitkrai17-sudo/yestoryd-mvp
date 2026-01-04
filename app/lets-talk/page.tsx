'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  Clock,
  Video,
  Heart,
  Award,
  MessageCircle,
  ArrowRight,
  Loader2,
  Calendar,
  Sparkles,
  Shield,
  Users,
  User,
  Phone,
  Mail,
  Baby,
  Brain,
  Eye,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

// Slot type for native booking
interface Slot {
  date: string;
  time: string;
  datetime: string;
  available: boolean;
}

function LetsTalkContent() {
  const searchParams = useSearchParams();
  
  // Form state - pre-fill from URL params
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
    childId: searchParams.get('childId') || '',
  });
  
  // Booking flow state
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

  const source = searchParams.get('source') || 'direct';

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);
  
  const dates = Object.keys(slotsByDate).sort();
  const currentDateIndex = dates.indexOf(selectedDate);

  // WhatsApp
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to know more about Yestoryd's reading program${formData.childName ? ` for ${formData.childName}` : ''}.`
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Fetch available slots
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
        setError(data.error || 'Failed to load available times. Please try again.');
      }
    } catch (err) {
      setError('Failed to load available times. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Form submit - validate and fetch slots
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate phone
    const cleanPhone = formData.parentPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    
    fetchSlots();
  };

  // Book the selected slot
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
          source: source || 'lets-talk',
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
    const d = new Date(dateStr + 'T00:00:00');
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  };

  const formatTimeDisplay = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-white">
      {/* Header - UNCHANGED */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image 
              src="/images/logo.png" 
              alt="Yestoryd" 
              width={120} 
              height={36}
              className="h-8 w-auto"
            />
          </Link>
          <Link 
            href="/assessment"
            className="text-sm font-semibold text-[#ff0099] hover:text-[#e6008a] transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Take Free Assessment</span>
            <span className="sm:hidden">Free Test</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
          
          {/* Left Column - Info - UNCHANGED */}
          <div>
            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight mb-3">
              Let's Talk About{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                {formData.childName || 'Your Child'}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base text-gray-600 mb-5">
              A friendly 30-minute conversation to understand your child's needs:
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-6">
              {[
                { icon: Brain, text: 'Review the AI assessment findings together', color: '#00ABFF' },
                { icon: Heart, text: 'Understand your child\'s unique learning style', color: '#FF0099' },
                { icon: Eye, text: 'See exactly how our coaching approach works', color: '#7B008B' },
                { icon: CheckCircle, text: 'Get honest advice — even if we\'re not the right fit', color: '#22c55e' },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-gray-700 text-sm pt-1">{item.text}</span>
                </div>
              ))}
            </div>

            {/* What Happens on This Call */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[#00ABFF]" />
                What Happens on This Call
              </h3>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'We review your child\'s assessment results' },
                  { num: '2', text: 'You share any concerns or goals' },
                  { num: '3', text: 'We explain how coaching would work for your child' },
                  { num: '4', text: 'You decide if it\'s the right fit (no pressure!)' },
                ].map((step) => (
                  <div key={step.num} className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-[#ff0099] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {step.num}
                    </span>
                    <span className="text-gray-600 text-sm">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Card */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  R
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Rucha</h3>
                  <p className="text-[#ff0099] font-medium text-sm">Founder & Lead Reading Coach</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-[#00ABFF]" />
                  <span>30 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Video className="w-4 h-4 text-green-500" />
                  <span>Video or phone</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Heart className="w-4 h-4 text-[#ff0099]" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Award className="w-4 h-4 text-[#ffde00]" />
                  <span>7 years exp.</span>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5 border-l-4 border-[#ff0099] rounded-r-xl p-4 mb-5">
              <p className="text-gray-600 italic text-sm">
                "If we're not the right fit, I'll honestly tell you and recommend other resources that might help."
              </p>
              <p className="text-[#ff0099] font-semibold text-sm mt-2">— Rucha, Founder</p>
            </div>

            {/* Social Proof */}
            <div className="bg-white rounded-xl p-4 flex items-center justify-center gap-3 border border-gray-200">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff0099] to-[#7b008b] border-2 border-white" />
                ))}
              </div>
              <span className="text-gray-600 text-sm">
                <span className="text-gray-900 font-bold">100+</span> families helped
              </span>
            </div>
          </div>

          {/* Right Column - Form & Booking */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              
              {/* ============================================================ */}
              {/* STEP 1: FORM */}
              {/* ============================================================ */}
              {step === 'form' && (
                <>
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Book Your Free Call
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Quick details so we can prepare
                    </p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                    {/* Parent Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          name="parentName"
                          value={formData.parentName}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter your name"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          name="parentEmail"
                          value={formData.parentEmail}
                          onChange={handleInputChange}
                          required
                          placeholder="your@email.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          name="parentPhone"
                          value={formData.parentPhone}
                          onChange={handleInputChange}
                          required
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Child Name & Age */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Child's Name</label>
                        <div className="relative">
                          <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            name="childName"
                            value={formData.childName}
                            onChange={handleInputChange}
                            required
                            placeholder="Child's name"
                            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        >
                          <option value="">Select</option>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                            <option key={age} value={age}>{age} yrs</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Error */}
                    {error && (
                      <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 flex items-center justify-center gap-2 bg-[#e6008a] hover:bg-[#d10080] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#ff0099]/20 mt-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                      ) : (
                        <>
                          <Calendar className="w-5 h-5" />
                          Choose a Time Slot
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-green-500" />
                        100% Free
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00ABFF]" />
                        30 min
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#ff0099]" />
                        No obligation
                      </span>
                    </div>
                  </form>
                </>
              )}

              {/* ============================================================ */}
              {/* STEP 2: SLOT SELECTION (NATIVE - replaces Cal.com) */}
              {/* ============================================================ */}
              {step === 'slots' && (
                <>
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Choose a Time That Works
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Select a slot for {formData.childName}'s discovery call
                    </p>
                    <button 
                      onClick={() => { setStep('form'); setSelectedSlot(null); setError(''); }}
                      className="text-[#ff0099] text-xs mt-2 hover:underline flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Edit details
                    </button>
                  </div>

                  <div className="p-4">
                    {/* Date Selector - Horizontal scrollable */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Select Date</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {dates.slice(0, 10).map(date => {
                          const { day, date: dateNum, month } = formatDateShort(date);
                          const hasAvailable = slotsByDate[date]?.some(s => s.available);
                          const isSelected = selectedDate === date;
                          
                          return (
                            <button
                              key={date}
                              onClick={() => setSelectedDate(date)}
                              disabled={!hasAvailable}
                              className={`flex-shrink-0 w-16 py-3 rounded-xl text-center transition-all ${
                                isSelected
                                  ? 'bg-[#ff0099] text-white shadow-lg shadow-[#ff0099]/30'
                                  : hasAvailable
                                  ? 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
                              }`}
                            >
                              <div className="text-xs font-medium">{day}</div>
                              <div className="text-lg font-bold">{dateNum}</div>
                              <div className="text-xs">{month}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slots Grid */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Select Time</p>
                      <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                        {slotsByDate[selectedDate]?.map(slot => {
                          const isSelected = selectedSlot?.datetime === slot.datetime;
                          
                          return (
                            <button
                              key={`${slot.date}-${slot.time}`}
                              onClick={() => slot.available && setSelectedSlot(slot)}
                              disabled={!slot.available}
                              className={`py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                                !slot.available
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#ff0099] text-white shadow-lg shadow-[#ff0099]/30'
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                              }`}
                            >
                              {formatTimeDisplay(slot.time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Summary */}
                    {selectedSlot && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                        <p className="text-green-800 text-sm font-medium flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          {formatDateDisplay(selectedSlot.date)} at {formatTimeDisplay(selectedSlot.time)}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
                    )}

                    {/* Confirm Button */}
                    <button
                      onClick={handleBooking}
                      disabled={!selectedSlot || loading}
                      className="w-full h-14 flex items-center justify-center gap-2 bg-[#e6008a] hover:bg-[#d10080] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#ff0099]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Booking...</>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Confirm Booking
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* ============================================================ */}
              {/* STEP 3: SUCCESS */}
              {/* ============================================================ */}
              {step === 'success' && bookingResult && (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    You're All Set! 🎉
                  </h2>
                  
                  <p className="text-gray-600 mb-4">
                    Your discovery call with Rucha is confirmed.
                  </p>
                  
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-center gap-4 text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#ff0099]" />
                        <span className="font-medium">{bookingResult.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#ff0099]" />
                        <span className="font-medium">{bookingResult.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-500 text-sm mb-4">
                    You'll receive a confirmation on WhatsApp with the Google Meet link.
                  </p>
                  
                  {bookingResult.meetLink && (
                    <a
                      href={bookingResult.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#ff0099] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#e6008a] transition-all"
                    >
                      <Calendar className="w-5 h-5" />
                      Add to Calendar
                    </a>
                  )}
                  
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <Link 
                      href="/"
                      className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
                    >
                      ← Back to Home
                    </Link>
                  </div>
                </div>
              )}

              {/* WhatsApp Alternative - Always visible */}
              {step !== 'success' && (
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <p className="text-center text-gray-500 text-xs mb-2">
                    Prefer to message directly?
                  </p>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message on WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40 shadow-lg">
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 w-14 flex items-center justify-center bg-[#25d366] text-white rounded-xl flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#e6008a] text-white font-bold rounded-xl text-sm"
          >
            <Calendar className="w-4 h-4" />
            Book Free Call
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}

export default function LetsTalkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFF5F9] to-white">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff0099]" />
      </div>
    }>
      <LetsTalkContent />
    </Suspense>
  );
}
