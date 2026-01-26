'use client';

import { Check, Loader2, Ticket, X } from 'lucide-react';

interface DiscountBreakdown {
  originalAmount: number;
  couponDiscount: number;
  couponCode: string | null;
  creditApplied: number;
  totalDiscount: number;
  finalAmount: number;
  maxDiscountPercent: number;
  wasCapped: boolean;
}

interface CouponInputProps {
  couponCode: string;
  couponApplied: boolean;
  couponLoading: boolean;
  couponError: string;
  discountBreakdown: DiscountBreakdown | null;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
}

export function CouponInput({
  couponCode,
  couponApplied,
  couponLoading,
  couponError,
  discountBreakdown,
  onCodeChange,
  onApply,
  onRemove,
}: CouponInputProps) {
  return (
    <div className="border border-border rounded-xl p-3 bg-surface-2 space-y-3">
      <label className="block text-sm font-medium text-text-secondary flex items-center gap-1.5">
        <Ticket className="w-4 h-4 text-[#FF0099]" />
        Have a coupon or referral code?
      </label>

      {!couponApplied ? (
        <div className="flex gap-2 w-full">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg text-white bg-surface-1 placeholder:text-text-tertiary focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm uppercase"
          />
          <button
            type="button"
            onClick={onApply}
            disabled={couponLoading || !couponCode.trim()}
            className="flex-shrink-0 px-3 sm:px-4 py-2 bg-[#FF0099] text-white font-semibold rounded-lg hover:bg-[#FF0099]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {couponLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Apply'
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-semibold text-green-300 text-sm">
                {couponCode} applied!
              </p>
              <p className="text-green-400 text-xs">
                You save ₹{discountBreakdown?.totalDiscount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-text-tertiary hover:text-red-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {couponError && (
        <p className="text-red-400 text-xs flex items-center gap-1">
          <X className="w-3 h-3" />
          {couponError}
        </p>
      )}

      {/* Price Breakdown - Only show when coupon applied */}
      {couponApplied && discountBreakdown && (
        <div className="pt-2 border-t border-border space-y-1.5">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Original Price</span>
            <span>₹{discountBreakdown.originalAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm text-green-400">
            <span>Coupon Discount</span>
            <span>-₹{discountBreakdown.couponDiscount.toLocaleString('en-IN')}</span>
          </div>
          {discountBreakdown.creditApplied > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Credit Applied</span>
              <span>-₹{discountBreakdown.creditApplied.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-white pt-1 border-t border-border">
            <span>Final Amount</span>
            <span className="text-[#FF0099]">₹{discountBreakdown.finalAmount.toLocaleString('en-IN')}</span>
          </div>
          {discountBreakdown.wasCapped && (
            <p className="text-xs text-text-tertiary italic">
              Maximum {discountBreakdown.maxDiscountPercent}% discount applied
            </p>
          )}
        </div>
      )}
    </div>
  );
}
