// =============================================================================
// STRUCTURAL CONSTANTS
// lib/constants/structural.ts
//
// These are STRUCTURAL constants — not business configuration.
// They define technical behavior, not business rules.
// Business config (emails, counts, durations, prices) → lib/config/loader.ts
// =============================================================================

export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CONFIRMED: 'confirmed',
} as const;

export type StatusValue = typeof STATUS[keyof typeof STATUS];

export const SESSION_TYPE_KEYS = {
  COACHING: 'coaching',
  PARENT_CHECKIN: 'parent_checkin',
  PARENT_CALL: 'parent_call',
  SKILL_BOOSTER: 'skill_booster',
} as const;

export type SessionTypeKey = typeof SESSION_TYPE_KEYS[keyof typeof SESSION_TYPE_KEYS];

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?\d{7,15}$/,
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

// =============================================================================
// UTILITY FUNCTIONS (structural, not business)
// =============================================================================

/** Format WhatsApp link from phone number */
export function getWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const baseUrl = `https://wa.me/${cleanPhone}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

/** Format Cal.com booking link */
export function getCalBookingLink(username: string, slug: string): string {
  return `https://cal.com/${username}/${slug}`;
}

/** Calculate discount percentage */
export function calculateDiscount(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}
