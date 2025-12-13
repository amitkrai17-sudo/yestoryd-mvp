'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Calendar, Clock, CreditCard, Loader2, Shield, CheckCircle } from 'lucide-react';

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

const PACKAGES = {
  'coaching-6': {
    name: '3-Month Reading Coaching',
    sessions: 6,
    checkins: 3,
    duration: '12 weeks',
    price: 5999,
    features: [
      '6 one-on-one coaching sessions',
      '3 parent check-in calls',
      'Personalized learning plan',
      'Progress tracking dashboard',
      'Access to e-learning modules',
      'WhatsApp support',
    ],
  },
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const childId = searchParams.get('childId') || '';
  const childName = searchParams.get('childName') || '';
  const parentName = searchParams.get('parentName') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const coachId = searchParams.get('coachId') || 'rucha';
  const packageType = (searchParams.get('package') || 'coaching-6') as keyof typeof PACKAGES;
  const source = searchParams.get('source') || 'yestoryd.com';

  const pkg = PACKAGES[packageType] || PACKAGES['coaching-6'];

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    if (selectedDay === null || !selectedTime) {
      setError('Please select your preferred day and time');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Load Razorpay script
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => (script.onload = resolve));
      }

      // Create order
      const orderRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pkg.price,
          childId,
          childName,
          parentName,
          parentEmail,
          parentPhone,
          coachId,
          packageType,
          source,
          preferredDay: selectedDay,
          preferredTime: selectedTime,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Yestoryd',
        description: pkg.name,
        order_id: orderData.orderId,
        prefill: {
          name: parentName,
          email: parentEmail,
          contact: parentPhone,
        },
        notes: {
          childId,
          childName,
          coachId,
          packageType,
          source,
          preferredDay: selectedDay,
          preferredTime: selectedTime,
        },
        theme: {
          color: '#ec4899',
        },
        handler: async function (response: any) {
          // Verify payment
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              childId,
              childName,
              parentName,
              parentEmail,
              parentPhone,
              coachId,
              packageType,
              source,
              preferredDay: selectedDay,
              preferredTime: selectedTime,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            router.push(
              `/enrollment/success?enrollmentId=${verifyData.enrollmentId}&childName=${encodeURIComponent(childName)}`
            );
          } else {
            setError('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Enrollment</h1>
          <p className="text-gray-400">
            Enrolling <span className="text-pink-400 font-medium">{childName}</span> in reading coaching
          </p>
        </div>

        {/* Package Details */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{pkg.name}</h2>
              <p className="text-gray-400 text-sm">{pkg.duration}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-pink-500">₹{pkg.price.toLocaleString()}</p>
              <p className="text-gray-500 text-sm">one-time</p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400 mb-3">What's included:</p>
            <ul className="space-y-2">
              {pkg.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Schedule Preference */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Preferred Weekly Slot
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            All 9 sessions will be scheduled at this time. Coach will confirm or suggest alternatives.
          </p>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Preferred Day</label>
            <div className="grid grid-cols-4 gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDay(day.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDay === day.value
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-1">
              <Clock className="w-4 h-4" /> Preferred Time
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {TIME_OPTIONS.map((time) => (
                <button
                  key={time.value}
                  type="button"
                  onClick={() => setSelectedTime(time.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedTime === time.value
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {time.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay ₹{pkg.price.toLocaleString()}
            </>
          )}
        </button>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 mt-6 text-gray-500 text-sm">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>Secure Payment</span>
          </div>
          <span>•</span>
          <span>100% Refund Policy</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}