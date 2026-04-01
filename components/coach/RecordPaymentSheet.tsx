'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Banknote,
  Smartphone,
  Building2,
  Check,
  IndianRupee,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

type PaymentMethod = 'cash' | 'upi_manual' | 'bank_transfer';

interface RecordPaymentSheetProps {
  enrollment: {
    id: string;
    child_name: string;
    session_rate: number; // paise
    sessions_remaining: number;
    parent_name: string | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi_manual', label: 'UPI', icon: Smartphone },
  { value: 'bank_transfer', label: 'Bank', icon: Building2 },
];

export default function RecordPaymentSheet({ enrollment, onClose, onSuccess }: RecordPaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [sessions, setSessions] = useState('');
  const [notes, setNotes] = useState('');
  const [lastEdited, setLastEdited] = useState<'amount' | 'sessions'>('amount');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const rateRupees = enrollment ? Math.round(enrollment.session_rate / 100) : 0;

  // Auto-calculate the other field
  useEffect(() => {
    if (!rateRupees) return;
    if (lastEdited === 'amount' && amount) {
      const calc = Math.floor(Number(amount) / rateRupees);
      setSessions(calc > 0 ? String(calc) : '');
    } else if (lastEdited === 'sessions' && sessions) {
      const calc = Number(sessions) * rateRupees;
      setAmount(calc > 0 ? String(calc) : '');
    }
  }, [amount, sessions, lastEdited, rateRupees]);

  // Reset on open
  useEffect(() => {
    if (enrollment) {
      setMethod('cash');
      setAmount('');
      setSessions('');
      setNotes('');
      setLastEdited('amount');
      setSubmitting(false);
      setSuccess(false);
      setError(null);
      setConfirmStep(false);
    }
  }, [enrollment]);

  if (!enrollment) return null;

  const parsedAmount = Number(amount) || 0;
  const parsedSessions = Number(sessions) || 0;
  const newBalance = (enrollment.sessions_remaining ?? 0) + parsedSessions;
  const canSubmit = parsedAmount > 0 && parsedSessions > 0;

  const handleSubmit = async () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/payment/record-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: enrollment.id,
          amount: parsedAmount,
          sessions_purchased: parsedSessions,
          payment_method: method,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to record payment');
        setConfirmStep(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      setError('Network error. Please try again.');
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => { if (!submitting) onClose(); }}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {success ? 'Payment Recorded' : 'Record Payment'}
            </h3>
            {!success && (
              <p className="text-xs text-gray-400 mt-0.5">for {enrollment.child_name}</p>
            )}
          </div>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm text-green-400 font-medium text-center">
                {parsedSessions} sessions added for {enrollment.child_name}
              </p>
              <p className="text-xs text-gray-400">Parent will receive a WhatsApp confirmation</p>
            </div>
          )}

          {!success && (
            <>
              {/* Payment method toggle */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Payment Method</label>
                <div className="flex gap-2">
                  {METHODS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-medium transition-colors ${
                        method === m.value
                          ? 'bg-[#00ABFF]/20 text-[#00ABFF] border border-[#00ABFF]/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <m.icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" />
                  Amount
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setLastEdited('amount');
                    setConfirmStep(false);
                  }}
                  placeholder="e.g. 2200"
                  className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00ABFF] placeholder-gray-600"
                />
              </div>

              {/* Sessions input */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Sessions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={sessions}
                  onChange={(e) => {
                    setSessions(e.target.value);
                    setLastEdited('sessions');
                    setConfirmStep(false);
                  }}
                  placeholder="auto-calculated"
                  className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00ABFF] placeholder-gray-600"
                />
              </div>

              {/* Info row */}
              {rateRupees > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700">
                  <span className="text-[11px] text-gray-400">
                    Rate: ₹{rateRupees}/session
                  </span>
                  {parsedSessions > 0 && (
                    <span className="text-[11px] text-gray-300 font-medium">
                      New balance: {enrollment.sessions_remaining} + {parsedSessions} = {newBalance}
                    </span>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid at home visit"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00ABFF] placeholder-gray-600 resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmStep
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-[#00ABFF] hover:bg-[#00ABFF]/90 text-white'
                }`}
              >
                {submitting ? (
                  <Spinner />
                ) : confirmStep ? (
                  `Confirm ₹${parsedAmount.toLocaleString('en-IN')} ${method === 'cash' ? 'cash' : method === 'upi_manual' ? 'UPI' : 'bank transfer'}?`
                ) : (
                  'Record Payment'
                )}
              </button>

              {confirmStep && !submitting && (
                <button
                  onClick={() => setConfirmStep(false)}
                  className="w-full h-9 rounded-xl text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>

        {/* Safe area */}
        <div className="h-6" />
      </div>

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
