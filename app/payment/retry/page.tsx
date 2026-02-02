'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { Loader2, CreditCard, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RetryData {
  tokenId: string;
  orderId: string;
  amount: number;
  productCode: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: number;
  childId: string;
  parentId: string;
  razorpayKeyId: string;
}

function RetryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [retryData, setRetryData] = useState<RetryData | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  // Validate token
  useEffect(() => {
    if (!token) {
      setError('No retry token provided. Please use the link from your notification.');
      setLoading(false);
      return;
    }

    fetch(`/api/payment/validate-retry?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setRetryData(data.data);
        } else {
          setError(data.error || 'This retry link is no longer valid.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to validate retry link. Please try again.');
        setLoading(false);
      });
  }, [token]);

  const handleRetryPayment = async () => {
    if (!retryData || !razorpayLoaded) return;
    setPaying(true);
    setError('');

    try {
      const options = {
        key: retryData.razorpayKeyId,
        amount: retryData.amount * 100,
        currency: 'INR',
        name: 'Yestoryd',
        description: 'Reading Coaching Program - Retry Payment',
        order_id: retryData.orderId,
        prefill: {
          name: retryData.parentName,
          email: retryData.parentEmail,
          contact: retryData.parentPhone,
        },
        theme: { color: '#ff0099' },
        handler: async function (response: any) {
          try {
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              setError('Payment response incomplete. Please contact support.');
              setPaying(false);
              return;
            }

            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              productCode: retryData.productCode,
              childName: retryData.childName,
              childAge: retryData.childAge,
              childId: retryData.childId,
              parentEmail: retryData.parentEmail,
              parentPhone: retryData.parentPhone,
              parentName: retryData.parentName,
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            let verifyRes: Response;
            try {
              verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyPayload),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
            } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              setError(
                fetchErr.name === 'AbortError'
                  ? 'Payment verification timed out. Your payment was received - please contact support with order ID: ' + response.razorpay_order_id
                  : 'Network error during verification. Please contact support with order ID: ' + response.razorpay_order_id
              );
              setPaying(false);
              return;
            }

            const verifyData = await verifyRes.json();
            if (verifyData.success && verifyData.redirectUrl) {
              // Mark retry token as used
              fetch(`/api/payment/validate-retry?token=${token}`, { method: 'POST' }).catch(() => {});
              window.location.href = verifyData.redirectUrl;
              return;
            }
            if (verifyData.success && verifyData.enrollmentId) {
              window.location.href = `/enrollment/success?enrollmentId=${verifyData.enrollmentId}&childName=${encodeURIComponent(retryData.childName)}`;
              return;
            }
            setError(verifyData.error || 'Payment verification failed. Please contact support.');
            setPaying(false);
          } catch {
            setError('An unexpected error occurred. Please contact support.');
            setPaying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-3" />
          <p className="text-text-secondary text-sm">Validating your retry link...</p>
        </div>
      </div>
    );
  }

  if (error && !retryData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-surface-1 rounded-xl border border-border p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-white mb-2">Link Not Valid</h1>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <a
            href="/enroll"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all"
          >
            Start Fresh Enrollment
          </a>
        </div>
      </div>
    );
  }

  if (!retryData) return null;

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-1">Complete Your Payment</h1>
          <p className="text-text-secondary text-sm">
            Your previous payment didn&apos;t go through. Let&apos;s try again!
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Reading Coaching Program</h2>
                <p className="text-white/80 text-xs mt-0.5">
                  For {retryData.childName}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">
                  ₹{retryData.amount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-text-secondary">
                Parent: <span className="text-white">{retryData.parentName}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-text-secondary">
                Child: <span className="text-white">{retryData.childName}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-text-secondary">
                Email: <span className="text-white">{retryData.parentEmail}</span>
              </span>
            </div>

            {error && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleRetryPayment}
              disabled={paying || !razorpayLoaded}
              className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30"
            >
              {paying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Retry Payment — ₹{retryData.amount.toLocaleString('en-IN')}
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 pt-1">
              <Shield className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">Secure payment via Razorpay</span>
            </div>
          </div>
        </div>

        {/* Help */}
        <p className="text-center text-text-tertiary text-xs">
          Having trouble? Contact us at{' '}
          <a href="mailto:engage@yestoryd.com" className="text-pink-400 hover:underline">
            engage@yestoryd.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function RetryPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      }
    >
      <RetryPageContent />
    </Suspense>
  );
}
