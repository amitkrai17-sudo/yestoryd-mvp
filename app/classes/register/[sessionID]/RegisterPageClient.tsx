// =============================================================================
// FILE: app/classes/register/[sessionId]/RegisterPageClient.tsx
// PURPOSE: Registration form with Razorpay payment integration
// DESIGN: Yestoryd dark theme, AIDA+LIFT, mobile-first
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import {
  Calendar, Clock, Users, ArrowLeft, CheckCircle, Tag,
  AlertCircle, Loader2, Shield, User, Mail, Phone, Baby,
  Sparkles, Gift, CreditCard, BookOpen
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================
interface Session {
  id: string;
  title: string;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  maxParticipants: number;
  currentParticipants: number;
  spotsAvailable: number;
  priceInr: number;
  ageMin: number;
  ageMax: number;
  classType: {
    name: string;
    icon_emoji: string;
    color_hex: string;
  } | null;
  instructor: {
    name: string;
    photo_url: string | null;
  } | null;
  book: {
    title: string;
    author: string;
    cover_image_url: string | null;
  } | null;
}

interface FormData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: string;
  couponCode: string;
}

interface PricingInfo {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  isEnrolledFree: boolean;
  appliedCouponCode: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function RegisterPageClient({ sessionId: propSessionId }: { sessionId?: string }) {
  const router = useRouter();
  const params = useParams();

  // Get sessionId - try multiple sources
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Try params first
    if (params?.sessionId) {
      setResolvedSessionId(params.sessionId as string);
      return;
    }

    // Try prop
    if (propSessionId) {
      setResolvedSessionId(propSessionId);
      return;
    }

    // Extract from URL as last resort
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const urlSessionId = pathParts[pathParts.length - 1];
      if (urlSessionId && urlSessionId.match(/^[0-9a-f-]{36}$/i)) {
        setResolvedSessionId(urlSessionId);
      }
    }
  }, [params, propSessionId]);

  // State
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingInfo | null>(null);

  const [formData, setFormData] = useState<FormData>({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    childName: '',
    childAge: '',
    couponCode: '',
  });

  // Fetch session details
  useEffect(() => {
    // Wait for sessionId to be resolved
    if (!resolvedSessionId) {
      return; // Don't set error yet, wait for resolution
    }

    async function fetchSession() {
      try {
        console.log('Fetching session:', resolvedSessionId);
        const res = await fetch(`/api/group-classes/sessions/${resolvedSessionId}`);
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          setSession(data.session);
          setPricing({
            originalPrice: data.session.priceInr,
            discountAmount: 0,
            finalPrice: data.session.priceInr,
            isEnrolledFree: false,
            appliedCouponCode: null,
          });
        }
      } catch (err) {
        setError('Failed to load session details');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [resolvedSessionId]);

  // Use resolvedSessionId for all operations
  const sessionId = resolvedSessionId;

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear coupon error when editing coupon field
    if (name === 'couponCode') {
      setCouponError(null);
    }
  };

  // Validate and apply coupon
  const applyCoupon = async () => {
    if (!formData.couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/group-classes/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          couponCode: formData.couponCode.trim(),
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setPricing({
          originalPrice: data.originalPrice,
          discountAmount: data.discountAmount,
          finalPrice: data.finalPrice,
          isEnrolledFree: data.isEnrolledFree,
          appliedCouponCode: data.appliedCoupon?.code || null,
        });
      } else {
        setCouponError(data.error || 'Invalid coupon code');
      }
    } catch (err) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove applied coupon
  const removeCoupon = () => {
    setPricing({
      originalPrice: session?.priceInr || 0,
      discountAmount: 0,
      finalPrice: session?.priceInr || 0,
      isEnrolledFree: false,
      appliedCouponCode: null,
    });
    setFormData(prev => ({ ...prev, couponCode: '' }));
    setCouponError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Create registration
      const registerRes = await fetch('/api/group-classes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          childName: formData.childName,
          childAge: parseInt(formData.childAge),
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          couponCode: pricing?.appliedCouponCode || formData.couponCode || null,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        throw new Error(registerData.error || 'Registration failed');
      }

      // If no payment required, redirect to success
      if (!registerData.requiresPayment) {
        router.push(`/classes/register/success?registrationId=${registerData.registrationId}&free=true`);
        return;
      }

      // Initialize Razorpay payment
      const options = {
        key: registerData.razorpayKeyId,
        amount: registerData.pricing.finalPrice * 100,
        currency: 'INR',
        name: 'Yestoryd',
        description: `${session?.classType?.name || 'Group Class'}: ${session?.title}`,
        order_id: registerData.razorpayOrderId,
        handler: async function (response: any) {
          // Verify payment
          try {
            const verifyRes = await fetch('/api/group-classes/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                registrationId: registerData.registrationId,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              router.push(`/classes/register/success?registrationId=${registerData.registrationId}`);
            } else {
              setError('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            setError('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: formData.parentName,
          email: formData.parentEmail,
          contact: formData.parentPhone,
        },
        notes: {
          session_id: sessionId,
          child_name: formData.childName,
        },
        theme: {
          color: '#ff0099',
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#ff0099] animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading session details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="bg-surface-1 rounded-2xl p-8 max-w-md text-center shadow-lg shadow-black/25 border border-border">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link
            href="/classes"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff0099] text-white rounded-xl font-bold hover:bg-[#e0008a] transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const colorHex = session.classType?.color_hex || '#ff0099';

  return (
    <>
      {/* Razorpay Script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="min-h-screen bg-surface-0">
        {/* Header */}
        <div className="bg-surface-1 border-b border-border">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Link
              href="/classes"
              className="inline-flex items-center gap-2 text-text-secondary hover:text-[#ff0099] transition-colors min-h-[44px]"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Classes
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column: Form */}
            <div className="lg:col-span-3">
              <div className="bg-surface-1 rounded-2xl shadow-lg shadow-black/25 border border-border p-6 sm:p-8">
                <h1 className="text-2xl font-bold text-white mb-6">
                  Register for Class
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Parent Information */}
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-[#ff0099]" />
                      Parent Information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          name="parentName"
                          value={formData.parentName}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter your name"
                          className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Email *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                          <input
                            type="email"
                            name="parentEmail"
                            value={formData.parentEmail}
                            onChange={handleInputChange}
                            required
                            placeholder="email@example.com"
                            className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Phone (WhatsApp) *
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                          <input
                            type="tel"
                            name="parentPhone"
                            value={formData.parentPhone}
                            onChange={handleInputChange}
                            required
                            placeholder="9876543210"
                            className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                          />
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          We&apos;ll send class link & reminders via WhatsApp
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />

                  {/* Child Information */}
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Baby className="w-5 h-5 text-[#00abff]" />
                      Child Information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Child&apos;s Name *
                        </label>
                        <input
                          type="text"
                          name="childName"
                          value={formData.childName}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter child's name"
                          className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent placeholder:text-text-tertiary min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Child&apos;s Age *
                        </label>
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent min-h-[44px]"
                        >
                          <option value="">Select age</option>
                          {Array.from({ length: 9 }, (_, i) => i + 4).map(age => (
                            <option key={age} value={age}>
                              {age} years
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Age warning */}
                    {formData.childAge && (parseInt(formData.childAge) < session.ageMin || parseInt(formData.childAge) > session.ageMax) && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-400">
                          This class is designed for ages {session.ageMin}-{session.ageMax}.
                          Your child can still join, but content may not be ideal.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />

                  {/* Coupon Section */}
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5 text-[#7b008b]" />
                      Have a Coupon?
                    </h2>

                    {pricing?.appliedCouponCode ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                              {pricing.isEnrolledFree ? (
                                <Gift className="w-5 h-5 text-green-400" />
                              ) : (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-green-400">
                                {pricing.appliedCouponCode}
                              </p>
                              <p className="text-sm text-green-400/80">
                                {pricing.isEnrolledFree
                                  ? 'FREE as enrolled family!'
                                  : `₹${pricing.discountAmount} discount applied`
                                }
                              </p>
                            </div>
                          </div>
                          {!pricing.isEnrolledFree && (
                            <button
                              type="button"
                              onClick={removeCoupon}
                              className="text-red-400 hover:text-red-300 text-sm font-medium min-h-[44px]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <input
                          type="text"
                          name="couponCode"
                          value={formData.couponCode}
                          onChange={handleInputChange}
                          placeholder="Enter coupon code"
                          className="flex-1 px-4 py-3 border border-border rounded-xl text-white bg-surface-2 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent uppercase placeholder:text-text-tertiary min-h-[44px]"
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={couponLoading}
                          className="px-6 py-3 bg-surface-2 text-text-secondary rounded-xl font-semibold hover:bg-surface-0 transition-colors disabled:opacity-50 flex items-center gap-2 border border-border min-h-[44px]"
                        >
                          {couponLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </button>
                      </div>
                    )}

                    {couponError && (
                      <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {couponError}
                      </p>
                    )}

                    {/* Enrolled family hint */}
                    <p className="mt-3 text-sm text-text-tertiary">
                      <Sparkles className="w-4 h-4 inline mr-1 text-[#ffde00]" />
                      Enrolled families get <strong className="text-white">FREE unlimited</strong> group classes!
                    </p>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#ff0099]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[56px]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : pricing?.finalPrice === 0 ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Register Free
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Pay ₹{pricing?.finalPrice || session.priceInr}
                      </>
                    )}
                  </button>

                  {/* Trust Signals */}
                  <div className="flex items-center justify-center gap-4 text-sm text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Shield className="w-4 h-4 text-green-400" />
                      Secure Payment
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-[#00abff]" />
                      Instant Confirmation
                    </span>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Session Summary */}
            <div className="lg:col-span-2">
              <div className="bg-surface-1 rounded-2xl shadow-lg shadow-black/25 border border-border overflow-hidden sticky top-8">
                {/* Header */}
                <div
                  className="p-4"
                  style={{ background: `linear-gradient(135deg, ${colorHex}, #7b008b)` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">
                        {session.classType?.name || 'Group Class'}
                      </p>
                      <h2 className="text-white font-bold text-lg">{session.title}</h2>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-4">
                  {/* Date & Time */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#ff0099]/20 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {formatDate(session.scheduledDate)}
                      </p>
                      <p className="text-text-tertiary text-sm">
                        {formatTime(session.scheduledTime)} • {session.durationMinutes} minutes
                      </p>
                    </div>
                  </div>

                  {/* Spots */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#00abff]/20 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#00abff]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {session.spotsAvailable} spots left
                      </p>
                      <p className="text-text-tertiary text-sm">
                        Ages {session.ageMin}-{session.ageMax}
                      </p>
                    </div>
                  </div>

                  {/* Instructor */}
                  {session.instructor && (
                    <div className="flex items-center gap-3">
                      {session.instructor.photo_url ? (
                        <Image
                          src={session.instructor.photo_url}
                          alt={session.instructor.name}
                          width={40}
                          height={40}
                          className="rounded-lg"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-[#7b008b]/20 rounded-lg flex items-center justify-center text-[#c847f4] font-bold">
                          {session.instructor.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">
                          {session.instructor.name}
                        </p>
                        <p className="text-text-tertiary text-sm">Instructor</p>
                      </div>
                    </div>
                  )}

                  {/* Book */}
                  {session.book && (
                    <div className="p-3 bg-[#ffde00]/10 rounded-xl border border-[#ffde00]/30">
                      <p className="text-[#ffde00] text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Featured Book
                      </p>
                      <p className="font-bold text-white">{session.book.title}</p>
                      <p className="text-text-tertiary text-sm">by {session.book.author}</p>
                    </div>
                  )}
                </div>

                {/* Pricing Summary */}
                <div className="p-4 bg-surface-2 border-t border-border">
                  <div className="space-y-2">
                    <div className="flex justify-between text-text-secondary">
                      <span>Session Price</span>
                      <span>₹{pricing?.originalPrice || session.priceInr}</span>
                    </div>

                    {pricing && pricing.discountAmount > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Discount ({pricing.appliedCouponCode})</span>
                        <span>-₹{pricing.discountAmount}</span>
                      </div>
                    )}

                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">Total</span>
                        <span className="text-2xl font-bold text-[#ff0099]">
                          {pricing?.finalPrice === 0 ? 'FREE' : `₹${pricing?.finalPrice || session.priceInr}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
