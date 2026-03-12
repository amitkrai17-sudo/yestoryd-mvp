# YESTORYD PAYMENT FLOW VERIFICATION
## Post-Config Migration Health Check

**Context:** We migrated from hardcoded values to database config loader. Need to verify nothing broke.

---

## VERIFICATION CHECKLIST

### Step 1: Build Verification
```
npm run build

Expected: Zero errors
Check: All payment routes compile successfully
```

### Step 2: Config Loader Verification
```
TASK: Verify all config loaders work

Create a test script or use the Node REPL to verify:

1. Test loadAuthConfig():
   - Returns admin_emails array
   - Array contains expected emails
   - No errors thrown

2. Test loadCoachConfig():
   - Returns defaultCoachId (valid UUID)
   - Returns defaultCoachEmail
   - Coach exists in database

3. Test loadPaymentConfig():
   - Returns currency (INR)
   - Returns rateLimitRequests (number)
   - Returns receiptPrefix (string)

4. Test loadSchedulingConfig():
   - Returns minGapDays
   - Returns lookaheadDays
   - All are valid numbers

5. Test loadRevenueSplitConfig():
   - Returns percentages that sum to 100
   - Returns tdsRatePercent
   - Returns tdsThresholdAnnual

6. Test loadPricingPlan('full') or default product:
   - Returns price
   - Returns durationMonths
   - Returns sessionsTotal
   - Returns coachingSessions
   - Returns checkinSessions
```

### Step 3: Payment Create Endpoint Test
```
TASK: Test /api/payment/create endpoint

Use curl or Postman:

curl -X POST https://yestoryd.com/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "your-product-id",
    "childName": "Test Child",
    "childAge": 7,
    "parentName": "Test Parent",
    "parentEmail": "test@example.com",
    "parentPhone": "+919999999999"
  }'

Expected Response:
{
  "success": true,
  "orderId": "order_xxx",
  "amount": 599900,
  "currency": "INR",
  ...
}

Verify:
- [ ] Order created successfully
- [ ] Amount comes from pricing_plans (not hardcoded)
- [ ] Currency comes from config (not hardcoded 'INR')
- [ ] Receipt prefix uses config value
- [ ] Rate limiting works (try 6 requests in 1 minute)
```

### Step 4: Payment Verify Logic Review
```
TASK: Review payment/verify route for config usage

Search in app/api/payment/verify/route.ts for:

1. Coach resolution:
   grep -n "loadCoachConfig\|defaultCoach" app/api/payment/verify/route.ts
   
   Verify: Uses config loader, not hardcoded email

2. Enrollment duration:
   grep -n "durationMonths\|addMonths" app/api/payment/verify/route.ts
   
   Verify: Duration from pricing_plans, not hardcoded 3

3. Session counts:
   grep -n "sessionsTotal\|coachingSessions" app/api/payment/verify/route.ts
   
   Verify: Counts from pricing_plans, not hardcoded 9/6/3

4. Revenue split:
   grep -n "loadRevenueSplitConfig\|tdsRate" app/api/payment/verify/route.ts
   
   Verify: TDS from config, no || 10 fallbacks

5. Currency:
   grep -n "currency" app/api/payment/verify/route.ts
   
   Verify: From config, not hardcoded 'INR'
```

### Step 5: Webhook Handler Review
```
TASK: Review payment/webhook route

grep -n "loadCoachConfig\|defaultCoach\|currency" app/api/payment/webhook/route.ts

Verify same patterns as verify route.
```

### Step 6: Admin Auth Verification
```
TASK: Test admin authentication uses DB config

1. Check middleware loads admin emails from DB:
   grep -n "loadAuthConfig\|admin_emails\|site_settings" middleware.ts

2. Check api-auth.ts loads from DB:
   grep -n "loadAuthConfig\|admin_emails" lib/api-auth.ts

3. Test admin login:
   - Login with admin email (should work)
   - Verify admin routes accessible
   
4. Test non-admin rejection:
   - If possible, test with non-admin email
   - Should be rejected
```

### Step 7: Database Config Verification
```
TASK: Verify all required config exists in database

Run SQL:

-- Check site_settings has all required keys
SELECT key, value, category 
FROM site_settings 
WHERE key IN (
  'admin_emails',
  'default_coach_id',
  'default_coach_email',
  'payment_currency',
  'payment_rate_limit_requests',
  'payment_rate_limit_window_seconds',
  'payment_receipt_prefix',
  'scheduling_min_gap_days',
  'scheduling_lookahead_days'
)
ORDER BY category, key;

-- Verify admin_emails is valid JSON array
SELECT key, value::jsonb FROM site_settings WHERE key = 'admin_emails';

-- Verify default coach exists
SELECT c.id, c.name, c.email 
FROM coaches c
JOIN site_settings s ON s.key = 'default_coach_id' AND s.value = c.id::text;

-- Check pricing_plans has required fields
SELECT id, name, price, duration_months, sessions_total, 
       coaching_sessions, checkin_sessions,
       coaching_duration_minutes, checkin_duration_minutes
FROM pricing_plans 
WHERE is_active = true;

-- Check revenue_split_config exists
SELECT * FROM revenue_split_config WHERE is_active = true;
```

### Step 8: End-to-End Test (Razorpay Test Mode)
```
TASK: Full payment flow test in test mode

Prerequisites:
- Razorpay test mode enabled
- Test card: 4111 1111 1111 1111

Flow:
1. Go to enrollment page
2. Fill form with test data
3. Click Pay
4. Complete Razorpay checkout (test mode)
5. Verify:
   - [ ] Payment record created in payments table
   - [ ] Enrollment created in enrollments table
   - [ ] Enrollment has correct coach_id
   - [ ] Enrollment has correct end_date (start + duration_months from DB)
   - [ ] Sessions scheduled in scheduled_sessions table
   - [ ] Correct number of sessions (from pricing_plans)
   - [ ] Child status updated
   - [ ] Discovery call status updated (if applicable)
```

### Step 9: Error Handling Verification
```
TASK: Verify config errors fail loudly

1. Temporarily remove a required config:
   DELETE FROM site_settings WHERE key = 'default_coach_id';

2. Try to trigger payment verify
   - Should get clear error about missing config
   - NOT silent fallback to hardcoded value

3. Restore the config:
   INSERT INTO site_settings (key, value, category) 
   VALUES ('default_coach_id', 'uuid-here', 'coaches');

4. Verify payment works again
```

---

## QUICK SMOKE TEST

If time is limited, run this minimal verification:

```
TASK: Quick smoke test for payment flow

1. Build check:
   npm run build
   ✓ Passes

2. Config loaded:
   Check Vercel logs or add console.log to verify loadPaymentConfig() returns data
   ✓ No errors

3. Admin login:
   Go to /admin, login
   ✓ Works

4. Test payment (if test mode available):
   Create test order
   ✓ Order created with correct amount from DB

5. Database check:
   SELECT COUNT(*) FROM site_settings WHERE category IN ('auth', 'coaches', 'payments');
   ✓ Returns expected count (should be 7+)
```

---

## REPORT TEMPLATE

After verification, fill this:

```
## Payment Flow Verification Report
Date: ___________

### Build Status
- [ ] npm run build passes

### Config Loader Status
- [ ] loadAuthConfig() works
- [ ] loadCoachConfig() works  
- [ ] loadPaymentConfig() works
- [ ] loadSchedulingConfig() works
- [ ] loadRevenueSplitConfig() works
- [ ] loadPricingPlan() works

### Payment Create
- [ ] Endpoint responds
- [ ] Order created with DB config values

### Payment Verify
- [ ] Uses config loader for coach
- [ ] Uses config loader for TDS
- [ ] No hardcoded fallbacks

### Admin Auth
- [ ] Admin login works
- [ ] Uses DB admin_emails

### Database Config
- [ ] All required keys present
- [ ] Values are valid

### End-to-End Test
- [ ] Payment completes
- [ ] Enrollment created correctly
- [ ] Sessions scheduled

### Issues Found
1. ___________
2. ___________

### Conclusion
[ ] VERIFIED - Payment flow intact
[ ] ISSUES FOUND - See above
```

---

## EXECUTE

Run with Claude Code:

```
Execute payment flow verification from YESTORYD-PAYMENT-VERIFICATION.md

Start with Step 7 - verify database has all required config.
Then Step 4 - review payment/verify code for config usage.
Report any hardcoded values or missing config.
```
