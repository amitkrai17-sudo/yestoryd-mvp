// app/coach/onboard-student/page.tsx
// 3-step wizard: Student Details → Session Details → Review & Submit
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle,
  Clock, IndianRupee, Users, Video, MapPin, Copy, Check,
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
}

// ============================================================
// CONSTANTS
// ============================================================

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const SESSIONS_PER_WEEK_OPTIONS = [1, 2, 3];

// ============================================================
// COMPONENT
// ============================================================

export default function CoachOnboardStudentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ magicLink: string; childName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Step 1 — Student details
  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [childAge, setChildAge] = useState<number | ''>('');
  const [joinBatch, setJoinBatch] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Step 2 — Session details
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

  // Referral code
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // ---- Load batches + referral code ----
  useEffect(() => {
    loadBatches();
    loadReferralCode();
  }, []);

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!coach) return;

      const { data: rows } = await supabase
        .from('tuition_onboarding')
        .select('batch_id, child_name, session_rate, session_duration_minutes')
        .eq('coach_id', coach.id)
        .eq('status', 'parent_completed');

      // Group by batch_id
      const batchMap = new Map<string, Batch>();
      for (const r of rows || []) {
        const bid = (r as any).batch_id;
        if (!bid) continue;
        const existing = batchMap.get(bid);
        if (existing) {
          existing.children.push(r.child_name);
        } else {
          batchMap.set(bid, {
            batch_id: bid,
            label: '',
            rate: r.session_rate,
            duration: r.session_duration_minutes ?? 60,
            children: [r.child_name],
          });
        }
      }

      const batchList = Array.from(batchMap.values())
        .map(b => ({ ...b, label: `${b.children.join(', ')} (${b.duration}m, ${b.rate / 100}/session)` }));
      setBatches(batchList);
    } catch { /* ignore */ }
    finally { setLoadingBatches(false); }
  };

  const loadReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!coach) return;

      const { data: coupon } = await supabase
        .from('coupons')
        .select('code')
        .eq('coupon_type', 'coach_referral')
        .eq('coach_id', coach.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (coupon) setReferralCode(coupon.code);
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
          body: JSON.stringify({
            sessionRateRupees: Number(rateRupees),
            durationMinutes: duration,
            sessionType,
            isAdmin: false,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRateValidation(data);

          // Also compute split preview
          const coachPercent = 70; // Rising default — the API will return actual
          const coachAmount = Math.round(Number(rateRupees) * coachPercent / 100);
          setSplitPreview({
            coach_percent: coachPercent,
            coach_amount_rupees: coachAmount,
            platform_amount_rupees: Number(rateRupees) - coachAmount,
          });
        }
      } catch { /* ignore */ }
      finally { setValidatingRate(false); }
    }, 500);

    return () => clearTimeout(timeout);
  }, [rateRupees, duration, sessionType, joinBatch]);

  // ---- Step navigation ----
  const canProceedStep1 = childName.length >= 2 && /^[6-9]\d{9}$/.test(parentPhone) && (!joinBatch || selectedBatchId);
  const isRateBlocked = rateValidation?.flag === 'red_low' || rateValidation?.flag === 'red_high';
  const canProceedStep2 = joinBatch || (rateRupees && !isRateBlocked);

  const handleNext = () => {
    if (step === 1 && joinBatch && selectedBatchId) {
      // Skip step 2 — go to review
      setStep(3);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 3 && joinBatch) {
      setStep(1);
    } else {
      setStep(step - 1);
    }
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const ratePaise = joinBatch
        ? batches.find(b => b.batch_id === selectedBatchId)?.rate || 0
        : Number(rateRupees) * 100;

      const res = await fetch('/api/coach/onboard-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: childName || undefined,
          childApproximateAge: childAge || undefined,
          parentPhone,
          sessionRate: ratePaise,
          sessionDurationMinutes: joinBatch
            ? batches.find(b => b.batch_id === selectedBatchId)?.duration || 60
            : duration,
          sessionsPurchased,
          sessionsPerWeek,
          defaultSessionMode: sessionMode,
          sessionType: joinBatch ? 'batch' : sessionType,
          batchId: joinBatch ? selectedBatchId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create onboarding');
        return;
      }

      setSuccess({ magicLink: data.magicLink, childName: childName || parentPhone });
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- Success state ----
  if (success) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="bg-surface-1/50 rounded-2xl border border-green-500/30 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Student Onboarded</h2>
          <p className="text-text-secondary text-sm">
            Payment link sent to parent via WhatsApp. Once they complete the form, sessions will be scheduled automatically.
          </p>
          {referralCode && (
            <div className="bg-surface-2/50 rounded-xl p-3 text-sm">
              <p className="text-text-tertiary mb-1">Share your referral code for a discount:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-[#00ABFF] font-bold">{referralCode}</span>
                <button
                  onClick={() => handleCopyLink(referralCode)}
                  className="h-7 px-2 rounded-lg bg-[#00ABFF]/10 text-[#00ABFF] text-xs hover:bg-[#00ABFF]/20"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => router.push('/coach/sessions')}
              className="h-10 px-5 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Go to Sessions
            </button>
            <button
              onClick={() => { setSuccess(null); setStep(1); setChildName(''); setParentPhone(''); setChildAge(''); setRateRupees(''); }}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90"
            >
              Onboard Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Wizard ----
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <PageHeader title="Onboard Student" subtitle="Set up a new tuition student" />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-[#00ABFF] text-white' :
              s < step ? 'bg-[#00ABFF]/20 text-[#00ABFF]' :
              'bg-surface-2 text-text-tertiary'
            }`}>
              {s < step ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[#00ABFF]/50' : 'bg-surface-2'}`} />}
          </div>
        ))}
        <span className="text-sm text-text-tertiary ml-2">
          {step === 1 ? 'Student' : step === 2 ? 'Session' : 'Review'}
        </span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* STEP 1: Student Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Child Name</label>
            <input
              type="text"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              placeholder="Enter child's name"
              className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Parent Phone</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-tertiary">+91</span>
              <input
                type="tel"
                value={parentPhone}
                onChange={e => setParentPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="flex-1 h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Child Age (approx)</label>
            <input
              type="number"
              value={childAge}
              onChange={e => setChildAge(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="8"
              min={3} max={18}
              className="w-24 h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
            />
          </div>

          {/* Batch selection */}
          <div className="bg-surface-1/50 rounded-2xl border border-border p-4 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => { setJoinBatch(false); setSelectedBatchId(null); }}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                  !joinBatch ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                New Class
              </button>
              <button
                onClick={() => setJoinBatch(true)}
                disabled={batches.length === 0}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                  joinBatch ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Add to Batch {batches.length > 0 ? `(${batches.length})` : ''}
              </button>
            </div>

            {joinBatch && (
              loadingBatches ? <Spinner size="sm" className="text-[#00ABFF]" /> : (
                <select
                  value={selectedBatchId || ''}
                  onChange={e => setSelectedBatchId(e.target.value || null)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
                >
                  <option value="">Select a batch...</option>
                  {batches.map(b => (
                    <option key={b.batch_id} value={b.batch_id}>{b.label}</option>
                  ))}
                </select>
              )
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceedStep1}
            className="w-full h-10 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {joinBatch ? 'Review' : 'Next: Session Details'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: Session Details */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Session type */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Session Type</label>
            <div className="flex gap-3">
              {(['individual', 'batch'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSessionType(t)}
                  className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                    sessionType === t ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {t === 'individual' ? 'Individual' : 'Batch'}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${
                    duration === d ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Clock className="w-3 h-3 inline mr-1" />{d}m
                </button>
              ))}
            </div>
          </div>

          {/* Sessions per week */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Sessions/Week</label>
            <div className="flex gap-2">
              {SESSIONS_PER_WEEK_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSessionsPerWeek(s)}
                  className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${
                    sessionsPerWeek === s ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Total sessions */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Total Sessions</label>
            <input
              type="number"
              value={sessionsPurchased}
              onChange={e => setSessionsPurchased(parseInt(e.target.value) || 1)}
              min={1} max={50}
              className="w-24 h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Mode</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSessionMode('online')}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  sessionMode === 'online' ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Video className="w-3.5 h-3.5" />Online
              </button>
              <button
                onClick={() => setSessionMode('offline')}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  sessionMode === 'offline' ? 'bg-[#00ABFF] text-white' : 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />In-Person
              </button>
            </div>
          </div>

          {/* Rate */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Rate per Session</label>
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-text-tertiary" />
              <input
                type="number"
                value={rateRupees}
                onChange={e => setRateRupees(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="200"
                min={50} max={1000}
                className="w-32 h-10 px-3 rounded-xl bg-surface-2 border border-border text-white text-sm focus:outline-none focus:border-[#00ABFF]"
              />
              {validatingRate && <Spinner size="sm" className="text-[#00ABFF]" />}
            </div>

            {/* Rate validation indicator */}
            {rateValidation && rateValidation.flag !== 'green' && (
              <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${
                rateValidation.flag.startsWith('red') ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
              }`}>
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {rateValidation.message}
              </div>
            )}

            {/* Split preview */}
            {splitPreview && rateRupees && !isRateBlocked && (
              <div className="mt-3 bg-surface-1/50 rounded-xl border border-border p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Your share ({splitPreview.coach_percent}%)</span>
                  <span className="text-green-400 font-medium">
                    {`\u20B9${splitPreview.coach_amount_rupees}/session \u00D7 ${sessionsPurchased} = \u20B9${(splitPreview.coach_amount_rupees * sessionsPurchased).toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Parent pays ({sessionsPurchased} sessions)</span>
                  <span className="text-white font-medium">{`\u20B9${(Number(rateRupees) * sessionsPurchased).toLocaleString('en-IN')}`}</span>
                </div>
                <p className="text-[13px] text-text-secondary pt-1">Paid per completed session &middot; Payout on 7th of each month</p>
              </div>
            )}
          </div>

          {/* Referral code */}
          {referralCode && (
            <div className="bg-[#00ABFF]/5 rounded-xl border border-[#00ABFF]/20 p-3 text-sm">
              <p className="text-text-tertiary mb-1">Your referral code (share with parent):</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#00ABFF] font-bold">{referralCode}</span>
                <button
                  onClick={() => handleCopyLink(referralCode)}
                  className="h-7 px-2 rounded-lg bg-[#00ABFF]/10 text-[#00ABFF] text-xs hover:bg-[#00ABFF]/20"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="h-10 px-5 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceedStep2}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Review<ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-surface-1/50 rounded-2xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-white">Review</h3>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-text-tertiary">Student</span>
              <span className="text-white">{childName || 'Pending'}</span>

              <span className="text-text-tertiary">Parent Phone</span>
              <span className="text-white">+91 {parentPhone}</span>

              {childAge && (
                <>
                  <span className="text-text-tertiary">Age</span>
                  <span className="text-white">{childAge} years</span>
                </>
              )}

              <span className="text-text-tertiary">Type</span>
              <span className="text-white">{joinBatch ? 'Batch (existing)' : sessionType === 'batch' ? 'Batch (new)' : 'Individual'}</span>

              <span className="text-text-tertiary">Rate</span>
              <span className="text-white">
                {joinBatch
                  ? `${(batches.find(b => b.batch_id === selectedBatchId)?.rate || 0) / 100}/session`
                  : `${rateRupees}/session`
                }
              </span>

              <span className="text-text-tertiary">Duration</span>
              <span className="text-white">
                {joinBatch
                  ? `${batches.find(b => b.batch_id === selectedBatchId)?.duration || 60}m`
                  : `${duration}m`
                }
              </span>

              <span className="text-text-tertiary">Sessions</span>
              <span className="text-white">{sessionsPurchased} sessions, {sessionsPerWeek}x/week</span>

              <span className="text-text-tertiary">Mode</span>
              <span className="text-white">{sessionMode === 'online' ? 'Online' : 'In-Person'}</span>
            </div>

            {/* Split breakdown */}
            {splitPreview && !joinBatch && (
              <div className="border-t border-border pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Your earnings/session</span>
                  <span className="text-green-400 font-semibold">{`\u20B9${splitPreview.coach_amount_rupees}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Total coach earnings</span>
                  <span className="text-green-400 font-semibold">{`\u20B9${splitPreview.coach_amount_rupees}/sess \u00D7 ${sessionsPurchased} = \u20B9${(splitPreview.coach_amount_rupees * sessionsPurchased).toLocaleString('en-IN')}`}</span>
                </div>
                <p className="text-[13px] text-text-secondary pt-1">Paid per completed session &middot; Payout on 7th of each month</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="h-10 px-5 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {submitting ? 'Sending...' : 'Send to Parent'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
