// ============================================================
// FILE: lib/tuition/pay-link-status.ts
// PURPOSE: PURE (client-safe) pay-link state derivation + chip metadata,
//   shared by the admin and coach UIs. No server imports — the lifecycle
//   mutations live in pay-link-lifecycle.ts (server only). Only meaningful
//   for payment_pending enrollments.
// ============================================================

export type PayLinkState = 'active' | 'expired' | 'voided';

const DAY_MS = 24 * 60 * 60 * 1000;

export function computePayLinkState(args: {
  expiresAt: string | null;
  voidedAt: string | null;
  nowMs: number;
}): { state: PayLinkState; daysLeft: number | null } {
  if (args.voidedAt != null) return { state: 'voided', daysLeft: null };
  if (args.expiresAt != null) {
    const expMs = Date.parse(args.expiresAt);
    if (!Number.isNaN(expMs)) {
      if (expMs < args.nowMs) return { state: 'expired', daysLeft: 0 };
      return { state: 'active', daysLeft: Math.max(0, Math.ceil((expMs - args.nowMs) / DAY_MS)) };
    }
  }
  return { state: 'active', daysLeft: null };
}

/** Dark-portal chip classes + label (admin + coach are both dark themes). */
export const PAY_LINK_STATE_META: Record<PayLinkState, { label: (daysLeft: number | null) => string; cls: string }> = {
  active:  { label: (d) => (d != null ? `Link active · ${d}d left` : 'Link active'), cls: 'bg-emerald-500/10 text-emerald-300' },
  expired: { label: () => 'Link expired', cls: 'bg-amber-500/10 text-amber-300' },
  voided:  { label: () => 'Link cancelled', cls: 'bg-red-500/10 text-red-400' },
};
