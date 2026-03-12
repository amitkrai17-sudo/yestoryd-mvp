# Yestoryd Phone Number & Country Code Audit Report
**Date:** January 17, 2026  
**Purpose:** Identify inconsistencies and create global phone handling strategy

---

## Executive Summary

**Current State:** INCONSISTENT ❌  
**Impact:** High - affects WhatsApp delivery, OTP authentication, international customer support  
**Effort to Fix:** Medium (2-3 hours)

### Critical Issues Found

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Database stores phone in 4+ different formats | 🔴 HIGH | `children.parent_phone`, `parents.phone`, `coaches.phone` |
| 2 | Different validation regex across APIs | 🔴 HIGH | Payment, Coach Profile, Auth routes |
| 3 | AiSensy requires `91XXXXXXXXXX` (no +), code sometimes sends with + | 🟡 MEDIUM | `lib/communication/aisensy.ts` |
| 4 | Cal.com needs `+91XXXXXXXXXX`, code sometimes strips it | 🟡 MEDIUM | `/lets-talk/page.tsx` |
| 5 | No central phone utility function | 🔴 HIGH | Scattered across 10+ files |
| 6 | International numbers partially supported | 🟡 MEDIUM | Payment routes fixed, others not |

---

## 1. Current Database State

### Phone Field Locations

| Table | Column | Current Format Examples | Used By |
|-------|--------|------------------------|---------|
| `children` | `parent_phone` | `9876543210`, `+919687606177`, `919099145083` | Assessment, CRM |
| `parents` | `phone` | `918976287997`, `+919687606177` | Parent Login OTP |
| `coaches` | `phone` | `+919XXXXXXXXX` | Coach Portal |
| `coaches` | `whatsapp_number` | (same issues) | WhatsApp notifications |
| `discovery_calls` | `parent_phone` | Mixed formats | Discovery flow |

### Actual Data Sample (from chat history)
```
| parent_phone  | parent_email            | parent_name     |
| ------------- | ----------------------- | --------------- |
| 9876543210    | test@example.com        | Test Parent     | ← No country code
| +919099145083 | rucharai86@gmail.com    | Rucha Rai       | ← With +91
| +919687606177 | amitraiforyou@gmail.com | rita rai        | ← With +91
```

**Verdict:** 3 different formats in the same column! 🔴

---

## 2. Validation Patterns Across Codebase

### API Route: `/api/payment/create/route.ts`
```typescript
// OLD (India-only):
parentPhone: z.string()
  .transform((v) => v ? v.replace(/^(\+91|91)/, '') : v)
  .refine((v) => !v || /^[6-9]\d{9}$/.test(v), 'Invalid Indian mobile number')

// NEW (International - after fix):
parentPhone: z.string()
  .transform((v) => v ? v.replace(/[\s\-\(\)]/g, '') : v)
  .refine((v) => !v || /^\+?\d{7,15}$/.test(v), 'Invalid phone number')
```

### API Route: `/api/payment/verify/route.ts`
```typescript
// Was:
parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile')

// Now (after fix):
parentPhone: z.string()
  .transform((v) => v ? v.replace(/[\s\-\(\)]/g, '') : v)
  .refine((v) => !v || /^\+?\d{7,15}$/.test(v), 'Invalid phone number')
```

### API Route: `/api/coach/profile/route.ts`
```typescript
// Current:
phone: z.preprocess(val => val === '' ? undefined : val, 
  z.string().regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Enter valid phone').optional())
```

### Assessment Page: Phone Input
```typescript
// No country code selector - just 10-digit input
// Assumes India
```

### Let's Talk Page: Phone Formatting
```typescript
// Has country code dropdown: +91, +1, +44, +971, +65, +61, +60, +974, +966, +49
// But formatting logic is complex and changed multiple times
```

---

## 3. External Service Requirements

### AiSensy (WhatsApp Business API)
```
Required Format: 918976287997 (12 digits, no + sign)
Current Function: formatIndianPhone() - only handles India
```

```typescript
// Current lib/communication/aisensy.ts
function formatIndianPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  if (!cleaned.startsWith('91')) cleaned = '91' + cleaned;
  return cleaned;
}
```
**Issue:** Only handles Indian numbers. International numbers will fail!

### Cal.com (Booking System)
```
Required Format: +919687606177 (with + prefix)
Issue: Code was stripping +91, causing Oman (+968) detection bug
```

### Razorpay (Payments)
```
Accepts: Any valid format
Stores: As-provided
```

---

## 4. Countries to Support (Target Markets)

| Country | Code | Digits | Total | Priority |
|---------|------|--------|-------|----------|
| 🇮🇳 India | +91 | 10 | 12-13 | Primary |
| 🇦🇪 UAE | +971 | 9 | 12-13 | High (NRI) |
| 🇺🇸 USA | +1 | 10 | 11-12 | High (NRI) |
| 🇬🇧 UK | +44 | 10-11 | 12-14 | Medium |
| 🇸🇬 Singapore | +65 | 8 | 10-11 | Medium |
| 🇦🇺 Australia | +61 | 9 | 11-12 | Medium |
| 🇲🇾 Malaysia | +60 | 9-10 | 11-12 | Medium |
| 🇶🇦 Qatar | +974 | 8 | 11-12 | Low |
| 🇸🇦 Saudi Arabia | +966 | 9 | 12-13 | Low |
| 🇩🇪 Germany | +49 | 10-11 | 12-14 | Low |

---

## 5. Recommended Solution Architecture

### 5.1 Canonical Storage Format
**Store ALL phone numbers in E.164 format:**
```
+[country code][number]

Examples:
+919687606177  (India)
+14155551234   (USA)
+447911123456  (UK)
+971501234567  (UAE)
```

### 5.2 Central Phone Utility Library

Create: `lib/utils/phone.ts`

```typescript
// lib/utils/phone.ts
// Centralized phone number handling for Yestoryd

export interface PhoneNumber {
  raw: string;           // Original input
  e164: string;          // +919687606177 (canonical storage)
  national: string;      // 9687606177 (display)
  countryCode: string;   // +91
  isValid: boolean;
  country: string;       // 'IN', 'US', 'AE', etc.
}

// Known country patterns
const COUNTRY_PATTERNS = {
  'IN': { code: '91', lengths: [10], regex: /^[6-9]\d{9}$/ },
  'US': { code: '1', lengths: [10], regex: /^\d{10}$/ },
  'UK': { code: '44', lengths: [10, 11], regex: /^\d{10,11}$/ },
  'AE': { code: '971', lengths: [9], regex: /^5\d{8}$/ },
  'SG': { code: '65', lengths: [8], regex: /^[89]\d{7}$/ },
  'AU': { code: '61', lengths: [9], regex: /^4\d{8}$/ },
  'MY': { code: '60', lengths: [9, 10], regex: /^\d{9,10}$/ },
  'QA': { code: '974', lengths: [8], regex: /^\d{8}$/ },
  'SA': { code: '966', lengths: [9], regex: /^5\d{8}$/ },
  'DE': { code: '49', lengths: [10, 11], regex: /^\d{10,11}$/ },
};

/**
 * Parse and validate phone number
 */
export function parsePhone(input: string, defaultCountry = 'IN'): PhoneNumber {
  // Remove all formatting
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
  
  let countryCode = '';
  let national = '';
  let country = defaultCountry;
  
  // Check if starts with + 
  if (cleaned.startsWith('+')) {
    // Find matching country code
    for (const [cc, info] of Object.entries(COUNTRY_PATTERNS)) {
      if (cleaned.startsWith('+' + info.code)) {
        countryCode = '+' + info.code;
        national = cleaned.slice(countryCode.length);
        country = cc;
        break;
      }
    }
    // If no match found, still extract what we can
    if (!countryCode) {
      countryCode = cleaned.match(/^\+\d{1,4}/)?.[0] || '';
      national = cleaned.slice(countryCode.length);
    }
  }
  // Check if starts with country code without +
  else if (/^\d{11,15}$/.test(cleaned)) {
    for (const [cc, info] of Object.entries(COUNTRY_PATTERNS)) {
      if (cleaned.startsWith(info.code) && info.lengths.includes(cleaned.length - info.code.length)) {
        countryCode = '+' + info.code;
        national = cleaned.slice(info.code.length);
        country = cc;
        break;
      }
    }
  }
  // Assume default country for short numbers
  else if (/^\d{7,11}$/.test(cleaned)) {
    const info = COUNTRY_PATTERNS[defaultCountry];
    if (info && info.lengths.includes(cleaned.length)) {
      countryCode = '+' + info.code;
      national = cleaned;
      country = defaultCountry;
    } else if (cleaned.startsWith('0')) {
      // Remove leading 0 (common in India: 09687606177)
      national = cleaned.slice(1);
      const info = COUNTRY_PATTERNS[defaultCountry];
      if (info) countryCode = '+' + info.code;
    } else {
      national = cleaned;
    }
  }
  
  const e164 = countryCode + national;
  const isValid = validatePhone(e164, country);
  
  return {
    raw: input,
    e164,
    national,
    countryCode,
    isValid,
    country
  };
}

/**
 * Validate phone against country rules
 */
export function validatePhone(e164: string, country: string): boolean {
  const info = COUNTRY_PATTERNS[country];
  if (!info) return e164.length >= 10 && e164.length <= 16;
  
  const national = e164.replace(/^\+\d{1,4}/, '');
  return info.lengths.includes(national.length) && info.regex.test(national);
}

/**
 * Format for AiSensy WhatsApp (no + sign)
 */
export function formatForAiSensy(phone: string): string {
  const parsed = parsePhone(phone);
  // AiSensy wants: 919687606177 (no +)
  return parsed.e164.replace(/^\+/, '');
}

/**
 * Format for Cal.com (with + sign)
 */
export function formatForCalCom(phone: string): string {
  const parsed = parsePhone(phone);
  // Cal.com wants: +919687606177
  return parsed.e164;
}

/**
 * Format for display (national format)
 */
export function formatForDisplay(phone: string, showCountry = true): string {
  const parsed = parsePhone(phone);
  if (showCountry) {
    // Format: +91 96876 06177
    const national = parsed.national;
    if (parsed.country === 'IN' && national.length === 10) {
      return `${parsed.countryCode} ${national.slice(0, 5)} ${national.slice(5)}`;
    }
    return `${parsed.countryCode} ${national}`;
  }
  return parsed.national;
}

/**
 * Format for database storage (canonical E.164)
 */
export function formatForStorage(phone: string): string {
  const parsed = parsePhone(phone);
  return parsed.e164; // Always store as +919687606177
}

/**
 * Normalize any format to E.164
 */
export function normalizePhone(phone: string, defaultCountry = 'IN'): string {
  if (!phone) return '';
  const parsed = parsePhone(phone, defaultCountry);
  return parsed.e164;
}

/**
 * Check if two phone numbers are the same
 */
export function isSamePhone(phone1: string, phone2: string): boolean {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Zod schema for phone validation (use in API routes)
 */
export const phoneSchema = {
  // Accept any format, normalize on storage
  flexible: z.string()
    .transform(v => v ? v.replace(/[\s\-\(\)\.]/g, '') : v)
    .refine(v => !v || /^\+?\d{7,15}$/.test(v), 'Invalid phone number')
    .transform(v => v ? normalizePhone(v) : v),
  
  // Strict E.164 format
  e164: z.string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (+919687606177)'),
  
  // Optional phone (allow empty)
  optional: z.preprocess(
    val => val === '' ? undefined : val,
    z.string()
      .transform(v => v ? v.replace(/[\s\-\(\)\.]/g, '') : v)
      .refine(v => !v || /^\+?\d{7,15}$/.test(v), 'Invalid phone number')
      .transform(v => v ? normalizePhone(v) : v)
      .optional()
  )
};
```

---

## 6. Migration Plan

### Phase 1: Create Utility Library (30 min)
1. Create `lib/utils/phone.ts` with above code
2. Add unit tests
3. Deploy

### Phase 2: Update API Routes (1 hour)
Update these files to use central utility:

| File | Change |
|------|--------|
| `app/api/payment/create/route.ts` | Use `phoneSchema.flexible` |
| `app/api/payment/verify/route.ts` | Use `phoneSchema.flexible` |
| `app/api/coach/profile/route.ts` | Use `phoneSchema.optional` |
| `app/api/auth/send-otp/route.ts` | Use `normalizePhone()` + `formatForAiSensy()` |
| `app/api/discovery-call/*/route.ts` | Use `normalizePhone()` |

### Phase 3: Update Frontend Components (1 hour)
| File | Change |
|------|--------|
| `app/assessment/page.tsx` | Add country code selector |
| `app/lets-talk/page.tsx` | Use `formatForCalCom()` |
| `app/enroll/page.tsx` | Use `formatForStorage()` |
| `app/parent/login/page.tsx` | Use `normalizePhone()` |
| Components with phone input | Consistent country dropdown |

### Phase 4: Database Normalization (30 min)
```sql
-- Backup first
CREATE TABLE children_phone_backup AS 
SELECT id, parent_phone FROM children;

-- Normalize all phone numbers to E.164
UPDATE children
SET parent_phone = 
  CASE 
    -- Already E.164
    WHEN parent_phone ~ '^\+\d{10,15}$' THEN parent_phone
    -- Has 91 prefix without +
    WHEN parent_phone ~ '^91\d{10}$' THEN '+' || parent_phone
    -- Just 10 digits (assume India)
    WHEN parent_phone ~ '^\d{10}$' THEN '+91' || parent_phone
    -- Other formats
    ELSE '+91' || regexp_replace(parent_phone, '\D', '', 'g')
  END
WHERE parent_phone IS NOT NULL;

-- Same for parents table
UPDATE parents
SET phone = 
  CASE 
    WHEN phone ~ '^\+\d{10,15}$' THEN phone
    WHEN phone ~ '^91\d{10}$' THEN '+' || phone
    WHEN phone ~ '^\d{10}$' THEN '+91' || phone
    ELSE '+91' || regexp_replace(phone, '\D', '', 'g')
  END
WHERE phone IS NOT NULL;

-- Same for coaches
UPDATE coaches
SET phone = 
  CASE 
    WHEN phone ~ '^\+\d{10,15}$' THEN phone
    WHEN phone ~ '^91\d{10}$' THEN '+' || phone
    WHEN phone ~ '^\d{10}$' THEN '+91' || phone
    ELSE '+91' || regexp_replace(phone, '\D', '', 'g')
  END
WHERE phone IS NOT NULL;
```

### Phase 5: Update AiSensy Integration (15 min)
```typescript
// lib/communication/aisensy.ts

import { formatForAiSensy, parsePhone } from '@/lib/utils/phone';

export async function sendWhatsAppMessage(params: AiSensyMessageParams) {
  // Use centralized formatting
  const phone = parsePhone(params.to);
  
  // Check if we support WhatsApp for this country
  const supportedCountries = ['IN', 'AE', 'US', 'UK', 'SG']; // Expand as needed
  
  if (!supportedCountries.includes(phone.country)) {
    console.warn(`WhatsApp not configured for country: ${phone.country}`);
    // Fall back to email/SMS
    return { success: false, error: `WhatsApp not available for ${phone.country}` };
  }
  
  const formattedPhone = formatForAiSensy(params.to);
  // ... rest of function
}
```

---

## 7. Testing Checklist

### After Implementation, Test:

| Test Case | Input | Expected Storage | Expected AiSensy | Expected Cal.com |
|-----------|-------|-----------------|------------------|------------------|
| Indian bare | `9687606177` | `+919687606177` | `919687606177` | `+919687606177` |
| Indian +91 | `+919687606177` | `+919687606177` | `919687606177` | `+919687606177` |
| Indian 91 | `919687606177` | `+919687606177` | `919687606177` | `+919687606177` |
| Indian 0 | `09687606177` | `+919687606177` | `919687606177` | `+919687606177` |
| US | `+14155551234` | `+14155551234` | `14155551234` | `+14155551234` |
| UAE | `+971501234567` | `+971501234567` | `971501234567` | `+971501234567` |
| UK | `+447911123456` | `+447911123456` | `447911123456` | `+447911123456` |

---

## 8. Quick Wins (Immediate Actions)

### Action 1: Add Country Code Selector to Assessment Form
Currently missing - add same dropdown as Let's Talk page:
```tsx
<select name="countryCode" defaultValue="+91">
  <option value="+91">🇮🇳 +91</option>
  <option value="+1">🇺🇸 +1</option>
  <option value="+44">🇬🇧 +44</option>
  <option value="+971">🇦🇪 +971</option>
  <option value="+65">🇸🇬 +65</option>
</select>
```

### Action 2: Fix AiSensy for International
Update `formatIndianPhone` to `formatForWhatsApp` that handles all countries.

### Action 3: Database Cleanup
Run the normalization SQL to make all existing data consistent.

---

## 9. Files to Modify (Complete List)

| File | Priority | Changes Needed |
|------|----------|----------------|
| `lib/utils/phone.ts` | 🔴 CREATE | New central utility |
| `app/api/payment/create/route.ts` | 🔴 HIGH | Import & use phone utils |
| `app/api/payment/verify/route.ts` | 🔴 HIGH | Import & use phone utils |
| `app/api/auth/send-otp/route.ts` | 🔴 HIGH | Use formatForAiSensy |
| `lib/communication/aisensy.ts` | 🔴 HIGH | Update formatIndianPhone |
| `app/api/coach/profile/route.ts` | 🟡 MEDIUM | Use phoneSchema.optional |
| `app/assessment/page.tsx` | 🟡 MEDIUM | Add country dropdown |
| `app/lets-talk/page.tsx` | 🟡 MEDIUM | Use central formatForCalCom |
| `app/enroll/page.tsx` | 🟡 MEDIUM | Use formatForStorage |
| `app/parent/login/page.tsx` | 🟡 MEDIUM | Use normalizePhone |
| `components/PhoneInput.tsx` | 🟢 NEW | Reusable phone component |

---

## 10. Summary

### Current Problems
1. ❌ Phone stored in 4+ formats in database
2. ❌ Different validation regex in different APIs
3. ❌ No central phone utility
4. ❌ AiSensy only works for Indian numbers
5. ❌ Cal.com had country detection bugs

### After Fix
1. ✅ All phones stored in E.164 format (+919687606177)
2. ✅ Single validation schema across all APIs
3. ✅ Central `lib/utils/phone.ts` utility
4. ✅ AiSensy works for all configured countries
5. ✅ Cal.com receives correctly formatted numbers
6. ✅ Ready for global expansion

---

**Next Step:** Would you like me to create the actual files for implementation?
