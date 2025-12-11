'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PACKAGES = {
  'coaching-6': {
    name: '3-Month Coaching Program',
    price: 5999,
    features: [
      '6 personalized coaching sessions (45 mins each)',
      '3 parent check-in calls (15 mins each)',
      'AI-powered progress tracking',
      'FREE access to all e-learning modules',
      'FREE storytelling workshops',
      'FREE physical classes access',
      'Weekly progress reports',
      'WhatsApp support',
    ],
  },
  'coaching-trial': {
    name: 'Trial Session',
    price: 999,
    features: [
      '1 coaching session (45 mins)',
      'Detailed assessment report',
      'Personalized recommendations',
    ],
  },
};

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Get data from URL params (passed from assessment results page)
  const childId = searchParams.get('childId') || '';
  const childName = searchParams.get('childName') || '';
  const parentName = searchParams.get('parentName') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const packageType = (searchParams.get('package') || 'coaching-6') as keyof typeof PACKAGES;
  const source = searchParams.get('source') || 'yestoryd.com';
  const coachId = searchParams.get('coachId') || 'rucha';

  const selectedPackage = PACKAGES[packageType] || PACKAGES['coaching-6'];

  async function handlePayment() {
    if (!scriptLoaded) {
      setError('Payment system loading. Please wait...');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create order on backend
      const orderRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          childName,
          coachId,
          packageType,
          parentName,
          parentEmail,
          parentPhone,
          source,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // 2. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: 'Yestoryd',
        description: selectedPackage.name,
        order_id: orderData.orderId,
        prefill: {
          name: parentName,
          email: parentEmail,
          contact: parentPhone,
        },
        theme: {
          color: '#6366f1', // Indigo
        },
        handler: async function (response: any) {
          // 3. Verify payment on backend
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                childId,
                childName,
                coachId,
                packageType,
                parentName,
                parentEmail,
                parentPhone,
                source,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              // Redirect to success page
              router.push(`/enrollment/success?childId=${childId}&childName=${encodeURIComponent(childName)}`);
            } else {
              setError('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            console.error('Verification error:', err);
            setError('Payment completed but verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Enrollment
            </h1>
            <p className="text-gray-600">
              Start {childName}'s reading transformation journey
            </p>
          </div>

          {/* Package Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Package Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
              <h2 className="text-2xl font-bold">{selectedPackage.name}</h2>
              <div className="mt-4 flex items-baseline">
                <span className="text-5xl font-extrabold">₹{selectedPackage.price.toLocaleString()}</span>
                <span className="ml-2 text-indigo-200">one-time</span>
              </div>
            </div>

            {/* Features */}
            <div className="px-6 py-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                What's Included
              </h3>
              <ul className="space-y-3">
                {selectedPackage.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Child Info */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <div className="text-sm text-gray-600">
                <p><span className="font-medium">Child:</span> {childName}</p>
                <p><span className="font-medium">Parent:</span> {parentName}</p>
                <p><span className="font-medium">Email:</span> {parentEmail}</p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Pay Button */}
            <div className="px-6 py-6 border-t">
              <button
                onClick={handlePayment}
                disabled={loading || !scriptLoaded}
                className={`w-full py-4 px-6 rounded-xl text-lg font-semibold text-white transition-all
                  ${loading || !scriptLoaded
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Pay ₹${selectedPackage.price.toLocaleString()}`
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                Secure payment powered by Razorpay. By proceeding, you agree to our Terms of Service.
              </p>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-8 flex justify-center items-center space-x-6 text-gray-400">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Secure</span>
            </div>
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              <span className="text-sm">100% Refund Policy</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
