# PRICING TECH DEBT — Hardcoded Values Audit
**Date:** Feb 6, 2026
**Priority:** HIGH — Backend calculations may use wrong amounts
**Status:** Logged, not started

## Summary
Database (pricing_plans + site_settings) is the source of truth. Frontend homepage reads from DB correctly. But 7+ backend files have hardcoded stale prices that don't match DB.

## Correct Values (from pricing_plans table)
- Starter (Phase 1: Foundation): ₹1,499 (original ₹2,499)
- Continuation (Phase 2: Transformation): ₹5,999 (original ₹9,499)
- Full (12-Week Complete): ₹6,999 (original ₹11,999)
- Legacy full: inactive

## Coach Earnings
- DB has coach_earnings_yestoryd_lead: ₹2,500 and coach_earnings_coach_lead: ₹3,500
- Code has ₹3,000 and ₹4,200 hardcoded
- Correct logic: 50% for Yestoryd lead, 70% for coach lead, modified by coach tier
- All earnings should be calculated dynamically from enrollment amount × percentage × tier modifier

## Files Needing Fix (7+ files with ₹5,999)
1. app/api/coupons/calculate/route.ts:165
2. app/api/coupons/validate/route.ts:303
3. app/coach/earnings/page.tsx:116
4. app/yestoryd-academy/page.tsx:67, 155
5. app/coach/[subdomain]/page.tsx:190
6. app/admin/settings/pricing/page.tsx:381+
7. app/admin/settings/revenue/page.tsx:53

## Files with stale coach earnings (8+ files)
1. app/api/agreement/sign/route.ts:221, 225
2. app/api/coach/send-status-notification/route.ts:92, 130
3. app/coach/dashboard/MyReferralsTab.tsx:151, 286, 336, 362
4. app/api/coach/my-referrals/route.ts:59
5. app/coach/onboarding/page.tsx:490, 495
6. app/yestoryd-academy/page.tsx:67, 83, 87, 145

## Existing TODOs in code
- app/admin/coach-groups/page.tsx:81 — "TODO: Fetch from site_settings 'program_price'"
- app/coach/dashboard/MyReferralsTab.tsx:4 — "TODO: Move referral amount to site_settings"
- app/admin/tds/page.tsx:392 — "TODO: Move TDS threshold to site_settings"

## Solution
Create lib/pricing.ts utility that reads from pricing_plans + site_settings. Replace all hardcoded values with DB lookups. Use fallback values matching current DB values, not stale ones.
