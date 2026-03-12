# Yestoryd Academy Enhancements - Complete Summary

## 1. Site Settings Added (10 keys)

All values moved from hardcoded constants to `site_settings` table:

| Key | Default Value | Category | Used In |
|-----|--------------|----------|---------|
| `coach_whatsapp_number` | `918976287997` | coach | Onboarding page, notifications |
| `coach_earnings_yestoryd_lead` | `2500` | coach | Onboarding page |
| `coach_earnings_coach_lead` | `3500` | coach | Onboarding page |
| `coach_admin_email` | `engage@yestoryd.com` | coach | All email sending |
| `coach_rucha_email` | `rucha.rai@yestoryd.com` | coach | Interview scheduling |
| `coach_interview_duration_minutes` | `20` | coach | Schedule interview |
| `coach_assessment_pass_score` | `6` | coach | Calculate score |
| `site_base_url` | `https://yestoryd.com` | general | All link generation |
| `coach_from_email` | `Yestoryd Academy <academy@yestoryd.com>` | coach | Email from field |
| `coach_referral_bonus` | `500` | coach | Referral system |

## 2. Files Updated to Use Settings

| File | Changes |
|------|---------|
| `lib/settings/coach-settings.ts` | **NEW** - Coach settings helper with 5-min cache |
| `lib/utils/rate-limiter.ts` | **NEW** - In-memory rate limiter |
| `app/api/settings/coach/route.ts` | **NEW** - Public API for client-side settings |
| `app/api/coach-assessment/schedule-interview/route.ts` | Uses `settings.ruchaEmail`, `settings.adminEmail`, `settings.interviewDurationMinutes`, `settings.siteBaseUrl` |
| `app/api/coach-assessment/calculate-score/route.ts` | Uses `settings.assessmentPassScore` for qualification threshold |
| `app/api/coach-assessment/interview-feedback/route.ts` | Uses `settings.adminEmail` for email from |
| `app/api/coach/send-status-notification/route.ts` | Uses `settings.siteBaseUrl`, `settings.adminEmail` for links and emails |

## 3. Rate Limiting Added

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/coach-assessment/chat` | 20 req/min per IP | 60s |
| `POST /api/coach-assessment/calculate-score` | 5 req/min per IP | 60s |

Implementation: `lib/utils/rate-limiter.ts` - in-memory sliding window.
Returns HTTP 429 with `Retry-After` header when exceeded.

## 4. Migration File

- **Path:** `supabase/migrations/20260130_coach_applications.sql`
- Creates `coach_applications` table with all fields
- Adds auto-incrementing application number (`YA-2026-0001`)
- Adds `updated_at` trigger
- Adds coaches table columns (bank details, referral code, etc.)
- Inserts 10 site_settings entries
- Enables RLS with applicant + admin policies

## 5. Tests

- **File:** `__tests__/coach-journey.test.ts`
- **Tests:** 7 (5 rate limiter + 2 coach settings)
- **Total suite:** 30 tests across 4 suites (all passing)

## 6. Security Fixes Applied (Previous Session)

| Endpoint | Auth Added |
|----------|-----------|
| `app/api/admin/coach-applications/[id]/route.ts` | `requireAdmin()` on GET/PATCH/DELETE |
| `app/api/coach/onboarding/route.ts` | `requireCoach()` + ownership verification |
| `app/api/coach-assessment/schedule-interview/route.ts` | `requireAdmin()` |
| `app/api/coach-assessment/interview-feedback/route.ts` | `requireAdmin()` |
| `app/api/coach/send-status-notification/route.ts` | `requireAdmin()` |
| `app/api/coach-assessment/chat/route.ts` | `applicationId` validation + state check |
| `app/api/coach-assessment/calculate-score/route.ts` | `applicationId` validation |

Additional fixes:
- Referral code uniqueness: UUID-based suffix (`REF-FIRSTNAME-A3B4C5`)
- Razorpay error handling: `onboarding_complete`/`payout_enabled` only set when fund account created

## 7. Final Status

- TypeScript: Clean compile (0 errors)
- Tests: 30/30 passing
- All hardcoded values moved to site_settings
- Rate limiting on Gemini endpoints
- Auth on all API endpoints
