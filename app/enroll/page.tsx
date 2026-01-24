// =============================================================================
// FILE: app/enroll/page.tsx
// PURPOSE: Unified Enrollment Page with Coupon/Referral Support
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
  Ticket,
  X,
  Check,
  Target,
} from 'lucide-react';
import { LEARNING_GOALS, LearningGoalId } from '@/lib/constants/goals';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';

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

// Discount breakdown interface
interface DiscountBreakdown {
  originalAmount: number;
  couponDiscount: number;
  couponCode: string | null;
  couponInfo: {
    type: string;
    title: string;
    discountType: string;
    discountValue: number;
  } | null;
  creditApplied: number;
  creditRemaining: number;
  totalDiscount: number;
  finalAmount: number;
  maxDiscountPercent: number;
  maxDiscountAmount: number;
  wasCapped: boolean;
  savings: {
    amount: number;
    percent: number;
  };
}

// Product interface for multi-product support
interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  original_price: number;
  discounted_price: number;
  price_display: string;
  savings_display: string | null;
  sessions_included: number;
  coaching_sessions: number;
  parent_sessions: number;
  // Session breakdown from pricing_plans
  sessions_coaching?: number;
  sessions_skill_building?: number;
  sessions_checkin?: number;
  duration_months: number;
  features: string[];
  is_featured: boolean;
  badge_text: string | null;
  display_order: number;
  available: boolean;
  eligibility_message: string | null;
}

function EnrollContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Dynamic coach settings from database
  const [coach, setCoach] = useState<CoachSettings>(DEFAULT_COACH);

  // Product selection state
  const productParam = searchParams.get('product') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>(productParam || 'full');
  const [productsLoading, setProductsLoading] = useState(true);
  const [starterCompleted, setStarterCompleted] = useState(false);

  // Get selected product from products array
  const selectedProduct = products.find(p => p.slug === selectedProductSlug) || products.find(p => p.slug === 'full');

  // Dynamic pricing from selected product (fetched from pricing_plans table)
  // No hardcoded defaults - show loading until data arrives
  const [pricing, setPricing] = useState<{
    programPrice: number;
    originalPrice: number;
    displayPrice: string;
    displayOriginalPrice: string;
    discountLabel: string;
    sessionsIncluded: number;
    durationMonths: number;
  } | null>(null);

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

  // ==================== NEW: Coupon/Discount State ====================
  const [couponCode, setCouponCode] = useState(searchParams.get('ref') || searchParams.get('coupon') || '');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [discountBreakdown, setDiscountBreakdown] = useState<DiscountBreakdown | null>(null);

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
  const discoveryCallId = searchParams.get('discoveryCallId') || '';
  const childId = searchParams.get('childId') || '';
  const assessmentScore = searchParams.get('assessmentScore') ? parseInt(searchParams.get('assessmentScore')!) : null;

  // Log enrollment page view for analytics
  useEffect(() => {
    console.log(JSON.stringify({
      event: 'enroll_page_viewed',
      source,
      childId: childId || null,
      assessmentScore,
      hasParentName: !!formData.parentName,
      timestamp: new Date().toISOString(),
    }));
  }, []);

  // Parse goals from URL params - convert to state for GoalsCapture fallback
  const goalsParam = searchParams.get('goals') || '';
  const [goals, setGoals] = useState<string[]>(
    goalsParam ? goalsParam.split(',').filter(g => g in LEARNING_GOALS) : []
  );

  // Child age state - needed for GoalsCapture
  const childAgeParam = searchParams.get('childAge');
  const [childAgeForGoals, setChildAgeForGoals] = useState<number>(
    childAgeParam ? parseInt(childAgeParam) : parseInt(formData.childAge) || 7
  );

  // Fetch child data if age not in URL but childId exists
  useEffect(() => {
    if (childId && !childAgeParam && !formData.childAge) {
      fetch(`/api/children/${childId}`)
        .then(res => res.json())
        .then(data => {
          if (data.age) {
            setChildAgeForGoals(data.age);
            setFormData(prev => ({ ...prev, childAge: data.age.toString() }));
          }
          if (data.parent_goals?.length > 0 && goals.length === 0) {
            setGoals(data.parent_goals);
          }
        })
        .catch(console.error);
    }
  }, [childId, childAgeParam, formData.childAge]);

  // Capitalize childName for display
  const displayChildName = formData.childName
    ? formData.childName.charAt(0).toUpperCase() + formData.childName.slice(1).toLowerCase()
    : 'your child';

  // WhatsApp - uses dynamic coach name
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to enroll${formData.childName ? ` ${formData.childName}` : ' my child'} in Yestoryd's reading program.`
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        setProductsLoading(true);
        const url = childId
          ? `/api/products?childId=${childId}`
          : '/api/products';

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.products) {
          setProducts(data.products);

          // Set starter completion status
          if (data.starterStatus?.completed) {
            setStarterCompleted(true);
          }

          // If product param is provided, select it
          if (productParam && data.products.find((p: Product) => p.slug === productParam)) {
            setSelectedProductSlug(productParam);
          } else if (!productParam) {
            // Default to 'full' if no param
            setSelectedProductSlug('full');
          }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setProductsLoading(false);
      }
    }

    fetchProducts();
  }, [childId, productParam]);

  // Update pricing when selected product changes
  useEffect(() => {
    if (selectedProduct) {
      setPricing({
        programPrice: selectedProduct.discounted_price,
        originalPrice: selectedProduct.original_price,
        displayPrice: selectedProduct.price_display,
        displayOriginalPrice: `₹${selectedProduct.original_price.toLocaleString('en-IN')}`,
        discountLabel: selectedProduct.savings_display || '',
        sessionsIncluded: selectedProduct.sessions_included,
        durationMonths: selectedProduct.duration_months,
      });
    }
  }, [selectedProduct]);

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
  }, []);

  // Auto-apply coupon from URL if present (after pricing loads)
  useEffect(() => {
    if (pricing && couponCode && !couponApplied) {
      handleApplyCoupon();
    }
  }, [pricing?.programPrice]); // Run after pricing loads from API

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

  // ==================== Coupon Functions ====================
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    setCouponError('');

    try {
      const response = await fetch('/api/coupons/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: couponCode.trim().toUpperCase(),
          productType: 'coaching',
          applyCredit: false, // Can add credit checkbox later
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCouponError(data.error || 'Invalid coupon code');
        setCouponApplied(false);
        setDiscountBreakdown(null);
        return;
      }

      if (data.breakdown.couponDiscount === 0) {
        setCouponError('Coupon code not found or expired');
        setCouponApplied(false);
        setDiscountBreakdown(null);
        return;
      }

      setDiscountBreakdown(data.breakdown);
      setCouponApplied(true);
      setCouponError('');
    } catch (err) {
      setCouponError('Failed to apply coupon');
      setCouponApplied(false);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setDiscountBreakdown(null);
    setCouponError('');
  };

  // Get final amount to charge
  const getFinalAmount = () => {
    if (discountBreakdown) {
      return discountBreakdown.finalAmount;
    }
    return pricing?.programPrice ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!razorpayLoaded) {
      setError('Payment system is loading. Please try again.');
      return;
    }

    if (!pricing) {
      setError('Pricing is still loading. Please wait a moment.');
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
      // Create Razorpay order with discounted amount
      const finalAmount = getFinalAmount();

      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Product selection
          productCode: selectedProductSlug || 'full',
          // Amount (server will validate from product)
          amount: finalAmount,
          // Parent/Child info
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          childName: formData.childName,
          childAge: formData.childAge,
          childId: childId || null,
          source,
          // Coupon info
          couponCode: couponApplied ? couponCode : null,
          discoveryCallId: discoveryCallId || null,
          originalAmount: pricing?.programPrice ?? 0,
          discountAmount: discountBreakdown?.totalDiscount || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      // [ORDER:1] Log order created
      console.log('[ORDER:1] Order created successfully:', {
        orderId: data.orderId,
        amountRupees: data.amount,
        amountPaise: data.amount * 100,
        productCode: selectedProductSlug,
        childName: formData.childName,
      });

      // Open Razorpay checkout
      // Note: amount should be in paise for Razorpay (though it uses order amount when order_id is present)
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount * 100, // Convert to paise for Razorpay
        currency: 'INR',
        name: 'Yestoryd',
        description: `${pricing?.durationMonths ?? 3}-Month Reading Coaching Program`,
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
          couponCode: couponApplied ? couponCode : '',
          originalAmount: pricing?.programPrice ?? 0,
          discountAmount: discountBreakdown?.totalDiscount || 0,
        },
        theme: {
          color: '#ff0099',
        },
        handler: async function (response: any) {
          // STEP 1: All logging and processing inside try block for safety
          try {
            // [PAY:1] Log callback received
            console.log('[PAY:1] Razorpay callback received:', {
              order_id: response?.razorpay_order_id || 'MISSING',
              payment_id: response?.razorpay_payment_id || 'MISSING',
              signature_present: !!response?.razorpay_signature,
              timestamp: new Date().toISOString(),
            });

            // [PAY:2] Validate response has required fields
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              console.error('[PAY:2] INVALID RESPONSE - Missing required fields');
              setError('Payment response incomplete. Please contact support.');
              setLoading(false);
              return;
            }

            // [PAY:3] Build verify payload
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              productCode: selectedProductSlug || 'full',
              childName: formData.childName,
              childAge: formData.childAge,
              childId: childId || null,
              parentEmail: formData.parentEmail,
              parentPhone: formData.parentPhone,
              parentName: formData.parentName,
              requestedStartDate: startOption === 'later' ? startDate : null,
              couponCode: couponApplied ? couponCode : null,
              discoveryCallId: discoveryCallId || null,
              originalAmount: pricing?.programPrice ?? 0,
              discountAmount: discountBreakdown?.totalDiscount || 0,
            };
            console.log('[PAY:3] Verify payload prepared:', {
              ...verifyPayload,
              razorpay_signature: verifyPayload.razorpay_signature.substring(0, 10) + '...',
            });

            // [PAY:4] Call verify API with 60-second timeout
            console.log('[PAY:4] Calling /api/payment/verify...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
              if (fetchErr.name === 'AbortError') {
                console.error('[PAY:4] TIMEOUT - Verify request took too long (60s)');
                setError('Payment verification timed out. Your payment was received - please contact support with order ID: ' + response.razorpay_order_id);
              } else {
                console.error('[PAY:4] FETCH ERROR:', fetchErr.message);
                setError('Network error during verification. Please contact support with order ID: ' + response.razorpay_order_id);
              }
              setLoading(false);
              return;
            }

            // [PAY:5] Log response status
            console.log('[PAY:5] Verify response status:', verifyRes.status, verifyRes.statusText);

            // [PAY:6] Parse response body
            let verifyData: any;
            try {
              const rawText = await verifyRes.clone().text();
              console.log('[PAY:6] Raw response body length:', rawText.length);
              if (rawText.length === 0) {
                console.error('[PAY:6] EMPTY RESPONSE BODY');
                setError('Empty response from server. Please contact support with order ID: ' + response.razorpay_order_id);
                setLoading(false);
                return;
              }
              verifyData = JSON.parse(rawText);
              console.log('[PAY:7] Parsed response:', JSON.stringify(verifyData, null, 2));
            } catch (parseErr: any) {
              console.error('[PAY:6] JSON PARSE ERROR:', parseErr.message);
              setError('Invalid response from server. Please contact support with order ID: ' + response.razorpay_order_id);
              setLoading(false);
              return;
            }

            // [PAY:8] Check for success with redirectUrl
            if (verifyData.success && verifyData.redirectUrl) {
              console.log('[PAY:8] SUCCESS! Redirecting to:', verifyData.redirectUrl);
              window.location.href = verifyData.redirectUrl;
              return;
            }

            // [PAY:9] Fallback: Build redirect URL if API didn't provide one but success is true
            if (verifyData.success && verifyData.enrollmentId) {
              console.log('[PAY:9] Building fallback redirect URL...');
              const successParams = new URLSearchParams({
                childName: formData.childName,
                enrollmentId: verifyData.enrollmentId || verifyData.data?.enrollmentId || '',
                coachName: verifyData.data?.coachName || '',
                sessions: String(verifyData.data?.product?.sessionsIncluded || pricing?.sessionsIncluded || 9),
                product: selectedProduct?.name || 'Full Program',
              });

              if (startOption === 'later' && startDate) {
                successParams.set('startDate', startDate);
                successParams.set('delayed', 'true');
              }

              if (discountBreakdown?.totalDiscount) {
                successParams.set('saved', discountBreakdown.totalDiscount.toString());
              }

              const fallbackUrl = `/enrollment/success?${successParams.toString()}`;
              console.log('[PAY:9] Fallback redirect to:', fallbackUrl);
              window.location.href = fallbackUrl;
              return;
            }

            // [PAY:10] Verification failed - show error
            console.error('[PAY:10] Verification failed:', {
              success: verifyData.success,
              hasRedirectUrl: !!verifyData.redirectUrl,
              hasEnrollmentId: !!verifyData.enrollmentId,
              error: verifyData.error,
            });
            setError(verifyData.error || 'Payment verification failed. Please contact support with order ID: ' + response.razorpay_order_id);
            setLoading(false);
          } catch (err: any) {
            console.error('[PAY:ERR] Unhandled exception in payment handler:', err);
            console.error('[PAY:ERR] Stack:', err.stack);
            setError('An unexpected error occurred. Please contact support.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            console.log('[ORDER:DISMISS] Razorpay modal dismissed by user');
            setLoading(false);
          },
        },
      };

      // [ORDER:2] Log Razorpay options and open checkout
      console.log('[ORDER:2] Opening Razorpay checkout:', {
        orderId: options.order_id,
        amountPaise: options.amount,
        hasKey: !!options.key,
        prefill: { name: options.prefill.name, email: options.prefill.email },
      });

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      console.log('[ORDER:3] Razorpay checkout opened');
    } catch (err: any) {
      console.error('[ORDER:ERR] Error in payment flow:', err.message);
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  // Dynamic features based on selected product
  const getFeatures = () => {
    // Get session counts from selected product
    const coachingSessions = selectedProduct?.sessions_coaching ?? selectedProduct?.coaching_sessions ?? 6;
    const skillBuildingSessions = selectedProduct?.sessions_skill_building ?? 0;
    const checkinSessions = selectedProduct?.sessions_checkin ?? selectedProduct?.parent_sessions ?? 3;
    const isStarter = selectedProduct?.slug === 'starter';
    const isFull = selectedProduct?.slug === 'full';

    // Build features array dynamically
    const featuresList: Array<{ icon: typeof Video; text: string }> = [];

    // Coaching Sessions (always show)
    featuresList.push({
      icon: Video,
      text: `${coachingSessions} Coaching Session${coachingSessions !== 1 ? 's' : ''} (45 min)`,
    });

    // Skill Building Sessions (only if > 0)
    if (skillBuildingSessions > 0) {
      featuresList.push({
        icon: BookOpen,
        text: `${skillBuildingSessions} Skill Building Session${skillBuildingSessions !== 1 ? 's' : ''} (45 min)`,
      });
    }

    // Parent Check-ins (always show if > 0)
    if (checkinSessions > 0) {
      featuresList.push({
        icon: Calendar,
        text: `${checkinSessions} Parent Check-in${checkinSessions !== 1 ? 's' : ''} (30 min)`,
      });
    }

    // AI Progress Report/Tracking
    featuresList.push({
      icon: Sparkles,
      text: isStarter ? 'AI Progress Report' : 'AI Progress Tracking',
    });

    // WhatsApp Support
    featuresList.push({
      icon: MessageCircle,
      text: 'WhatsApp Support',
    });

    // Completion Certificate (not for starter)
    if (!isStarter) {
      featuresList.push({
        icon: Award,
        text: 'Completion Certificate',
      });
    }

    // FREE E-Learning Access (only for full program)
    if (isFull) {
      featuresList.push({
        icon: Gift,
        text: 'FREE E-Learning Access',
      });
    }

    return featuresList;
  };

  // Re-calculate features when selected product changes
  const features = getFeatures();

  // Personalized CTA with start date info
  const renderCtaText = () => {
    const name = formData.childName;
    const finalAmount = getFinalAmount();
    const displayAmount = `₹${finalAmount.toLocaleString('en-IN')}`;
    const dateInfo = startOption === 'later' && startDate ? ` • Start ${formatDateForDisplay(startDate)}` : '';

    if (name) {
      return (
        <>
          Enroll <span className="text-yellow-300 font-black">{name}</span> — {displayAmount}
          {dateInfo && <span className="text-pink-200 text-xs font-normal">{dateInfo}</span>}
        </>
      );
    }
    return `Proceed to Payment — ${displayAmount}`;
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 overflow-x-hidden">

        {/* ========================================
            ATTENTION: Program Selection (ALWAYS FIRST)
            ======================================== */}
        {products.length > 1 && (
          <section className="mb-6 sm:mb-8 w-full max-w-md mx-auto lg:max-w-none">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF0099]" />
              Select Your Program
            </h1>
            <div className="space-y-3">
              {products.map((product) => {
                const isSelected = selectedProductSlug === product.slug;
                const isAvailable = product.available;

                return (
                  <button
                    key={product.id}
                    onClick={() => isAvailable && setSelectedProductSlug(product.slug)}
                    disabled={!isAvailable}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-[#FF0099] bg-[#FF0099]/5 shadow-sm'
                        : isAvailable
                        ? 'border-gray-200 hover:border-[#FF0099]/50 bg-white'
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-[#FF0099] bg-[#FF0099]' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold text-sm sm:text-base leading-tight ${isSelected ? 'text-[#FF0099]' : 'text-gray-900'}`}>
                            {product.name}
                            {product.is_featured && (
                              <span className="ml-2 px-2 py-0.5 bg-[#FF0099]/10 text-[#FF0099] text-[10px] rounded-full font-bold">
                                BEST VALUE
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {product.sessions_included} sessions • {product.duration_months} month{product.duration_months > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-base sm:text-lg ${isSelected ? 'text-[#FF0099]' : 'text-gray-900'}`}>
                          {product.price_display}
                        </p>
                        {product.savings_display && (
                          <p className="text-xs text-green-600 font-medium">{product.savings_display}</p>
                        )}
                      </div>
                    </div>
                    {!isAvailable && product.eligibility_message && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3 flex-shrink-0" />
                        {product.eligibility_message}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Continuation eligibility message */}
            {selectedProductSlug === 'continuation' && !starterCompleted && childId && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm">Starter Pack Required</p>
                  <p className="text-amber-600 text-xs">Complete the Starter Pack first to enroll in the Continuation program.</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================
            DESKTOP: Two columns | MOBILE: Stacked (AIDA order)
            ======================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">

          {/* LEFT COLUMN: INTEREST + DESIRE sections */}
          <div className="order-1 lg:order-1 lg:col-span-2 space-y-5 w-full max-w-md mx-auto lg:max-w-none">

            {/* INTEREST: What's Included */}
            <section className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4 text-sm">
                <Gift className="w-4 h-4 text-[#FF0099]" />
                What&apos;s Included
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-xs leading-tight">{feature.text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* INTEREST: Your Reading Coach */}
            <section className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h2 className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
                <Sparkles className="w-4 h-4 text-[#FF0099]" />
                Your Reading Coach
              </h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FF0099] to-[#FF0099]/70 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {coach.initial}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Coach {coach.name}</h3>
                  <p className="text-[#FF0099] font-medium text-sm">{coach.title}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="font-semibold">{coach.rating}</span>
                </span>
                <span>{coach.experience}</span>
                <span>{coach.families}</span>
              </div>
            </section>

            {/* DESIRE: Focus Areas (Goals) */}
            {(goals.length > 0 || childId) && (
              <section className="bg-gradient-to-br from-[#FF0099]/5 to-[#00ABFF]/5 rounded-2xl p-5 border border-[#FF0099]/10">
                {goals.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-[#FF0099]" />
                      <p className="text-gray-900 font-semibold text-sm">
                        {displayChildName}&apos;s Focus Areas
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {goals.map((goalId) => {
                        const goal = LEARNING_GOALS[goalId];
                        if (!goal) return null;
                        return (
                          <span
                            key={goalId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200"
                          >
                            <Check className="w-3 h-3 text-[#FF0099]" />
                            {goal.shortLabel || goal.label}
                          </span>
                        );
                      })}
                    </div>
                  </>
                ) : childId ? (
                  <GoalsCapture
                    childId={childId}
                    childName={displayChildName}
                    childAge={childAgeForGoals}
                    onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
                  />
                ) : null}
              </section>
            )}

            {/* DESIRE: Testimonial */}
            <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
                ))}
              </div>
              <blockquote className="text-gray-700 italic text-sm mb-3">
                &quot;Amazing transformation! Aarav went from struggling to reading confidently in just 2 months.&quot;
              </blockquote>
              <cite className="text-sm font-semibold text-gray-900 not-italic">
                — Priya S., Mumbai
              </cite>
            </section>

            {/* After You Enroll - Desktop only */}
            <section className="hidden lg:block bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4 text-sm">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                After You Enroll
              </h3>
              <ol className="space-y-2.5 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
                  <span>Confirmation email with receipt (instant)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
                  <span>Coach {coach.name} WhatsApps to introduce herself</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
                  <span>Calendar invites for all sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
                  <span>First session within 3-5 days</span>
                </li>
              </ol>
            </section>

          </div>

          {/* RIGHT COLUMN: ACTION - Form & CTA */}
          <div className="order-2 lg:order-2 lg:col-span-3 w-full max-w-md mx-auto lg:max-w-none">
            {/* Pricing Card */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white">
                {!pricing ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span>Loading pricing...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-bold truncate">
                          {selectedProduct?.name || `${pricing.durationMonths}-Month Reading Coaching`}
                        </h2>
                        <p className="text-white/80 text-xs">{pricing.sessionsIncluded} sessions • Everything included</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {pricing.originalPrice > pricing.programPrice && (
                          <div className="text-xs line-through text-white/60">{pricing.displayOriginalPrice}</div>
                        )}
                        <div className="text-xl sm:text-2xl font-black">{pricing.displayPrice}</div>
                      </div>
                    </div>
                    {pricing.discountLabel && (
                      <div className="mt-2 inline-block bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full text-xs font-bold">
                        {pricing.discountLabel}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Personalized Welcome - if coming from assessment/lets-talk */}
              {(formData.parentName || formData.childName) && source !== 'direct' && (
                <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                  <p className="text-sm text-gray-700 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-pink-500 flex-shrink-0 mt-0.5" />
                    <span className="break-words">
                      {formData.parentName ? (
                        <>Welcome back, <strong className="break-all">{formData.parentName.split(' ')[0]}</strong>! {formData.childName ? `Ready to start ${formData.childName}'s reading journey?` : 'Complete your enrollment below.'}</>
                      ) : (
                        <>Ready to start <strong className="break-all">{formData.childName}</strong>'s reading journey?</>
                      )}
                    </span>
                  </p>
                </div>
              )}

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        placeholder="email@example.com"
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
                        placeholder="98765 43210"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Child Name & Age Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        placeholder="Child's first name"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Child&apos;s Age *</label>
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

                {/* ==================== NEW: Coupon/Referral Section ==================== */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
                  <label className="block text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-pink-500" />
                    Have a coupon or referral code?
                  </label>

                  {!couponApplied ? (
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="flex-shrink-0 px-3 sm:px-4 py-2 bg-pink-500 text-white font-semibold rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {couponLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800 text-sm">
                            {couponCode} applied!
                          </p>
                          <p className="text-green-600 text-xs">
                            You save ₹{discountBreakdown?.totalDiscount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {couponError}
                    </p>
                  )}

                  {/* Price Breakdown - Only show when coupon applied */}
                  {couponApplied && discountBreakdown && (
                    <div className="pt-2 border-t border-gray-200 space-y-1.5">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Original Price</span>
                        <span>₹{discountBreakdown.originalAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Coupon Discount</span>
                        <span>-₹{discountBreakdown.couponDiscount.toLocaleString('en-IN')}</span>
                      </div>
                      {discountBreakdown.creditApplied > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Credit Applied</span>
                          <span>-₹{discountBreakdown.creditApplied.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                        <span>Final Amount</span>
                        <span className="text-pink-600">₹{discountBreakdown.finalAmount.toLocaleString('en-IN')}</span>
                      </div>
                      {discountBreakdown.wasCapped && (
                        <p className="text-xs text-gray-500 italic">
                          Maximum {discountBreakdown.maxDiscountPercent}% discount applied
                        </p>
                      )}
                    </div>
                  )}
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
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-gray-500 pt-2">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">100% Refund</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">Flexible</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">Certified</span>
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


