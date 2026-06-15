// ============================================================
// FILE: app/tuition/pay/[enrollmentId]/page.tsx
// PURPOSE: Tuition checkout page — loads enrollment, opens
//          Razorpay modal, calls payment/verify on success.
//          Supports ?renewal=true for session top-ups.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen, IndianRupee, CheckCircle, AlertCircle, ShieldCheck, RefreshCw, MessageSquare,
  Video, MapPin,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface EnrollmentData {
  id: string;
  childName: string;
  childAge: number | null;
  childId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentId: string;
  coachName: string;
  coachId: string;
  sessionRate: number;       // paise
  sessionsPurchased: number;
  totalAmountRupees: number;
  sessionDurationMinutes: number;
  status: string;
  isRenewal: boolean;
  sessionsRemaining: number;
  currentSessionMode: 'online' | 'offline';
}

export default function TuitionPayPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRenewal = searchParams.get('renewal') === 'true';
  const successParam = searchParams.get('success') === 'true';

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [data, setData] = useState<EnrollmentData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [linkState, setLinkState] = useState<'voided' | 'expired' | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  // Class format for the NEW sessions this payment adds — pre-selects current mode (2B-3).
  const [sessionMode, setSessionMode] = useState<'online' | 'offline'>('offline');

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  // Fetch enrollment data
  useEffect(() => {
    if (successParam) setSuccess(true);
    async function fetchEnrollment() {
      try {
        const renewalParam = isRenewal ? '?renewal=true' : '';
        const res = await fetch(`/api/tuition/pay/${enrollmentId}${renewalParam}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          // Pay-link lifecycle states get dedicated, parent-friendly screens.
          if (json.error === 'link_voided') { setLinkState('voided'); return; }
          if (json.error === 'link_expired') { setLinkState('expired'); return; }
          // On the post-payment ?success= landing the enrollment is already paid;
          // show the success state instead of the alreadyPaid error (Q7-#3).
          if (successParam) return;
          setError(json.error || 'Failed to load enrollment');
          return;
        }
        const json = await res.json();
        setData(json);
        setSessionMode(json.currentSessionMode ?? 'offline');
      } catch {
        if (!successParam) setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchEnrollment();
  }, [enrollmentId, isRenewal, successParam]);

  async function handlePay() {
    if (!data || !razorpayLoaded) return;
    setPaying(true);
    setError('');

    try {
      // 1. Create Razorpay order
      const createRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: 'tuition',
          childName: data.childName,
          childAge: data.childAge,
          childId: data.childId,
          parentName: data.parentName,
          parentEmail: data.parentEmail,
          parentPhone: data.parentPhone,
          parentId: data.parentId,
          coachId: data.coachId,
          enrollmentId: data.id,
          leadSource: 'yestoryd',
          sessionMode,
        }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok) throw new Error(orderData.error || 'Failed to create order');

      // 2. Open Razorpay checkout
      const description = data.isRenewal
        ? `Renew ${data.sessionsPurchased} Sessions`
        : `${data.sessionsPurchased} English Classes`;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount * 100,
        currency: 'INR',
        name: 'Yestoryd',
        description,
        order_id: orderData.orderId,
        prefill: {
          name: data.parentName,
          email: data.parentEmail,
          contact: data.parentPhone,
        },
        notes: {
          childName: data.childName,
          enrollmentId: data.id,
          enrollment_type: 'tuition',
        },
        theme: { color: '#ff0099' },
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          try {
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              setError('Payment response incomplete. Please contact support.');
              setPaying(false);
              return;
            }

            // 3. Verify payment
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                productCode: 'tuition',
                childName: data.childName,
                childAge: data.childAge || 8,
                childId: data.childId,
                parentName: data.parentName,
                parentEmail: data.parentEmail,
                parentPhone: data.parentPhone,
                coachId: data.coachId,
                leadSource: 'yestoryd',
                enrollmentId: data.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setSuccess(true);
            } else {
              setError(verifyData.error || 'Payment verification failed. Please contact support.');
            }
          } catch {
            setError('Network error during verification. Your payment was received - please contact support.');
          }
          setPaying(false);
        },
        modal: {
          ondismiss: function () { setPaying(false); },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPaying(false);
    }
  }

  // Auto-redirect to dashboard 3s after success
  const goToDashboard = useCallback(() => router.push('/parent/dashboard'), [router]);

  // Logo nav: back when there's in-app history, else dashboard (direct WhatsApp/email entry has none).
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/parent/dashboard');
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(goToDashboard, 3000);
    return () => clearTimeout(timer);
  }, [success, goToDashboard]);

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  // ---- LINK VOIDED / EXPIRED ----
  if (linkState) {
    const voided = linkState === 'voided';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <button type="button" onClick={goBack} className="flex items-center justify-center mb-4 cursor-pointer">
            <Image src="/images/logo.png" alt="Yestoryd" width={160} height={45} priority />
          </button>
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">
            {voided ? 'This payment link was cancelled' : 'This payment link has expired'}
          </h1>
          <p className="text-gray-600 mb-6">
            {voided
              ? 'Your coach cancelled this payment link. Please message us and we’ll send a fresh one.'
              : 'This payment link is no longer valid. Please message us and we’ll send you a new one.'}
          </p>
          <a
            href={`https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}?text=${encodeURIComponent('Hi, my tuition payment link is no longer working. Can you resend it?')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#FF0099]/90 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Message Us on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // ---- ERROR ----
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <button type="button" onClick={goBack} className="flex items-center justify-center mb-4 cursor-pointer">
            <Image src="/images/logo.png" alt="Yestoryd" width={160} height={45} priority />
          </button>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href={`https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF0099] font-medium hover:underline"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // ---- SUCCESS ----
  // Data-tolerant: client-side success has `data` in memory; a fresh ?success=true
  // landing (Q7-#3) may not, so all data reads fall back gracefully.
  if (success) {
    const isRenewalView = data?.isRenewal ?? isRenewal;
    const childName = data?.childName ?? 'your child';
    const coachName = data?.coachName ?? 'your coach';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <button type="button" onClick={() => router.push('/parent/dashboard')} className="flex items-center justify-center mb-4 cursor-pointer">
            <Image src="/images/logo.png" alt="Yestoryd" width={160} height={45} priority />
          </button>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">
            {isRenewalView ? 'Sessions Renewed!' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-600 mb-4">
            {isRenewalView
              ? `${data ? `${data.sessionsPurchased} sessions have` : 'Your sessions have'} been added for ${childName}. Coaching continues with ${coachName}.`
              : `${childName}${data ? `'s ${data.sessionsPurchased} sessions` : "'s sessions"} with ${coachName} are confirmed. Your coach will reach out to schedule the first session.`
            }
          </p>
          {data && (
            <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 mb-4">
              <div className="flex justify-between mb-1">
                <span>Sessions {data.isRenewal ? 'added' : ''}</span>
                <span className="font-medium text-gray-900">{data.sessionsPurchased}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount paid</span>
                <span className="font-bold text-[#FF0099]">
                  &#8377;{data.totalAmountRupees.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={goToDashboard}
            className="w-full bg-[#FF0099] text-white font-semibold py-3 rounded-xl hover:bg-[#FF0099]/90 transition-colors h-12 text-base"
          >
            Go to Dashboard
          </button>
          <p className="text-gray-400 text-xs mt-3">Redirecting automatically...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ---- CHECKOUT ----
  const heading = data.isRenewal ? 'Renew Sessions' : 'Complete Payment';
  const subheading = data.isRenewal
    ? `Add more sessions for ${data.childName}`
    : `Secure checkout for ${data.childName}'s sessions`;
  const HeadingIcon = data.isRenewal ? RefreshCw : BookOpen;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-6">
          <button type="button" onClick={goBack} className="flex items-center mb-4 cursor-pointer">
            <Image src="/images/logo.png" alt="Yestoryd" width={160} height={45} priority />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <HeadingIcon className="w-6 h-6 text-[#FF0099]" />
            <h1 className="font-display text-xl font-bold text-gray-900">{heading}</h1>
          </div>
          <p className="text-gray-600 text-sm">{subheading}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Renewal context banner */}
        {data.isRenewal && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-800 text-sm font-medium">
              {data.sessionsRemaining <= 0
                ? `${data.childName}'s sessions have run out. Add more to continue coaching.`
                : `${data.childName} has ${data.sessionsRemaining} session${data.sessionsRemaining === 1 ? '' : 's'} remaining.`
              }
            </p>
          </div>
        )}

        {/* Class format — governs the NEW sessions this payment adds (not existing upcoming) */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-display font-semibold text-gray-900 mb-1">Class Format</h2>
          <p className="text-gray-500 text-sm mb-4">Applies to the new sessions you&apos;re adding now.</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'online' as const, label: 'Online', icon: Video },
              { value: 'offline' as const, label: 'In-person', icon: MapPin },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSessionMode(opt.value)}
                aria-pressed={sessionMode === opt.value}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors ${
                  sessionMode === opt.value
                    ? 'bg-[#FF0099] text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-gray-400 text-xs mt-3">
            Your new classes will be {sessionMode === 'online' ? 'online' : 'in person'}.
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-display font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Student</span>
              <span className="font-medium text-gray-900">{data.childName}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Coach</span>
              <span className="font-medium text-gray-900">{data.coachName}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{data.isRenewal ? 'Sessions to add' : 'Sessions'}</span>
              <span className="font-medium text-gray-900">{data.sessionsPurchased} sessions</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Duration</span>
              <span className="font-medium text-gray-900">{data.sessionDurationMinutes} min each</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Rate</span>
              <span className="font-medium text-gray-900">&#8377;{(data.sessionRate / 100).toLocaleString('en-IN')}/session</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="font-semibold text-gray-900 text-base">Total</span>
              <span className="font-bold text-[#FF0099] text-xl">
                &#8377;{data.totalAmountRupees.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={paying || !razorpayLoaded}
          className="w-full flex items-center justify-center gap-2 bg-[#FF0099] text-white font-semibold py-3.5 rounded-xl hover:bg-[#FF0099]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-12 text-base"
        >
          {paying ? (
            <Spinner size="sm" color="white" />
          ) : (
            <>
              <IndianRupee className="w-5 h-5" />
              {data.isRenewal ? 'Renew' : 'Pay'} &#8377;{data.totalAmountRupees.toLocaleString('en-IN')}
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Secured by Razorpay</span>
        </div>
      </div>
    </div>
  );
}
