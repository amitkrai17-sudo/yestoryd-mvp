// components/shared/RevenueCalculator.tsx
// Display component for revenue split visualization.
// Does NOT call Calculator B — parent provides all numbers.
'use client';

import { IndianRupee, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface RevenueCalculatorProps {
  productType: 'coaching' | 'tuition' | 'workshop';
  variant: 'inline' | 'card' | 'detail';

  grossAmount: number;
  coachAmount: number;
  leadAmount: number;
  platformAmount: number;
  tdsAmount?: number;
  netToCoach: number;

  coachPercent: number;
  leadPercent: number;
  platformPercent: number;

  coachTierName?: string;
  sessionRate?: number;
  sessionDuration?: number;
  sessionType?: string;

  rateFlag?: 'green' | 'amber_low' | 'amber_high' | 'red_low' | 'red_high';
  rateFlagMessage?: string;

  showCoachView?: boolean;
}

// ============================================================
// PRODUCT COLORS
// ============================================================

const PRODUCT_COLORS: Record<string, { bg: string; text: string; bar: string; label: string }> = {
  tuition:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',   bar: 'bg-blue-500',   label: 'English Classes' },
  coaching: { bg: 'bg-purple-500/10',  text: 'text-purple-400', bar: 'bg-purple-500',  label: 'Coaching' },
  workshop: { bg: 'bg-teal-500/10',    text: 'text-teal-400',   bar: 'bg-teal-500',    label: 'Workshop' },
};

const FLAG_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  green:      { bg: 'bg-green-500/10',  text: 'text-green-400',  icon: CheckCircle },
  amber_low:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: AlertTriangle },
  amber_high: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: AlertTriangle },
  red_low:    { bg: 'bg-red-500/10',    text: 'text-red-400',    icon: AlertTriangle },
  red_high:   { bg: 'bg-red-500/10',    text: 'text-red-400',    icon: AlertTriangle },
};

function formatRupees(amount: number): string {
  return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`;
}

// ============================================================
// INLINE VARIANT
// ============================================================

function InlineVariant({ props }: { props: RevenueCalculatorProps }) {
  if (props.showCoachView) {
    return (
      <span className="text-sm text-green-400 font-medium">
        Your share: {formatRupees(props.netToCoach)}
      </span>
    );
  }
  return (
    <span className="text-xs text-text-tertiary">
      Coach: {formatRupees(props.coachAmount)} | Lead: {formatRupees(props.leadAmount)} | Platform: {formatRupees(props.platformAmount)}
    </span>
  );
}

// ============================================================
// CARD VARIANT
// ============================================================

function CardVariant({ props }: { props: RevenueCalculatorProps }) {
  const product = PRODUCT_COLORS[props.productType] || PRODUCT_COLORS.tuition;
  const total = props.grossAmount || 1;
  const coachPct = Math.round((props.coachAmount / total) * 100);
  const leadPct = Math.round((props.leadAmount / total) * 100);

  return (
    <div className="bg-surface-1/50 rounded-xl border border-border p-3 space-y-2">
      {/* Stacked bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden flex">
          <div className={`${product.bar} rounded-l-full`} style={{ width: `${coachPct}%` }} />
          {leadPct > 0 && <div className="bg-orange-400" style={{ width: `${leadPct}%` }} />}
          <div className="bg-gray-500 flex-1 rounded-r-full" />
        </div>
        {props.sessionRate != null && (
          <span className="text-sm text-white font-medium whitespace-nowrap">
            {formatRupees(props.sessionRate)}/session
          </span>
        )}
      </div>

      {/* Coach share */}
      <div className="flex justify-between text-sm">
        <span className="text-text-tertiary">Your share ({props.coachPercent}%)</span>
        <span className="text-green-400 font-semibold">{formatRupees(props.netToCoach)}</span>
      </div>

      {/* Lead + Platform */}
      <div className="flex gap-3 text-xs text-text-tertiary">
        {props.leadAmount > 0 && <span>Lead: {formatRupees(props.leadAmount)}</span>}
        <span>Platform: {formatRupees(props.platformAmount)}</span>
      </div>

      {/* Rate flag */}
      {props.rateFlag && props.rateFlag !== 'green' && props.rateFlagMessage && (
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${FLAG_STYLES[props.rateFlag]?.bg} ${FLAG_STYLES[props.rateFlag]?.text}`}>
          <AlertTriangle className="w-3 h-3" />
          {props.rateFlagMessage}
        </div>
      )}

      {/* TDS notice */}
      {(props.tdsAmount ?? 0) > 0 && (
        <div className="text-xs text-text-tertiary">
          TDS: {formatRupees(props.tdsAmount!)} deducted
        </div>
      )}
    </div>
  );
}

// ============================================================
// DETAIL VARIANT
// ============================================================

function DetailVariant({ props }: { props: RevenueCalculatorProps }) {
  const product = PRODUCT_COLORS[props.productType] || PRODUCT_COLORS.tuition;

  return (
    <div className="space-y-3">
      {/* Tier badge */}
      {props.coachTierName && (
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm text-text-secondary">{props.coachTierName}</span>
        </div>
      )}

      {/* Split visualization */}
      <div className="bg-surface-1/50 rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${product.bg} ${product.text}`}>
            {product.label}
          </span>
          {props.sessionRate != null && (
            <span className="text-sm text-white">{formatRupees(props.sessionRate)}/session</span>
          )}
        </div>

        {/* Split bar */}
        <div className="h-3 bg-surface-2 rounded-full overflow-hidden flex">
          <div className={`${product.bar}`} style={{ width: `${props.coachPercent}%` }} />
          {props.leadPercent > 0 && <div className="bg-orange-400" style={{ width: `${props.leadPercent}%` }} />}
          <div className="bg-gray-600 flex-1" />
        </div>

        {/* Labels */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${product.bar}`} />
              <span className="text-text-secondary">You ({props.coachPercent}%)</span>
            </div>
            <span className="text-green-400 font-semibold">{formatRupees(props.coachAmount)}</span>
          </div>
          {props.leadPercent > 0 && (
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-text-secondary">Lead ({props.leadPercent}%)</span>
              </div>
              <span className="text-text-tertiary">{formatRupees(props.leadAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-600" />
              <span className="text-text-secondary">Platform ({props.platformPercent}%)</span>
            </div>
            <span className="text-text-tertiary">{formatRupees(props.platformAmount)}</span>
          </div>
        </div>

        {/* Net to coach */}
        <div className="border-t border-border pt-2 flex justify-between text-sm">
          <span className="text-white font-medium">Net to you</span>
          <span className="text-green-400 font-bold">{formatRupees(props.netToCoach)}</span>
        </div>
      </div>

      {/* Rate flag */}
      {props.rateFlag && props.rateFlagMessage && (
        <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl ${FLAG_STYLES[props.rateFlag]?.bg} ${FLAG_STYLES[props.rateFlag]?.text}`}>
          {props.rateFlag === 'green' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {props.rateFlag === 'green'
            ? `${formatRupees(props.sessionRate ? Math.round((props.sessionRate / (props.sessionDuration || 60)) * 60) : 0)}/hr — normal range`
            : props.rateFlagMessage
          }
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function RevenueCalculator(props: RevenueCalculatorProps) {
  switch (props.variant) {
    case 'inline': return <InlineVariant props={props} />;
    case 'card': return <CardVariant props={props} />;
    case 'detail': return <DetailVariant props={props} />;
    default: return <CardVariant props={props} />;
  }
}

// ============================================================
// PRODUCT BADGE (reusable sub-component)
// ============================================================

export function ProductBadge({ product }: { product: 'coaching' | 'tuition' | 'workshop' }) {
  const colors = PRODUCT_COLORS[product] || PRODUCT_COLORS.tuition;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}
