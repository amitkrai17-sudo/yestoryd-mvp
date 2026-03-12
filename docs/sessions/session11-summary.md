# Session 11 - Summary & Tech Debt

**Date:** January 10, 2026  
**Status:** ✅ DEPLOYED

---

## 🎉 JOURNEY 4 COMPLETE!

| Step | Action | Status |
|------|--------|--------|
| 4.1 | Go to /coach/login | ✅ |
| 4.2 | Login as coach (Rucha) | ✅ |
| 4.3 | Go to /coach/discovery-calls | ✅ |
| 4.4 | Click on a call | ✅ |
| 4.5 | See AI-generated questions + Score/WPM/Age | ✅ |
| 4.6 | Fill questionnaire | ✅ |
| 4.7 | Send Payment Link | ✅ |
| 4.8 | Check status update + CRM sync | ✅ |

---

## 🔧 FIXES COMPLETED THIS SESSION

### 1. Coach Portal Auth (Same pattern as Admin)
- Added `/coach` to PUBLIC_ROUTES in middleware.ts
- Added fetch interceptor to coach layout for Bearer token
- Fixed `profile_photo` → `photo_url` column name

### 2. API Auth Migration
- `/api/discovery-call/pending/route.ts` → `requireAdminOrCoach()`
- `/api/discovery-call/[id]/route.ts` → `requireAdminOrCoach()`

### 3. Unified Data Architecture
- API now JOINs `children` table for assessment data
- No duplicate columns - single source of truth
- Added `assessment_wpm` column to children table
- Backfilled WPM from learning_events

---

## 📋 IMPROVEMENTS TO IMPLEMENT

### 1. Conditional Questionnaire UI
**Priority:** High  
**Impact:** Better UX, cleaner data, logical flow

**Current State:**
- All questionnaire fields shown regardless of call status
- Confusing for No Show / Rescheduled scenarios

**Proposed State:**

| Call Status | Fields to Show |
|-------------|----------------|
| **Completed** | Full questionnaire + Likelihood (Hot/Warm/Cold) + Objections + Notes + "Send Payment Link" |
| **No Show** | Follow-up action (Retry/Remind/Lost) + Next follow-up date + Notes + "Schedule Follow-up" |
| **Rescheduled** | New date/time picker + Reschedule reason + Notes + "Update Calendar" |

**Files to modify:**
- `app/coach/discovery-calls/[id]/page.tsx`

---

### 2. Sync Triggers Enhancement
**Priority:** Medium  
**Impact:** CRM consistency

**Current Mapping (in triggers):**
```
discovery_calls.call_outcome → children.lead_status
- enrolled → enrolled
- follow_up → negotiating
- interested → negotiating  
- maybe_later → cold
- not_interested → lost
- no_show → cold
- rescheduled → hot
```

**Enhancement Needed:**
- Add `likelihood` field sync (hot/warm/cold from questionnaire)
- Map to children.lead_status for CRM visibility

---

### 3. Remove Duplicate Assessment Columns from discovery_calls
**Priority:** Low (after launch)  
**Impact:** Database cleanliness

**Current:**
- `discovery_calls.assessment_score` (duplicate)
- `discovery_calls.assessment_wpm` (duplicate)

**Target:**
- Remove these columns
- Always JOIN to children table

---

## 🔄 REMAINING API ROUTES TO UPDATE (NextAuth → api-auth.ts)

From Session 10 list:
- [ ] `app/api/admin/payouts/route.ts`
- [ ] `app/api/chat/route.ts`
- [ ] `app/api/communication/send/route.ts`
- [ ] `app/api/coupons/calculate/route.ts`
- [ ] `app/api/coupons/validate/route.ts`
- [x] `app/api/discovery-call/assign/route.ts` ✅
- [ ] `app/api/enrollment/calculate-revenue/route.ts`
- [ ] `app/api/leads/hot-alert/route.ts`
- [ ] `app/api/payouts/process/route.ts`
- [x] `app/api/discovery-call/[id]/route.ts` ✅
- [ ] `app/api/discovery-call/[id]/questionnaire/route.ts`
- [ ] `app/api/discovery-call/[id]/send-followup/route.ts`
- [ ] `app/api/discovery-call/[id]/send-payment-link/route.ts`

---

## 📊 JOURNEY 4 PROGRESS

| Step | Action | Status |
|------|--------|--------|
| 4.1 | Go to /coach/login | ✅ |
| 4.2 | Login as coach (Rucha) | ✅ |
| 4.3 | Go to /coach/discovery-calls | ✅ |
| 4.4 | Click on a call | ✅ |
| 4.5 | See AI-generated questions + Score/WPM/Age | ✅ |
| 4.6 | Fill questionnaire | ⬜ Testing |
| 4.7 | Send Payment Link | ⬜ |
| 4.8 | Check status update + CRM sync | ⬜ |

---

*Last Updated: January 10, 2026*
