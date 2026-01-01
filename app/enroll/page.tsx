// =============================================================================
// FILE: app/enroll/page.tsx
// PURPOSE: Unified Enrollment Page with "Pay Now, Start Later" feature
// DYNAMIC: Coach info from site_settings, Pricing from pricing_plans table
// =============================================================================

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import {
  CheckCircle,
  ArrowRight,
  Loader2,
  Shield,
  Star,
  Calendar,
  BookOpen,
  MessageCircle,
  Video,
  Sparkles,
  Award,
  Phone,
  Mail,
  User,
  Baby,
  Clock,
  CreditCard,
  Gift,
  Zap,
  Info,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Coach settings interface
interface CoachSettings {
  name: string;
  title: string;
  rating: string;
  experience: string;
  families: string;
  initial: string;
}

// Default coach settings (fallback)
const DEFAULT_COACH: CoachSettings = {
  name: 'Rucha',
  title: 'Founder & Lead Coach',
  rating: '4.9',
  experience: '7 years exp.',
  families: '100+ families',
  initial: 'R',
};

function EnrollContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Dynamic coach settings from database
  const [coach, setCoach] = useState<CoachSettings>(DEFAULT_COACH);

  // Dynamic pricing from pricing_plans table
  const [pricing, setPricing] = useState({
    programPrice: 5999,
    originalPrice: 9999,
    displayPrice: '₹5,999',
    displayOriginalPrice: '₹9,999',
    discountLabel: 'SAVE 50% — Launch Offer',
    sessionsIncluded: 9,
    durationMonths: 3,
  });

  // Pre-fill from URL params (supports both /enroll direct and redirects from /checkout)
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
  });

  // ==================== NEW: Start Date Selection ====================
  const [startOption, setStartOption] = useState<'now' | 'later'>('now');
  const [startDate, setStartDate] = useState<string>('');

  // Calculate min and max dates for date picker
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 3); // Minimum 3 days from now
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30); // Maximum 30 days from now

  const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const source = searchParams.get('source') || 'direct';

  // WhatsApp - uses dynamic coach name
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to enroll${formData.childName ? ` ${formData.childName}` : ' my child'} in Yestoryd's reading program.`
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Fetch coach settings from site_settings
  useEffect(() => {
    async function fetchCoachSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('key, value')
          .eq('category', 'coach')
          .like('key', 'default_coach_%');

        if (error) {
          console.error('Error fetching coach settings:', error);
          return;
        }

        if (data && data.length > 0) {
          const settings: Partial<CoachSettings> = {};
          data.forEach((row) => {
            const keyName = row.key.replace('default_coach_', '');
            // Parse JSON value (stored as "value" in JSON)
            const parsedValue = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
            settings[keyName as keyof CoachSettings] = parsedValue.replace(/^"|"$/g, '');
          });

          setCoach({
            name: settings.name || DEFAULT_COACH.name,
            title: settings.title || DEFAULT_COACH.title,
            rating: settings.rating || DEFAULT_COACH.rating,
            experience: settings.experience || DEFAULT_COACH.experience,
            families: settings.families || DEFAULT_COACH.families,
            initial: settings.initial || DEFAULT_COACH.initial,
          });
        }
      } catch (err) {
        console.error('Failed to fetch coach settings:', err);
      }
    }

    fetchCoachSettings();

    // Fetch pricing from pricing_plans table
    async function fetchPricingSettings() {
      try {
        const { data, error } = await supabase
          .from('pricing_plans')
          .select('*')
          .eq('slug', 'coaching-3month')
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Error fetching pricing:', error);
          return;
        }

        if (data) {
          setPricing({
            programPrice: data.discounted_price,
            originalPrice: data.original_price,
            displayPrice: `₹${data.discounted_price.toLocaleString('en-IN')}`,
            displayOriginalPrice: `₹${data.original_price.toLocaleString('en-IN')}`,
            discountLabel: data.discount_label || 'SAVE 50% — Launch Offer',
            sessionsIncluded: data.sessions_included || 9,
            durationMonths: data.duration_months || 3,
          });
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      }
    }

    fetchPricingSettings();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!razorpayLoaded) {
      setError('Payment system is loading. Please try again.');
      return;
    }

    // Validate start date if "later" is selected
    if (startOption === 'later' && !startDate) {
      setError('Please select a start date for the program.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create Razorpay order
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pricing.programPrice,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          childName: formData.childName,
          childAge: formData.childAge,
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: 'INR',
        name: 'Yestoryd',
        description: `${pricing.durationMonths}-Month Reading Coaching Program`,
        order_id: data.orderId,
        prefill: {
          name: formData.parentName,
          email: formData.parentEmail,
          contact: formData.parentPhone,
        },
        notes: {
          childName: formData.childName,
          childAge: formData.childAge,
          requestedStartDate: startOption === 'later' ? startDate : 'immediate',
        },
        theme: {
          color: '#ff0099',
        },
        handler: async function (response: any) {
          // Verify payment
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                childName: formData.childName,
                childAge: formData.childAge,
                parentEmail: formData.parentEmail,
                parentPhone: formData.parentPhone,
                parentName: formData.parentName,
                // NEW: Pass start date info
                requestedStartDate: startOption === 'later' ? startDate : null,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok) {
              // Build success URL with all relevant params
              const successParams = new URLSearchParams({
                  childName: formData.childName,
                  enrollmentId: verifyData.enrollmentId || verifyData.data?.enrollmentId || '',
                  coachName: verifyData.coachName || verifyData.data?.coachName || '',
                });

              // Add delayed start info if applicable
              if (startOption === 'later' && startDate) {
                successParams.set('startDate', startDate);
                successParams.set('delayed', 'true');
              }

              window.location.href = `/enrollment/success?${successParams.toString()}`;
            } else {
              setError('Payment verification failed. Please contact support.');
              setLoading(false);
            }
          } catch (err) {
            setError('Payment verification failed. Please contact support.');
            setLoading(false);
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
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const features = [
    { icon: Video, text: '6 One-on-One Sessions' },
    { icon: Calendar, text: '3 Parent Meetings' },
    { icon: BookOpen, text: 'FREE E-Learning Access' },
    { icon: Sparkles, text: 'AI Progress Tracking' },
    { icon: MessageCircle, text: 'WhatsApp Support' },
    { icon: Award, text: 'Completion Certificate' },
  ];

  // Personalized CTA with start date info
  const renderCtaText = () => {
    const name = formData.childName;
    const dateInfo = startOption === 'later' && startDate ? ` • Start ${formatDateForDisplay(startDate)}` : '';

    if (name) {
      return (
        <>
          Enroll <span className="text-yellow-300 font-black">{name}</span> — {pricing.displayPrice}
          {dateInfo && <span className="text-pink-200 text-xs font-normal">{dateInfo}</span>}
        </>
      );
    }
    return `Proceed to Payment — ${pricing.displayPrice}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
          </Link>
          <Link
            href="/lets-talk"
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Book Free Call</span>
            <span className="sm:hidden">Free Call</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-10">
          {/* Left Column - Info (2/5) */}
          <div className="lg:col-span-2 space-y-4">
            {/* URGENCY BADGE */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-amber-800 font-semibold text-sm">Limited Slots Available</p>
                <p className="text-amber-600 text-xs">Only 3 spots left for January batch</p>
              </div>
            </div>

            {/* Coach Card - DYNAMIC from site_settings */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-yellow-600 mb-3">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold text-xs">YOUR READING COACH</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold">
                  {coach.initial}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Coach {coach.name}</h3>
                  <p className="text-green-600 font-medium text-sm">{coach.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">{coach.rating}</span>
                </div>
                <span>{coach.experience}</span>
                <span>{coach.families}</span>
              </div>
            </div>

            {/* What's Included */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3 text-sm">
                <Gift className="w-4 h-4 text-pink-500" />
                What&apos;s Included
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WHAT HAPPENS AFTER PAYMENT - Dynamic based on start option */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3 text-sm">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                After You Enroll
              </h3>
              <ol className="space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                    1
                  </span>
                  <span>Confirmation email with receipt (instant)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                    2
                  </span>
                  <span>Coach {coach.name} WhatsApps to introduce herself (within 24hrs)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                    3
                  </span>
                  <span>
                    {startOption === 'later' && startDate
                      ? `Calendar invites sent 3 days before ${formatDateForDisplay(startDate)}`
                      : `Calendar invites for all ${pricing.sessionsIncluded} sessions (within 24hrs)`}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                    4
                  </span>
                  <span>
                    {startOption === 'later' && startDate
                      ? `First session on ${formatDateForDisplay(startDate)}`
                      : 'First session scheduled within 3-5 days'}
                  </span>
                </li>
              </ol>
            </div>

            {/* Testimonial */}
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <p className="text-gray-700 italic text-sm mb-3">
                &quot;Amazing transformation! Aarav went from struggling to reading confidently in just 2 months.&quot;
              </p>
              <p className="font-bold text-green-700 text-sm">— Priya S., Mumbai</p>
            </div>
          </div>

          {/* Right Column - Form (3/5) */}
          <div className="lg:col-span-3">
            {/* Pricing Card */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{pricing.durationMonths}-Month Reading Coaching</h2>
                    <p className="text-white/80 text-xs">{pricing.sessionsIncluded} sessions • Everything included</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs line-through text-white/60">{pricing.displayOriginalPrice}</div>
                    <div className="text-2xl font-black">{pricing.displayPrice}</div>
                  </div>
                </div>
                <div className="mt-2 inline-block bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full text-xs font-bold">
                  {pricing.discountLabel}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                {/* Parent Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                </div>

                {/* Email & Phone Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="parentEmail"
                        value={formData.parentEmail}
                        onChange={handleInputChange}
                        required
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="parentPhone"
                        value={formData.parentPhone}
                        onChange={handleInputChange}
                        required
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Child Name & Age Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Child&apos;s Name *</label>
                    <div className="relative">
                      <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="childName"
                        value={formData.childName}
                        onChange={handleInputChange}
                        required
                        placeholder="Child's name"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Age (4-12 years) *</label>
                    <select
                      name="childAge"
                      value={formData.childAge}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    >
                      <option value="">Select age</option>
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                        <option key={age} value={age}>
                          {age} years
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ==================== When to Start Section ==================== */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                  <label className="block text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    When would you like to start?
                  </label>

                  {/* Option 1: Start Immediately */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${startOption === 'now'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-pink-200 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="startOption"
                      value="now"
                      checked={startOption === 'now'}
                      onChange={() => setStartOption('now')}
                      className="mt-0.5 w-4 h-4 text-pink-500 border-gray-300 focus:ring-pink-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-pink-500" />
                        <span className="font-semibold text-gray-800 text-sm">Start Immediately</span>
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">Sessions scheduled within 48 hours</p>
                    </div>
                  </label>

                  {/* Option 2: Choose a Date */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${startOption === 'later'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-pink-200 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="startOption"
                      value="later"
                      checked={startOption === 'later'}
                      onChange={() => setStartOption('later')}
                      className="mt-0.5 w-4 h-4 text-pink-500 border-gray-300 focus:ring-pink-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-gray-800 text-sm">Choose a Start Date</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Perfect for after exams, holidays, or travel. Lock in today&apos;s price!
                      </p>

                      {/* Date Picker - Only show when "later" is selected */}
                      {startOption === 'later' && (
                        <div className="mt-2 space-y-2">
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            min={formatDateForInput(minDate)}
                            max={formatDateForInput(maxDate)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          />
                          {startDate && (
                            <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-100 p-2 rounded-lg">
                              <Calendar className="w-3 h-3" />
                              <span>
                                Program starts:{' '}
                                <strong>
                                  {new Date(startDate).toLocaleDateString('en-IN', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                  })}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Info Note */}
                  <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {startOption === 'now'
                        ? "You'll receive your schedule within 48 hours via email and WhatsApp."
                        : "You'll receive a reminder 3 days before your program starts."}
                    </span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{error}</div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !razorpayLoaded}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {renderCtaText()}
                    </>
                  )}
                </button>

                {/* Trust Signals */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 pt-2">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-500" />
                    100% Refund Guarantee
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    Flexible scheduling
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-purple-500" />
                    Certified coach
                  </span>
                </div>

                {/* Secure Payment Badge */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400">Secure payment via Razorpay</span>
                </div>
              </form>

              {/* Alternative */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <p className="text-center text-gray-600 text-xs mb-2">Need help deciding?</p>
                <div className="flex gap-2">
                  <Link
                    href="/lets-talk"
                    className="flex-1 h-10 flex items-center justify-center gap-1 bg-purple-100 text-purple-700 font-semibold rounded-lg text-sm hover:bg-purple-200 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Free Call
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-10 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  );
}
