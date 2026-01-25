// ============================================================
// LETS TALK PAGE - Discovery Call Booking
// File: app/lets-talk/page.tsx
// ============================================================
// Flow:
// 1. Parent fills form (name, email, phone, child info)
// 2. Selects time using FlightStyleSlotPicker (bucket → slot)
// 3. System assigns available coach (round-robin)
// 4. Success shows assigned coach name
// ============================================================

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle, Clock, Video, Heart, Award, MessageCircle,
  ArrowRight, Loader2, Calendar, Sparkles, Shield, Users,
  User, Phone, Mail, Baby, Brain, Eye, PhoneCall,
  ChevronLeft, Check, Target,
} from 'lucide-react';
import FlightStyleSlotPicker from '@/components/booking/FlightStyleSlotPicker';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';
import { LEARNING_GOALS } from '@/lib/constants/goals';
import { GoalIcon } from '@/components/shared/GoalIcon';

// ============================================================
// TYPES
// ============================================================

interface Slot {
  date: string;
  time: string;
  datetime: string;
  endTime: string;
  available: boolean;
  bucketName: string;
}

// ============================================================
// MAIN CONTENT
// ============================================================

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

  // Goals state - for GoalsCapture fallback
  const goalsParam = searchParams.get('goals') || '';
  const [goals, setGoals] = useState<string[]>(
    goalsParam ? goalsParam.split(',').filter(g => g in LEARNING_GOALS) : []
  );

  // Fetch child data if goals not in URL but childId exists
  useEffect(() => {
    const childId = formData.childId;
    if (childId && goals.length === 0) {
      fetch(`/api/children/${childId}`)
        .then(res => res.json())
        .then(data => {
          if (data.parent_goals?.length > 0) {
            setGoals(data.parent_goals);
          }
          // Also update age if missing
          if (data.age && !formData.childAge) {
            setFormData(prev => ({ ...prev, childAge: data.age.toString() }));
          }
        })
        .catch(console.error);
    }
  }, [formData.childId]);

  // Display name for child
  const displayChildName = formData.childName
    ? formData.childName.charAt(0).toUpperCase() + formData.childName.slice(1).toLowerCase()
    : 'Your Child';

  // Booking flow state
  const [step, setStep] = useState<'form' | 'slots' | 'success'>('form');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingResult, setBookingResult] = useState<{
    meetLink: string;
    date: string;
    time: string;
    coachName?: string;
  } | null>(null);

  const source = searchParams.get('source') || 'direct';
  const assessmentScore = searchParams.get('assessmentScore') ? parseInt(searchParams.get('assessmentScore')!) : null;

  // Build enroll URL with all context params
  const buildEnrollUrl = () => {
    const params = new URLSearchParams();

    if (formData.childId) params.set('childId', formData.childId);
    if (formData.childName) params.set('childName', formData.childName);
    if (formData.childAge) params.set('childAge', formData.childAge);
    if (formData.parentName) params.set('parentName', formData.parentName);
    if (formData.parentEmail) params.set('parentEmail', formData.parentEmail);
    if (formData.parentPhone) params.set('parentPhone', formData.parentPhone);
    if (assessmentScore) params.set('assessmentScore', assessmentScore.toString());
    if (goals.length > 0) params.set('goals', goals.join(','));
    params.set('source', 'lets-talk-skip');

    return `/enroll?${params.toString()}`;
  };

  // WhatsApp config
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to know more about Yestoryd's reading program${formData.childName ? ` for ${formData.childName}` : ''}.`
  );

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone
    const cleanPhone = formData.parentPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setStep('slots');
  };

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
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
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          childName: formData.childName,
          childAge: formData.childAge,
          childId: formData.childId || undefined,
          slotDate: selectedSlot.date,
          slotTime: selectedSlot.time,
          source: source || 'lets-talk',
          goals: goals.length > 0 ? goals : undefined,
        }),
      });

      const data = await res.json();

      if (data.code === 'ALREADY_BOOKED') {
        setError('You already have a discovery call scheduled. Check your email for details!');
        return;
      }

      if (data.success && data.booking) {
        // Booking successful
        setBookingResult({
          meetLink: data.booking.meetLink,
          date: formatDateDisplay(selectedSlot.date),
          time: formatTimeDisplay(selectedSlot.time),
          coachName: data.coach?.name || 'Our Reading Coach',
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

  // ============================================================
  // FORMATTERS
  // ============================================================

  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTimeDisplay = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-white">
      {/* Header */}
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
            <span className="hidden sm:inline">Reading Test - Free</span>
            <span className="sm:hidden">Reading Test</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">

          {/* ============================================================ */}
          {/* LEFT COLUMN - INFO */}
          {/* ============================================================ */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight mb-3">
              Let's Talk About{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                {formData.childName || 'Your Child'}
              </span>
            </h1>

            <p className="text-base text-gray-600 mb-5">
              A friendly 30-minute conversation to understand your child's needs:
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-6">
              {[
                { icon: Brain, text: 'Review the AI assessment findings together', color: '#00ABFF' },
                { icon: Heart, text: "Understand your child's unique learning style", color: '#FF0099' },
                { icon: Eye, text: 'See exactly how our coaching approach works', color: '#7B008B' },
                { icon: CheckCircle, text: "Get honest advice – even if we're not the right fit", color: '#22c55e' },
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

            {/* What Happens */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[#00ABFF]" />
                What Happens on This Call
              </h3>
              <div className="space-y-3">
                {[
                  { num: '1', text: "We review your child's assessment results" },
                  { num: '2', text: 'You share any concerns or goals' },
                  { num: '3', text: 'We explain how coaching would work for your child' },
                  { num: '4', text: "You decide if it's the right fit (no pressure!)" },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-[#ff0099] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {s.num}
                    </span>
                    <span className="text-gray-600 text-sm">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Card - GENERIC (not Rucha-specific) */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Our Reading Coaches</h3>
                  <p className="text-[#ff0099] font-medium text-sm">Certified Jolly Phonics Experts</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-[#00ABFF]" />
                  <span>30 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Video className="w-4 h-4 text-green-500" />
                  <span>Video call</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Heart className="w-4 h-4 text-[#ff0099]" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Award className="w-4 h-4 text-[#ffde00]" />
                  <span>5+ years exp.</span>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5 border-l-4 border-[#ff0099] rounded-r-xl p-4 mb-5">
              <p className="text-gray-600 italic text-sm">
                "If we're not the right fit, we'll honestly tell you and recommend other resources that might help."
              </p>
              <p className="text-[#ff0099] font-semibold text-sm mt-2">— Yestoryd Team</p>
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

          {/* ============================================================ */}
          {/* RIGHT COLUMN - BOOKING */}
          {/* ============================================================ */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">

              {/* STEP 1: FORM */}
              {step === 'form' && (
                <>
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Book Your Free Call
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Quick details so we can prepare</p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                    {/* GOALS SECTION - Show badges OR GoalsCapture fallback */}
                    {goals.length > 0 ? (
                      <div className="bg-gradient-to-r from-[#FF0099]/10 to-[#7b008b]/10 rounded-xl p-4 border border-pink-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-[#FF0099]" />
                          <p className="text-gray-700 font-semibold text-sm">
                            {displayChildName}&apos;s focus areas:
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {goals.map((goalId) => {
                            const goal = LEARNING_GOALS[goalId];
                            if (!goal) return null;
                            return (
                              <span
                                key={goalId}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 shadow-sm"
                              >
                                <GoalIcon goal={goal} className="w-4 h-4 text-[#FF0099]" />
                                {goal.shortLabel || goal.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : formData.childId ? (
                      <div className="bg-gradient-to-r from-[#FF0099]/10 to-[#7b008b]/10 rounded-xl p-4 border border-pink-200">
                        <GoalsCapture
                          childId={formData.childId}
                          childName={displayChildName}
                          childAge={formData.childAge ? parseInt(formData.childAge) : 7}
                          onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
                        />
                      </div>
                    ) : null}

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
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm"
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
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm"
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
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm"
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
                            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm"
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
                      className="w-full h-14 flex items-center justify-center gap-2 bg-[#FF0099] hover:bg-[#e6008a] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#ff0099]/20 mt-2"
                    >
                      <Calendar className="w-5 h-5" />
                      Choose a Time Slot
                      <ArrowRight className="w-5 h-5" />
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

                    {/* Secondary Option - Skip Discovery */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <p className="text-sm text-gray-500 text-center mb-3">
                        Already decided? Skip the call.
                      </p>
                      <Link
                        href={buildEnrollUrl()}
                        onClick={() => {
                          console.log(JSON.stringify({
                            event: 'skip_discovery_clicked',
                            childId: formData.childId,
                            assessmentScore,
                            source: 'lets-talk',
                            timestamp: new Date().toISOString(),
                          }));
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-[#FF0099]/10 to-[#00ABFF]/10 text-[#FF0099] font-medium hover:from-[#FF0099]/20 hover:to-[#00ABFF]/20 rounded-xl border border-[#FF0099]/30 transition-all duration-200"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>View Programs & Enroll</span>
                      </Link>
                    </div>
                  </form>
                </>
              )}

              {/* STEP 2: SLOT SELECTION (Flight-Style) */}
              {step === 'slots' && (
                <>
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Choose a Time
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
                    {/* Flight-Style Slot Picker */}
                    <FlightStyleSlotPicker
                      sessionType="discovery"
                      childAge={formData.childAge ? parseInt(formData.childAge) : undefined}
                      onSlotSelect={handleSlotSelect}
                      selectedSlot={selectedSlot}
                    />

                    {/* Error */}
                    {error && (
                      <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mt-4">{error}</p>
                    )}

                    {/* Confirm Button */}
                    {selectedSlot && (
                      <button
                        onClick={handleBooking}
                        disabled={loading}
                        className="w-full h-14 flex items-center justify-center gap-2 bg-[#FF0099] hover:bg-[#e6008a] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#ff0099]/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Booking...</>
                        ) : (
                          <><Check className="w-5 h-5" /> Confirm Booking</>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* STEP 3: SUCCESS - Shows assigned coach */}
              {step === 'success' && bookingResult && (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    You're All Set! 🎉
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Your discovery call with <span className="font-semibold text-[#ff0099]">{bookingResult.coachName}</span> is confirmed.
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

              {/* WhatsApp Alternative */}
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
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#FF0099] hover:bg-[#e6008a] text-white font-bold rounded-xl text-sm"
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

// ============================================================
// EXPORT WITH SUSPENSE
// ============================================================

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
