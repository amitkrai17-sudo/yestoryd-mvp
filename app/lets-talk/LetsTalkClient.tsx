'use client';

// ============================================================================
// LETS TALK CLIENT - Discovery Call Booking Page
// app/lets-talk/LetsTalkClient.tsx
// ============================================================================
// 
// Flow:
// 1. Parent fills in details (name, email, phone, child info)
// 2. Selects time slot using flight-style picker
// 3. Confirms booking
// 4. Receives confirmation email & WhatsApp
//
// Uses:
// - /api/scheduling/slots for availability
// - /api/discovery/book for booking
//
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Mail, 
  User, 
  Baby, 
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  Video
} from 'lucide-react';
import SlotPicker from '@/components/booking/SlotPicker';

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

interface FormData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: string;
  concerns: string;
}

type Step = 'details' | 'schedule' | 'confirm' | 'success';

// ============================================================================
// COMPONENT
// ============================================================================

export default function LetsTalkClient() {
  // State
  const [step, setStep] = useState<Step>('details');
  const [formData, setFormData] = useState<FormData>({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    childName: '',
    childAge: '',
    concerns: '',
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Form validation
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function validateDetails(): boolean {
    const newErrors: Partial<FormData> = {};

    if (!formData.parentName.trim()) {
      newErrors.parentName = 'Name is required';
    }

    if (!formData.parentEmail.trim()) {
      newErrors.parentEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
      newErrors.parentEmail = 'Invalid email address';
    }

    if (!formData.parentPhone.trim()) {
      newErrors.parentPhone = 'Phone is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.parentPhone.replace(/\D/g, ''))) {
      newErrors.parentPhone = 'Invalid phone number';
    }

    if (!formData.childName.trim()) {
      newErrors.childName = "Child's name is required";
    }

    if (!formData.childAge) {
      newErrors.childAge = "Child's age is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  function handleInputChange(field: keyof FormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  function handleDetailsSubmit() {
    if (validateDetails()) {
      setStep('schedule');
    }
  }

  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
  }

  function handleScheduleSubmit() {
    if (selectedSlot) {
      setStep('confirm');
    }
  }

  async function handleConfirmBooking() {
    if (!selectedSlot) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/discovery/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: formData.parentName.trim(),
          parentEmail: formData.parentEmail.toLowerCase().trim(),
          parentPhone: formData.parentPhone.replace(/\D/g, ''),
          childName: formData.childName.trim(),
          childAge: parseInt(formData.childAge),
          concerns: formData.concerns.trim() || undefined,
          slotDate: selectedSlot.date,
          slotTime: selectedSlot.time,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBookingResult(data);
        setStep('success');
      } else {
        setError(data.error || 'Booking failed. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  // ============================================================================
  // RENDER - STEP INDICATOR
  // ============================================================================

  function renderStepIndicator() {
    const steps = [
      { id: 'details', label: 'Details' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'confirm', label: 'Confirm' },
    ];

    if (step === 'success') return null;

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, index) => {
          const isActive = s.id === step;
          const isPast = steps.findIndex(st => st.id === step) > index;

          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-[#00ABFF] text-white' 
                    : isPast 
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                }`}>
                  {isPast ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                <span className={`text-sm hidden sm:inline ${
                  isActive ? 'text-white font-medium' : 'text-gray-500'
                }`}>
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 ${
                  isPast ? 'bg-emerald-500' : 'bg-gray-700'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 1: DETAILS
  // ============================================================================

  function renderDetailsStep() {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Book a Free Discovery Call
          </h2>
          <p className="text-gray-400">
            30-minute video call with our reading expert
          </p>
        </div>

        {/* Parent Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#00ABFF]" />
            Your Details
          </h3>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Your Name *</label>
            <input
              type="text"
              value={formData.parentName}
              onChange={(e) => handleInputChange('parentName', e.target.value)}
              placeholder="Enter your full name"
              className={`w-full p-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none ${
                errors.parentName ? 'border-red-500' : 'border-gray-700 focus:border-[#00ABFF]'
              }`}
            />
            {errors.parentName && (
              <p className="text-red-400 text-sm mt-1">{errors.parentName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Email *</label>
            <input
              type="email"
              value={formData.parentEmail}
              onChange={(e) => handleInputChange('parentEmail', e.target.value)}
              placeholder="your@email.com"
              className={`w-full p-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none ${
                errors.parentEmail ? 'border-red-500' : 'border-gray-700 focus:border-[#00ABFF]'
              }`}
            />
            {errors.parentEmail && (
              <p className="text-red-400 text-sm mt-1">{errors.parentEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Phone (WhatsApp) *</label>
            <div className="flex">
              <span className="px-3 py-3 bg-gray-700 border border-r-0 border-gray-700 rounded-l-lg text-gray-400">
                +91
              </span>
              <input
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                placeholder="9876543210"
                maxLength={10}
                className={`flex-1 p-3 bg-gray-800 border rounded-r-lg text-white placeholder-gray-500 focus:outline-none ${
                  errors.parentPhone ? 'border-red-500' : 'border-gray-700 focus:border-[#00ABFF]'
                }`}
              />
            </div>
            {errors.parentPhone && (
              <p className="text-red-400 text-sm mt-1">{errors.parentPhone}</p>
            )}
          </div>
        </div>

        {/* Child Details */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Baby className="w-5 h-5 text-[#00ABFF]" />
            Child's Details
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Child's Name *</label>
              <input
                type="text"
                value={formData.childName}
                onChange={(e) => handleInputChange('childName', e.target.value)}
                placeholder="Enter name"
                className={`w-full p-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none ${
                  errors.childName ? 'border-red-500' : 'border-gray-700 focus:border-[#00ABFF]'
                }`}
              />
              {errors.childName && (
                <p className="text-red-400 text-sm mt-1">{errors.childName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Age *</label>
              <select
                value={formData.childAge}
                onChange={(e) => handleInputChange('childAge', e.target.value)}
                className={`w-full p-3 bg-gray-800 border rounded-lg text-white focus:outline-none ${
                  errors.childAge ? 'border-red-500' : 'border-gray-700 focus:border-[#00ABFF]'
                }`}
              >
                <option value="">Select</option>
                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(age => (
                  <option key={age} value={age}>{age} years</option>
                ))}
              </select>
              {errors.childAge && (
                <p className="text-red-400 text-sm mt-1">{errors.childAge}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Any specific concerns? (optional)
            </label>
            <textarea
              value={formData.concerns}
              onChange={(e) => handleInputChange('concerns', e.target.value)}
              placeholder="E.g., difficulty with phonics, slow reading speed..."
              rows={3}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#00ABFF] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleDetailsSubmit}
          className="w-full py-4 bg-[#00ABFF] hover:bg-[#0095e0] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Continue to Schedule
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 2: SCHEDULE
  // ============================================================================

  function renderScheduleStep() {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setStep('details')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to details
        </button>

        {/* Slot Picker */}
        <SlotPicker
          sessionType="discovery"
          childAge={formData.childAge ? parseInt(formData.childAge) : undefined}
          onSlotSelect={handleSlotSelect}
          selectedSlot={selectedSlot}
        />

        {/* Continue Button */}
        {selectedSlot && (
          <button
            onClick={handleScheduleSubmit}
            className="w-full py-4 bg-[#00ABFF] hover:bg-[#0095e0] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Continue to Confirm
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 3: CONFIRM
  // ============================================================================

  function renderConfirmStep() {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setStep('schedule')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Change time
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            Confirm Your Booking
          </h2>
          <p className="text-gray-400">
            Please review your details before confirming
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-[#1a1a24] border border-gray-700 rounded-xl overflow-hidden">
          {/* Session Details */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-[#00ABFF]" />
              Session Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-white">
                  {selectedSlot && formatDate(selectedSlot.date)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-white">
                  {selectedSlot && `${formatTime(selectedSlot.time)} - ${formatTime(selectedSlot.endTime)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Parent Details */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-[#00ABFF]" />
              Your Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white">{formData.parentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{formData.parentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phone</span>
                <span className="text-white">+91 {formData.parentPhone}</span>
              </div>
            </div>
          </div>

          {/* Child Details */}
          <div className="p-4">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <Baby className="w-5 h-5 text-[#00ABFF]" />
              Child's Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white">{formData.childName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Age</span>
                <span className="text-white">{formData.childAge} years</span>
              </div>
              {formData.concerns && (
                <div>
                  <span className="text-gray-400 block mb-1">Concerns</span>
                  <span className="text-white">{formData.concerns}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirmBooking}
          disabled={loading}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Confirm Booking
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-500">
          By confirming, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    );
  }

  // ============================================================================
  // RENDER - STEP 4: SUCCESS
  // ============================================================================

  function renderSuccessStep() {
    return (
      <div className="text-center space-y-6">
        {/* Success Animation */}
        <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Booking Confirmed! 🎉
          </h2>
          <p className="text-gray-400">
            We've sent confirmation details to your email and WhatsApp
          </p>
        </div>

        {/* Booking Summary */}
        <div className="bg-[#1a1a24] border border-emerald-500/30 rounded-xl p-6 text-left">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="font-medium text-white">
                {selectedSlot && formatDate(selectedSlot.date)}
              </div>
              <div className="text-emerald-400">
                {selectedSlot && `${formatTime(selectedSlot.time)} - ${formatTime(selectedSlot.endTime)} IST`}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Video className="w-4 h-4" />
              30-minute video call with reading expert
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Mail className="w-4 h-4" />
              Calendar invite sent to {formData.parentEmail}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Phone className="w-4 h-4" />
              WhatsApp reminder will be sent to +91 {formData.parentPhone}
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-[#1a1a24] border border-gray-700 rounded-xl p-6 text-left">
          <h3 className="font-medium text-white mb-3">What to Expect</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">1.</span>
              You'll receive a Google Meet link in your email
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">2.</span>
              We'll discuss your child's reading journey
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">3.</span>
              Get a free AI reading assessment during the call
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">4.</span>
              Receive personalized recommendations
            </li>
          </ul>
        </div>

        {/* CTA */}
        <a
          href="/"
          className="block w-full py-4 bg-[#00ABFF] hover:bg-[#0095e0] text-white font-medium rounded-xl transition-colors text-center"
        >
          Back to Home
        </a>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-6">
          {step === 'details' && renderDetailsStep()}
          {step === 'schedule' && renderScheduleStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'success' && renderSuccessStep()}
        </div>

        {/* Trust Badges */}
        {step !== 'success' && (
          <div className="mt-6 flex items-center justify-center gap-4 text-gray-500 text-sm">
            <span>🔒 Secure booking</span>
            <span>•</span>
            <span>✨ Free consultation</span>
          </div>
        )}
      </div>
    </div>
  );
}
