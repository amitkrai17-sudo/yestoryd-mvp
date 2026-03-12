---
name: deploy-check
description: >
  Pre-deployment verification checklist for Yestoryd.
  Use before deploying to production or when preparing a release.
  Trigger on: "deploy", "ship", "push to prod", "release", "pre-deploy",
  "go live", "production check", "ready to launch", or any deployment discussion.
  This is a manual-only skill — Claude should NOT auto-invoke it.
disable-model-invocation: true
---

# Deploy Check Skill — Yestoryd

## Pre-Deploy Checklist

Run these checks before every production deployment:

### 1. TypeScript Types
```bash
# Regenerate Supabase types if ANY migration was run
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts

# Verify no type errors
npx tsc --noEmit
```

### 2. Build Verification
```bash
# Clean build — catches SSR issues
npm run build

# Check for build warnings (especially dynamic route issues)
```

### 3. Database Consistency
```bash
# Check all migrations are applied
npx supabase db diff

# Verify site_settings cache invalidation is wired
grep -r "invalidate.*site_settings\|revalidate.*settings" app/api/admin/ --include="*.ts" -l
```

### 4. Cron Health
- All new crons added to dispatcher schedule array
- All new crons added to health check monitoring
- activity_log logging confirmed (not cron_logs)

### 5. Mobile Testing
Test on these breakpoints (80%+ India mobile):
- iPhone SE: 375px
- Mid-range Android: 360px
- iPad: 768px
- Desktop: 1280px+

Check:
- [ ] No horizontal overflow
- [ ] Bottom nav visible and functional
- [ ] Cards not clipped
- [ ] Touch targets ≥ 44px
- [ ] Forms usable on mobile keyboard

### 6. Security
- [ ] No API keys in client-side code
- [ ] Auth checks on all protected routes
- [ ] child_id isolation verified (no cross-user data leaks)
- [ ] Webhook signatures verified (Razorpay timing-safe)
- [ ] RLS policies on new tables

### 7. Feature Flags
- [ ] New features behind site_settings toggles where appropriate
- [ ] Fallback values defined for all new site_settings keys
- [ ] Admin portal can control new settings

### 8. Monitoring
- [ ] Sentry error boundaries on new pages
- [ ] activity_log writes for significant actions
- [ ] Console.error for caught exceptions (Sentry picks these up)

### 9. Communication
- [ ] Any new AiSensy templates submitted for Meta approval
- [ ] Resend email fallback configured for critical alerts
- [ ] WhatsApp template IDs in site_settings (not hardcoded)

### 10. Common Gotchas
- [ ] No white text on white background (explicit `text-gray-900` on inputs)
- [ ] No hardcoded pricing (all from site_settings/pricing_plans)
- [ ] ISR cache times reasonable (assessments: 300s, not 3600s)
- [ ] No `@ts-nocheck` added (only 1 existing allowed)
- [ ] Supabase status page checked if ECONNRESET errors appear

## Post-Deploy Verification

1. Visit each portal (parent/coach/admin) on mobile + desktop
2. Check Sentry for new errors (wait 5 minutes)
3. Verify cron dispatcher fires on next cycle
4. Test one critical flow end-to-end (e.g., discovery booking → payment → enrollment)
