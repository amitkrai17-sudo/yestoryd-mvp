// file: app/components/agreement/AgreementStep.tsx
// Combined agreement review + signature step for coach onboarding
// Usage: <AgreementStep coachId={coachId} coachName={name} onComplete={() => goToNextStep()} />

'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Check, 
  AlertTriangle, 
  ChevronDown,
  Loader2,
  Shield,
  Download
} from 'lucide-react';
import AgreementText from './AgreementText';
import SignaturePad from './SignaturePad';

interface AgreementConfig {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_website: string;
  lead_cost_percent: string;
  coach_cost_percent: string;
  platform_fee_percent: string;
  tds_rate_standard: string;
  tds_rate_no_pan: string;
  tds_threshold: string;
  tds_section: string;
  payout_day: string;
  cancellation_notice_hours: string;
  termination_notice_days: string;
  no_show_wait_minutes: string;
  non_solicitation_months: string;
  liquidated_damages: string;
  liquidated_damages_multiplier: string;
  agreement_version: string;
  agreement_effective_date: string;
  [key: string]: string;
}

interface AgreementStepProps {
  coachId: string;
  coachName: string;
  coachEmail: string;
  onComplete: () => void;
  onBack?: () => void;
}

export default function AgreementStep({ 
  coachId, 
  coachName, 
  coachEmail,
  onComplete,
  onBack 
}: AgreementStepProps) {
  // State
  const [config, setConfig] = useState<AgreementConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Agreement state
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  
  // Tax ID state
  const [taxIdType, setTaxIdType] = useState<'pan' | 'aadhaar'>('pan');
  const [taxIdValue, setTaxIdValue] = useState('');
  
  // Refs
  const agreementRef = useRef<HTMLDivElement>(null);

  // Fetch agreement config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/agreement/config');
      const data = await res.json();
      
      if (data.success && data.config) {
        setConfig(data.config);
      } else {
        setError('Failed to load agreement configuration');
      }
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to load agreement. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Track scroll to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Scroll to bottom button
  const scrollToBottom = () => {
    if (agreementRef.current) {
      agreementRef.current.scrollTo({
        top: agreementRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Validate tax ID format
  const validateTaxId = (): boolean => {
    if (taxIdType === 'pan') {
      // PAN format: ABCDE1234F (5 letters, 4 numbers, 1 letter)
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      return panRegex.test(taxIdValue.toUpperCase());
    } else {
      // Aadhaar: 12 digits
      const aadhaarRegex = /^\d{12}$/;
      return aadhaarRegex.test(taxIdValue.replace(/\s/g, ''));
    }
  };

  // Check if form is complete
  const isFormComplete = hasScrolledToBottom && hasAgreed && signature && taxIdValue && validateTaxId();

  // Submit agreement
  const handleSubmit = async () => {
    if (!isFormComplete || !config) return;

    setSigning(true);
    setError(null);

    try {
      const res = await fetch('/api/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          signatureDataUrl: signature,
          agreementVersion: config.agreement_version,
          taxIdType,
          taxIdValue: taxIdType === 'aadhaar' ? taxIdValue.slice(-4) : null,
          configSnapshot: config,
        }),
      });

      const data = await res.json();

      if (data.success) {
        onComplete();
      } else {
        setError(data.error || 'Failed to sign agreement. Please try again.');
      }
    } catch (err) {
      console.error('Error signing agreement:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-4" />
        <p className="text-gray-500">Loading agreement...</p>
      </div>
    );
  }

  // Error state (no config)
  if (!config) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium">Failed to load agreement</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="agreement-step space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
          <FileText className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Coach Service Agreement</h2>
        <p className="text-gray-500 mt-1">Please review and sign the agreement to continue</p>
      </div>

      {/* Agreement Container */}
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent h-20 pointer-events-none z-10 rounded-b-xl" />
        )}
        {!hasScrolledToBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-pink-500 text-white rounded-full text-sm font-medium shadow-lg hover:bg-pink-600 transition-colors flex items-center gap-2"
          >
            <ChevronDown className="w-4 h-4 animate-bounce" />
            Scroll to read full agreement
          </button>
        )}

        {/* Agreement Text (Scrollable) */}
        <div
          ref={agreementRef}
          onScroll={handleScroll}
          className="max-h-[500px] overflow-y-auto p-6 text-sm"
        >
          <AgreementText 
            config={config} 
            coachName={coachName}
          />
        </div>

        {/* Scroll Complete Indicator */}
        {hasScrolledToBottom && (
          <div className="bg-green-50 border-t border-green-200 px-4 py-2 flex items-center justify-center gap-2 text-green-700 text-sm">
            <Check className="w-4 h-4" />
            You have reviewed the complete agreement
          </div>
        )}
      </div>

      {/* Tax ID Section */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Tax Identification (Required for TDS Compliance)
        </h3>

        {/* Tax ID Type Selection */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="taxIdType"
              value="pan"
              checked={taxIdType === 'pan'}
              onChange={() => { setTaxIdType('pan'); setTaxIdValue(''); }}
              className="w-4 h-4 text-pink-500 focus:ring-pink-500"
            />
            <span className="text-sm">
              <strong>PAN Number</strong>
              <span className="text-green-600 text-xs ml-2">(10% TDS)</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="taxIdType"
              value="aadhaar"
              checked={taxIdType === 'aadhaar'}
              onChange={() => { setTaxIdType('aadhaar'); setTaxIdValue(''); }}
              className="w-4 h-4 text-pink-500 focus:ring-pink-500"
            />
            <span className="text-sm">
              <strong>Aadhaar Number</strong>
              <span className="text-yellow-600 text-xs ml-2">(u/s 139A(5E))</span>
            </span>
          </label>
        </div>

        {/* Tax ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {taxIdType === 'pan' ? 'PAN Number' : 'Aadhaar Number'}
          </label>
          <input
            type="text"
            value={taxIdValue}
            onChange={(e) => setTaxIdValue(e.target.value.toUpperCase())}
            placeholder={taxIdType === 'pan' ? 'ABCDE1234F' : '1234 5678 9012'}
            maxLength={taxIdType === 'pan' ? 10 : 14}
            className={`w-full px-4 py-3 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
              taxIdValue && !validateTaxId() ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {taxIdValue && !validateTaxId() && (
            <p className="text-red-500 text-xs mt-1">
              {taxIdType === 'pan' 
                ? 'Invalid PAN format. Example: ABCDE1234F' 
                : 'Invalid Aadhaar. Must be 12 digits.'}
            </p>
          )}
        </div>

        {/* Aadhaar Warning */}
        {taxIdType === 'aadhaar' && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            <strong>Important:</strong> If your Aadhaar is NOT linked to a valid PAN, 
            TDS will be deducted at 20% instead of 10% as per Section 206AA.
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Digital Signature</h3>
        <SignaturePad
          onSignatureChange={setSignature}
          width={Math.min(400, typeof window !== 'undefined' ? window.innerWidth - 80 : 400)}
          height={150}
          disabled={!hasScrolledToBottom}
        />
        {!hasScrolledToBottom && (
          <p className="text-amber-600 text-sm mt-2">
            ⚠️ Please scroll and read the complete agreement before signing.
          </p>
        )}
      </div>

      {/* Agreement Checkbox */}
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            disabled={!hasScrolledToBottom}
            className="mt-1 w-5 h-5 text-pink-500 focus:ring-pink-500 rounded disabled:opacity-50"
          />
          <span className="text-sm text-gray-700">
            I, <strong>{coachName}</strong>, have read, understood, and agree to all terms and conditions 
            in this Coach Service Agreement. I acknowledge that my digital signature above is legally 
            binding and equivalent to a handwritten signature under the Information Technology Act, 2000.
          </span>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isFormComplete || signing}
          className={`flex-1 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
            isFormComplete && !signing
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-xl hover:shadow-pink-500/30'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {signing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing Agreement...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Sign Agreement & Continue
            </>
          )}
        </button>
      </div>

      {/* Checklist */}
      <div className="text-sm text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">Before you can sign:</p>
        <p className={hasScrolledToBottom ? 'text-green-600' : ''}>
          {hasScrolledToBottom ? '✓' : '○'} Read the complete agreement (scroll to bottom)
        </p>
        <p className={taxIdValue && validateTaxId() ? 'text-green-600' : ''}>
          {taxIdValue && validateTaxId() ? '✓' : '○'} Enter your {taxIdType === 'pan' ? 'PAN' : 'Aadhaar'} number
        </p>
        <p className={signature ? 'text-green-600' : ''}>
          {signature ? '✓' : '○'} Draw your signature
        </p>
        <p className={hasAgreed ? 'text-green-600' : ''}>
          {hasAgreed ? '✓' : '○'} Accept the terms and conditions
        </p>
      </div>
    </div>
  );
}
