// file: app/components/agreement/AgreementStep.tsx
// Combined agreement review + signature step for coach onboarding
// MOBILE RESPONSIVE VERSION
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  // Get container width for responsive signature pad
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 48); // minus padding
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

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
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      return panRegex.test(taxIdValue.toUpperCase());
    } else {
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
      <div className="flex flex-col items-center justify-center py-12 sm:py-20">
        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-pink-500 animate-spin mb-4" />
        <p className="text-gray-500 text-sm sm:text-base">Loading agreement...</p>
      </div>
    );
  }

  // Error state (no config)
  if (!config) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6 text-center">
        <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium text-sm sm:text-base">Failed to load agreement</p>
        <p className="text-red-600 text-xs sm:text-sm mt-1">{error}</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="agreement-step space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full mb-3 sm:mb-4">
          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Coach Service Agreement</h2>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Please review and sign the agreement to continue</p>
      </div>

      {/* Agreement Container */}
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent h-16 sm:h-20 pointer-events-none z-10 rounded-b-xl" />
        )}
        {!hasScrolledToBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 sm:px-4 py-1.5 sm:py-2 bg-pink-500 text-white rounded-full text-xs sm:text-sm font-medium shadow-lg hover:bg-pink-600 transition-colors flex items-center gap-1 sm:gap-2"
          >
            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 animate-bounce" />
            <span className="hidden xs:inline">Scroll to read full agreement</span>
            <span className="xs:hidden">Scroll down</span>
          </button>
        )}

        {/* Agreement Text (Scrollable) */}
        <div
          ref={agreementRef}
          onScroll={handleScroll}
          className="max-h-[350px] sm:max-h-[500px] overflow-y-auto p-4 sm:p-6 text-xs sm:text-sm"
        >
          <AgreementText 
            config={config} 
            coachName={coachName}
          />
        </div>

        {/* Scroll Complete Indicator */}
        {hasScrolledToBottom && (
          <div className="bg-green-50 border-t border-green-200 px-3 sm:px-4 py-2 flex items-center justify-center gap-2 text-green-700 text-xs sm:text-sm">
            <Check className="w-3 h-3 sm:w-4 sm:h-4" />
            You have reviewed the complete agreement
          </div>
        )}
      </div>

      {/* Tax ID Section */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
          Tax Identification
        </h3>

        {/* Tax ID Type Selection - Stack on mobile */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer p-2 sm:p-0 bg-white sm:bg-transparent rounded-lg sm:rounded-none border sm:border-0 border-gray-200">
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
              <span className="text-green-600 text-xs ml-1 sm:ml-2">(10% TDS)</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 sm:p-0 bg-white sm:bg-transparent rounded-lg sm:rounded-none border sm:border-0 border-gray-200">
            <input
              type="radio"
              name="taxIdType"
              value="aadhaar"
              checked={taxIdType === 'aadhaar'}
              onChange={() => { setTaxIdType('aadhaar'); setTaxIdValue(''); }}
              className="w-4 h-4 text-pink-500 focus:ring-pink-500"
            />
            <span className="text-sm">
              <strong>Aadhaar</strong>
              <span className="text-yellow-600 text-xs ml-1 sm:ml-2">(u/s 139A)</span>
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
            placeholder={taxIdType === 'pan' ? 'ABCDE1234F' : '123456789012'}
            maxLength={taxIdType === 'pan' ? 10 : 12}
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm sm:text-base ${
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
          <div className="mt-3 p-2.5 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs sm:text-sm text-yellow-800">
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
            <strong>Note:</strong> If Aadhaar is NOT linked to PAN, TDS will be 20% instead of 10%.
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Digital Signature</h3>
        <div className="overflow-hidden">
          <SignaturePad
            onSignatureChange={setSignature}
            width={Math.min(containerWidth, 400)}
            height={120}
            disabled={!hasScrolledToBottom}
          />
        </div>
        {!hasScrolledToBottom && (
          <p className="text-amber-600 text-xs sm:text-sm mt-2">
            ⚠️ Please scroll and read the agreement first.
          </p>
        )}
      </div>

      {/* Agreement Checkbox */}
      <div className="bg-purple-50 rounded-xl p-3 sm:p-4 border border-purple-200">
        <label className="flex items-start gap-2 sm:gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            disabled={!hasScrolledToBottom}
            className="mt-0.5 sm:mt-1 w-4 h-4 sm:w-5 sm:h-5 text-pink-500 focus:ring-pink-500 rounded disabled:opacity-50 flex-shrink-0"
          />
          <span className="text-xs sm:text-sm text-gray-700">
            I, <strong>{coachName}</strong>, have read and agree to all terms. 
            My digital signature is legally binding under IT Act, 2000.
          </span>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 text-red-700 text-xs sm:text-sm">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
          {error}
        </div>
      )}

      {/* Action Buttons - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-4 sm:px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm sm:text-base order-2 sm:order-1"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isFormComplete || signing}
          className={`w-full sm:flex-1 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-lg shadow-lg transition-all flex items-center justify-center gap-2 order-1 sm:order-2 ${
            isFormComplete && !signing
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-xl hover:shadow-pink-500/30'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {signing ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              <span className="hidden sm:inline">Signing Agreement...</span>
              <span className="sm:hidden">Signing...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Sign Agreement & Continue</span>
              <span className="sm:hidden">Sign & Continue</span>
            </>
          )}
        </button>
      </div>

      {/* Checklist - Compact on mobile */}
      <div className="text-xs sm:text-sm text-gray-500 space-y-0.5 sm:space-y-1 bg-gray-50 rounded-lg p-3 sm:p-0 sm:bg-transparent">
        <p className="font-medium text-gray-700 mb-1">Before you can sign:</p>
        <p className={hasScrolledToBottom ? 'text-green-600' : ''}>
          {hasScrolledToBottom ? '✓' : '○'} Read complete agreement
        </p>
        <p className={taxIdValue && validateTaxId() ? 'text-green-600' : ''}>
          {taxIdValue && validateTaxId() ? '✓' : '○'} Enter {taxIdType === 'pan' ? 'PAN' : 'Aadhaar'}
        </p>
        <p className={signature ? 'text-green-600' : ''}>
          {signature ? '✓' : '○'} Draw signature
        </p>
        <p className={hasAgreed ? 'text-green-600' : ''}>
          {hasAgreed ? '✓' : '○'} Accept terms
        </p>
      </div>
    </div>
  );
}
