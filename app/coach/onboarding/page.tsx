// file: app/coach/onboarding/page.tsx
// Coach onboarding page - Collect bank details, PAN for payouts
// UPDATED: Shows clear next steps after onboarding completion
// Access: /coach/onboarding (after approval)

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
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
  ArrowRight,
  BookOpen,
  Users,
  IndianRupee,
  Sparkles,
  MessageCircle,
  LayoutDashboard,
  GraduationCap,
  Gift,
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
  const [showForm, setShowForm] = useState(true);

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
        
        // If onboarding already complete, show success view
        if (coachData.onboarding_complete) {
          setShowForm(false);
        }
        
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
        setCoach(prev => prev ? { ...prev, onboarding_complete: true } : null);
        setShowForm(false); // Switch to success view
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

  // ==================== SUCCESS VIEW (After Onboarding Complete) ====================
  if (!showForm && coach?.onboarding_complete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🎉 You&apos;re All Set, {coach.name?.split(' ')[0]}!
            </h1>
            <p className="text-gray-400">
              Your onboarding is complete. Welcome to the Yestoryd coaching family!
            </p>
          </div>

          {/* Referral Link Card */}
          <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6 text-pink-400" />
              <h2 className="text-lg font-semibold text-white">Your Referral Link</h2>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Share this link with parents. When they enroll, you earn <span className="text-pink-400 font-bold">70%</span> of the fee!
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={coach.referral_link || ''}
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white text-sm font-mono"
              />
              <button
                onClick={copyReferralLink}
                className={`px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
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
              Your Code: <span className="font-mono text-pink-400 font-bold">{coach.referral_code}</span>
            </p>
          </div>

          {/* What's Next Section */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-6">
            <div className="p-5 border-b border-slate-700 bg-slate-800/80">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                What&apos;s Next?
              </h2>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Step 1: Dashboard */}
              <Link href="/coach/dashboard" className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-pink-500/50 hover:bg-slate-900 transition-all group">
                <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center group-hover:bg-pink-500/30 transition-all">
                  <LayoutDashboard className="w-6 h-6 text-pink-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Go to Coach Dashboard</h3>
                  <p className="text-sm text-gray-400">View students, sessions & earnings</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-pink-400 transition-all" />
              </Link>

              {/* Step 2: Share Referral */}
              <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Share Your Referral Link</h3>
                  <p className="text-sm text-gray-400">Post on WhatsApp, Instagram, or share with parents you know</p>
                </div>
              </div>

              {/* Step 3: Wait for Assignment */}
              <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Get Student Assignments</h3>
                  <p className="text-sm text-gray-400">We&apos;ll notify you when students are assigned to you</p>
                </div>
              </div>

              {/* Step 4: Training (Optional) */}
              <a 
                href="https://wa.me/918976287997?text=Hi! I just completed onboarding and would like access to coach training materials."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group"
              >
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/30 transition-all">
                  <GraduationCap className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Access Training Materials</h3>
                  <p className="text-sm text-gray-400">Request coach training resources via WhatsApp</p>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-all" />
              </a>
            </div>
          </div>

          {/* Earnings Reminder */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <IndianRupee className="w-6 h-6 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Your Earning Potential</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-900/50 rounded-xl p-4">
                <p className="text-3xl font-bold text-yellow-400">50%</p>
                <p className="text-sm text-gray-400">Per student you coach</p>
                <p className="text-xs text-gray-500 mt-1">≈ ₹3,000/student</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4">
                <p className="text-3xl font-bold text-pink-400">70%</p>
                <p className="text-sm text-gray-400">When YOU bring students</p>
                <p className="text-xs text-gray-500 mt-1">≈ ₹4,200/student</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">
              Payouts processed on 7th of every month via bank transfer
            </p>
          </div>

          {/* Edit Bank Details */}
          <div className="text-center">
            <button
              onClick={() => setShowForm(true)}
              className="text-gray-400 hover:text-pink-400 text-sm inline-flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Edit Bank Details
            </button>
          </div>

          {/* WhatsApp Support */}
          <div className="text-center mt-6">
            <a 
              href="https://wa.me/918976287997?text=Hi! I have a question about coaching at Yestoryd."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              Chat with Us on WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ==================== FORM VIEW (Initial Onboarding) ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Complete Your Onboarding
          </h1>
          <p className="text-gray-400">
            Welcome {coach?.name}! Set up your payout details to start earning.
          </p>
        </div>

        {/* Referral Link Preview */}
        {coach?.referral_link && (
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Share2 className="w-4 h-4 text-pink-400" />
              <span>Your Referral Link (share after completing onboarding)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={coach.referral_link}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm font-mono"
              />
              <button
                onClick={copyReferralLink}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-pink-500 text-white hover:bg-pink-600'
                }`}
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Code: <span className="font-mono text-pink-400">{coach.referral_code}</span>
            </p>
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
                  Complete Onboarding
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