// file: app/components/agreement/DynamicAgreementStep.tsx
// Agreement step that fetches and displays dynamic DOCX agreement
// Replaces the old AgreementStep with hardcoded text

'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Loader2, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface AgreementInfo {
  id: string;
  version: string;
  title: string;
  entity_type: string;
}

interface DynamicAgreementStepProps {
  coachId: string;
  coachName: string;
  coachEmail: string;
  onComplete: () => void;
}

export default function DynamicAgreementStep({
  coachId,
  coachName,
  coachEmail,
  onComplete
}: DynamicAgreementStepProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreementHtml, setAgreementHtml] = useState<string>('');
  const [agreementInfo, setAgreementInfo] = useState<AgreementInfo | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [taxIdType, setTaxIdType] = useState<'pan' | 'aadhaar'>('pan');
  const [taxIdValue, setTaxIdValue] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const agreementRef = useRef<HTMLDivElement>(null);

  // Fetch agreement on mount
  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreement/active?coachEmail=${encodeURIComponent(coachEmail)}`);
      const data = await response.json();

      if (data.success) {
        setAgreementHtml(data.html);
        setAgreementInfo(data.agreement);
      } else {
        setError(data.error || 'Failed to load agreement');
      }
    } catch (err) {
      setError('Failed to load agreement. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Handle scroll
  const handleScroll = () => {
    if (agreementRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = agreementRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const scrollToBottom = () => {
    if (agreementRef.current) {
      agreementRef.current.scrollTo({
        top: agreementRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Validate tax ID
  const validateTaxId = () => {
    if (taxIdType === 'pan') {
      return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(taxIdValue.toUpperCase());
    } else {
      return /^\d{12}$/.test(taxIdValue);
    }
  };

  // Check if can sign
  const canSign = hasScrolledToBottom && signature && taxIdValue && validateTaxId() && hasAgreed;

  // Handle sign
  const handleSign = async () => {
    if (!canSign || !agreementInfo) return;

    setSigning(true);
    setError(null);

    try {
      const response = await fetch('/api/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          agreementVersionId: agreementInfo.id,
          signature,
          taxIdType,
          taxIdValue: taxIdValue.toUpperCase(),
          agreementVersion: agreementInfo.version
        })
      });

      const data = await response.json();

      if (data.success) {
        onComplete();
      } else {
        setError(data.error || 'Failed to sign agreement');
      }
    } catch (err) {
      setError('Failed to sign agreement. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
        <p className="text-gray-600">Loading agreement...</p>
      </div>
    );
  }

  // Error state
  if (error && !agreementHtml) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-700 mb-2">Unable to Load Agreement</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchAgreement}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Agreement Info */}
      {agreementInfo && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-purple-900">{agreementInfo.title}</p>
            <p className="text-sm text-purple-600">Version {agreementInfo.version} • {agreementInfo.entity_type}</p>
          </div>
        </div>
      )}

      {/* Agreement Container */}
      <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Scroll Indicator */}
        {!hasScrolledToBottom && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent h-16 sm:h-20 pointer-events-none z-10 rounded-b-xl" />
        )}
        {!hasScrolledToBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 sm:px-4 py-1.5 sm:py-2 bg-pink-500 text-white rounded-full text-xs sm:text-sm font-medium shadow-lg hover:bg-pink-600 transition-colors flex items-center gap-1 sm:gap-2"
          >
            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 animate-bounce" />
            <span className="hidden sm:inline">Scroll to read full agreement</span>
            <span className="sm:hidden">Scroll down</span>
          </button>
        )}

        {/* Agreement Content (Scrollable) */}
        <div
          ref={agreementRef}
          onScroll={handleScroll}
          className="max-h-[350px] sm:max-h-[500px] overflow-y-auto p-4 sm:p-6 text-xs sm:text-sm"
          dangerouslySetInnerHTML={{ __html: agreementHtml }}
        />

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
          🆔 Tax Identification (Required)
        </h3>

        {/* Tax ID Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setTaxIdType('pan'); setTaxIdValue(''); }}
            className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              taxIdType === 'pan'
                ? 'bg-purple-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            PAN Card
          </button>
          <button
            type="button"
            onClick={() => { setTaxIdType('aadhaar'); setTaxIdValue(''); }}
            className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              taxIdType === 'aadhaar'
                ? 'bg-purple-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Aadhaar
          </button>
        </div>

        {/* Tax ID Input */}
        <div className="relative">
          <input
            type="text"
            value={taxIdValue}
            onChange={(e) => setTaxIdValue(e.target.value.toUpperCase())}
            placeholder={taxIdType === 'pan' ? 'Enter PAN (e.g., ABCDE1234F)' : 'Enter 12-digit Aadhaar'}
            maxLength={taxIdType === 'pan' ? 10 : 12}
            className={`w-full px-4 py-3 border rounded-lg text-sm sm:text-base font-mono tracking-wider text-gray-900 bg-white ${
              taxIdValue && !validateTaxId()
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'
            }`}
          />
          {taxIdValue && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {validateTaxId() ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          )}
        </div>

        {taxIdType === 'aadhaar' && (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ If your Aadhaar is not linked to PAN, 20% TDS will apply instead of 10%
          </p>
        )}
      </div>

      {/* Signature Section */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
          ✍️ Your Signature
        </h3>
        <SignaturePad onSignatureChange={setSignature} />
      </div>

      {/* Agreement Checkbox */}
      <label className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={hasAgreed}
          onChange={(e) => setHasAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <span className="text-xs sm:text-sm text-gray-700">
          I have read and understood the Coach Service Agreement. I agree to be bound by its terms and conditions,
          including the revenue sharing model, TDS deductions, data privacy obligations, and non-solicitation clauses.
          I confirm that clicking "Sign Agreement" constitutes my valid electronic signature under the
          Information Technology Act, 2000.
        </span>
      </label>

      {/* Sign Button */}
      <button
        onClick={handleSign}
        disabled={!canSign || signing}
        className={`w-full py-3 sm:py-4 rounded-xl text-base sm:text-lg font-bold transition-all flex items-center justify-center gap-2 ${
          canSign && !signing
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

      {/* Checklist */}
      <div className="text-xs sm:text-sm text-gray-500 space-y-1">
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
