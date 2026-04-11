// app/coach/onboard-student/page.tsx
// 3-step wizard: Student Details → Session Details → Review & Submit
// Coach portal dark theme — cyan primary, emerald earnings, pink referral
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserPlus, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle,
  Clock, IndianRupee, Users, Video, MapPin, Copy, Check, Wallet, Plus,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase/client';

// ============================================================
// TYPES
// ============================================================

interface Batch { batch_id: string; label: string; rate: number; duration: number; children: string[] }
interface RateValidation { flag: 'green' | 'amber_low' | 'amber_high' | 'red_low' | 'red_high'; hourlyRate: number; message: string; suggestedRange: { min: number; max: number } }
interface SplitPreview { coach_percent: number; coach_amount_rupees: number; platform_amount_rupees: number; lead_percent: number; lead_amount_rupees: number }
interface CouponInfo { code: string; discountType: string | null; discountValue: number | null }

// ============================================================
// STYLE TOKENS
// ============================================================

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const SESSIONS_PER_WEEK_OPTIONS = [1, 2, 3];
const PILL_ON = 'bg-cyan-500 text-white';
const PILL_OFF = 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/[0.08] transition-all duration-200';
const INPUT = 'px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 placeholder:text-gray-600';

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

  const [rateValidation, setRateValidation] = useState<RateValidation | null>(null);
  const [validatingRate, setValidatingRate] = useState(false);
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);

  // ---- Load data ----
  useEffect(() => { loadBatches(); loadReferralCode(); }, []);

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: coach } = await supabase.from('coaches').select('id').eq('email', user.email!).single();
      if (!coach) return;
      const { data: rows } = await supabase.from('tuition_onboarding').select('batch_id, child_name, session_rate, session_duration_minutes').eq('coach_id', coach.id).eq('status', 'parent_completed');
      const bm = new Map<string, Batch>();
      for (const r of rows || []) { const bid = (r as any).batch_id; if (!bid) continue; const e = bm.get(bid); if (e) e.children.push(r.child_name); else bm.set(bid, { batch_id: bid, label: '', rate: r.session_rate, duration: r.session_duration_minutes ?? 60, children: [r.child_name] }); }
      setBatches(Array.from(bm.values()).map(b => ({ ...b, label: `${b.children.join(', ')} (${b.duration}m, \u20B9${b.rate / 100}/s)` })));
    } catch { /* ignore */ } finally { setLoadingBatches(false); }
  };

  const loadReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: coach } = await supabase.from('coaches').select('id').eq('email', user.email!).single();
      if (!coach) return;
      const { data: coupon } = await supabase.from('coupons').select('code, discount_type, discount_value').eq('coupon_type', 'coach_referral').eq('coach_id', coach.id).eq('is_active', true).limit(1).maybeSingle();
      if (coupon) { setReferralCode(coupon.code); setCouponInfo({ code: coupon.code, discountType: coupon.discount_type || null, discountValue: coupon.discount_value != null ? Number(coupon.discount_value) : null }); }
    } catch { /* ignore */ }
  };

  // ---- Rate validation (debounced) ----
  useEffect(() => {
    if (!rateRupees || !duration || joinBatch) return;
    const t = setTimeout(async () => {
      setValidatingRate(true);
      try {
        const res = await fetch('/api/revenue/validate-rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionRateRupees: Number(rateRupees), durationMinutes: duration, sessionType, isAdmin: false }) });
        if (res.ok) {
          const d = await res.json(); setRateValidation(d);
          const cp = 70, lp = 10, r = Number(rateRupees), ca = Math.round(r * cp / 100), la = Math.round(r * lp / 100);
          setSplitPreview({ coach_percent: cp, coach_amount_rupees: ca, platform_amount_rupees: r - ca - la, lead_percent: lp, lead_amount_rupees: la });
        }
      } catch { /* ignore */ } finally { setValidatingRate(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [rateRupees, duration, sessionType, joinBatch]);

  // ---- Nav ----
  const canStep1 = childName.length >= 2 && /^[6-9]\d{9}$/.test(parentPhone) && (!joinBatch || selectedBatchId);
  const isBlocked = rateValidation?.flag === 'red_low' || rateValidation?.flag === 'red_high';
  const canStep2 = joinBatch || (rateRupees && !isBlocked);
  const handleNext = () => setStep(step === 1 && joinBatch && selectedBatchId ? 3 : step + 1);
  const handleBack = () => setStep(step === 3 && joinBatch ? 1 : step - 1);

  // ---- Submit ----
  const handleSubmit = async () => {
    setSubmitting(true); setError(null);
    try {
      const rp = joinBatch ? batches.find(b => b.batch_id === selectedBatchId)?.rate || 0 : Number(rateRupees) * 100;
      const res = await fetch('/api/coach/onboard-student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childName: childName || undefined, childApproximateAge: childAge || undefined, parentPhone, sessionRate: rp, sessionDurationMinutes: joinBatch ? batches.find(b => b.batch_id === selectedBatchId)?.duration || 60 : duration, sessionsPurchased, sessionsPerWeek, defaultSessionMode: sessionMode, sessionType: joinBatch ? 'batch' : sessionType, batchId: joinBatch ? selectedBatchId : undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create onboarding'); return; }
      setSuccess({ magicLink: data.magicLink, childName: childName || parentPhone });
    } catch { setError('Network error. Please try again.'); } finally { setSubmitting(false); }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ---- Compact step dots ----
  const StepDots = () => (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`rounded-full transition-all duration-200 flex items-center justify-center ${
            s === step ? 'w-6 h-6 bg-cyan-500' :
            s < step ? 'w-6 h-6 bg-emerald-500/30' :
            'w-2 h-2 bg-white/20'
          }`}>
            {s < step && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            {s === step && <span className="text-[11px] font-bold text-white">{s}</span>}
          </div>
          {s < 3 && <div className={`w-6 h-px ${s < step ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );

  // ---- Earnings card (reused in step 2 + 3) ----
  const EarningsCard = () => {
    if (!splitPreview || !rateRupees || isBlocked) return null;
    return (
      <div className="bg-emerald-500/10 rounded-xl border-l-4 border-emerald-400 p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span>Your share ({splitPreview.coach_percent}%)</span>
          </div>
          <div className="text-right">
            <p className="text-emerald-300 text-lg font-semibold">
              {`\u20B9${(splitPreview.coach_amount_rupees * sessionsPurchased).toLocaleString('en-IN')}`}
            </p>
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
    );
  };

  // ---- Referral card (reused in step 2 + 3) ----
  const ReferralCard = () => {
    if (!referralCode) return null;
    return (
      <div className="bg-pink-500/10 rounded-xl border-l-4 border-pink-400 p-4 text-sm space-y-2">
        <p className="text-pink-400 font-medium">Your referral code (share with parent):</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-pink-300 font-bold text-base">{referralCode}</span>
          <button onClick={() => copy(referralCode)} className="h-7 px-2 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20 transition-all duration-200">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <p className="text-gray-400 text-[13px]">
          {couponInfo?.discountValue && couponInfo.discountType === 'percent'
            ? `Parent gets: ${couponInfo.discountValue}% off`
            : couponInfo?.discountValue && couponInfo.discountType === 'fixed'
            ? `Parent gets: \u20B9${couponInfo.discountValue} off`
            : 'Tracks you as lead source (no parent discount currently)'}
        </p>
        {splitPreview && rateRupees && (
          <div className="border-t border-pink-500/20 pt-2.5 mt-2.5 space-y-1">
            <p className="text-sm text-pink-300/80">
              {`If this is your lead: +\u20B9${splitPreview.lead_amount_rupees}/session`}
            </p>
            <p className="text-sm text-pink-300 font-medium">
              {`Total: \u20B9${splitPreview.coach_amount_rupees + splitPreview.lead_amount_rupees}/session (\u20B9${((splitPreview.coach_amount_rupees + splitPreview.lead_amount_rupees) * sessionsPurchased).toLocaleString('en-IN')} for ${sessionsPurchased} sessions)`}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ================================================================
  // SUCCESS
  // ================================================================
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Student onboarded</h1>
          <p className="text-sm text-gray-400">Payment link sent to parent via WhatsApp. Sessions will be scheduled once they complete the form.</p>
          {referralCode && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <p className="text-gray-500 text-sm mb-2">Share your referral code:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-pink-300 font-bold text-lg">{referralCode}</span>
                <button onClick={() => copy(referralCode)} className="h-8 px-3 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20 transition-all duration-200">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => router.push('/coach/sessions')} className="h-11 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 transition-all duration-200">
              Go to Sessions
            </button>
            <button onClick={() => { setSuccess(null); setStep(1); setChildName(''); setParentPhone(''); setChildAge(''); setRateRupees(''); setSplitPreview(null); setRateValidation(null); }} className="h-11 px-5 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition-all duration-200 flex-1">
              Onboard Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // STEP 1 — Student details (centered, hero icon, cyan-only)
  // ================================================================
  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        <div className="w-full max-w-md space-y-6">
          <StepDots />

          {/* Hero */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-cyan-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Onboard student</h1>
            <p className="text-sm text-gray-400 mt-1">Set up a new tuition student</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border-l-4 border-red-400 rounded-r-xl p-3 text-sm text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400 mb-1.5 block">Child Name</label>
              <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Enter child's name" className={`w-full ${INPUT}`} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400 mb-1.5 block">Parent Phone</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">+91</span>
                <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className={`flex-1 ${INPUT}`} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400 mb-1.5 block">Child Age (approx)</label>
              <input type="number" value={childAge} onChange={e => setChildAge(e.target.value ? parseInt(e.target.value) : '')} placeholder="8" min={3} max={18} className={`w-20 ${INPUT}`} />
            </div>
          </div>

          {/* Batch selection — card-style */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setJoinBatch(false); setSelectedBatchId(null); }}
              className={`p-4 rounded-xl border text-center transition-all duration-200 ${!joinBatch ? 'bg-cyan-500/15 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'}`}
            >
              <Plus className={`w-5 h-5 mx-auto mb-1.5 ${!joinBatch ? 'text-cyan-300' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${!joinBatch ? 'text-cyan-300' : 'text-gray-400'}`}>New class</span>
            </button>
            <button
              onClick={() => setJoinBatch(true)}
              disabled={batches.length === 0}
              className={`p-4 rounded-xl border text-center transition-all duration-200 ${joinBatch ? 'bg-cyan-500/15 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Users className={`w-5 h-5 mx-auto mb-1.5 ${joinBatch ? 'text-cyan-300' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${joinBatch ? 'text-cyan-300' : 'text-gray-400'}`}>Add to batch</span>
              {batches.length > 0 && <span className="text-xs text-gray-500 block">({batches.length} batches)</span>}
            </button>
          </div>

          {joinBatch && (
            loadingBatches ? <div className="text-center py-2"><Spinner size="sm" className="text-cyan-400" /></div> : (
              <select value={selectedBatchId || ''} onChange={e => setSelectedBatchId(e.target.value || null)} className={`w-full ${INPUT}`}>
                <option value="">Select a batch...</option>
                {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.label}</option>)}
              </select>
            )
          )}

          <button onClick={handleNext} disabled={!canStep1} className="w-full h-12 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {joinBatch ? 'Review' : 'Next: Session details'}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // STEP 2 — Session details (cyan + green + pink)
  // ================================================================
  if (step === 2) {
    return (
      <div className="w-full max-w-md mx-auto px-4 space-y-6 pb-8">
        <StepDots />

        {error && (
          <div className="bg-red-500/10 border-l-4 border-red-400 rounded-r-xl p-3 text-sm text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Session type */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Session Type</label>
          <div className="flex gap-3">
            {(['individual', 'batch'] as const).map(t => (
              <button key={t} onClick={() => setSessionType(t)} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-200 ${sessionType === t ? PILL_ON : PILL_OFF}`}>
                {t === 'individual' ? 'Individual' : 'Batch'}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Duration</label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} className={`h-11 px-3.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1 ${duration === d ? PILL_ON : PILL_OFF}`}>
                <Clock className="w-3 h-3" />{d}m
              </button>
            ))}
          </div>
        </div>

        {/* Sessions/week */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Sessions/Week</label>
          <div className="flex gap-2">
            {SESSIONS_PER_WEEK_OPTIONS.map(s => (
              <button key={s} onClick={() => setSessionsPerWeek(s)} className={`h-11 px-5 rounded-xl text-sm font-medium transition-all duration-200 ${sessionsPerWeek === s ? PILL_ON : PILL_OFF}`}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Total sessions */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Total Sessions</label>
          <input type="number" value={sessionsPurchased} onChange={e => setSessionsPurchased(parseInt(e.target.value) || 1)} min={1} max={50} className={`w-20 ${INPUT}`} />
        </div>

        {/* Mode */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Mode</label>
          <div className="flex gap-3">
            <button onClick={() => setSessionMode('online')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${sessionMode === 'online' ? PILL_ON : PILL_OFF}`}>
              <Video className="w-3.5 h-3.5" />Online
            </button>
            <button onClick={() => setSessionMode('offline')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${sessionMode === 'offline' ? PILL_ON : PILL_OFF}`}>
              <MapPin className="w-3.5 h-3.5" />In-Person
            </button>
          </div>
        </div>

        {/* Rate */}
        <div>
          <label className="text-sm font-medium text-gray-400 mb-1.5 block">Rate per Session</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500"><IndianRupee className="w-4 h-4" /></span>
            <input type="number" value={rateRupees} onChange={e => setRateRupees(e.target.value ? parseInt(e.target.value) : '')} placeholder="200" min={50} max={1000} className={`w-32 ${INPUT}`} />
            {validatingRate && <Spinner size="sm" className="text-cyan-400" />}
          </div>
        </div>

        {/* Rate flag */}
        {rateValidation && rateValidation.flag !== 'green' && (
          <div className={`text-sm px-4 py-3 rounded-r-xl border-l-4 ${
            rateValidation.flag.startsWith('red') ? 'bg-red-500/10 border-red-400 text-red-300' : 'bg-amber-500/10 border-amber-400 text-amber-300'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{rateValidation.message}
          </div>
        )}

        {/* GREEN earnings preview */}
        <EarningsCard />

        {/* PINK referral code */}
        <ReferralCard />

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button onClick={handleBack} className="h-11 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />Back
          </button>
          <button onClick={handleNext} disabled={!canStep2} className="flex-1 h-11 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2">
            Review<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // STEP 3 — Review (card-based layout)
  // ================================================================
  return (
    <div className="w-full max-w-md mx-auto px-4 space-y-4 pb-8">
      <StepDots />

      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-400 rounded-r-xl p-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Student card */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2">
        <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wide">Student</h3>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-gray-500">Name</span>
          <span className="text-white">{childName || 'Pending'}</span>
          <span className="text-gray-500">Phone</span>
          <span className="text-white">+91 {parentPhone}</span>
          {childAge && (<><span className="text-gray-500">Age</span><span className="text-white">{childAge} years</span></>)}
        </div>
      </div>

      {/* Session card */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2">
        <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wide">Session</h3>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-gray-500">Type</span>
          <span className="text-white">{joinBatch ? 'Batch (existing)' : sessionType === 'batch' ? 'Batch (new)' : 'Individual'}</span>
          <span className="text-gray-500">Rate</span>
          <span className="text-white">{joinBatch ? `\u20B9${(batches.find(b => b.batch_id === selectedBatchId)?.rate || 0) / 100}/session` : `\u20B9${rateRupees}/session`}</span>
          <span className="text-gray-500">Duration</span>
          <span className="text-white">{joinBatch ? `${batches.find(b => b.batch_id === selectedBatchId)?.duration || 60}m` : `${duration}m`}</span>
          <span className="text-gray-500">Sessions</span>
          <span className="text-white">{sessionsPurchased}, {sessionsPerWeek}x/week</span>
          <span className="text-gray-500">Mode</span>
          <span className="text-white">{sessionMode === 'online' ? 'Online' : 'In-Person'}</span>
        </div>
      </div>

      {/* Earnings card */}
      {!joinBatch && <EarningsCard />}

      {/* Referral card */}
      {!joinBatch && <ReferralCard />}

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button onClick={handleBack} className="h-11 px-5 rounded-xl text-sm font-medium bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40 transition-all duration-200 flex items-center justify-center gap-2">
          {submitting ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
          {submitting ? 'Sending...' : 'Confirm & send payment link'}
        </button>
      </div>
    </div>
  );
}
