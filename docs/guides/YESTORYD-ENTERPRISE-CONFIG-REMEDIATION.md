# YESTORYD PAYMENT FLOW - ENTERPRISE SINGLE SOURCE OF TRUTH
## Claude Code Comprehensive Remediation Plan

**Objective:** Zero hardcoded values. All configuration from database. Fail loudly on missing config.

---

## PHASE 1: COMPLETE STATE AUDIT

### Step 1.1: Database Schema Analysis

```
TASK: Audit all configuration-related tables and their current state.

Execute these queries and report findings:

-- 1. Check pricing_plans structure and data
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pricing_plans' 
ORDER BY ordinal_position;

SELECT id, name, price, duration_months, sessions_total, 
       coaching_sessions, checkin_sessions, 
       coaching_duration_minutes, checkin_duration_minutes,
       is_active
FROM pricing_plans;

-- 2. Check site_settings current state
SELECT key, value, category, description, updated_at
FROM site_settings 
ORDER BY category, key;

-- 3. Check revenue_split_config existence and state
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'revenue_split_config';

-- If exists:
SELECT * FROM revenue_split_config WHERE is_active = true;

-- 4. Check coaches table for Rucha's ID
SELECT id, name, email, status FROM coaches 
WHERE email LIKE '%rucha%' OR email LIKE '%yestoryd%';

-- 5. Check if there's any existing admin config
SELECT * FROM site_settings WHERE key LIKE '%admin%' OR category = 'auth';

Report:
- What config tables exist
- What data is populated
- What's missing
- Rucha's actual coach UUID
```

### Step 1.2: Codebase Hardcoded Values Scan

```
TASK: Comprehensive scan of payment flow for ALL hardcoded values.

Search these directories:
- app/api/payment/
- app/api/enrollment/
- lib/scheduling/
- lib/business/
- lib/api-auth.ts
- middleware.ts

Search patterns (use grep or IDE search):

1. EMAIL PATTERNS:
   - rucha.rai@yestoryd.com
   - rucha@yestoryd.com
   - amitkrai17@gmail.com
   - amitkrai17@yestoryd.com
   - engage@yestoryd.com
   - Any @yestoryd.com as fallback/default

2. ADMIN ARRAYS:
   - ADMIN_EMAILS
   - adminEmails
   - isAdmin.*includes

3. NUMERIC CONSTANTS:
   - = 3 (months)
   - = 6 (coaching sessions)
   - = 9 (total sessions)
   - = 45 (duration)
   - = 30 (duration or TDS threshold thousands)
   - = 5999 (price)
   - = 10 (TDS percent)
   - = 30000 (TDS threshold)
   - = 5 (rate limit)
   - = 60 (rate limit window)
   - = 90 (scheduling lookahead)

4. STRING CONSTANTS:
   - 'INR'
   - 'coaching'
   - 'parent_checkin'
   - 'parent' (old session type)
   - 'rcpt_'

For EACH finding, document:
| File | Line | Hardcoded Value | Purpose | Should Be |
|------|------|-----------------|---------|-----------|

Do NOT fix yet - just audit.
```

### Step 1.3: Dependency Analysis

```
TASK: Map which code depends on which config values.

Create a dependency matrix:

CONFIG VALUE → FILES THAT USE IT

Example:
default_coach_email:
  - app/api/payment/verify/route.ts (fallback coach lookup)
  - app/api/payment/webhook/route.ts (if exists)
  - lib/scheduling/orchestrator.ts (if uses fallback)

admin_emails:
  - middleware.ts (route protection)
  - lib/api-auth.ts (requireAdmin)
  - lib/auth-options.ts (NextAuth callback)

session_counts:
  - app/api/payment/verify/route.ts
  - lib/scheduling/session-manager.ts
  - (should come from pricing_plans)

This tells us which files need updates when we create the settings loader.
```

---

## PHASE 2: DATABASE SCHEMA COMPLETION

### Step 2.1: Design Complete Config Schema

```
TASK: Design the complete configuration schema.

We need these config sources:

1. site_settings table (key-value for simple config)
   Categories needed:
   - 'auth' (admin_emails)
   - 'coaches' (default_coach_id, default_coach_email)
   - 'payments' (currency, min_amount, rate_limits, receipt_prefix)
   - 'scheduling' (gap_days, lookahead_days, buffer_minutes)
   - 'notifications' (reminder_hours_before)

2. pricing_plans table (product-specific config)
   Already has: price, duration, session counts, durations
   Verify: is this being READ by payment routes?

3. revenue_split_config table (financial config)
   Should have: percentages, TDS rate, TDS threshold, payout config
   Check if exists and is populated

4. session_types table (or constants)
   Options:
   A) Create session_types lookup table
   B) Use ENUM in database
   C) Put in site_settings as JSON
   
   Recommendation: site_settings with JSON array for flexibility

Create the SQL that ensures ALL required config exists.
```

### Step 2.2: Execute Schema Migration

```sql
-- ============================================================
-- ENTERPRISE CONFIG MIGRATION
-- Single Source of Truth for Yestoryd Payment Flow
-- ============================================================

-- 1. AUTH CONFIGURATION
-- ============================================================
INSERT INTO site_settings (key, value, category, description) VALUES
('admin_emails', '["rucha.rai@yestoryd.com","amitkrai17@gmail.com","amitkrai17@yestoryd.com","engage@yestoryd.com"]', 'auth', 'JSON array of admin email addresses')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. COACH CONFIGURATION
-- ============================================================
-- First get Rucha's UUID
DO $$
DECLARE
  rucha_id UUID;
BEGIN
  SELECT id INTO rucha_id FROM coaches WHERE email = 'rucha.rai@yestoryd.com' LIMIT 1;
  
  INSERT INTO site_settings (key, value, category, description) VALUES
  ('default_coach_id', rucha_id::TEXT, 'coaches', 'UUID of default/fallback coach'),
  ('default_coach_email', 'rucha.rai@yestoryd.com', 'coaches', 'Email of default/fallback coach'),
  ('default_coach_name', 'Rucha Rai', 'coaches', 'Display name of default coach')
  ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();
END $$;

-- 3. PAYMENT CONFIGURATION
-- ============================================================
INSERT INTO site_settings (key, value, category, description) VALUES
('payment_currency', 'INR', 'payments', 'Currency code for payments'),
('payment_min_amount_paise', '100', 'payments', 'Minimum payment amount in paise'),
('payment_receipt_prefix', 'rcpt_yestoryd_', 'payments', 'Prefix for payment receipts'),
('payment_rate_limit_requests', '5', 'payments', 'Max payment requests per window'),
('payment_rate_limit_window_seconds', '60', 'payments', 'Rate limit window in seconds')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. SCHEDULING CONFIGURATION
-- ============================================================
INSERT INTO site_settings (key, value, category, description) VALUES
('scheduling_min_gap_days', '2', 'scheduling', 'Minimum days between sessions'),
('scheduling_lookahead_days', '90', 'scheduling', 'How far ahead to schedule sessions'),
('scheduling_buffer_minutes', '15', 'scheduling', 'Buffer between sessions'),
('coach_max_sessions_per_day', '8', 'scheduling', 'Maximum sessions per coach per day')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 5. SESSION TYPES (Reference Data)
-- ============================================================
INSERT INTO site_settings (key, value, category, description) VALUES
('session_types', '{"coaching": {"label": "Coaching Session", "default_duration": 45}, "parent_checkin": {"label": "Parent Check-in", "default_duration": 30}, "remedial": {"label": "Skill Booster", "default_duration": 45}}', 'scheduling', 'Session type definitions with labels and default durations')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 6. NOTIFICATION CONFIGURATION
-- ============================================================
INSERT INTO site_settings (key, value, category, description) VALUES
('reminder_hours_before_24h', '24', 'notifications', 'Hours before session for 24h reminder'),
('reminder_hours_before_1h', '1', 'notifications', 'Hours before session for 1h reminder')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 7. VERIFY REVENUE SPLIT CONFIG EXISTS
-- ============================================================
-- Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS revenue_split_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_cost_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  coach_cost_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  tds_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  tds_threshold_annual INTEGER NOT NULL DEFAULT 30000,
  payout_frequency TEXT NOT NULL DEFAULT 'monthly',
  payout_day_of_month INTEGER DEFAULT 7,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_percentages CHECK (
    lead_cost_percent + coach_cost_percent + platform_fee_percent = 100.00
  )
);

-- Insert default if empty
INSERT INTO revenue_split_config (
  lead_cost_percent, coach_cost_percent, platform_fee_percent,
  tds_rate_percent, tds_threshold_annual, payout_frequency, created_by
) 
SELECT 20.00, 50.00, 30.00, 10.00, 30000, 'monthly', 'system'
WHERE NOT EXISTS (SELECT 1 FROM revenue_split_config WHERE is_active = true);

-- 8. CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- 9. VERIFICATION QUERY
-- ============================================================
SELECT 
  category,
  COUNT(*) as setting_count,
  array_agg(key ORDER BY key) as keys
FROM site_settings 
WHERE category IN ('auth', 'coaches', 'payments', 'scheduling', 'notifications')
GROUP BY category
ORDER BY category;
```

---

## PHASE 3: CONFIGURATION LOADER ARCHITECTURE

### Step 3.1: Create Type Definitions

```
TASK: Create lib/config/types.ts with complete TypeScript definitions.

File: lib/config/types.ts

Include types for:
- AuthConfig (adminEmails array)
- CoachConfig (defaultCoachId, email, name)
- PaymentConfig (currency, minAmount, rateLimit, receiptPrefix)
- SchedulingConfig (gapDays, lookahead, buffer, maxPerDay)
- SessionTypeConfig (type -> label, duration mapping)
- RevenueSplitConfig (percentages, TDS)
- NotificationConfig (reminder hours)
- PricingPlan (from pricing_plans table)

Also create:
- AppConfig (combines all above)
- ConfigCategory enum
- Validation functions for each config type
```

### Step 3.2: Create Configuration Loader

```
TASK: Create lib/config/loader.ts - the single source of truth loader.

Requirements:

1. CACHING:
   - 5-minute TTL for all config
   - Separate cache per config category
   - Cache invalidation functions

2. LOADING:
   - loadAuthConfig() - returns AuthConfig
   - loadCoachConfig() - returns CoachConfig
   - loadPaymentConfig() - returns PaymentConfig
   - loadSchedulingConfig() - returns SchedulingConfig
   - loadRevenueSplitConfig() - returns RevenueSplitConfig
   - loadPricingPlan(productId) - returns PricingPlan
   - loadFullConfig() - returns AppConfig (all combined)

3. ERROR HANDLING:
   - Throw ConfigurationError with specific missing key
   - NO silent fallbacks
   - NO hardcoded defaults in code
   - Log missing config to console with clear message

4. VALIDATION:
   - Validate JSON parsing for arrays
   - Validate numeric values are actually numbers
   - Validate required fields are present
   - Validate revenue split percentages sum to 100

5. STRUCTURE:
```typescript
// lib/config/loader.ts

import { createClient } from '@/lib/supabase/server';
import { 
  AuthConfig, CoachConfig, PaymentConfig, 
  SchedulingConfig, RevenueSplitConfig, PricingPlan 
} from './types';

class ConfigurationError extends Error {
  constructor(public readonly missingKey: string, public readonly category: string) {
    super(`Missing required configuration: ${category}.${missingKey}`);
    this.name = 'ConfigurationError';
  }
}

// Cache structure
interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

const cache = {
  auth: null as CacheEntry<AuthConfig> | null,
  coach: null as CacheEntry<CoachConfig> | null,
  payment: null as CacheEntry<PaymentConfig> | null,
  scheduling: null as CacheEntry<SchedulingConfig> | null,
  revenueSplit: null as CacheEntry<RevenueSplitConfig> | null,
  pricingPlans: new Map<string, CacheEntry<PricingPlan>>(),
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.loadedAt < CACHE_TTL;
}

// Implement each loader with:
// 1. Cache check
// 2. DB query
// 3. Validation
// 4. Cache update
// 5. Return typed result

export async function loadAuthConfig(): Promise<AuthConfig> {
  if (isCacheValid(cache.auth)) return cache.auth.data;
  
  const supabase = createClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .eq('category', 'auth');
  
  if (error) throw new Error(`Failed to load auth config: ${error.message}`);
  
  const settings = new Map(data?.map(s => [s.key, s.value]) || []);
  
  const adminEmailsRaw = settings.get('admin_emails');
  if (!adminEmailsRaw) throw new ConfigurationError('admin_emails', 'auth');
  
  let adminEmails: string[];
  try {
    adminEmails = JSON.parse(adminEmailsRaw);
    if (!Array.isArray(adminEmails)) throw new Error('Not an array');
  } catch {
    throw new ConfigurationError('admin_emails (invalid JSON)', 'auth');
  }
  
  const config: AuthConfig = { adminEmails };
  cache.auth = { data: config, loadedAt: Date.now() };
  return config;
}

// Similar implementations for other loaders...

// Cache invalidation
export function invalidateConfigCache(category?: keyof typeof cache) {
  if (category) {
    if (category === 'pricingPlans') {
      cache.pricingPlans.clear();
    } else {
      cache[category] = null;
    }
  } else {
    cache.auth = null;
    cache.coach = null;
    cache.payment = null;
    cache.scheduling = null;
    cache.revenueSplit = null;
    cache.pricingPlans.clear();
  }
}
```

Implement ALL loaders with this pattern.
```

### Step 3.3: Create API for Cache Invalidation

```
TASK: Create app/api/admin/config/invalidate/route.ts

This endpoint:
1. Requires admin authentication
2. Accepts optional category parameter
3. Invalidates config cache
4. Returns success confirmation

Use for:
- Admin UI "Refresh Config" button
- After updating site_settings via admin portal
```

---

## PHASE 4: UPDATE PAYMENT ROUTES

### Step 4.1: Update payment/create

```
TASK: Refactor app/api/payment/create/route.ts to use config loader.

CHANGES:

1. Add import:
import { loadPaymentConfig, loadPricingPlan } from '@/lib/config/loader';

2. At start of POST:
const paymentConfig = await loadPaymentConfig();

3. Replace rate limit constants:
BEFORE: const RATE_LIMIT = 5; const WINDOW = 60;
AFTER: Use paymentConfig.rateLimitRequests, paymentConfig.rateLimitWindowSeconds

4. Replace currency:
BEFORE: currency: 'INR'
AFTER: currency: paymentConfig.currency

5. Replace receipt prefix:
BEFORE: receipt: `rcpt_yestoryd_${...}`
AFTER: receipt: `${paymentConfig.receiptPrefix}${...}`

6. For product/pricing:
- Get productId from request
- loadPricingPlan(productId) to get price, sessions, duration
- Use those values, NOT hardcoded

7. Remove ALL numeric constants that should come from config
```

### Step 4.2: Update payment/verify

```
TASK: Refactor app/api/payment/verify/route.ts to use config loader.

This is the most critical file. CHANGES:

1. Add imports:
import { 
  loadCoachConfig, 
  loadSchedulingConfig, 
  loadRevenueSplitConfig,
  loadPricingPlan 
} from '@/lib/config/loader';

2. Load configs at start:
const [coachConfig, schedulingConfig, revenueConfig] = await Promise.all([
  loadCoachConfig(),
  loadSchedulingConfig(),
  loadRevenueSplitConfig(),
]);

3. Replace fallback coach logic:
BEFORE:
const { data: defaultCoach } = await supabase
  .from('coaches')
  .select('*')
  .eq('email', 'rucha.rai@yestoryd.com')
  .single();

AFTER:
const { data: defaultCoach } = await supabase
  .from('coaches')
  .select('*')
  .eq('id', coachConfig.defaultCoachId)
  .single();

if (!defaultCoach) {
  throw new Error(`Default coach not found: ${coachConfig.defaultCoachId}`);
}

4. Replace session creation:
- Get pricing plan from order metadata or lookup
- Use pricingPlan.coachingSessions, pricingPlan.checkinSessions
- Use pricingPlan.coachingDurationMinutes, pricingPlan.checkinDurationMinutes

5. Replace enrollment duration:
BEFORE: end_date: addMonths(new Date(), 3)
AFTER: end_date: addMonths(new Date(), pricingPlan.durationMonths)

6. Replace revenue split:
- Use revenueConfig.leadCostPercent, coachCostPercent, platformFeePercent
- Use revenueConfig.tdsRatePercent, tdsThresholdAnnual

7. Search file for ANY remaining:
- Email addresses
- Numbers (3, 6, 9, 30, 45, 10, 30000, 5999)
- Magic strings

Replace ALL with config values.
```

### Step 4.3: Update payment/webhook

```
TASK: Refactor app/api/payment/webhook/route.ts (if exists) with same pattern.

Same changes as verify route for any enrollment/session creation logic.
```

### Step 4.4: Update Scheduling Orchestrator

```
TASK: Update lib/scheduling/orchestrator.ts and related files.

1. Import config loader
2. Replace any hardcoded:
   - Session counts (should come from enrollment/pricing_plan)
   - Durations (should come from pricing_plan)
   - Gap days (schedulingConfig.minGapDays)
   - Lookahead (schedulingConfig.lookaheadDays)
   - Coach limits (schedulingConfig.maxSessionsPerDay)

3. Ensure session types use config:
   - schedulingConfig.sessionTypes for labels/defaults
   - Or constants file that's clearly separated from business logic
```

---

## PHASE 5: UPDATE AUTH FLOW

### Step 5.1: Update lib/api-auth.ts

```
TASK: Refactor lib/api-auth.ts to load admin emails from database.

CHANGES:

1. Import config loader:
import { loadAuthConfig } from '@/lib/config/loader';

2. Update requireAdmin:
export async function requireAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const authConfig = await loadAuthConfig();
  const isAdmin = authConfig.adminEmails
    .map(e => e.toLowerCase())
    .includes(user.email.toLowerCase());
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  return user;
}

3. REMOVE hardcoded ADMIN_EMAILS constant entirely
```

### Step 5.2: Update middleware.ts

```
TASK: Assess and update middleware.ts admin check.

OPTIONS:

A) REMOVE admin check from middleware (RECOMMENDED)
   - middleware.ts only checks "is user authenticated"
   - Admin authorization happens in API routes via requireAdmin()
   - Cleaner separation of concerns
   - Edge runtime doesn't need DB calls

B) Keep admin check in middleware with edge-safe loader
   - More complex
   - Need edge-compatible Supabase client
   - Caching is tricky on edge

IMPLEMENTATION (Option A):

1. Remove ADMIN_EMAILS from middleware.ts
2. Remove admin-specific logic
3. middleware.ts only handles:
   - PUBLIC_ROUTES (no auth needed)
   - Redirect to login if not authenticated
   - Let API routes handle admin authorization

4. Verify all /admin/* routes use requireAdmin()
```

### Step 5.3: Update lib/auth-options.ts

```
TASK: Update NextAuth config to use database for admin check.

If admin emails are used in NextAuth callbacks:
1. Import loadAuthConfig
2. Replace hardcoded emails with config lookup
3. Handle async properly in callbacks
```

---

## PHASE 6: VERIFICATION & TESTING

### Step 6.1: Grep Verification

```
TASK: Final grep to ensure NO hardcoded values remain.

Run these searches and verify ZERO results in business logic:

grep -r "rucha.rai@yestoryd.com" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -r "rucha@yestoryd.com" --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "amitkrai17" --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "ADMIN_EMAILS" --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "adminEmails.*\[" --include="*.ts" --include="*.tsx" | grep -v node_modules

For numeric constants, check context:
grep -rn "= 3;" --include="*.ts" | grep -v node_modules
grep -rn "= 6;" --include="*.ts" | grep -v node_modules  
grep -rn "= 9;" --include="*.ts" | grep -v node_modules
grep -rn "= 45" --include="*.ts" | grep -v node_modules
grep -rn "= 30000" --include="*.ts" | grep -v node_modules

Each result should be:
- In a test file (OK)
- In a type definition (OK)
- In config loader as validation (OK)
- In business logic reading FROM config (OK)

NOT OK:
- Hardcoded in business logic
- Used as fallback default
```

### Step 6.2: Integration Test

```
TASK: Create test for config loading.

Create: __tests__/config/loader.test.ts

Test:
1. loadAuthConfig returns valid array
2. loadCoachConfig returns valid coach
3. loadPaymentConfig returns all required fields
4. loadSchedulingConfig returns valid numbers
5. loadRevenueSplitConfig percentages sum to 100
6. loadPricingPlan returns product data
7. Cache invalidation works
8. Missing config throws ConfigurationError
```

### Step 6.3: End-to-End Payment Test

```
TASK: Test complete payment flow uses config.

1. Update a site_setting (e.g., change receipt prefix)
2. Invalidate cache via API
3. Create a test payment
4. Verify new prefix is used
5. This proves config is actually being read from DB
```

---

## PHASE 7: DOCUMENTATION

### Step 7.1: Update CLAUDE.md

```
TASK: Add configuration section to CLAUDE.md

Add section explaining:
- All config comes from database
- How to add new config values
- Which tables hold which config
- How to use config loader
- Cache TTL and invalidation
- Error handling for missing config
```

### Step 7.2: Create Admin Config Guide

```
TASK: Document all configuration keys for admin reference.

Create: docs/CONFIGURATION.md

List every site_settings key with:
- Key name
- Category
- Type (string, number, JSON)
- Description
- Valid values
- Impact of changing
```

---

## EXECUTION CHECKLIST

Run in order:

- [ ] Phase 1.1: Database schema analysis
- [ ] Phase 1.2: Codebase scan for hardcoded values
- [ ] Phase 1.3: Dependency mapping
- [ ] Phase 2.2: Run SQL migration
- [ ] Phase 3.1: Create type definitions
- [ ] Phase 3.2: Create config loader
- [ ] Phase 3.3: Create cache invalidation API
- [ ] Phase 4.1: Update payment/create
- [ ] Phase 4.2: Update payment/verify
- [ ] Phase 4.3: Update payment/webhook
- [ ] Phase 4.4: Update scheduling orchestrator
- [ ] Phase 5.1: Update api-auth.ts
- [ ] Phase 5.2: Update middleware.ts
- [ ] Phase 5.3: Update auth-options.ts
- [ ] Phase 6.1: Grep verification
- [ ] Phase 6.2: Integration tests
- [ ] Phase 6.3: E2E payment test
- [ ] Phase 7.1: Update CLAUDE.md
- [ ] Phase 7.2: Create config documentation

---

## SUCCESS CRITERIA

✅ Zero email addresses hardcoded in business logic
✅ Zero numeric constants for business rules
✅ All config loaded via lib/config/loader.ts
✅ Missing config throws clear error (not silent fallback)
✅ Admin can change config without code deploy
✅ Cache invalidation works via API
✅ All tests pass
✅ Payment flow works end-to-end with DB config
