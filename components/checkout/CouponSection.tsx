// =============================================================================
// FILE: components/checkout/CouponSection.tsx
// PURPOSE: Coupon input + discount calculation at checkout
// UI/UX: AIDA + LIFT - reduces anxiety, shows clear value
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { 
  Ticket, Tag, CheckCircle, XCircle, Loader2, 
  Gift, Percent, AlertCircle, Info, Wallet
} from 'lucide-react';

interface DiscountBreakdown {
  originalAmount: number;
  couponDiscount: number;
  creditApplied: number;
  totalDiscount: number;
  finalAmount: number;
  creditRemaining: number;
  wasCapped: boolean;
  maxDiscountPercent: number;
}

interface CouponInfo {
  code: string;
  type: string;
  referrerName?: string;
}

interface Props {
  originalAmount: number;
  parentId?: string;
  productType: 'coaching' | 'elearning' | 'group_class';
  onDiscountChange: (breakdown: DiscountBreakdown | null, couponCode: string | null, leadSource: string) => void;
  availableCredit?: number;
}

export default function CouponSection({ 
  originalAmount, 
  parentId, 
  productType,
  onDiscountChange,
  availableCredit = 0
}: Props) {
  const [couponCode, setCouponCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);
  const [breakdown, setBreakdown] = useState<DiscountBreakdown | null>(null);
  const [applyCredit, setApplyCredit] = useState(availableCredit > 0);
  const [leadSource, setLeadSource] = useState<string>('yestoryd');

  // Recalculate when credit toggle changes
  useEffect(() => {
    if (validated && couponCode) {
      calculateDiscount();
    } else if (applyCredit && availableCredit > 0) {
      calculateDiscount();
    } else {
      setBreakdown(null);
      onDiscountChange(null, null, 'yestoryd');
    }
  }, [applyCredit]);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          parentId,
          productType,
          amount: originalAmount,
        }),
      });

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || 'Invalid coupon code');
        setValidated(false);
        setCouponInfo(null);
      } else {
        setValidated(true);
        setCouponInfo({
          code: data.coupon.code,
          type: data.coupon.couponType,
          referrerName: data.referralImpact?.referrerName,
        });
        setLeadSource(data.referralImpact?.leadSource || 'yestoryd');
        calculateDiscount();
      }
    } catch (err) {
      setError('Failed to validate coupon');
      setValidated(false);
    } finally {
      setValidating(false);
    }
  };

  const calculateDiscount = async () => {
    try {
      const response = await fetch('/api/coupons/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalAmount,
          couponCode: validated ? couponCode.trim() : undefined,
          parentId,
          applyCredit,
          productType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBreakdown(data.breakdown);
        setLeadSource(data.leadSource);
        onDiscountChange(data.breakdown, validated ? couponCode : null, data.leadSource);
      }
    } catch (err) {
      console.error('Calculate discount error:', err);
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setValidated(false);
    setError(null);
    setCouponInfo(null);
    setBreakdown(null);
    onDiscountChange(null, null, 'yestoryd');
  };

  const getCouponTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      coach_referral: 'Coach Referral',
      parent_referral: 'Referral Discount',
      fixed_discount: 'Special Offer',
      percent_discount: 'Special Offer',
      first_time: 'Welcome Offer',
      event: 'Limited Offer',
    };
    return labels[type] || 'Discount';
  };

  return (
    <div className="space-y-4">
      {/* Coupon Input Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-pink-500" />
          Have a coupon or referral code?
        </h3>

        {!validated ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="Enter code (e.g., SAVE10)"
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-mono uppercase placeholder:text-gray-400 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                onKeyPress={(e) => e.key === 'Enter' && validateCoupon()}
              />
              <button
                onClick={validateCoupon}
                disabled={validating || !couponCode.trim()}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {validating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-mono font-semibold text-gray-900">
                  {couponInfo?.code}
                </div>
                <div className="text-sm text-green-600">
                  {getCouponTypeLabel(couponInfo?.type || '')}
                  {couponInfo?.referrerName && ` • via ${couponInfo.referrerName}`}
                </div>
              </div>
            </div>
            <button
              onClick={removeCoupon}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Credit Balance Section */}
      {availableCredit > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 p-4 sm:p-5">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={applyCredit}
              onChange={(e) => setApplyCredit(e.target.checked)}
              className="w-5 h-5 mt-1 rounded border-yellow-400 text-pink-500 focus:ring-pink-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-gray-900">
                  Use your credits
                </span>
              </div>
              <p className="text-sm text-gray-600">
                You have <span className="font-semibold text-pink-600">₹{availableCredit.toLocaleString()}</span> in referral credits
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Price Breakdown */}
      {breakdown && (
        <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 space-y-3">
          <h4 className="font-semibold text-gray-900 mb-3">Order Summary</h4>
          
          {/* Original Price */}
          <div className="flex justify-between text-gray-600">
            <span>Program Fee</span>
            <span>₹{breakdown.originalAmount.toLocaleString()}</span>
          </div>

          {/* Coupon Discount */}
          {breakdown.couponDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Coupon Discount
              </span>
              <span>-₹{breakdown.couponDiscount.toLocaleString()}</span>
            </div>
          )}

          {/* Credit Applied */}
          {breakdown.creditApplied > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Credit Applied
              </span>
              <span>-₹{breakdown.creditApplied.toLocaleString()}</span>
            </div>
          )}

          {/* Cap Warning */}
          {breakdown.wasCapped && (
            <div className="flex items-start gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Maximum {breakdown.maxDiscountPercent}% discount applied.
                {breakdown.creditRemaining > 0 && (
                  <> ₹{breakdown.creditRemaining.toLocaleString()} credit saved for later.</>
                )}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            {/* Total Discount */}
            {breakdown.totalDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-medium mb-2">
                <span>Total Savings</span>
                <span>-₹{breakdown.totalDiscount.toLocaleString()}</span>
              </div>
            )}

            {/* Final Amount */}
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Amount to Pay</span>
              <span className="text-pink-600">₹{breakdown.finalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Savings Badge */}
          {breakdown.totalDiscount > 0 && (
            <div className="flex justify-center mt-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <Percent className="w-4 h-4" />
                You're saving ₹{breakdown.totalDiscount.toLocaleString()}!
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info about stacking */}
      {availableCredit > 0 && (
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            You can combine coupon + credit. Maximum 20% total discount applies.
          </span>
        </div>
      )}
    </div>
  );
}
