// =============================================================================
// FILE: app/enroll/page.tsx
// PURPOSE: Unified Enrollment Page with Coupon/Referral Support
// DYNAMIC: Coach info from site_settings, Pricing from pricing_plans table
// MODULARIZED: Components in ./_components/
// =============================================================================

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Video, BookOpen, Calendar, Sparkles, MessageCircle, Award, Gift, CheckCircle } from 'lucide-react';
import { LEARNING_GOALS } from '@/lib/constants/goals';
import { useSessionDurations } from '@/contexts/SiteSettingsContext';
import {
  EnrollHeader,
  ProductSelector,
  WhatsIncluded,
  CoachCard,
  FocusAreasCard,
  TestimonialCard,
  AfterEnrollSteps,
  StartDateSelector,
  CouponInput,
  EnrollForm,
  PaymentSection,
} from './_components';
import { TimeBucketSelector, DayOfWeekSelector } from '@/components/ui/scheduling';

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

// ==================== INTERFACES ====================
interface CoachSettings {
  name: string;
  title: string;
  rating: string;
  experience: string;
  families: string;
  initial: string;
}

interface DiscountBreakdown {
  originalAmount: number;
  couponDiscount: number;
  couponCode: string | null;
  couponInfo: { type: string; title: string; discountType: string; discountValue: number } | null;
  creditApplied: number;
  creditRemaining: number;
  totalDiscount: number;
  finalAmount: number;
  maxDiscountPercent: number;
  maxDiscountAmount: number;
  wasCapped: boolean;
  savings: { amount: number; percent: number };
}

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
  // New columns
  week_range?: string | null;
  is_locked?: boolean;
  lock_message?: string | null;
  duration_coaching_mins?: number;
  duration_skill_mins?: number;
  duration_checkin_mins?: number;
  phase_number?: number | null;
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

// ==================== MAIN COMPONENT ====================
function EnrollContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const durations = useSessionDurations();

  // === CORE STATE ===
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [coach, setCoach] = useState<CoachSettings>(DEFAULT_COACH);
  const [whatsappNumber, setWhatsappNumber] = useState('918976287997');

  // === PRODUCT STATE ===
  const productParam = searchParams.get('product') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>(productParam || 'full');
  const [productsLoading, setProductsLoading] = useState(true);
  const [starterCompleted, setStarterCompleted] = useState(false);
  const selectedProduct = products.find(p => p.slug === selectedProductSlug) || products.find(p => p.slug === 'full');

  // === PRICING STATE ===
  const [pricing, setPricing] = useState<{
    programPrice: number;
    originalPrice: number;
    displayPrice: string;
    displayOriginalPrice: string;
    discountLabel: string;
    sessionsIncluded: number;
    durationMonths: number;
  } | null>(null);

  // === FORM STATE ===
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
  });

  // === START DATE STATE ===
  const [startOption, setStartOption] = useState<'now' | 'later'>('now');
  const [startDate, setStartDate] = useState<string>('');
  const today = new Date();
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + 3);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 30);
  const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

  // === SCHEDULING PREFERENCE STATE ===
  const [preferenceTimeBucket, setPreferenceTimeBucket] = useState<'morning' | 'afternoon' | 'evening' | 'any'>('any');
  const [preferenceDays, setPreferenceDays] = useState<number[]>([]);

  // === COUPON STATE ===
  const [couponCode, setCouponCode] = useState(searchParams.get('ref') || searchParams.get('coupon') || '');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [discountBreakdown, setDiscountBreakdown] = useState<DiscountBreakdown | null>(null);

  // === GOALS STATE ===
  const goalsParam = searchParams.get('goals') || '';
  const [goals, setGoals] = useState<string[]>(
    goalsParam ? goalsParam.split(',').filter(g => g in LEARNING_GOALS) : []
  );
  const childAgeParam = searchParams.get('childAge');
  const [childAgeForGoals, setChildAgeForGoals] = useState<number>(
    childAgeParam ? parseInt(childAgeParam) : parseInt(formData.childAge) || 7
  );

  // === URL PARAMS ===
  const source = searchParams.get('source') || 'direct';
  const discoveryCallId = searchParams.get('discoveryCallId') || '';
  const childId = searchParams.get('childId') || '';

  // === COMPUTED ===
  const displayChildName = formData.childName
    ? formData.childName.charAt(0).toUpperCase() + formData.childName.slice(1).toLowerCase()
    : 'your child';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to enroll${formData.childName ? ` ${formData.childName}` : ' my child'} in Yestoryd's reading program.`
  );

  // === HANDLERS ===
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getFinalAmount = () => discountBreakdown ? discountBreakdown.finalAmount : (pricing?.programPrice ?? 0);

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

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

  // === COUPON HANDLERS ===
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) { setCouponError('Please enter a coupon code'); return; }
    setCouponLoading(true);
    setCouponError('');
    try {
      const response = await fetch('/api/coupons/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: couponCode.trim().toUpperCase(), productType: 'coaching', applyCredit: false }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) { setCouponError(data.error || 'Invalid coupon code'); setCouponApplied(false); setDiscountBreakdown(null); return; }
      if (data.breakdown.couponDiscount === 0) { setCouponError('Coupon code not found or expired'); setCouponApplied(false); setDiscountBreakdown(null); return; }
      setDiscountBreakdown(data.breakdown);
      setCouponApplied(true);
      setCouponError('');
    } catch { setCouponError('Failed to apply coupon'); setCouponApplied(false); }
    finally { setCouponLoading(false); }
  };

  const handleRemoveCoupon = () => {
    setCouponCode(''); setCouponApplied(false); setDiscountBreakdown(null); setCouponError('');
  };

  // === PAYMENT HANDLER ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razorpayLoaded) { setError('Payment system is loading. Please try again.'); return; }
    if (!pricing) { setError('Pricing is still loading. Please wait a moment.'); return; }
    if (startOption === 'later' && !startDate) { setError('Please select a start date for the program.'); return; }

    setLoading(true);
    setError('');

    try {
      const finalAmount = getFinalAmount();
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: selectedProductSlug || 'full',
          amount: finalAmount,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          childName: formData.childName,
          childAge: formData.childAge,
          childId: childId || null,
          source,
          couponCode: couponApplied ? couponCode : null,
          discoveryCallId: discoveryCallId || null,
          originalAmount: pricing?.programPrice ?? 0,
          discountAmount: discountBreakdown?.totalDiscount || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create order');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount * 100,
        currency: 'INR',
        name: 'Yestoryd',
        description: `${pricing?.durationMonths ?? 3}-Month Reading Coaching Program`,
        order_id: data.orderId,
        prefill: { name: formData.parentName, email: formData.parentEmail, contact: formData.parentPhone },
        notes: { childName: formData.childName, childAge: formData.childAge, requestedStartDate: startOption === 'later' ? startDate : 'immediate', couponCode: couponApplied ? couponCode : '', originalAmount: pricing?.programPrice ?? 0, discountAmount: discountBreakdown?.totalDiscount || 0 },
        theme: { color: '#ff0099' },
        handler: async function (response: any) {
          try {
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              setError('Payment response incomplete. Please contact support.');
              setLoading(false);
              return;
            }
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
              // Scheduling preferences
              preferenceTimeBucket: preferenceTimeBucket !== 'any' ? preferenceTimeBucket : null,
              preferenceDays: preferenceDays.length > 0 ? preferenceDays : null,
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            let verifyRes: Response;
            try {
              verifyRes = await fetch('/api/payment/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(verifyPayload), signal: controller.signal });
              clearTimeout(timeoutId);
            } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              setError(fetchErr.name === 'AbortError' ? 'Payment verification timed out. Your payment was received - please contact support with order ID: ' + response.razorpay_order_id : 'Network error during verification. Please contact support with order ID: ' + response.razorpay_order_id);
              setLoading(false);
              return;
            }
            const verifyData = await verifyRes.json();
            if (verifyData.success && verifyData.redirectUrl) { window.location.href = verifyData.redirectUrl; return; }
            if (verifyData.success && verifyData.enrollmentId) {
              const successParams = new URLSearchParams({ childName: formData.childName, enrollmentId: verifyData.enrollmentId || '', coachName: verifyData.data?.coachName || '', sessions: String(pricing?.sessionsIncluded || 9), product: selectedProduct?.name || 'Full Program' });
              if (startOption === 'later' && startDate) { successParams.set('startDate', startDate); successParams.set('delayed', 'true'); }
              if (discountBreakdown?.totalDiscount) { successParams.set('saved', discountBreakdown.totalDiscount.toString()); }
              window.location.href = `/enrollment/success?${successParams.toString()}`;
              return;
            }
            setError(verifyData.error || 'Payment verification failed. Please contact support with order ID: ' + response.razorpay_order_id);
            setLoading(false);
          } catch (err: any) { setError('An unexpected error occurred. Please contact support.'); setLoading(false); }
        },
        modal: { ondismiss: function () { setLoading(false); } },
      };
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) { setError(err.message || 'Something went wrong'); setLoading(false); }
  };

  // === FEATURES COMPUTATION ===
  const getFeatures = () => {
    if (!selectedProduct) return [];

    // Get session counts and durations (use product-specific durations if available, else context)
    const coachingSessions = selectedProduct?.sessions_coaching ?? selectedProduct?.coaching_sessions ?? 6;
    const skillBuildingSessions = selectedProduct?.sessions_skill_building ?? 0;
    const checkinSessions = selectedProduct?.sessions_checkin ?? selectedProduct?.parent_sessions ?? 3;
    const coachingMins = selectedProduct?.duration_coaching_mins ?? durations.coaching;
    const skillMins = selectedProduct?.duration_skill_mins ?? durations.skillBuilding;
    const checkinMins = selectedProduct?.duration_checkin_mins ?? durations.checkin;

    const featuresList: Array<{ icon: typeof Video; text: string }> = [];

    // Session breakdown (always show these first)
    featuresList.push({ icon: Video, text: `${coachingSessions} Coaching Session${coachingSessions !== 1 ? 's' : ''} (${coachingMins} min)` });
    if (skillBuildingSessions > 0) {
      featuresList.push({ icon: BookOpen, text: `${skillBuildingSessions} Skill Building Session${skillBuildingSessions !== 1 ? 's' : ''} (${skillMins} min)` });
    }
    if (checkinSessions > 0) {
      featuresList.push({ icon: Calendar, text: `${checkinSessions} Parent Check-in${checkinSessions !== 1 ? 's' : ''} (${checkinMins} min)` });
    }

    // Map DB features to icons based on keywords
    const iconMap: Record<string, typeof Video> = {
      'e-learning': BookOpen,
      'learning': BookOpen,
      'ai progress': Sparkles,
      'rAI': Sparkles,
      'whatsapp': MessageCircle,
      'recording': Video,
      'certificate': Award,
      'priority': Calendar,
      'scheduling': Calendar,
    };

    // Add features from database
    const dbFeatures = selectedProduct.features || [];
    dbFeatures.forEach((feature: string) => {
      const featureLower = feature.toLowerCase();
      const matchedKey = Object.keys(iconMap).find(key => featureLower.includes(key));
      featuresList.push({
        icon: matchedKey ? iconMap[matchedKey] : CheckCircle,
        text: feature,
      });
    });

    return featuresList;
  };

  // === DATA FETCHING ===
  useEffect(() => {
    async function fetchProducts() {
      try {
        setProductsLoading(true);
        const url = childId ? `/api/products?childId=${childId}` : '/api/products';
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.products) {
          setProducts(data.products);
          if (data.starterStatus?.completed) setStarterCompleted(true);
          if (productParam && data.products.find((p: Product) => p.slug === productParam)) setSelectedProductSlug(productParam);
          else if (!productParam) setSelectedProductSlug('full');
        }
      } catch (err) { console.error('Failed to fetch products:', err); }
      finally { setProductsLoading(false); }
    }
    fetchProducts();
  }, [childId, productParam]);

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

  // Redirect if locked product is selected
  useEffect(() => {
    if (selectedProduct?.is_locked) {
      router.push('/#pricing');
    }
  }, [selectedProduct?.is_locked, router]);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data: coachData, error: coachError } = await supabase.from('site_settings').select('key, value').eq('category', 'coach').like('key', 'default_coach_%');
        if (!coachError && coachData && coachData.length > 0) {
          const settings: Partial<CoachSettings> = {};
          coachData.forEach((row) => { const keyName = row.key.replace('default_coach_', ''); const parsedValue = typeof row.value === 'string' ? row.value : JSON.stringify(row.value); settings[keyName as keyof CoachSettings] = parsedValue.replace(/^"|"$/g, ''); });
          setCoach({ name: settings.name || DEFAULT_COACH.name, title: settings.title || DEFAULT_COACH.title, rating: settings.rating || DEFAULT_COACH.rating, experience: settings.experience || DEFAULT_COACH.experience, families: settings.families || DEFAULT_COACH.families, initial: settings.initial || DEFAULT_COACH.initial });
        }
        const { data: whatsappData, error: whatsappError } = await supabase.from('site_settings').select('value').eq('key', 'whatsapp_number').single();
        if (!whatsappError && whatsappData?.value) setWhatsappNumber(whatsappData.value.replace('+', ''));
      } catch (err) { console.error('Failed to fetch settings:', err); }
    }
    fetchSettings();
  }, []);

  useEffect(() => { if (pricing && couponCode && !couponApplied) handleApplyCoupon(); }, [pricing?.programPrice]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else { setRazorpayLoaded(true); }
  }, []);

  useEffect(() => {
    if (childId && !childAgeParam && !formData.childAge) {
      fetch(`/api/children/${childId}`).then(res => res.json()).then(data => {
        if (data.age) { setChildAgeForGoals(data.age); setFormData(prev => ({ ...prev, childAge: data.age.toString() })); }
        if (data.parent_goals?.length > 0 && goals.length === 0) setGoals(data.parent_goals);
      }).catch(console.error);
    }
  }, [childId, childAgeParam, formData.childAge]);

  // === RENDER ===
  return (
    <div className="min-h-screen bg-surface-0 overflow-x-hidden">
      <EnrollHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 overflow-x-hidden">
        <ProductSelector
          products={products}
          selectedProductSlug={selectedProductSlug}
          onSelect={setSelectedProductSlug}
          starterCompleted={starterCompleted}
          childId={childId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
          {/* LEFT COLUMN */}
          <div className="order-1 lg:order-1 lg:col-span-2 space-y-5 w-full max-w-md mx-auto lg:max-w-none">
            <WhatsIncluded features={getFeatures()} />
            <CoachCard coach={coach} />
            {(goals.length > 0 || childId) && (
              <FocusAreasCard
                goals={goals}
                displayChildName={displayChildName}
                childId={childId}
                childAgeForGoals={childAgeForGoals}
                onGoalsSaved={setGoals}
              />
            )}
            <TestimonialCard />
            <AfterEnrollSteps coachName={coach.name} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="order-2 lg:order-2 lg:col-span-3 w-full max-w-md mx-auto lg:max-w-none">
            <PaymentSection
              pricing={pricing}
              productName={selectedProduct?.name}
              loading={loading}
              razorpayLoaded={razorpayLoaded}
              error={error}
              whatsappNumber={whatsappNumber}
              whatsappMessage={whatsappMessage}
              renderCtaText={renderCtaText}
              onSubmit={handleSubmit}
              formData={formData}
              source={source}
            >
              <EnrollForm formData={formData} onChange={handleInputChange} />

              {/* Scheduling Preferences */}
              <div className="border border-border rounded-xl p-3 bg-surface-2 space-y-4">
                <TimeBucketSelector
                  selected={preferenceTimeBucket}
                  onChange={setPreferenceTimeBucket}
                />
                <DayOfWeekSelector
                  selectedDays={preferenceDays}
                  onChange={setPreferenceDays}
                />
              </div>

              <StartDateSelector
                startOption={startOption}
                startDate={startDate}
                onOptionChange={setStartOption}
                onDateChange={setStartDate}
                minDate={formatDateForInput(minDate)}
                maxDate={formatDateForInput(maxDate)}
              />
              <CouponInput
                couponCode={couponCode}
                couponApplied={couponApplied}
                couponLoading={couponLoading}
                couponError={couponError}
                discountBreakdown={discountBreakdown}
                onCodeChange={setCouponCode}
                onApply={handleApplyCoupon}
                onRemove={handleRemoveCoupon}
              />
            </PaymentSection>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface-0"><Loader2 className="w-12 h-12 animate-spin text-[#FF0099]" /></div>}>
      <EnrollContent />
    </Suspense>
  );
}
