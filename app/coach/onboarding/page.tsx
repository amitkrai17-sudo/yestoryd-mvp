// file: app/coach/onboarding/page.tsx
// Coach onboarding page with Agreement Signing + Bank Details
// Flow: Step 1 (Agreement) → Step 2 (Bank Details) → Complete
// Access: /coach/onboarding (after approval)

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Shield,
  Wallet,
  IndianRupee,
  Sparkles,
  MessageCircle,
  LayoutDashboard,
  GraduationCap,
  Gift,
  Users,
} from 'lucide-react';
import DynamicAgreementStep from '../../components/agreement/DynamicAgreementStep';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoachData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  pan_number: string | null;
  referral_code: string | null;
  agreement_signed_at: string | null;
  agreement_version: string | null;
}

type OnboardingStep = 'agreement' | 'bank_details' | 'complete';

export default function CoachOnboardingPage() {
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('agreement');
  const [error, setError] = useState<string | null>(null);
  
  // Bank details form
  const [bankForm, setBankForm] = useState({
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
    bankName: '',
    panNumber: '',
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch coach data on mount
  useEffect(() => {
    fetchCoachData();
  }, []);

  const fetchCoachData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/coach/login');
        return;
      }

      const { data: coachData, error: fetchError } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (fetchError || !coachData) {
        setError('Coach profile not found. Please contact support.');
        setLoading(false);
        return;
      }

      setCoach(coachData);

      // Determine current step based on existing data
      if (coachData.bank_account_number && coachData.bank_ifsc) {
        setCurrentStep('complete');
      } else if (coachData.agreement_signed_at) {
        setCurrentStep('bank_details');
      } else {
        setCurrentStep('agreement');
      }

      // Pre-fill bank form if data exists
      if (coachData.bank_account_number) {
        setBankForm({
          accountNumber: coachData.bank_account_number || '',
          confirmAccountNumber: coachData.bank_account_number || '',
          ifsc: coachData.bank_ifsc || '',
          bankName: coachData.bank_name || '',
          panNumber: coachData.pan_number || '',
        });
      }

    } catch (err) {
      console.error('Error fetching coach data:', err);
      setError('Failed to load your profile. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleAgreementComplete = () => {
    fetchCoachData();
    setCurrentStep('bank_details');
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    
    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      setError('Account numbers do not match');
      return;
    }

    if (bankForm.ifsc.length !== 11) {
      setError('IFSC code must be 11 characters');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('coaches')
        .update({
          bank_account_number: bankForm.accountNumber,
          bank_ifsc: bankForm.ifsc.toUpperCase(),
          bank_name: bankForm.bankName,
          pan_number: bankForm.panNumber?.toUpperCase() || null,
        })
        .eq('id', coach.id);

      if (updateError) throw updateError;

      await fetchCoachData();
      setCurrentStep('complete');

    } catch (err: any) {
      console.error('Error saving bank details:', err);
      setError(err.message || 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  const copyReferralLink = () => {
    if (!coach?.referral_code) return;
    const link = `https://yestoryd.com/assessment?ref=${coach.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-[#FF0099] animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading your onboarding...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!coach) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'Unable to load your coach profile.'}</p>
          <Link href="/coach/login" className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-xl hover:bg-[#FF0099] transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="Yestoryd" width={120} height={40} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">Welcome, {coach.name?.split(' ')[0]}</span>
            <div className="w-8 h-8 bg-gradient-to-r from-[#FF0099] to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {coach.name?.charAt(0) || 'C'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${currentStep === 'agreement' ? 'text-pink-400' : 'text-green-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 'agreement' ? 'bg-[#FF0099] text-white' : 'bg-green-500 text-white'
              }`}>
                {currentStep !== 'agreement' ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Agreement</span>
            </div>
            
            <div className="w-12 h-0.5 bg-gray-700" />
            
            <div className={`flex items-center gap-2 ${currentStep === 'bank_details' ? 'text-pink-400' : currentStep === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 'bank_details' ? 'bg-[#FF0099] text-white' : 
                currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {currentStep === 'complete' ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Bank Details</span>
            </div>
            
            <div className="w-12 h-0.5 bg-gray-700" />
            
            <div className={`flex items-center gap-2 ${currentStep === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {currentStep === 'complete' ? <CheckCircle className="w-5 h-5" /> : '3'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Complete</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* STEP 1: Agreement */}
          {currentStep === 'agreement' && (
            <div className="p-6 sm:p-8">
              <DynamicAgreementStep
                coachId={coach.id}
                coachName={coach.name || 'Coach'}
                coachEmail={coach.email}
                onComplete={handleAgreementComplete}
              />
            </div>
          )}

          {/* STEP 2: Bank Details */}
          {currentStep === 'bank_details' && (
            <div className="p-6 sm:p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Bank Account Details</h2>
                <p className="text-gray-500 mt-1">For receiving your coaching payouts</p>
              </div>

              {coach.agreement_signed_at && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-green-800 font-medium">Agreement Signed ✓</p>
                    <p className="text-green-600 text-sm">
                      Version {coach.agreement_version} • {new Date(coach.agreement_signed_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleBankSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    placeholder="e.g., HDFC Bank"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#FF0099]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="Enter account number"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#FF0099]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Account Number</label>
                  <input
                    type="text"
                    value={bankForm.confirmAccountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, confirmAccountNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="Re-enter account number"
                    required
                    className={`w-full px-4 py-3 border rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#FF0099] ${
                      bankForm.confirmAccountNumber && bankForm.accountNumber !== bankForm.confirmAccountNumber
                        ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {bankForm.confirmAccountNumber && bankForm.accountNumber !== bankForm.confirmAccountNumber && (
                    <p className="text-red-500 text-xs mt-1">Account numbers do not match</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase().slice(0, 11) })}
                    placeholder="e.g., HDFC0001234"
                    required
                    maxLength={11}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#FF0099]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN Number <span className="text-gray-400">(Optional if Aadhaar provided)</span>
                  </label>
                  <input
                    type="text"
                    value={bankForm.panNumber}
                    onChange={(e) => setBankForm({ ...bankForm, panNumber: e.target.value.toUpperCase().slice(0, 10) })}
                    placeholder="e.g., ABCDE1234F"
                    maxLength={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#FF0099]"
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl">
                  <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-700">Your bank details are encrypted and securely stored.</p>
                    <p className="text-xs text-gray-500 mt-1">Payouts are processed on the 7th of every month.</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || bankForm.accountNumber !== bankForm.confirmAccountNumber}
                  className="w-full py-4 bg-gradient-to-r from-[#FF0099] to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Save & Complete Onboarding</>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: Complete */}
          {currentStep === 'complete' && (
            <div className="p-6 sm:p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-4">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">You're All Set, {coach.name?.split(' ')[0]}! 🎉</h2>
                <p className="text-gray-500 mt-2">Your onboarding is complete. Here's what's next.</p>
              </div>

              {coach.referral_code && (
                <div className="bg-gradient-to-r from-[#FF0099] to-purple-600 rounded-2xl p-6 mb-6 text-white">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Gift className="w-5 h-5" />
                        <span className="font-semibold">Your Referral Link</span>
                      </div>
                      <p className="text-sm text-pink-100">Share this link to earn 70% on every enrollment!</p>
                    </div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">70% Earnings</span>
                  </div>
                  
                  <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                    <code className="flex-1 text-sm truncate">yestoryd.com/assessment?ref={coach.referral_code}</code>
                    <button
                      onClick={copyReferralLink}
                      className="px-4 py-2 bg-white text-[#FF0099] rounded-lg font-medium text-sm hover:bg-[#FF0099]/10 transition-colors flex items-center gap-1"
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <Link href="/coach/dashboard" className="p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                  <LayoutDashboard className="w-8 h-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-600">Go to Dashboard</h3>
                  <p className="text-sm text-gray-500 mt-1">View your students, sessions & earnings</p>
                </Link>

                <a href={`https://wa.me/918976287997?text=Hi, I completed onboarding. Code: ${coach.referral_code}`} target="_blank" rel="noopener noreferrer" className="p-5 bg-green-50 rounded-xl hover:bg-green-100 transition-colors group">
                  <MessageCircle className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 group-hover:text-green-600">Join WhatsApp Group</h3>
                  <p className="text-sm text-gray-500 mt-1">Connect with other coaches</p>
                </a>

                <div className="p-5 bg-blue-50 rounded-xl">
                  <Users className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-gray-900">Student Assignments</h3>
                  <p className="text-sm text-gray-500 mt-1">We'll notify you when students are assigned</p>
                </div>

                <div className="p-5 bg-amber-50 rounded-xl">
                  <GraduationCap className="w-8 h-8 text-amber-600 mb-3" />
                  <h3 className="font-semibold text-gray-900">Training Materials</h3>
                  <p className="text-sm text-gray-500 mt-1">Access curriculum & teaching resources</p>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-5 mb-6">
                <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" /> Your Earnings Structure
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-500">Platform-sourced Students</p>
                    <p className="text-2xl font-bold text-purple-600">50%</p>
                    <p className="text-xs text-gray-400">≈ ₹2,500 per student</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 ring-2 ring-pink-400">
                    <p className="text-sm text-gray-500">Your Referral Students</p>
                    <p className="text-2xl font-bold text-[#FF0099]">70%</p>
                    <p className="text-xs text-gray-400">≈ ₹3,500 per student</p>
                  </div>
                </div>
                <p className="text-xs text-purple-700 mt-3 flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Payouts on 7th of every month via bank transfer
                </p>
              </div>

              <div className="text-center">
                <button onClick={() => setCurrentStep('bank_details')} className="text-sm text-gray-500 hover:text-[#FF0099] transition-colors inline-flex items-center gap-1">
                  <CreditCard className="w-4 h-4" /> Edit Bank Details
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <a href="https://wa.me/918976287997?text=I need help with coach onboarding" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-400 text-sm inline-flex items-center gap-2">
            Need help? Contact support <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </main>
    </div>
  );
}
