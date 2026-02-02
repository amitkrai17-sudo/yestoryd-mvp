# YESTORYD - DUPLICATE CODE VERIFICATION
## Check for Parallel Implementations

---

## CHECK 1: Duplicate API Routes

```bash
# Find all route.ts files and check for duplicates
find app/api -name "route.ts" | sort

# Check for multiple payment-related routes
find app/api -path "*payment*" -name "route.ts"

# Check for multiple refund routes
find app/api -path "*refund*" -name "route.ts"

# Check for multiple config/settings routes
find app/api -path "*config*" -o -path "*settings*" -name "route.ts"

# Check for multiple coach assignment routes
find app/api -path "*coach*" -name "route.ts"

# Check for multiple scheduling routes
find app/api -path "*schedule*" -o -path "*reschedule*" -name "route.ts"
```

Report any routes that seem to do the same thing.

---

## CHECK 2: Duplicate Library Files

```bash
# Check for multiple config loaders
find lib -name "*config*" -o -name "*settings*" -o -name "*loader*"

# Check for multiple refund calculators
find lib -name "*refund*"

# Check for multiple scheduling utilities
find lib -name "*schedule*" -o -name "*slot*"

# Check for multiple coach matching
find lib -name "*coach*" -o -name "*match*"

# Check for multiple communication handlers
find lib -name "*communication*" -o -name "*notification*"

# Check for multiple lead scoring
find lib -name "*lead*" -o -name "*scoring*"
```

---

## CHECK 3: Deprecated Files Still Present

```bash
# These should have been DELETED:
ls -la lib/site-settings.ts 2>/dev/null && echo "WARNING: lib/site-settings.ts still exists!"
ls -la lib/utils/constants.ts 2>/dev/null && echo "WARNING: lib/utils/constants.ts still exists!"
ls -la lib/settings/coach-settings.ts 2>/dev/null && echo "WARNING: lib/settings/coach-settings.ts still exists!"

# Check if any file imports from deleted files
grep -r "from.*lib/site-settings" --include="*.ts" --include="*.tsx" app/ lib/
grep -r "from.*lib/utils/constants" --include="*.ts" --include="*.tsx" app/ lib/
grep -r "from.*lib/settings/coach-settings" --include="*.ts" --include="*.tsx" app/ lib/
```

---

## CHECK 4: Conflicting Implementations

```bash
# Multiple refund calculation logic?
grep -rn "calculateRefund\|refundAmount\|prorated" --include="*.ts" lib/ app/api/

# Multiple coach assignment logic?
grep -rn "smartMatch\|assignCoach\|coachScore\|weightedScore" --include="*.ts" lib/ app/api/

# Multiple lead scoring logic?
grep -rn "leadScore\|calculateLeadScore\|scoreLead" --include="*.ts" lib/ app/api/

# Multiple notification preference checks?
grep -rn "notification_preferences\|shouldSendNotification\|checkPreferences" --include="*.ts" lib/

# Multiple payout reconciliation?
grep -rn "bank_transfer_status\|reconcile.*payout\|utr_number" --include="*.ts" lib/ app/api/
```

---

## CHECK 5: Database Migration Conflicts

```bash
# List all migrations
ls -la supabase/migrations/

# Check for duplicate table creations
grep -l "CREATE TABLE.*enrollment_terminations" supabase/migrations/*
grep -l "CREATE TABLE.*failed_payments" supabase/migrations/*
grep -l "CREATE TABLE.*payment_retry_tokens" supabase/migrations/*
grep -l "CREATE TABLE.*coach_specializations" supabase/migrations/*

# Check for duplicate column additions
grep -l "ADD COLUMN.*child_id" supabase/migrations/*
grep -l "ADD COLUMN.*notification_preferences" supabase/migrations/*
grep -l "ADD COLUMN.*lead_score" supabase/migrations/*
grep -l "ADD COLUMN.*bank_transfer_status" supabase/migrations/*
```

---

## CHECK 6: Import Consistency

```bash
# All files should import config from lib/config/loader.ts, NOT from:
# - lib/site-settings.ts (deleted)
# - lib/utils/constants.ts (deleted)  
# - Hardcoded values

# Check config imports are consistent
grep -rn "from.*lib/config" --include="*.ts" app/api/payment/
grep -rn "from.*lib/config" --include="*.ts" app/api/refund/
grep -rn "from.*lib/config" --include="*.ts" app/api/admin/
```

---

## CHECK 7: Function Name Conflicts

```bash
# Check for duplicate function names across files
grep -rn "^export async function\|^export function" --include="*.ts" lib/ | sort -t: -k3 | uniq -d -f2

# Check for duplicate type/interface names
grep -rn "^export interface\|^export type" --include="*.ts" lib/ | sort -t: -k3 | uniq -d -f2
```

---

## EXPECTED CLEAN STATE

After verification, we should have:

### Single Source Files (No Duplicates)
| Purpose | Single Location |
|---------|-----------------|
| Config loading | `lib/config/loader.ts` |
| Refund calculation | `lib/refund/calculator.ts` |
| Lead scoring | `lib/crm/lead-scoring.ts` |
| Communication send | `lib/communication/index.ts` |
| Coach smart match | `lib/scheduling/` or `app/api/payment/verify/route.ts` |

### API Routes (No Overlaps)
| Purpose | Single Route |
|---------|--------------|
| Initiate refund | `/api/refund/initiate` |
| Validate retry token | `/api/payment/validate-retry` |
| Parent reschedule | `/api/parent/session/reschedule` |
| Admin payments list | `/api/admin/payments` |
| Payout reconciliation | `/api/admin/payouts/reconcile` |
| Notification prefs | `/api/parent/notification-preferences` |
| Lead scoring cron | `/api/cron/lead-scoring` |

### Deleted Files (Should Not Exist)
- `lib/site-settings.ts`
- `lib/utils/constants.ts`
- `lib/settings/coach-settings.ts`

---

## RUN VERIFICATION

```
Execute the duplicate code verification checks above.

For each check, report:
✅ CLEAN - No duplicates found
⚠️ WARNING - Potential duplicate, needs review
❌ CONFLICT - Definite duplicate, needs resolution

If conflicts found, identify:
1. Which files conflict
2. Which one is the correct/newer implementation
3. What action is needed (delete old, merge, etc.)
```
