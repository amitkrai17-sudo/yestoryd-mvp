# Recall.ai Webhook Integration - Troubleshooting Guide

**Date:** February 1, 2026  
**Project:** Yestoryd  
**Author:** Amit Kumar Rai (with Claude assistance)

---

## Overview

This document captures the issues encountered while setting up Recall.ai webhook integration for session recording and transcript processing, along with their solutions.

---

## Issues Encountered & Solutions

### Issue 1: Google Meet Lobby Blocking Parents and Recall.ai Bot

**Symptoms:**
- Parents stuck in lobby waiting to be admitted
- Recall.ai bot stuck in lobby
- Coach didn't have host controls
- Rucha couldn't present or manage meeting

**Root Cause:**
- Google Calendar events were created with `engage@yestoryd.com` as the **organizer**
- Coach was added only as an **attendee**
- The organizer (engage@) never "joined" the meeting, so no one could admit participants

**Solution:**
Changed calendar event creation to make the **coach the organizer**:

```typescript
// BEFORE (problematic):
const event = await calendar.events.insert({
  calendarId: 'engage@yestoryd.com',  // engage is organizer
  attendees: [coach, parent, engage]
});

// AFTER (fixed):
const event = await calendar.events.insert({
  calendarId: coachEmail,  // Coach is organizer
  attendees: [parent, 'engage@yestoryd.com']  // engage as attendee for Recall
});
```

**Files Modified:**
- `app/api/jobs/enrollment-complete/route.ts`
- `app/api/sessions/confirm/route.ts`
- `app/api/admin/group-classes/route.ts`
- `lib/calendar/operations.ts`
- `lib/googleCalendar.ts`

**Fallback Chain:**
```
coachEmail → DEFAULT_COACH_EMAIL (rucha.rai@yestoryd.com) → engage@yestoryd.com
```

**Environment Variable Added:**
```
DEFAULT_COACH_EMAIL=rucha.rai@yestoryd.com
```

---

### Issue 2: Google Meet "Trusted" Access Type

**Symptoms:**
- Even with coach as organizer, external users (parents, Recall.ai bot) were stuck in lobby

**Root Cause:**
- Google Workspace Meet settings had "Access Type" set to **"Trusted"**
- This only allowed @yestoryd.com users to join directly
- External users (parents with @gmail.com, Recall.ai bot) had to knock

**Solution:**
Changed Google Workspace Admin settings:

1. Go to: `admin.google.com` → Apps → Google Workspace → Google Meet → Meet safety settings
2. Change **"Access Type"** from **"Trusted"** to **"Open"**

This allows anyone with the meeting link to join directly without waiting in lobby.

---

### Issue 3: Webhook URL Causing 307 Redirect

**Symptoms:**
- Webhook attempts returned `307 (Temporary Redirect)`
- Response body: `"Redirecting..."`
- Signature verification failed after redirect (body lost)

**Root Cause:**
- Vercel domain configuration: `yestoryd.com` redirects (307) → `www.yestoryd.com`
- Recall.ai was sending webhooks to `https://yestoryd.com/api/webhooks/recall`
- The redirect caused the request body to be lost

**Solution:**
Changed webhook URL to use the canonical domain:

```
WRONG:  https://yestoryd.com/api/webhooks/recall
WRONG:  https://yestoryd.com/api/webhooks/recall/  (trailing slash)
WRONG:  https://www.yestoryd.com/api/webhooks/recall/  (trailing slash)
CORRECT: https://www.yestoryd.com/api/webhooks/recall
```

**Key Learnings:**
- Always use the canonical domain (check Vercel domain settings)
- No trailing slash on webhook URLs
- Vercel's domain-level redirects affect API routes too

---

### Issue 4: Invalid Signature (401 Unauthorized)

**Symptoms:**
- Webhook reached server (no more redirect)
- Response: `401 Unauthorized`
- Error: `{"error": "Invalid signature"}`

**Root Cause:**
- Recall.ai uses **Svix** for webhook delivery (not raw HMAC)
- Our code was using manual `crypto.createHmac` with wrong headers
- Wrong header: `x-recall-signature`
- Wrong signing format: body only

**The Difference:**

| Aspect | Old (Broken) | New (Fixed) |
|--------|--------------|-------------|
| Header | `x-recall-signature` | `svix-signature` (or `webhook-signature`) |
| Signed content | `body` only | `${svix-id}.${svix-timestamp}.${body}` |
| Key format | Raw string | `whsec_` prefixed, base64-decoded internally |
| Digest | hex | base64 |
| Library | Manual `crypto.createHmac` | `svix` package `Webhook.verify()` |

**Solution:**
Rewrote signature verification to use Svix library:

```typescript
import { Webhook } from 'svix';

// Get headers (Svix or webhook- prefixed)
const svixId = headers.get('svix-id') || headers.get('webhook-id');
const svixTimestamp = headers.get('svix-timestamp') || headers.get('webhook-timestamp');
const svixSignature = headers.get('svix-signature') || headers.get('webhook-signature');

// Verify using Svix library
const wh = new Webhook(process.env.RECALL_WEBHOOK_SECRET!);
const payload = wh.verify(rawBody, {
  'svix-id': svixId,
  'svix-timestamp': svixTimestamp,
  'svix-signature': svixSignature,
});
```

**Package Added:**
```bash
npm install svix
```

**Reference Documentation:**
- https://docs.recall.ai/docs/status-change-webhooks-setup-verification
- https://www.svix.com/customers/recall-ai/
- https://docs.svix.com/receiving/verifying-payloads/how-manual

---

### Issue 5: Webhook Disabled in Recall.ai Dashboard

**Symptoms:**
- No webhook attempts showing in logs
- Status showed "Disabled" with error rate

**Root Cause:**
- Webhook endpoint was manually disabled in Recall.ai dashboard
- Previous failures had triggered automatic disable

**Solution:**
- Re-enabled the webhook endpoint in Recall.ai Dashboard → Webhooks → Endpoints
- Fixed the underlying issues (URL, signature) before re-enabling

---

## Final Working Configuration

### Recall.ai Webhook Settings
```
URL: https://www.yestoryd.com/api/webhooks/recall
Events: bot.done, bot.call_ended, bot.fatal, recording.done, etc.
Status: Enabled
```

### Environment Variables (Vercel)
```
RECALL_API_KEY=<your-api-key>
RECALL_WEBHOOK_SECRET=whsec_<your-signing-secret>
DEFAULT_COACH_EMAIL=rucha.rai@yestoryd.com
GOOGLE_CALENDAR_DELEGATED_USER=engage@yestoryd.com
```

### Google Workspace Settings
```
Google Meet → Meet safety settings:
- Access Type: Open
- Host must join before anyone else: OFF
```

### Domain Configuration (Vercel)
```
yestoryd.com → 307 redirect → www.yestoryd.com (primary)
www.yestoryd.com → Production
```

---

## Testing Checklist

When setting up or debugging Recall.ai webhooks:

- [ ] Webhook URL uses canonical domain (check Vercel domain redirects)
- [ ] No trailing slash on webhook URL
- [ ] RECALL_WEBHOOK_SECRET matches Recall.ai dashboard exactly (whsec_... format)
- [ ] Using Svix library for signature verification (not manual HMAC)
- [ ] Webhook endpoint is ENABLED in Recall.ai dashboard
- [ ] Google Meet Access Type is "Open" (not "Trusted")
- [ ] Coach is calendar event organizer (not engage@)

---

## Webhook Flow (Working)

```
1. Enrollment Created
   ↓
2. Sessions Created in DB (with metadata)
   ↓
3. Google Calendar Events Created (Coach as Organizer)
   ↓
4. Recall.ai Bots Scheduled (with session_id, child_id, coach_id metadata)
   ↓
5. Session Time: Coach Joins → Parents Join → Bot Auto-Joins
   ↓
6. Session Ends → Recall.ai Processes Recording
   ↓
7. Webhook Fired: bot.done
   ↓
8. /api/webhooks/recall receives webhook
   ↓
9. Svix signature verified ✓
   ↓
10. Session found via metadata.session_id
    ↓
11. Transcript fetched from Recall.ai API
    ↓
12. Gemini analyzes transcript
    ↓
13. Database updated: transcript, ai_analysis, parent_summary
    ↓
14. Parent notified (optional)
```

---

## Common Errors & Quick Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| 307 Redirect | Wrong domain (yestoryd.com vs www) | Use www.yestoryd.com |
| 307 Redirect | Trailing slash | Remove trailing slash |
| 401 Invalid signature | Wrong verification method | Use Svix library |
| 401 Invalid signature | Secret mismatch | Re-copy secret from Recall.ai |
| validation_failed | No metadata in bot | Ensure bot created with session_id |
| Bot stuck in lobby | Coach not organizer | Make coach the calendar organizer |
| Bot stuck in lobby | Meet Access Type: Trusted | Change to "Open" |

---

## Files Reference

**Webhook Handler:**
- `app/api/webhooks/recall/route.ts`

**Calendar Event Creation:**
- `app/api/jobs/enrollment-complete/route.ts`
- `app/api/sessions/confirm/route.ts`
- `lib/calendar/operations.ts`
- `lib/googleCalendar.ts`

**Recall.ai Bot Scheduling:**
- `lib/recall-auto-bot.ts`

**Session Processing:**
- `app/api/jobs/process-session/route.ts`

---

*Last Updated: February 1, 2026*
