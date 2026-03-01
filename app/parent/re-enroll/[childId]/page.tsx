'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, Star, ArrowRight, Trophy, TrendingUp,
  AlertCircle, CheckCircle, Clock, User, Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SkillGrowth {
  skill: string;
  before: string;
  after: string;
}

export default function ReEnrollPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [preferenceDays, setPreferenceDays] = useState<number[]>([]);
  const [timeBucket, setTimeBucket] = useState('any');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/parent/re-enroll/${childId}`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          setError(result.error || 'Failed to load');
          return;
        }
        setData(result);
      } catch {
        setError('Failed to load re-enrollment data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [childId]);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('razorpay-script')) {
      const script = document.createElement('script');
      script.id = 'razorpay-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    if (!data?.pricing) return;
    setPaying(true);
    setError('');

    try {
      // Create Razorpay order
      const res = await fetch(`/api/parent/re-enroll/${childId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: data.pricing.plan_id,
          preference_days: preferenceDays.length > 0 ? preferenceDays : undefined,
          preference_time_bucket: timeBucket !== 'any' ? timeBucket : undefined,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        setError(orderData.error || 'Failed to create order');
        setPaying(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: 'Yestoryd',
        description: `Season ${data.next_season.number} — ${data.child.name}`,
        order_id: orderData.order_id,
        prefill: orderData.prefill,
        theme: { color: '#FF0099' },
        handler: async (response: any) => {
          // Verify payment via existing verify endpoint
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setPaymentSuccess(true);
            } else {
              setError('Payment verification failed. Contact support.');
            }
          } catch {
            setError('Payment verification failed. Contact support.');
          }
          setPaying(false);
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setError('Payment failed. Please try again.');
      setPaying(false);
    }
  };

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TIME_BUCKETS = [
    { value: 'any', label: 'Any Time' },
    { value: 'morning', label: 'Morning (9-12)' },
    { value: 'afternoon', label: 'Afternoon (12-4)' },
    { value: 'evening', label: 'Evening (4-8)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 mb-2">{error}</p>
          <button onClick={() => router.back()} className="text-[#FF0099] font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            You&apos;re All Set!
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Season {data.next_season.number} enrollment is confirmed for {data.child.name}.
            We&apos;ll set up your sessions shortly.
          </p>
          <button
            onClick={() => router.push('/parent/dashboard')}
            className="w-full py-3 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { child, previous_season, coach, next_season, age_band_transition, pricing } = data;
  const prevCompletionPct = Math.round((previous_season.completion_rate || 0) * 100);

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-[#FF0099] mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">
            Continue {child.name}&apos;s Journey
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Season {next_season.number} is ready
          </p>
        </div>

        {/* Season 1 Recap */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-gray-900 font-bold text-sm">Season {previous_season.number} Recap</h2>
          </div>
          <div className="px-5 py-4">
            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-lg font-bold text-amber-400">{prevCompletionPct}%</p>
                <p className="text-[10px] text-gray-500">Complete</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{previous_season.sessions_completed}/{previous_season.sessions_total}</p>
                <p className="text-[10px] text-gray-500">Sessions</p>
              </div>
            </div>

            {/* Growth highlights (top 3) */}
            {previous_season.growth?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Key growth areas:</p>
                {previous_season.growth.slice(0, 3).map((g: SkillGrowth) => (
                  <div key={g.skill} className="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-xs text-gray-900">{g.skill}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">{g.before}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-700" />
                      <span className="text-emerald-700 font-medium">{g.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Season 2 Preview */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-50 border border-pink-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-[#FF0099]" />
            <h2 className="text-gray-900 font-bold text-sm">Season {next_season.number}: {next_season.name}</h2>
          </div>

          {next_season.focus_areas?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {next_season.focus_areas.map((area: string) => (
                <span key={area} className="px-2.5 py-1 text-[10px] bg-pink-50 text-[#FF0099] rounded-full border border-pink-200">
                  {area}
                </span>
              ))}
            </div>
          )}

          <p className="text-gray-500 text-xs leading-relaxed">
            Building on {child.name}&apos;s Season {previous_season.number} progress,
            this season will focus on strengthening key skills and reaching new milestones.
          </p>
        </div>

        {/* Age Band Transition */}
        {age_band_transition && (
          <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ArrowUpRight className="w-5 h-5 text-[#00ABFF] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-900 text-sm font-medium">Level Up!</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {age_band_transition.reason}. They&apos;ll transition from{' '}
                  <AgeBandBadge ageBand={age_band_transition.from} /> to{' '}
                  <AgeBandBadge ageBand={age_band_transition.to} /> with age-appropriate content.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Coach Continuity */}
        {coach && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#0066CC] flex items-center justify-center text-white font-bold text-sm">
              {coach.name?.charAt(0) || 'C'}
            </div>
            <div className="flex-1">
              <p className="text-gray-900 font-medium text-sm">{coach.name}</p>
              <p className="text-gray-500 text-xs">Same coach continues</p>
            </div>
            <User className="w-4 h-4 text-emerald-700" />
          </div>
        )}

        {/* Scheduling Preferences */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h2 className="text-gray-900 font-bold text-sm">Schedule Preference</h2>
          </div>

          {/* Preferred Days */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Preferred days (optional)</p>
            <div className="flex gap-2">
              {DAY_LABELS.map((day, i) => {
                const selected = preferenceDays.includes(i);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPreferenceDays(prev =>
                      selected ? prev.filter(d => d !== i) : [...prev, i]
                    )}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                      selected
                        ? 'bg-pink-50 text-[#FF0099] border-pink-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Bucket */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Preferred time (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              {TIME_BUCKETS.map(tb => (
                <button
                  key={tb.value}
                  type="button"
                  onClick={() => setTimeBucket(tb.value)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                    timeBucket === tb.value
                      ? 'bg-pink-50 text-[#FF0099] border-pink-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing + CTA */}
        {pricing && !pricing.is_locked && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
            <div className="text-center mb-4">
              <p className="text-gray-500 text-xs">Season {next_season.number}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                <span className="text-lg text-gray-500">&#8377;</span>{pricing.price?.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {pricing.sessions} sessions | {pricing.duration_months} month{pricing.duration_months > 1 ? 's' : ''}
              </p>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center">
                {error}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={paying}
              className="w-full py-3.5 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue Season {next_season.number}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {pricing?.is_locked && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 text-center">
            <p className="text-gray-500 text-sm">{pricing.lock_message || 'Re-enrollment is currently unavailable.'}</p>
          </div>
        )}

        {!pricing && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 text-center">
            <p className="text-gray-500 text-sm">Pricing not available. Please contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}
