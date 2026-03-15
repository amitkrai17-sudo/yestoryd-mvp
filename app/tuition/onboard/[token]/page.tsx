// ============================================================
// FILE: app/tuition/onboard/[token]/page.tsx
// PURPOSE: Public parent-facing tuition onboarding form.
//   Token-gated, no login needed. Mobile-first.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  BookOpen, User, Mail, Phone, Calendar, GraduationCap,
  School, MessageSquare, ArrowRight, Clock, AlertCircle,
  CheckCircle, IndianRupee,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

interface OnboardingData {
  childName: string;
  childApproximateAge: number;
  sessionRate: number;
  sessionRateDisplay: number;
  sessionsPurchased: number;
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
  schedulePreference: string | null;
  coachName: string;
  totalAmount: number;
  parentPhone: string;
  parentNameHint: string | null;
  alreadyCompleted: boolean;
  enrollmentId: string | null;
}

interface FormData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childDob: string;
  childGrade: string;
  childSchool: string;
  learningConcerns: string;
}

export default function TuitionOnboardPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState<FormData>({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    childDob: '',
    childGrade: '',
    childSchool: '',
    learningConcerns: '',
  });

  // Fetch onboarding data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/tuition/onboard/${token}`);
        if (res.status === 410) {
          setExpired(true);
          return;
        }
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const json: OnboardingData = await res.json();
        setData(json);

        // Pre-fill phone from onboarding data
        if (json.parentPhone) {
          setForm(prev => ({ ...prev, parentPhone: json.parentPhone }));
        }
        if (json.parentNameHint) {
          setForm(prev => ({ ...prev, parentName: json.parentNameHint || '' }));
        }

        // If already completed, show success state
        if (json.alreadyCompleted && json.enrollmentId) {
          setSubmitted(true);
          setCheckoutUrl(`/tuition/pay/${json.enrollmentId}`);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  function updateField(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: [] }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch(`/api/tuition/onboard/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: form.parentName.trim(),
          parentEmail: form.parentEmail.trim(),
          parentPhone: form.parentPhone.trim(),
          childDob: form.childDob || undefined,
          childGrade: form.childGrade.trim() || undefined,
          childSchool: form.childSchool.trim() || undefined,
          learningConcerns: form.learningConcerns.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (res.status === 410) {
        setExpired(true);
        return;
      }

      if (!res.ok) {
        if (json.details) setFieldErrors(json.details);
        setError(json.error || 'Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
      setCheckoutUrl(json.checkoutUrl || null);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <p className="text-gray-500 text-sm">Loading your form...</p>
        </div>
      </div>
    );
  }

  // ---- EXPIRED ----
  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">
            This link has expired. Please contact your coach to get a new one.
          </p>
          <a
            href={`https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}?text=Hi%2C%20my%20tuition%20onboarding%20link%20has%20expired.%20Can%20you%20resend%3F`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#FF0099] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#FF0099]/90 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Message Us on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // ---- NOT FOUND ----
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600">
            This link is not valid. Please check the link you received or contact your coach.
          </p>
        </div>
      </div>
    );
  }

  // ---- SUCCESS ----
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mb-2">
            You&apos;re All Set!
          </h1>
          <p className="text-gray-600 mb-2">
            {data.childName}&apos;s learning journey with {data.coachName} is ready to begin.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            A payment link has been sent to your WhatsApp.
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>{data.sessionsPurchased} sessions</span>
              <span>{data.sessionDurationMinutes} min each</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-gray-900">
              <span>Total</span>
              <span className="text-[#FF0099]">
                &#8377;{data.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {checkoutUrl && (
            <a
              href={checkoutUrl}
              className="inline-flex items-center justify-center gap-2 w-full bg-[#FF0099] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#FF0099]/90 transition-colors"
            >
              <IndianRupee className="w-4 h-4" />
              Proceed to Payment
            </a>
          )}
        </div>
      </div>
    );
  }

  // ---- FORM ----
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="w-6 h-6 text-[#FF0099]" />
            <h1 className="font-display text-xl font-bold text-gray-900">
              Welcome to Yestoryd
            </h1>
          </div>
          <p className="text-gray-600 text-sm">
            Complete your details to begin {data.childName}&apos;s sessions with {data.coachName}.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Session summary card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-display font-semibold text-gray-900 mb-3">Session Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Student</span>
              <span className="font-medium text-gray-900">{data.childName} (age {data.childApproximateAge})</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Coach</span>
              <span className="font-medium text-gray-900">{data.coachName}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Sessions</span>
              <span className="font-medium text-gray-900">{data.sessionsPurchased} sessions</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Duration</span>
              <span className="font-medium text-gray-900">{data.sessionDurationMinutes} min each</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Frequency</span>
              <span className="font-medium text-gray-900">{data.sessionsPerWeek}x per week</span>
            </div>
            {data.schedulePreference && (() => {
              const DAY_MAP: Record<string, string> = {
                Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
                Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
              };
              let display = data.schedulePreference;
              try {
                const schedule = JSON.parse(data.schedulePreference);
                const days = (schedule.days as string[])?.map(d => DAY_MAP[d] || d).join(', ') || '';
                const timeSlot = schedule.timeSlot || '';
                const preferredTime = schedule.preferredTime || '';
                display = [days, timeSlot, preferredTime].filter(Boolean).join(' \u00b7 ');
              } catch {
                // plain string — use as-is
              }
              return display ? (
                <div className="flex justify-between text-gray-600">
                  <span>Schedule</span>
                  <span className="font-medium text-gray-900 text-right">{display}</span>
                </div>
              ) : null;
            })()}
            <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-[#FF0099] text-base">
                &#8377;{data.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              &#8377;{data.sessionRateDisplay} per session
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <h2 className="font-display font-semibold text-gray-900">Parent Details</h2>

            {/* Parent Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.parentName}
                  onChange={e => updateField('parentName', e.target.value)}
                  placeholder="Full name"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
              {fieldErrors.parentName && <p className="text-red-500 text-xs mt-1">{fieldErrors.parentName[0]}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={e => updateField('parentEmail', e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
              {fieldErrors.parentEmail && <p className="text-red-500 text-xs mt-1">{fieldErrors.parentEmail[0]}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={form.parentPhone}
                  onChange={e => updateField('parentPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  required
                  inputMode="numeric"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
              {fieldErrors.parentPhone && <p className="text-red-500 text-xs mt-1">{fieldErrors.parentPhone[0]}</p>}
            </div>
          </div>

          {/* Child details (optional) */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <h2 className="font-display font-semibold text-gray-900">
              About {data.childName}
              <span className="text-xs font-normal text-gray-400 ml-2">Optional</span>
            </h2>

            {/* DOB */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={form.childDob}
                  onChange={e => updateField('childDob', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
            </div>

            {/* Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade / Class</label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.childGrade}
                  onChange={e => updateField('childGrade', e.target.value)}
                  placeholder="e.g., Class 3"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
            </div>

            {/* School */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.childSchool}
                  onChange={e => updateField('childSchool', e.target.value)}
                  placeholder="School name"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
                />
              </div>
            </div>

            {/* Learning concerns */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Learning Concerns
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  value={form.learningConcerns}
                  onChange={e => updateField('learningConcerns', e.target.value)}
                  placeholder="Any specific areas you'd like the coach to focus on?"
                  rows={3}
                  maxLength={500}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.parentName || !form.parentEmail || !form.parentPhone}
            className="w-full flex items-center justify-center gap-2 bg-[#FF0099] text-white font-semibold py-3 rounded-xl hover:bg-[#FF0099]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-12"
          >
            {submitting ? (
              <Spinner size="sm" color="white" />
            ) : (
              <>
                Complete & Proceed to Payment
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By submitting, you agree to Yestoryd&apos;s terms of service.
          </p>
        </form>
      </div>
    </div>
  );
}
