// ============================================================
// FILE: lib/utils/phone.ts
// ============================================================
// Single source of truth for phone number handling
// 
// USAGE:
//   import { normalizePhone, formatForWhatsApp, phoneSchema } from '@/lib/utils/phone';
//
// STORAGE FORMAT: E.164 → +919687606177
// ============================================================

import { z } from 'zod';

// ============================================================
// SUPPORTED COUNTRIES (NRI Markets)
// ============================================================

const COUNTRIES: Record<string, { code: string; lengths: number[]; flag: string }> = {
  IN: { code: '91', lengths: [10], flag: '🇮🇳' },
  US: { code: '1', lengths: [10], flag: '🇺🇸' },
  CA: { code: '1', lengths: [10], flag: '🇨🇦' },
  GB: { code: '44', lengths: [10, 11], flag: '🇬🇧' },
  AE: { code: '971', lengths: [9], flag: '🇦🇪' },
  SG: { code: '65', lengths: [8], flag: '🇸🇬' },
  AU: { code: '61', lengths: [9], flag: '🇦🇺' },
  MY: { code: '60', lengths: [9, 10], flag: '🇲🇾' },
  QA: { code: '974', lengths: [8], flag: '🇶🇦' },
  SA: { code: '966', lengths: [9], flag: '🇸🇦' },
  KW: { code: '965', lengths: [8], flag: '🇰🇼' },
  BH: { code: '973', lengths: [8], flag: '🇧🇭' },
  OM: { code: '968', lengths: [8], flag: '🇴🇲' },
  DE: { code: '49', lengths: [10, 11], flag: '🇩🇪' },
  NZ: { code: '64', lengths: [8, 9], flag: '🇳🇿' },
};

// Sorted by code length (longest first) for matching
const SORTED_CODES = Object.entries(COUNTRIES).sort(
  (a, b) => b[1].code.length - a[1].code.length
);

// ============================================================
// CORE FUNCTION: Normalize to E.164
// ============================================================

/**
 * Normalize any phone format to E.164 (+919687606177)
 * This is the ONLY function you need for most cases
 * 
 * @example
 * normalizePhone('9687606177')      → '+919687606177'
 * normalizePhone('+919687606177')   → '+919687606177'
 * normalizePhone('919687606177')    → '+919687606177'
 * normalizePhone('+14155551234')    → '+14155551234'
 */
export function normalizePhone(phone: string, defaultCountry = 'IN'): string {
  if (!phone) return '';
  
  // Clean: remove spaces, dashes, parentheses, dots
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Already E.164
  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Has + but might need cleanup
  if (cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    return '+' + digits;
  }
  
  // Try to detect country code
  for (const [, info] of SORTED_CODES) {
    if (cleaned.startsWith(info.code)) {
      const national = cleaned.slice(info.code.length);
      if (info.lengths.includes(national.length)) {
        return '+' + cleaned;
      }
    }
  }
  
  // Leading zero (Indian format: 09687606177)
  if (cleaned.startsWith('0')) {
    const withoutZero = cleaned.slice(1);
    const defaultCode = COUNTRIES[defaultCountry]?.code || '91';
    return '+' + defaultCode + withoutZero;
  }
  
  // Assume default country for short numbers
  const defaultInfo = COUNTRIES[defaultCountry];
  if (defaultInfo && defaultInfo.lengths.includes(cleaned.length)) {
    return '+' + defaultInfo.code + cleaned;
  }
  
  // Fallback: add default country code
  return '+' + (COUNTRIES[defaultCountry]?.code || '91') + cleaned;
}

// ============================================================
// FORMAT FOR EXTERNAL SERVICES
// ============================================================

/**
 * Format for AiSensy WhatsApp API (no + sign)
 * AiSensy requires: 919687606177
 */
export function formatForWhatsApp(phone: string): string {
  return normalizePhone(phone).replace(/^\+/, '');
}

/**
 * Format for display: +91 96876 06177
 */
export function formatForDisplay(phone: string): string {
  const e164 = normalizePhone(phone);
  if (!e164) return '';
  
  // Find country
  for (const [country, info] of SORTED_CODES) {
    if (e164.startsWith('+' + info.code)) {
      const national = e164.slice(info.code.length + 1);
      // India: 5-5 split
      if (country === 'IN' && national.length === 10) {
        return `+${info.code} ${national.slice(0, 5)} ${national.slice(5)}`;
      }
      // US/CA: 3-3-4 split
      if ((country === 'US' || country === 'CA') && national.length === 10) {
        return `+${info.code} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
      }
      // Generic
      return `+${info.code} ${national}`;
    }
  }
  
  return e164;
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Check if phone is valid
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const e164 = normalizePhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(e164);
}

/**
 * Check if two phones are the same
 */
export function isSamePhone(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  return normalizePhone(phone1) === normalizePhone(phone2);
}

// ============================================================
// ZOD SCHEMAS (Use in API routes)
// ============================================================

/**
 * Standard phone schema - normalizes to E.164
 * Use: parentPhone: phoneSchema
 */
export const phoneSchema = z
  .string()
  .transform(v => v?.trim() || '')
  .refine(v => !v || /^[\+\d\s\-\(\)\.]{7,20}$/.test(v), 'Invalid phone format')
  .transform(v => v ? normalizePhone(v) : '');

/**
 * Optional phone schema - allows empty/null
 * Use: phone: phoneSchemaOptional
 */
export const phoneSchemaOptional = z
  .preprocess(
    val => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string()
      .transform(v => v?.trim() || '')
      .refine(v => !v || /^[\+\d\s\-\(\)\.]{7,20}$/.test(v), 'Invalid phone format')
      .transform(v => v ? normalizePhone(v) : '')
      .optional()
      .nullable()
  );

// ============================================================
// COUNTRY DROPDOWN HELPER
// ============================================================

/**
 * Get country options for dropdown (priority sorted)
 */
export function getCountryOptions() {
  const priority = ['IN', 'AE', 'US', 'GB', 'SG', 'AU', 'CA', 'MY', 'QA', 'SA'];
  
  return priority
    .filter(code => COUNTRIES[code])
    .map(code => ({
      value: '+' + COUNTRIES[code].code,
      label: `${COUNTRIES[code].flag} +${COUNTRIES[code].code}`,
      country: code
    }));
}

/**
 * Combine country code + national number
 * Use in forms with separate country dropdown
 */
export function combinePhone(countryCode: string, nationalNumber: string): string {
  const code = countryCode.replace(/^\+/, '');
  const number = nationalNumber.replace(/\D/g, '');
  return normalizePhone(code + number);
}
