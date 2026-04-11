// app/coach/onboard-student/page.tsx
// 3-step wizard: Student Details → Session Details → Review & Submit
// Coach portal dark theme with pastel accents (emerald for earnings, pink for referral)
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserPlus, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle,
  Clock, IndianRupee, Users, Video, MapPin, Copy, Check, Wallet,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/lib/supabase/client';

// ============================================================
// TYPES
// ============================================================

interface Batch {
  batch_id: string;
  label: string;
  rate: number;
  duration: number;
  children: string[];
}

interface RateValidation {
  flag: 'green' | 'amber_low' | 'amber_high' | 'red_low' | 'red_high';
  hourlyRate: number;
  message: string;
  suggestedRange: { min: number; max: number };
}

interface SplitPreview {
  coach_percent: number;
  coach_amount_rupees: number;
  platform_amount_rupees: number;
  lead_percent: number;
  lead_amount_rupees: number;
}

interface CouponInfo {
  code: string;
  discountType: string | null;
  discountValue: number | null;
}

// ============================================================
// CONSTANTS
// ============================================================

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const SESSIONS_PER_WEEK_OPTIONS = [1, 2, 3];

// Shared pill classes
const PILL_ACTIVE = 'bg-cyan-500 text-white';
const PILL_INACTIVE = 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10';
const INPUT_CLASS = 'h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-gray-500';

// ============================================================
// COMPONENT
// ============================================================

export default function CoachOnboardStudentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBatchId = searchParams.get('batchId');

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ magicLink: string; childName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Step 1
  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [childAge, setChildAge] = useState<number | ''>('');
  const [joinBatch, setJoinBatch] = useState(!!preselectedBatchId);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(preselectedBatchId);

  // Step 2
  const [sessionType, setSessionType] = useState<'individual' | 'batch'>('individual');
  const [duration, setDuration] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [sessionsPurchased, setSessionsPurchased] = useState(8);
  const [sessionMode, setSessionMode] = useState<'online' | 'offline'>('online');
  const [rateRupees, setRateRupees] = useState<number | ''>('');

  // Rate validation
  const [rateValidation, setRateValidation] = useState<RateValidation | null>(null);
  const [validatingRate, setValidatingRate] = useState(false);

  // Split preview
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);

  // Referral
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);

  // ---- Load data ----
  useEffect(() => {
    loadBatches();
    loadReferralCode();
  }, []);

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: coach } = await supabase.from('coaches').select('id').eq('email', user.email!).single();
      if (!coach) return;

      const { data: rows } = await supabase
        .from('tuition_onboarding')
        .select('batch_id, child_name, session_rate, session_duration_minutes')
        .eq('coach_id', coach.id)
        .eq('status', 'parent_completed');

      const batchMap = new Map<string, Batch>();
      for (const r of rows || []) {
        const bid = (r as any).batch_id;
        if (!bid) continue;
        const existing = batchMap.get(bid);
        if (existing) { existing.children.push(r.child_name); }
        else { batchMap.set(bid, { batch_id: bid, label: '', rate: r.session_rate, duration: r.session_duration_minutes ?? 60, children: [r.child_name] }); }
      }
      setBatches(Array.from(batchMap.values()).map(b => ({ ...b, label: `${b.children.join(', ')} (${b.duration}m, ${b.rate / 100}/session)` })));
    } catch { /* ignore */ }
    finally { setLoadingBatches(false); }
  };

  const loadReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: coach } = await supabase.from('coaches').select('id').eq('email', user.email!).single();
      if (!coach) return;

      const { data: coupon } = await supabase
        .from('coupons')
        .select('code, discount_type, discount_value')
        .eq('coupon_type', 'coach_referral')
        .eq('coach_id', coach.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (coupon) {
        setReferralCode(coupon.code);
        setCouponInfo({ code: coupon.code, discountType: coupon.discount_type || null, discountValue: coupon.discount_value != null ? Number(coupon.discount_value) : null });
      }
    } catch { /* ignore */ }
  };

  // ---- Rate validation (debounced) ----
  useEffect(() => {
    if (!rateRupees || !duration || joinBatch) return;
    const timeout = setTimeout(async () => {
      setValidatingRate(true);
      try {
        const res = await fetch('/api/revenue/validate-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionRateRupees: Number(rateRupees), durationMinutes: duration, sessionType, isAdmin: false }),
        });
        if (res.ok) {
          const data = await res.json();
          setRateValidation(data);
          const coachPercent = 70, leadPercent = 10, rate = Number(rateRupees);
          const coachAmount = Math.round(rate * coachPercent / 100);
          const leadAmount = Math.round(rate * leadPercent / 100);
          setSplitPreview({ coach_percent: coachPercent, coach_amount_rupees: coachAmount, platform_amount_rupees: rate - coachAmount - leadAmount, lead_percent: leadPercent, lead_amount_rupees: leadAmount });
        }
      } catch { /* ignore */ }
      finally { setValidatingRate(false); }
    }, 500);
    return () => clearTimeout(timeout);
  }, [rateRupees, duration, sessionType, joinBatch]);

  // ---- Navigation ----
  const canProceedStep1 = childName.length >= 2 && /^[6-9]\d{9}$/.test(parentPhone) && (!joinBatch || selectedBatchId);
  const isRateBlocked = rateValidation?.flag === 'red_low' || rateValidation?.flag === 'red_high';
  const canProceedStep2 = joinBatch || (rateRupees && !isRateBlocked);

  const handleNext = () => { setStep(step === 1 && joinBatch && selectedBatchId ? 3 : step + 1); };
  const handleBack = () => { setStep(step === 3 && joinBatch ? 1 : step - 1); };

  // ---- Submit ----
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ratePaise = joinBatch ? batches.find(b => b.batch_id === selectedBatchId)?.rate || 0 : Number(rateRupees) * 100;
      const res = await fetch('/api/coach/onboard-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: childName || undefined, childApproximateAge: childAge || undefined, parentPhone, sessionRate: ratePaise,
          sessionDurationMinutes: joinBatch ? batches.find(b => b.batch_id === selectedBatchId)?.duration || 60 : duration,
          sessionsPurchased, sessionsPerWeek, defaultSessionMode: sessionMode,
          sessionType: joinBatch ? 'batch' : sessionType, batchId: joinBatch ? selectedBatchId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create onboarding'); return; }
      setSuccess({ magicLink: data.magicLink, childName: childName || parentPhone });
    } catch { setError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ============================================================
  // SUCCESS STATE
  // ============================================================
  if (success) {
    return (
      <div className="space-y-6 max-w-lg mx-auto px-4">
        <div className="bg-surface-1/50 rounded-2xl border border-emerald-500/30 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Student Onboarded</h2>
          <p className="text-gray-400 text-sm">
            Payment link sent to parent via WhatsApp. Once they complete the form, sessions will be scheduled automatically.
          </p>
          {referralCode && (
            <div className="bg-white/5 rounded-xl p-3 text-sm">
              <p className="text-gray-500 mb-1">Share your referral code:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-pink-300 font-bold">{referralCode}</span>
                <button onClick={() => handleCopy(referralCode)} className="h-7 px-2 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button onClick={() => router.push('/coach/sessions')} className="h-10 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5">
              Go to Sessions
            </button>
            <button onClick={() => { setSuccess(null); setStep(1); setChildName(''); setParentPhone(''); setChildAge(''); setRateRupees(''); }} className="h-10 px-5 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600">
              Onboard Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // WIZARD
  // ============================================================
  return (
    <div className="space-y-6 max-w-lg mx-auto px-4">
      <PageHeader title="Onboard Student" subtitle="Set up a new tuition student" />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-cyan-500 text-white' :
              s < step ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-white/10 text-gray-500'
            }`}>
              {s < step ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
          </div>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          {step === 1 ? 'Student' : step === 2 ? 'Session' : 'Review'}
        </span>
      </div>

      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-400 rounded-r-xl p-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 1: Student Details                                          */}
      {/* ================================================================ */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Child Name</label>
            <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Enter child's name" className={`w-full ${INPUT_CLASS}`} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Parent Phone</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">+91</span>
              <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className={`flex-1 ${INPUT_CLASS}`} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Child Age (approx)</label>
            <input type="number" value={childAge} onChange={e => setChildAge(e.target.value ? parseInt(e.target.value) : '')} placeholder="8" min={3} max={18} className={`w-20 ${INPUT_CLASS}`} />
          </div>

          {/* Batch selection */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/10 p-4 space-y-3">
            <div className="flex gap-3">
              <button onClick={() => { setJoinBatch(false); setSelectedBatchId(null); }} className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${!joinBatch ? PILL_ACTIVE : PILL_INACTIVE}`}>
                New Class
              </button>
              <button onClick={() => setJoinBatch(true)} disabled={batches.length === 0} className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${joinBatch ? PILL_ACTIVE : PILL_INACTIVE} disabled:opacity-40 disabled:cursor-not-allowed`}>
                <Users className="w-3.5 h-3.5 inline mr-1" />Add to Batch {batches.length > 0 ? `(${batches.length})` : ''}
              </button>
            </div>
            {joinBatch && (
              loadingBatches ? <Spinner size="sm" className="text-cyan-400" /> : (
                <select value={selectedBatchId || ''} onChange={e => setSelectedBatchId(e.target.value || null)} className={`w-full ${INPUT_CLASS}`}>
                  <option value="">Select a batch...</option>
                  {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.label}</option>)}
                </select>
              )
            )}
          </div>

          <button onClick={handleNext} disabled={!canProceedStep1} className="w-full h-10 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {joinBatch ? 'Review' : 'Next: Session Details'}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 2: Session Details                                          */}
      {/* ================================================================ */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Session type */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Session Type</label>
            <div className="flex gap-3">
              {(['individual', 'batch'] as const).map(t => (
                <button key={t} onClick={() => setSessionType(t)} className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${sessionType === t ? PILL_ACTIVE : PILL_INACTIVE}`}>
                  {t === 'individual' ? 'Individual' : 'Batch'}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)} className={`h-9 px-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-1 ${duration === d ? PILL_ACTIVE : PILL_INACTIVE}`}>
                  <Clock className="w-3 h-3" />{d}m
                </button>
              ))}
            </div>
          </div>

          {/* Sessions per week */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Sessions/Week</label>
            <div className="flex gap-2">
              {SESSIONS_PER_WEEK_OPTIONS.map(s => (
                <button key={s} onClick={() => setSessionsPerWeek(s)} className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${sessionsPerWeek === s ? PILL_ACTIVE : PILL_INACTIVE}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Total sessions */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Total Sessions</label>
            <input type="number" value={sessionsPurchased} onChange={e => setSessionsPurchased(parseInt(e.target.value) || 1)} min={1} max={50} className={`w-20 ${INPUT_CLASS}`} />
          </div>

          {/* Mode */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Mode</label>
            <div className="flex gap-3">
              <button onClick={() => setSessionMode('online')} className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${sessionMode === 'online' ? PILL_ACTIVE : PILL_INACTIVE}`}>
                <Video className="w-3.5 h-3.5" />Online
              </button>
              <button onClick={() => setSessionMode('offline')} className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${sessionMode === 'offline' ? PILL_ACTIVE : PILL_INACTIVE}`}>
                <MapPin className="w-3.5 h-3.5" />In-Person
              </button>
            </div>
          </div>

          {/* Rate */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Rate per Session</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500"><IndianRupee className="w-4 h-4" /></span>
              <input type="number" value={rateRupees} onChange={e => setRateRupees(e.target.value ? parseInt(e.target.value) : '')} placeholder="200" min={50} max={1000} className={`w-32 ${INPUT_CLASS}`} />
              {validatingRate && <Spinner size="sm" className="text-cyan-400" />}
            </div>

            {/* Rate flag — border-l accent banners */}
            {rateValidation && rateValidation.flag !== 'green' && (
              <div className={`mt-3 text-sm px-3 py-2.5 rounded-r-xl border-l-4 ${
                rateValidation.flag.startsWith('red')
                  ? 'bg-red-500/10 border-red-400 text-red-300'
                  : 'bg-amber-500/10 border-amber-400 text-amber-300'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                {rateValidation.message}
              </div>
            )}

            {/* ---- SPLIT PREVIEW (emerald hero card) ---- */}
            {splitPreview && rateRupees && !isRateBlocked && (
              <div className="mt-3 bg-emerald-500/10 rounded-xl border-l-4 border-emerald-400 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <Wallet className="w-4 h-4 flex-shrink-0" />
                    <span>Your share ({splitPreview.coach_percent}%)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-300 text-xl font-semibold">
                      {`\u20B9${(splitPreview.coach_amount_rupees * sessionsPurchased).toLocaleString('en-IN')}`}
                    </span>
                    <p className="text-xs text-emerald-400/60">
                      {`\u20B9${splitPreview.coach_amount_rupees}/session \u00D7 ${sessionsPurchased}`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Parent pays ({sessionsPurchased} sessions)</span>
                  <span className="text-white font-semibold">{`\u20B9${(Number(rateRupees) * sessionsPurchased).toLocaleString('en-IN')}`}</span>
                </div>
                <p className="text-xs text-gray-500 italic">Paid per completed session &middot; Payout on 7th of each month</p>
              </div>
            )}
          </div>

          {/* ---- REFERRAL CODE (pink accent card) ---- */}
          {referralCode && (
            <div className="bg-pink-500/10 rounded-xl border-l-4 border-pink-400 p-3 text-sm space-y-2">
              <p className="text-pink-400 font-medium">Your referral code (share with parent):</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-pink-300 font-bold text-base">{referralCode}</span>
                <button onClick={() => handleCopy(referralCode)} className="h-7 px-2 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              {/* Parent discount */}
              <p className="text-gray-400 text-[13px]">
                {couponInfo?.discountValue && couponInfo.discountType === 'percent'
                  ? `Parent gets: ${couponInfo.discountValue}% off`
                  : couponInfo?.discountValue && couponInfo.discountType === 'fixed'
                  ? `Parent gets: \u20B9${couponInfo.discountValue} off`
                  : 'Tracks you as lead source (no parent discount currently)'}
              </p>

              {/* Lead bonus */}
              {splitPreview && rateRupees && (
                <div className="border-t border-pink-400/20 pt-2 space-y-1">
                  <p className="text-gray-300 font-medium">If this is your lead:</p>
                  <p className="text-gray-400 text-[13px]">
                    {`Your lead bonus: +\u20B9${splitPreview.lead_amount_rupees}/session (${splitPreview.lead_percent}%)`}
                  </p>
                  <p className="text-pink-300 text-[13px] font-semibold">
                    {`Total: \u20B9${splitPreview.coach_amount_rupees} + \u20B9${splitPreview.lead_amount_rupees} = \u20B9${splitPreview.coach_amount_rupees + splitPreview.lead_amount_rupees}/session (\u20B9${((splitPreview.coach_amount_rupees + splitPreview.lead_amount_rupees) * sessionsPurchased).toLocaleString('en-IN')} total)`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons — stack on mobile */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={handleBack} className="h-10 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <button onClick={handleNext} disabled={!canProceedStep2} className="flex-1 h-10 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              Review<ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 3: Review                                                   */}
      {/* ================================================================ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] rounded-2xl border border-white/10 p-4 space-y-3">
            <h3 className="font-semibold text-white">Review</h3>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-500">Student</span>
              <span className="text-white">{childName || 'Pending'}</span>
              <span className="text-gray-500">Parent Phone</span>
              <span className="text-white">+91 {parentPhone}</span>
              {childAge && (<><span className="text-gray-500">Age</span><span className="text-white">{childAge} years</span></>)}
              <span className="text-gray-500">Type</span>
              <span className="text-white">{joinBatch ? 'Batch (existing)' : sessionType === 'batch' ? 'Batch (new)' : 'Individual'}</span>
              <span className="text-gray-500">Rate</span>
              <span className="text-white">{joinBatch ? `\u20B9${(batches.find(b => b.batch_id === selectedBatchId)?.rate || 0) / 100}/session` : `\u20B9${rateRupees}/session`}</span>
              <span className="text-gray-500">Duration</span>
              <span className="text-white">{joinBatch ? `${batches.find(b => b.batch_id === selectedBatchId)?.duration || 60}m` : `${duration}m`}</span>
              <span className="text-gray-500">Sessions</span>
              <span className="text-white">{sessionsPurchased} sessions, {sessionsPerWeek}x/week</span>
              <span className="text-gray-500">Mode</span>
              <span className="text-white">{sessionMode === 'online' ? 'Online' : 'In-Person'}</span>
            </div>

            {/* Split breakdown — emerald accent */}
            {splitPreview && !joinBatch && (
              <div className="border-t border-white/10 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Your earnings/session</span>
                  <span className="text-emerald-400 font-semibold">{`\u20B9${splitPreview.coach_amount_rupees}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total coach earnings</span>
                  <span className="text-emerald-300 font-semibold text-base">{`\u20B9${(splitPreview.coach_amount_rupees * sessionsPurchased).toLocaleString('en-IN')}`}</span>
                </div>
                <p className="text-xs text-gray-500 italic pt-1">Paid per completed session &middot; Payout on 7th of each month</p>
              </div>
            )}
          </div>

          {/* Navigation buttons — stack on mobile */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={handleBack} className="h-10 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 h-10 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {submitting ? 'Sending...' : 'Send to Parent'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
