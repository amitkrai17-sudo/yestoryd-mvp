'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, ArrowRight, Shield, Clock, Users, Sparkles, Loader2, Calendar, Gift } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 3); // 3-15 years

// Default pricing (fallback)
const DEFAULT_PRICING = {
  name: '3-Month Reading Program',
  originalPrice: 9999,
  discountedPrice: 5999,
  discountLabel: 'SAVE 40%',
  features: [
    '6 One-on-One Coaching Sessions',
    '3 Parent Progress Check-ins',
    'AI-Powered Reading Analysis',
    'Personalized Learning Plan',
  ],
};

// Main enrollment form component
function EnrollmentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const source = searchParams.get('source') || 'direct';
  const flowType = searchParams.get('type') || 'paid'; // 'paid' or 'free'
  const prefillChildName = searchParams.get('childName') || '';
  const prefillChildAge = searchParams.get('childAge') || '';
  const prefillParentName = searchParams.get('parentName') || '';
  const prefillParentEmail = searchParams.get('email') || searchParams.get('parentEmail') || '';
  const prefillParentPhone = searchParams.get('parentPhone') || '';
  
  const isFreeTrialFlow = flowType === 'free';
  
  const [step, setStep] = useState<'info' | 'payment' | 'success'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  
  const [form, setForm] = useState({
    parentName: prefillParentName,
    parentEmail: prefillParentEmail,
    parentPhone: prefillParentPhone,
    childName: prefillChildName,
    childAge: prefillChildAge,
    source: source,
  });

  // Fetch pricing from database
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch('/api/pricing');
        if (res.ok) {
          const data = await res.json();
          if (data.plans && data.plans.length > 0) {
            const plan = data.plans[0];
            setPricing({
              name: plan.name || DEFAULT_PRICING.name,
              originalPrice: plan.original_price || DEFAULT_PRICING.originalPrice,
              discountedPrice: plan.discounted_price || DEFAULT_PRICING.discountedPrice,
              discountLabel: plan.discount_label || DEFAULT_PRICING.discountLabel,
              features: plan.features || DEFAULT_PRICING.features,
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch pricing:', e);
      } finally {
        setPricingLoaded(true);
      }
    };
    fetchPricing();
  }, []);

  // Load Razorpay script (only for paid flow)
  useEffect(() => {
    if (!isFreeTrialFlow) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, [isFreeTrialFlow]);

  // Check if user is logged in and prefill
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const session = await res.json();
        if (session?.user?.email) {
          setForm(f => ({
            ...f,
            parentEmail: f.parentEmail || session.user.email,
            parentName: f.parentName || session.user.name || '',
          }));
        }
      } catch (e) {
        // Not logged in, continue
      }
    };
    checkAuth();
  }, []);

  const validateForm = () => {
    if (!form.parentName.trim()) return 'Parent name is required';
    if (!form.parentEmail.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) return 'Invalid email format';
    if (!form.parentPhone.trim()) return 'Phone number is required';
    if (!/^[6-9]\d{9}$/.test(form.parentPhone.replace(/\D/g, ''))) return 'Invalid phone number (10 digits starting with 6-9)';
    if (!form.childName.trim()) return 'Child name is required';
    if (!form.childAge) return 'Child age is required';
    return null;
  };

  // Save lead to database
  const saveLeadToDatabase = async () => {
    try {
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_name: form.parentName,
          parent_email: form.parentEmail,
          parent_phone: form.parentPhone,
          child_name: form.childName,
          child_age: parseInt(form.childAge),
          lead_source: isFreeTrialFlow ? 'free_trial' : source,
          lead_status: isFreeTrialFlow ? 'call_scheduled' : 'assessed',
          lead_notes: isFreeTrialFlow ? 'Booked free trial session' : `Enrollment from ${source}`,
        }),
      });
      
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Failed to save lead:', e);
      return null;
    }
  };

  // Handle free trial flow
  const handleFreeTrialSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Save lead to database
      await saveLeadToDatabase();

      // 2. Build Cal.com URL with prefilled data
      const calUrl = `https://cal.com/yestoryd/discovery?name=${encodeURIComponent(form.parentName)}&email=${encodeURIComponent(form.parentEmail)}&notes=${encodeURIComponent(`Child: ${form.childName}, Age: ${form.childAge}`)}`;

      // 3. Redirect to Cal.com
      window.location.href = calUrl;
      
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setLoading(false);
    }
  };

  // Handle paid enrollment flow
  const handlePaidEnrollment = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Razorpay order with dynamic pricing
      const orderRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pricing.discountedPrice,
          childName: form.childName,
          childAge: form.childAge,
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,
        }),
      });

      const orderData = await orderRes.json();
      
      if (!orderRes.ok || !orderData.orderId) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // 2. Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Yestoryd',
        description: pricing.name,
        image: '/images/logo.png',
        order_id: orderData.orderId,
        prefill: {
          name: form.parentName,
          email: form.parentEmail,
          contact: form.parentPhone,
        },
        notes: {
          childName: form.childName,
          childAge: form.childAge,
          source: form.source,
        },
        theme: {
          color: '#FF0099',
        },
        handler: async function (response: any) {
          // 3. Verify payment
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                childName: form.childName,
                childAge: form.childAge,
                parentName: form.parentName,
                parentEmail: form.parentEmail,
                parentPhone: form.parentPhone,
              }),
            });

            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              setStep('success');
            } else {
              setError(verifyData.error || 'Payment verification failed');
            }
          } catch (e) {
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
      
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setLoading(false);
    }
  };

  // Handle form submission based on flow type
  const handleSubmit = () => {
    if (isFreeTrialFlow) {
      handleFreeTrialSubmit();
    } else {
      handlePaidEnrollment();
    }
  };

  // Calculate discount amount
  const discountAmount = pricing.originalPrice - pricing.discountedPrice;

  // Success Screen (Paid enrollment)
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Welcome to Yestoryd!
          </h1>
          <p className="text-gray-600 mb-6">
            {form.childName}&apos;s reading journey begins now! Check your email for confirmation and session schedule.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-500 mb-2">What happens next:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Confirmation email with schedule</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Google Calendar invites for all 9 sessions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">WhatsApp message from your coach</span>
              </li>
            </ul>
          </div>
          <button
            onClick={() => router.push('/parent/dashboard')}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            Go to Parent Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Enrollment Form
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Image src="/images/logo.png" alt="Yestoryd" width={120} height={40} />
          <div className="text-right">
            <p className="text-sm text-gray-500">Secure {isFreeTrialFlow ? 'Booking' : 'Checkout'}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
              <Shield className="w-3 h-3" /> Your data is safe
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Form Section */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              {/* Header based on flow */}
              {isFreeTrialFlow ? (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Book Free Trial
                    </h1>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Complete your details to book a free 30-min session
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Enroll Your Child
                  </h1>
                  <p className="text-gray-600 mb-6">
                    Start your child&apos;s 3-month reading transformation journey
                  </p>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Parent Section */}
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-3">Parent Details</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        value={form.parentName}
                        onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={form.parentEmail}
                          onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          value={form.parentPhone}
                          onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                          placeholder="9876543210"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Child Section */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Child Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Child&apos;s Name *
                      </label>
                      <input
                        type="text"
                        value={form.childName}
                        onChange={(e) => setForm({ ...form, childName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                        placeholder="Child's first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age *
                      </label>
                      <select
                        value={form.childAge}
                        onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                      >
                        <option value="" className="text-gray-400">Select age</option>
                        {AGE_OPTIONS.map(age => (
                          <option key={age} value={age} className="text-gray-900">{age} years</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full mt-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                  isFreeTrialFlow 
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isFreeTrialFlow ? (
                  <>
                    <Calendar className="w-5 h-5" />
                    <span>Book Free Session</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₹{pricing.discountedPrice.toLocaleString('en-IN')} & Start Journey</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                By proceeding, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* Summary Section */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h3 className="font-bold text-gray-900 mb-4">
                {isFreeTrialFlow ? 'Free Trial Details' : 'Order Summary'}
              </h3>
              
              {isFreeTrialFlow ? (
                <>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4">
                    <p className="font-semibold text-gray-900">Free Discovery Session</p>
                    <p className="text-sm text-gray-600">30-minute consultation call</p>
                  </div>

                  <div className="space-y-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">Meet Coach Rucha</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">Discuss your child&apos;s reading</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">Get personalized recommendations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">No obligation to enroll</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span className="text-gray-900">Price</span>
                      <span className="text-green-600">FREE</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4 mb-4">
                    <p className="font-semibold text-gray-900">{pricing.name}</p>
                    <p className="text-sm text-gray-600">Complete transformation package</p>
                  </div>

                  <div className="space-y-3 text-sm mb-4">
                    {(pricing.features || DEFAULT_PRICING.features).slice(0, 4).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-pink-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Program Fee</span>
                      <span className="text-gray-400 line-through">₹{pricing.originalPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-600 font-medium">Discount</span>
                      <span className="text-green-600">-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-900">Total</span>
                      <span className="text-pink-600">₹{pricing.discountedPrice.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      🎁 <strong>Bonus:</strong> Free access to e-learning library & storytelling workshops!
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Main page with Suspense boundary
export default function EnrollPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EnrollmentForm />
    </Suspense>
  );
}