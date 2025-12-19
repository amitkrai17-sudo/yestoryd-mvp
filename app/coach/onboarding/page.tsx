// file: app/coach/onboarding/page.tsx
// Coach onboarding page - Collect bank details, PAN for payouts
// Access: /coach/onboarding (after approval)

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Building2,
  CreditCard,
  User,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Shield,
  Wallet,
  Share2,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoachData {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  referral_link: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  pan_number: string | null;
  upi_id: string | null;
  onboarding_complete: boolean;
}

export default function CoachOnboardingPage() {
  const router = useRouter();
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bank_account_number: '',
    bank_account_number_confirm: '',
    bank_ifsc: '',
    bank_name: '',
    bank_account_holder: '',
    pan_number: '',
    upi_id: '',
  });

  // Fetch coach data
  useEffect(() => {
    const fetchCoach = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/coach/login');
          return;
        }

        const { data: coachData, error } = await supabase
          .from('coaches')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (error || !coachData) {
          router.push('/coach/login');
          return;
        }

        setCoach(coachData);
        setFormData({
          bank_account_number: coachData.bank_account_number || '',
          bank_account_number_confirm: coachData.bank_account_number || '',
          bank_ifsc: coachData.bank_ifsc || '',
          bank_name: coachData.bank_name || '',
          bank_account_holder: coachData.bank_account_holder || '',
          pan_number: coachData.pan_number || '',
          upi_id: coachData.upi_id || '',
        });
      } catch (error) {
        console.error('Error fetching coach:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoach();
  }, [router]);

  // Auto-fetch bank name from IFSC
  const fetchBankName = async (ifsc: string) => {
    if (ifsc.length !== 11) return;
    
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, bank_name: data.BANK }));
      }
    } catch (error) {
      console.error('IFSC lookup failed:', error);
    }
  };

  // Handle IFSC change
  const handleIfscChange = (value: string) => {
    const ifsc = value.toUpperCase();
    setFormData(prev => ({ ...prev, bank_ifsc: ifsc }));
    if (ifsc.length === 11) {
      fetchBankName(ifsc);
    }
  };

  // Validate PAN format
  const isValidPan = (pan: string) => {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validations
    if (formData.bank_account_number !== formData.bank_account_number_confirm) {
      setMessage({ type: 'error', text: 'Account numbers do not match' });
      return;
    }

    if (formData.bank_ifsc.length !== 11) {
      setMessage({ type: 'error', text: 'Invalid IFSC code (must be 11 characters)' });
      return;
    }

    if (!isValidPan(formData.pan_number)) {
      setMessage({ type: 'error', text: 'Invalid PAN format (e.g., ABCDE1234F)' });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/coach/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: coach?.id,
          bank_account_number: formData.bank_account_number,
          bank_ifsc: formData.bank_ifsc,
          bank_name: formData.bank_name,
          bank_account_holder: formData.bank_account_holder,
          pan_number: formData.pan_number.toUpperCase(),
          upi_id: formData.upi_id || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Bank details saved successfully! You can now receive payouts.' });
        setCoach(prev => prev ? { ...prev, onboarding_complete: true } : null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save details' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Copy referral link
  const copyReferralLink = () => {
    if (coach?.referral_link) {
      navigator.clipboard.writeText(coach.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-gray-400">Add your bank details to start receiving payouts</p>
        </div>

        {/* Referral Link Card */}
        {coach?.referral_code && (
          <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl p-6 mb-8 border border-pink-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Share2 className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-semibold text-white">Your Referral Link</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Share this link to earn 20% commission on every enrollment!
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={coach.referral_link}
                readOnly
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm"
              />
              <button
                onClick={copyReferralLink}
                className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-pink-500 text-white hover:bg-pink-600'
                }`}
              >
                {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Referral Code: <span className="font-mono text-pink-400">{coach.referral_code}</span>
            </p>
          </div>
        )}

        {/* Status Badge */}
        {coach?.onboarding_complete && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Payout enabled! You&apos;re all set to receive payments.</span>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Bank Details Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-semibold text-white">Bank Account Details</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">Required for receiving payouts via NEFT/IMPS</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Account Holder Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Holder Name *
              </label>
              <input
                type="text"
                required
                value={formData.bank_account_holder}
                onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                placeholder="As per bank records"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Account Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value.replace(/\D/g, '') })}
                  placeholder="Enter account number"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank_account_number_confirm}
                  onChange={(e) => setFormData({ ...formData, bank_account_number_confirm: e.target.value.replace(/\D/g, '') })}
                  placeholder="Re-enter account number"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
                />
              </div>
            </div>

            {/* IFSC & Bank Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={formData.bank_ifsc}
                  onChange={(e) => handleIfscChange(e.target.value)}
                  placeholder="e.g., HDFC0001234"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Auto-detected from IFSC"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  readOnly={!!formData.bank_name}
                />
              </div>
            </div>

            {/* PAN Number */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-5 h-5 text-pink-400" />
                <h3 className="text-lg font-semibold text-white">Tax Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PAN Number *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    placeholder="e.g., ABCDE1234F"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required for TDS compliance</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    UPI ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.upi_id}
                    onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                    placeholder="e.g., yourname@upi"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">For faster payouts</p>
                </div>
              </div>
            </div>

            {/* Security Note */}
            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
              <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-300">Your bank details are encrypted and securely stored.</p>
                <p className="text-xs text-gray-500 mt-1">We use industry-standard security to protect your information.</p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Save Bank Details
                </>
              )}
            </button>
          </div>
        </form>

        {/* Help Link */}
        <div className="text-center mt-6">
          <a 
            href="https://wa.me/918976287997?text=I need help with coach onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-pink-400 text-sm inline-flex items-center gap-2"
          >
            Need help? Contact support
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
