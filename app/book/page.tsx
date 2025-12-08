'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Video,
  Loader2,
  Sparkles
} from 'lucide-react';

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childNameParam = searchParams.get('childName') || '';
  const assessmentId = searchParams.get('assessmentId') || '';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [meetLink, setMeetLink] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    childName: childNameParam,
    selectedDate: '',
    selectedTime: '',
    notes: '',
  });

  // Generate next 14 days for date selection (IST)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip Sundays (0 = Sunday)
      if (date.getDay() !== 0) {
        dates.push(date);
      }
    }
    return dates;
  };

  const availableDates = getAvailableDates();

  const formatDateISO = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assessmentId,
          coachId: 'coach_rucha',
          coachName: 'Rucha Rai',
          coachEmail: 'rucha@yestoryd.com',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMeetLink(result.meetLink || '');
        setBookingComplete(true);
      } else {
        setError(result.error || 'Failed to create booking. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = formData.parentName && formData.parentEmail && formData.parentPhone && formData.childName;
  const isStep2Valid = formData.selectedDate && formData.selectedTime;

  // Success Screen
  if (bookingComplete) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-xl mx-auto border border-gray-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Nunito, sans-serif' }}>
          Booking Confirmed! 🎉
        </h1>
        <p className="text-gray-600 mb-6">
          Your free consultation session has been scheduled with <strong>Rucha Rai</strong>.
        </p>
        
        <div className="bg-[#FAFAF9] rounded-2xl p-6 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-4">Session Details:</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#1E88E5]" />
              <span className="text-gray-800">{new Date(formData.selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#1E88E5]" />
              <span className="text-gray-800">{formData.selectedTime} IST (30 minutes)</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#1E88E5]" />
              <span className="text-gray-800">For: {formData.childName}</span>
            </div>
            {meetLink && (
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-[#1E88E5]" />
                <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-[#1E88E5] hover:underline font-medium">
                  Join Google Meet
                </a>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          A calendar invite has been sent to <strong>{formData.parentEmail}</strong>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {meetLink && (
            <a href={meetLink} target="_blank" rel="noopener noreferrer">
              <button className="w-full sm:w-auto px-6 py-3 bg-[#E91E63] text-white font-semibold rounded-full hover:bg-[#C2185B] transition-all active:scale-95 flex items-center justify-center gap-2">
                <Video className="w-5 h-5" />
                Open Meet Link
              </button>
            </a>
          )}
          <button 
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white border-2 border-[#1E88E5] text-[#1E88E5] font-semibold rounded-full hover:bg-blue-50 transition-all active:scale-95"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-2xl mx-auto border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E88E5] to-[#1565C0] p-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full mb-3">
          <Sparkles className="w-4 h-4 text-[#FFD740]" />
          <span className="text-white text-sm font-medium">Free Session</span>
        </div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Nunito, sans-serif' }}>
          Book Free Consultation
        </h2>
        <p className="text-blue-100 mt-1">30-minute session with Rucha Rai</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 py-6 bg-[#FAFAF9] border-b border-gray-100">
        {[
          { num: 1, label: 'Your Info' },
          { num: 2, label: 'Select Time' },
          { num: 3, label: 'Confirm' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step >= s.num
                    ? 'bg-[#1E88E5] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className="text-xs mt-1 text-gray-600 hidden sm:block">{s.label}</span>
            </div>
            {i < 2 && (
              <div className={`w-8 sm:w-16 h-1 mx-2 rounded ${step > s.num ? 'bg-[#1E88E5]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      
      <div className="p-6 sm:p-8">
        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="parentName" className="text-gray-700 font-medium">Your Name *</Label>
              <Input
                id="parentName"
                value={formData.parentName}
                onChange={(e) => updateField('parentName', e.target.value)}
                placeholder="Enter your full name"
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-[#1E88E5] focus:ring-[#1E88E5] bg-[#FAFAF9]"
              />
            </div>
            
            <div>
              <Label htmlFor="parentEmail" className="text-gray-700 font-medium">Email Address *</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => updateField('parentEmail', e.target.value)}
                placeholder="your@email.com"
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-[#1E88E5] focus:ring-[#1E88E5] bg-[#FAFAF9]"
              />
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Calendar invite will be sent here
              </p>
            </div>
            
            <div>
              <Label htmlFor="parentPhone" className="text-gray-700 font-medium">Phone Number *</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => updateField('parentPhone', e.target.value)}
                placeholder="+91 9876543210"
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-[#1E88E5] focus:ring-[#1E88E5] bg-[#FAFAF9]"
              />
            </div>
            
            <div>
              <Label htmlFor="childName" className="text-gray-700 font-medium">Child's Name *</Label>
              <Input
                id="childName"
                value={formData.childName}
                onChange={(e) => updateField('childName', e.target.value)}
                placeholder="Enter child's name"
                className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-[#1E88E5] focus:ring-[#1E88E5] bg-[#FAFAF9]"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              className={`w-full py-4 rounded-full font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isStep1Valid 
                  ? 'bg-[#E91E63] text-white hover:bg-[#C2185B] shadow-lg hover:shadow-xl hover:-translate-y-0.5' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Date Selection */}
            <div>
              <Label className="text-gray-700 font-semibold text-base flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-[#1E88E5]" />
                Select Date
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableDates.map((date) => {
                  const isSelected = formData.selectedDate === formatDateISO(date);
                  return (
                    <button
                      key={formatDateISO(date)}
                      onClick={() => updateField('selectedDate', formatDateISO(date))}
                      className={`p-3 rounded-2xl border-2 text-center transition-all hover:-translate-y-0.5 active:scale-95 ${
                        isSelected
                          ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-lg'
                          : 'bg-[#FAFAF9] border-gray-200 hover:border-[#1E88E5] text-gray-800'
                      }`}
                    >
                      <div className={`text-xs font-medium ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                        {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </div>
                      <div className="text-xl font-bold">{date.getDate()}</div>
                      <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                        {date.toLocaleDateString('en-IN', { month: 'short' })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <Label className="text-gray-700 font-semibold text-base flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-[#1E88E5]" />
                Select Time (IST)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_SLOTS.map((time) => {
                  const isSelected = formData.selectedTime === time;
                  return (
                    <button
                      key={time}
                      onClick={() => updateField('selectedTime', time)}
                      className={`p-3 rounded-2xl border-2 text-center transition-all hover:-translate-y-0.5 active:scale-95 ${
                        isSelected
                          ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-lg'
                          : 'bg-[#FAFAF9] border-gray-200 hover:border-[#1E88E5] text-gray-800'
                      }`}
                    >
                      <div className="text-sm font-semibold">{time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className={`flex-1 py-4 rounded-full font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isStep2Valid 
                    ? 'bg-[#E91E63] text-white hover:bg-[#C2185B] shadow-lg hover:shadow-xl hover:-translate-y-0.5' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-[#FAFAF9] rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
                <CheckCircle className="w-5 h-5 text-[#1E88E5]" />
                Booking Summary
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Session Type</span>
                  <span className="font-semibold text-gray-900">Free Consultation (30 min)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Coach</span>
                  <span className="font-semibold text-gray-900">Rucha Rai</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Date</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(formData.selectedDate).toLocaleDateString('en-IN', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Time</span>
                  <span className="font-semibold text-gray-900">{formData.selectedTime} IST</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Child</span>
                  <span className="font-semibold text-gray-900">{formData.childName}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Platform</span>
                  <span className="font-semibold text-gray-900 flex items-center gap-1">
                    <Video className="w-4 h-4 text-[#1E88E5]" /> Google Meet
                  </span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-gray-700 font-medium">Any specific concerns? (Optional)</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="E.g., My child struggles with pronunciation..."
                className="mt-1.5 w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#1E88E5] focus:border-[#1E88E5] bg-[#FAFAF9] text-gray-800"
                rows={3}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-4 rounded-full font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isSubmitting 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-[#E91E63] text-white hover:bg-[#C2185B] shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Booking...
                  </>
                ) : (
                  <>
                    Confirm Booking
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-xl mx-auto">
      <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#1E88E5]" />
      <p className="text-gray-600">Loading booking form...</p>
    </div>
  );
}

export default function BookingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAFAF9' }}>
      <Header />
      
      <main className="flex-1 py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<LoadingFallback />}>
            <BookingForm />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
