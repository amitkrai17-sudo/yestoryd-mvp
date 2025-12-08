'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Loader2
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

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childName = searchParams.get('childName') || '';
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
    childName: childName,
    selectedDate: '',
    selectedTime: '',
    notes: '',
  });

  // Generate next 14 days for date selection
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

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

  if (bookingComplete) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <Card className="border-green-200">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Booking Confirmed! 🎉
                </h1>
                <p className="text-gray-600 mb-6">
                  Your free consultation session has been scheduled with <strong>Rucha Rai</strong>.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-4">Session Details:</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <span>{new Date(formData.selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span>{formData.selectedTime} (30 minutes)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-blue-600" />
                      <span>For: {formData.childName}</span>
                    </div>
                    {meetLink && (
                      <div className="flex items-center gap-3">
                        <Video className="w-5 h-5 text-blue-600" />
                        <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Video className="w-4 h-4 mr-2" />
                        Open Meet Link
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" onClick={() => router.push('/')}>
                    Back to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1 bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= stepNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div
                      className={`w-12 h-1 ${
                        step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-600 px-4">
              <span>Your Info</span>
              <span>Select Time</span>
              <span>Confirm</span>
            </div>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Book Free Consultation</CardTitle>
              <CardDescription>
                30-minute session with Rucha Rai
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Step 1: Contact Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="parentName">Your Name *</Label>
                    <Input
                      id="parentName"
                      value={formData.parentName}
                      onChange={(e) => updateField('parentName', e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="parentEmail">Email Address *</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={formData.parentEmail}
                      onChange={(e) => updateField('parentEmail', e.target.value)}
                      placeholder="your@email.com"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Calendar invite will be sent here</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="parentPhone">Phone Number *</Label>
                    <Input
                      id="parentPhone"
                      type="tel"
                      value={formData.parentPhone}
                      onChange={(e) => updateField('parentPhone', e.target.value)}
                      placeholder="+91 9876543210"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="childName">Child's Name *</Label>
                    <Input
                      id="childName"
                      value={formData.childName}
                      onChange={(e) => updateField('childName', e.target.value)}
                      placeholder="Enter child's name"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}

              {/* Step 2: Select Date & Time */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Select Date</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableDates.map((date) => (
                        <button
                          key={formatDateISO(date)}
                          onClick={() => updateField('selectedDate', formatDateISO(date))}
                          className={`p-3 rounded-lg border text-center transition-all ${
                            formData.selectedDate === formatDateISO(date)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="text-xs">{date.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                          <div className="text-lg font-semibold">{date.getDate()}</div>
                          <div className="text-xs">{date.toLocaleDateString('en-IN', { month: 'short' })}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Select Time</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TIME_SLOTS.map((time) => (
                        <button
                          key={time}
                          onClick={() => updateField('selectedTime', time)}
                          className={`p-3 rounded-lg border text-center transition-all ${
                            formData.selectedTime === time
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <Clock className="w-4 h-4 mx-auto mb-1" />
                          <div className="text-sm font-medium">{time}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={() => setStep(1)}
                      variant="outline"
                      size="lg"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      disabled={!isStep2Valid}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      size="lg"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Booking Summary</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Session Type:</span>
                        <span className="font-medium">Free Consultation (30 min)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Coach:</span>
                        <span className="font-medium">Rucha Rai</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">
                          {new Date(formData.selectedDate).toLocaleDateString('en-IN', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time:</span>
                        <span className="font-medium">{formData.selectedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Child:</span>
                        <span className="font-medium">{formData.childName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Platform:</span>
                        <span className="font-medium flex items-center gap-1">
                          <Video className="w-4 h-4" /> Google Meet
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Any specific concerns? (Optional)</Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="E.g., My child struggles with pronunciation..."
                      className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(2)}
                      variant="outline"
                      size="lg"
                      disabled={isSubmitting}
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Creating Booking...
                        </>
                      ) : (
                        <>
                          Confirm Booking
                          <CheckCircle className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
