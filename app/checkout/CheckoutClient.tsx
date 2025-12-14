'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import {
  ArrowLeft,
  CheckCircle2,
  Shield,
  Lock,
  CreditCard,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

// ==================== TYPES ====================
interface PricingData {
  programName: string;
  originalPrice: number;
  discountedPrice: number;
  sessions: number;
  coachingSessions: number;
  parentMeetings: number;
  coachName: string;
  features: string[];
}

interface CheckoutClientProps {
  pricing: PricingData;
}

function CheckoutContent({ pricing }: CheckoutClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get params from URL
  const childName = searchParams.get('childName') || '';
  const childAge = searchParams.get('childAge') || '';
  const parentName = searchParams.get('parentName') || '';
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const coachId = searchParams.get('coachId') || 'rucha';
  
  // Use amount from URL if provided, otherwise use dynamic pricing
  const urlAmount = searchParams.get('amount');
  const amount = urlAmount ? parseInt(urlAmount) : pricing.discountedPrice;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Order summary - DYNAMIC from props
  const orderSummary = {
    program: pricing.programName,
    sessions: `${pricing.sessions} sessions (${pricing.coachingSessions} coaching + ${pricing.parentMeetings} parent meetings)`,
    coach: `Coach ${pricing.coachName}`,
    child: childName,
    originalPrice: pricing.originalPrice,
    discount: pricing.originalPrice - amount,
    finalPrice: amount,
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      setError('Payment system is loading. Please wait...');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create order on backend
      const orderResponse = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          childName,
          childAge,
          parentName,
          parentEmail,
          parentPhone,
          coachId,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.orderId) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      console.log('Order created:', orderData.orderId);

      // Step 2: Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amount * 100, // in paise
        currency: 'INR',
        name: 'Yestoryd',
        description: `Reading Coaching for ${childName}`,
        image: '/images/logo.png',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          console.log('Payment response:', response);
          
          // Step 3: Verify payment on backend
          try {
            setIsLoading(true);
            
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                childName,
                childAge,
                parentName,
                parentEmail,
                parentPhone,
                coachId,
                amount,
              }),
            });

            const verifyData = await verifyResponse.json();
            console.log('Verify response:', verifyData);

            if (verifyData.success) {
              // Redirect to success page
              router.push(`/enrollment/success?enrollmentId=${verifyData.enrollmentId}&childName=${encodeURIComponent(childName)}`);
            } else {
              setError(verifyData.error || 'Payment verification failed. Please contact support.');
              setIsLoading(false);
            }
          } catch (err: any) {
            console.error('Verify error:', err);
            setError('Payment verification failed. Please contact support.');
            setIsLoading(false);
          }
        },
        prefill: {
          name: parentName,
          email: parentEmail,
          contact: parentPhone,
        },
        notes: {
          childName,
          childAge,
          coachId,
        },
        theme: {
          color: '#f59e0b', // amber-500
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      
      razorpay.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        setError(`Payment failed: ${response.error.description}`);
        setIsLoading(false);
      });
      
      razorpay.open();

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Razorpay Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => {
          console.log('Razorpay script loaded');
          setRazorpayLoaded(true);
        }}
        onError={() => {
          console.error('Razorpay script failed to load');
          setError('Payment system failed to load. Please refresh.');
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/book" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </Link>
            <Image src="/images/logo.png" alt="Yestoryd" width={120} height={40} className="h-8 w-auto" />
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <Lock className="w-4 h-4" />
              <span>Secure</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Complete Your Enrollment</h1>

        <div className="grid gap-6">
          {/* Order Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <h2 className="text-white font-semibold">Order Summary</h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Program - DYNAMIC */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{orderSummary.program}</p>
                  <p className="text-gray-500 text-sm">{orderSummary.sessions}</p>
                  <p className="text-gray-500 text-sm">{orderSummary.coach}</p>
                </div>
                <p className="text-gray-400 line-through">₹{orderSummary.originalPrice.toLocaleString('en-IN')}</p>
              </div>

              {/* Child */}
              {childName && (
                <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                    {childName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{childName}</p>
                    <p className="text-gray-500 text-sm">{childAge ? `${childAge} years old` : 'Student'}</p>
                  </div>
                </div>
              )}

              <hr className="border-gray-200" />

              {/* Pricing - DYNAMIC */}
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{orderSummary.originalPrice.toLocaleString('en-IN')}</span>
                </div>
                {orderSummary.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{orderSummary.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <hr className="border-gray-200" />
                <div className="flex justify-between text-xl font-bold text-gray-800">
                  <span>Total</span>
                  <span>₹{orderSummary.finalPrice.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* What is Included - DYNAMIC features */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">What is Included</h3>
            <div className="space-y-3">
              {pricing.features.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Payment Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={isLoading || !razorpayLoaded}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : !razorpayLoaded ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading Payment...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay ₹{orderSummary.finalPrice.toLocaleString('en-IN')}
              </>
            )}
          </button>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>100% Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-500" />
              <span>SSL Encrypted</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="text-center text-sm text-gray-400">
            <p>UPI • Cards • Net Banking • Wallets</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutClient({ pricing }: CheckoutClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <CheckoutContent pricing={pricing} />
    </Suspense>
  );
}
