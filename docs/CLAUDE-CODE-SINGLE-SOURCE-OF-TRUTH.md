# YESTORYD - SINGLE SOURCE OF TRUTH CLEANUP
## Remove All Hardcoded Business Config

**Principle:** 
- Structural constants (HTTP codes, cache TTL, regex patterns) → Keep in code
- Business configuration (emails, counts, durations, percentages, thresholds) → Database only

---

## EXECUTE IN ORDER

### Step 1: Audit Deprecated Files

```
Show me the full contents of these files:

1. lib/site-settings.ts
2. lib/utils/constants.ts
3. lib/settings/coach-settings.ts (if exists)
4. Any other files in lib/settings/ or lib/constants/

For each file, categorize every export as:
- STRUCTURAL (keep in code) - HTTP codes, cache TTL, regex, type guards
- BUSINESS CONFIG (move to DB) - emails, counts, durations, prices, percentages, thresholds
```

### Step 2: Find All Dependencies

```
Search the entire codebase for imports from these files:

grep -r "from.*lib/site-settings" --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "from.*lib/utils/constants" --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "from.*lib/settings" --include="*.ts" --include="*.tsx" | grep -v node_modules

Also search for specific exports that might be imported:
- getSiteSetting
- getSiteSettings
- DEFAULT_VALUES
- SESSION_TYPES
- SESSION_DURATIONS
- PROGRAM_CONFIG
- ADMIN_EMAILS
- DEFAULT_COACH
- TDS_RATE
- Any constant that looks like business config

Create a dependency map:
| File | Imports From | What It Uses |
|------|--------------|--------------|
```

### Step 3: Ensure Database Has All Required Config

```
Verify these exist in site_settings (run SQL):

SELECT key, value, category FROM site_settings 
WHERE category IN ('auth', 'coaches', 'payments', 'scheduling', 'program', 'notifications')
ORDER BY category, key;

If any business config from the deprecated files is NOT in site_settings, add it:

-- Example additions if missing:
INSERT INTO site_settings (key, value, category, description) VALUES
('session_type_coaching_label', 'Coaching Session', 'scheduling', 'Display label for coaching sessions'),
('session_type_checkin_label', 'Parent Check-in', 'scheduling', 'Display label for check-in sessions'),
('session_type_remedial_label', 'Skill Booster', 'scheduling', 'Display label for remedial sessions')
ON CONFLICT (key) DO NOTHING;

Report what was added.
```

### Step 4: Update lib/config/loader.ts If Needed

```
Ensure lib/config/loader.ts can load ALL config that was in the deprecated files.

If any config type is missing, add a new loader function:

Example - if session type labels were hardcoded:

export async function loadSessionTypeConfig(): Promise<SessionTypeConfig> {
  if (isCacheValid(cache.sessionTypes)) return cache.sessionTypes.data;
  
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .like('key', 'session_type_%');
  
  if (error) throw new Error(`Failed to load session type config: ${error.message}`);
  
  const settings = new Map(data?.map(s => [s.key, s.value]) || []);
  
  const config: SessionTypeConfig = {
    coaching: {
      key: 'coaching',
      label: settings.get('session_type_coaching_label') || throwMissing('session_type_coaching_label'),
    },
    parentCheckin: {
      key: 'parent_checkin', 
      label: settings.get('session_type_checkin_label') || throwMissing('session_type_checkin_label'),
    },
    remedial: {
      key: 'remedial',
      label: settings.get('session_type_remedial_label') || throwMissing('session_type_remedial_label'),
    },
  };
  
  cache.sessionTypes = { data: config, loadedAt: Date.now() };
  return config;
}

function throwMissing(key: string): never {
  throw new ConfigurationError(key, 'site_settings');
}
```

### Step 5: Create Structural Constants File (Keep in Code)

```
Create lib/constants/structural.ts with ONLY non-business constants:

// lib/constants/structural.ts
// These are STRUCTURAL constants - not business configuration
// They define technical behavior, not business rules

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

export const CACHE_TTL = {
  CONFIG: 5 * 60 * 1000,      // 5 minutes - config refresh interval
  AUTH: 5 * 60 * 1000,        // 5 minutes - auth cache
  STATIC: 24 * 60 * 60 * 1000, // 24 hours - static content
} as const;

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?\d{7,15}$/,
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

export const API_LIMITS = {
  MAX_BATCH_SIZE: 100,
  MAX_FILE_SIZE_MB: 10,
  REQUEST_TIMEOUT_MS: 30000,
} as const;

// Session type KEYS (not labels or durations - those come from DB)
export const SESSION_TYPE_KEYS = {
  COACHING: 'coaching',
  PARENT_CHECKIN: 'parent_checkin',
  REMEDIAL: 'remedial',
} as const;

export type SessionTypeKey = typeof SESSION_TYPE_KEYS[keyof typeof SESSION_TYPE_KEYS];
```

### Step 6: Update Each Importing File

```
For each file that imports from deprecated files:

PATTERN A: Server-side file needing business config
BEFORE:
import { ADMIN_EMAILS, DEFAULT_COACH_EMAIL } from '@/lib/utils/constants';
const isAdmin = ADMIN_EMAILS.includes(email);

AFTER:
import { loadAuthConfig, loadCoachConfig } from '@/lib/config/loader';
const authConfig = await loadAuthConfig();
const isAdmin = authConfig.adminEmails.includes(email);

---

PATTERN B: Server-side file needing session types
BEFORE:
import { SESSION_TYPES, SESSION_DURATIONS } from '@/lib/utils/constants';
const duration = SESSION_DURATIONS[sessionType];

AFTER:
import { SESSION_TYPE_KEYS } from '@/lib/constants/structural';
import { loadPricingPlan } from '@/lib/config/loader';
// Duration comes from pricing_plans, not constants
const plan = await loadPricingPlan(productId);
const duration = sessionType === SESSION_TYPE_KEYS.COACHING 
  ? plan.coachingDurationMinutes 
  : plan.checkinDurationMinutes;

---

PATTERN C: Client-side component needing config
BEFORE:
import { PROGRAM_CONFIG } from '@/lib/utils/constants';
<p>Total sessions: {PROGRAM_CONFIG.TOTAL_SESSIONS}</p>

AFTER:
// Option 1: Pass from server component as prop
// In parent server component:
const plan = await loadPricingPlan(productId);
<ChildComponent sessionsTotal={plan.sessionsTotal} />

// Option 2: Fetch via API
const [config, setConfig] = useState(null);
useEffect(() => {
  fetch('/api/config/program').then(r => r.json()).then(setConfig);
}, []);

---

PATTERN D: Type definitions only
BEFORE:
import { SESSION_TYPES } from '@/lib/utils/constants';
type SessionType = keyof typeof SESSION_TYPES;

AFTER:
import { SESSION_TYPE_KEYS, SessionTypeKey } from '@/lib/constants/structural';
// Use SessionTypeKey type

---

Update EACH file. Do not skip any.
```

### Step 7: Create Client Config API (If Needed)

```
If client components need config, create an API endpoint:

// app/api/config/public/route.ts
import { NextResponse } from 'next/server';
import { loadPricingPlan } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Only expose PUBLIC config - no admin emails, no internal settings
    const plan = await loadPricingPlan('default');
    
    return NextResponse.json({
      program: {
        durationMonths: plan.durationMonths,
        sessionsTotal: plan.sessionsTotal,
        price: plan.price,
      },
      sessionTypes: {
        coaching: { label: 'Coaching Session' },
        parentCheckin: { label: 'Parent Check-in' },
        remedial: { label: 'Skill Booster' },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

NOTE: Session type labels should come from site_settings, add loader if not done.
```

### Step 8: Delete Deprecated Files

```
After all imports are updated:

1. Delete lib/site-settings.ts
2. Delete lib/utils/constants.ts (or rename to lib/utils/constants.ts.deprecated)
3. Delete lib/settings/coach-settings.ts
4. Delete any empty directories

If a file has SOME structural constants mixed with business config:
- Move structural constants to lib/constants/structural.ts
- Then delete the original file
```

### Step 9: Verify No Hardcoded Business Config Remains

```
Search for common hardcoded patterns:

# Email addresses (except in test files)
grep -rn "@yestoryd.com" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "\.test\." | grep -v "__tests__"

# Numeric business values
grep -rn "= 5999" --include="*.ts" | grep -v node_modules
grep -rn "= 30000" --include="*.ts" | grep -v node_modules
grep -rn "duration.*= 45" --include="*.ts" | grep -v node_modules
grep -rn "duration.*= 30" --include="*.ts" | grep -v node_modules
grep -rn "months.*= 3" --include="*.ts" | grep -v node_modules
grep -rn "sessions.*= 9" --include="*.ts" | grep -v node_modules
grep -rn "sessions.*= 6" --include="*.ts" | grep -v node_modules

# Hardcoded arrays that look like config
grep -rn "ADMIN_EMAILS\s*=" --include="*.ts" | grep -v node_modules
grep -rn "adminEmails\s*=\s*\[" --include="*.ts" | grep -v node_modules

Each result should be either:
✅ In lib/constants/structural.ts (structural constant)
✅ In a test file
✅ In a comment/documentation
✅ Being loaded from config loader

❌ NOT OK: Hardcoded in business logic
```

### Step 10: Build and Test

```
Run build to verify no broken imports:

npm run build

If build fails, fix the import errors.

Then verify the payment flow still works:
1. Config loads successfully
2. Payment create works
3. Payment verify works
4. Admin auth works
```

### Step 11: Update Documentation

```
Update CLAUDE.md with:

## Configuration Architecture

### Single Source of Truth
All business configuration comes from the database:
- `site_settings` table - key-value config (auth, coaches, payments, scheduling)
- `pricing_plans` table - product-specific config (sessions, durations, prices)
- `revenue_split_config` table - financial config (percentages, TDS)

### Config Loader
Use `lib/config/loader.ts` for all config access:
- `loadAuthConfig()` - admin emails
- `loadCoachConfig()` - default coach
- `loadPaymentConfig()` - payment settings
- `loadSchedulingConfig()` - scheduling rules
- `loadRevenueSplitConfig()` - financial splits
- `loadPricingPlan(productId)` - product details

### Structural Constants
Non-business constants are in `lib/constants/structural.ts`:
- HTTP status codes
- Cache TTL values
- Validation regex patterns
- Session type keys (not labels or durations)

### Deleted Files
These files were deprecated and removed:
- `lib/site-settings.ts` → use `lib/config/loader.ts`
- `lib/utils/constants.ts` → structural moved, business deleted
- `lib/settings/coach-settings.ts` → merged into loader

### Adding New Config
1. Add to appropriate database table (site_settings, pricing_plans, etc.)
2. Add loader function in lib/config/loader.ts if new category
3. Use loader in code - NO hardcoded fallbacks
4. Config must throw error if missing - fail loudly
```

---

## FINAL VERIFICATION CHECKLIST

After completing all steps:

- [ ] `lib/site-settings.ts` deleted
- [ ] `lib/utils/constants.ts` deleted (or only has structural constants)
- [ ] `lib/settings/coach-settings.ts` deleted
- [ ] `lib/constants/structural.ts` created with only structural constants
- [ ] All business config in database (site_settings, pricing_plans, revenue_split_config)
- [ ] All imports updated to use `lib/config/loader.ts`
- [ ] No hardcoded emails in business logic
- [ ] No hardcoded business numbers (durations, counts, prices, percentages)
- [ ] Build passes with zero errors
- [ ] CLAUDE.md updated

---

## WHAT'S STRUCTURAL vs BUSINESS

| Type | Example | Where |
|------|---------|-------|
| **STRUCTURAL** | HTTP_STATUS.OK = 200 | Code |
| **STRUCTURAL** | CACHE_TTL = 5 minutes | Code |
| **STRUCTURAL** | EMAIL_REGEX pattern | Code |
| **STRUCTURAL** | SESSION_TYPE_KEYS.COACHING = 'coaching' | Code |
| **BUSINESS** | Admin email list | site_settings |
| **BUSINESS** | Default coach ID | site_settings |
| **BUSINESS** | Session duration = 45 min | pricing_plans |
| **BUSINESS** | Program duration = 3 months | pricing_plans |
| **BUSINESS** | Total sessions = 9 | pricing_plans |
| **BUSINESS** | TDS rate = 10% | revenue_split_config |
| **BUSINESS** | Price = ₹5,999 | pricing_plans |
| **BUSINESS** | Rate limit = 5/min | site_settings |
| **BUSINESS** | Session type labels | site_settings |
