# Yestoryd Platform Contingency Plan
## Fallback Design & Cost Estimates (75 Children, 10 Coaches)

---

## Overview

This document outlines primary services, fallback alternatives, trigger conditions, and cost implications for each critical platform component.

---

## 1. AI/ML Services

### Primary: Gemini 2.5 Flash Lite
| Attribute | Details |
|-----------|---------|
| **Use Case** | Reading assessment analysis, RAG queries, session summaries |
| **Monthly Cost** | ₹2,500-3,000 |
| **Risk** | API outage, rate limits, quality degradation |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Gemini 2.5 Flash** | Quality drops noticeably for ages ≤7 | ₹5,000-6,000 | 2x cost, better accuracy |
| **OpenAI GPT-4o-mini** | Gemini API down >2 hours | ₹4,000-5,000 | Good audio support |
| **Claude 3.5 Haiku** | Both above unavailable | ₹3,500-4,500 | Text-only, no audio |
| **Manual Assessment** | All AI services down | ₹0 (time cost) | Coach fills form manually |

### Implementation
```javascript
// lib/ai-client.ts
const AI_PROVIDERS = ['gemini', 'openai', 'anthropic'];
let currentProvider = 'gemini';

async function analyzeReading(audio, passage, childAge) {
  for (const provider of AI_PROVIDERS) {
    try {
      return await callProvider(provider, audio, passage, childAge);
    } catch (error) {
      console.error(`${provider} failed, trying next...`);
      continue;
    }
  }
  // All failed - return manual assessment flag
  return { requiresManualReview: true };
}
```

---

## 2. Database

### Primary: Supabase (Free → Pro)
| Attribute | Details |
|-----------|---------|
| **Use Case** | All data storage, vector embeddings, auth |
| **Monthly Cost** | ₹0 (Free) → ₹2,100 (Pro) |
| **Risk** | Outage, data loss, hitting free tier limits |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Google Sheets** | Supabase down, need quick data access | ₹0 | Daily sync of critical data |
| **PlanetScale** | Supabase prolonged outage (>24h) | ₹0-2,500 | MySQL, good free tier |
| **Neon Postgres** | Need Postgres compatibility | ₹0-1,700 | Similar to Supabase |
| **Local JSON backup** | Emergency offline mode | ₹0 | Last 7 days cached locally |

### Implementation
```javascript
// Automated daily backup to Google Sheets
// Cron: Every day at 2 AM IST

async function dailyBackup() {
  const criticalTables = ['children', 'parents', 'sessions', 'payments'];
  for (const table of criticalTables) {
    const data = await supabase.from(table).select('*');
    await appendToGoogleSheet(table, data);
  }
}
```

---

## 3. Email Service

### Primary: SendGrid (Free Tier)
| Attribute | Details |
|-----------|---------|
| **Use Case** | Certificates, reminders, reports |
| **Monthly Cost** | ₹0 (100/day limit) |
| **Risk** | Spam issues, rate limits, account suspension |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **SendGrid Essentials** | Exceed 100/day regularly | ₹1,700 | 50,000 emails/month |
| **Resend** | SendGrid deliverability issues | ₹0-1,700 | Developer-friendly |
| **AWS SES** | Need high volume, low cost | ₹500-800 | $0.10 per 1000 emails |
| **Gmail SMTP** | Emergency only | ₹0 | 500/day limit, may hit spam |

### Implementation
```javascript
// lib/email-client.ts
const EMAIL_PROVIDERS = {
  primary: 'sendgrid',
  fallback1: 'resend',
  fallback2: 'ses',
  emergency: 'gmail'
};

async function sendEmail(to, subject, html) {
  const providers = Object.values(EMAIL_PROVIDERS);
  for (const provider of providers) {
    try {
      return await sendViaProvider(provider, to, subject, html);
    } catch (error) {
      console.error(`${provider} failed:`, error.message);
      continue;
    }
  }
  // Queue for manual sending
  await queueFailedEmail({ to, subject, html });
}
```

---

## 4. Video Hosting (E-Learning)

### Primary: YouTube Unlisted
| Attribute | Details |
|-----------|---------|
| **Use Case** | 100+ educational videos, 5 min each |
| **Monthly Cost** | ₹0 |
| **Risk** | No progress tracking, potential ToS issues, ads |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Bunny.net Stream** | Need progress tracking, scale to 300+ kids | ₹1,500-2,500 | $0.005/min watched |
| **Cloudinary** | YouTube gets blocked/flagged | ₹0-2,000 | 25GB free bandwidth |
| **Mux** | Need analytics, DRM | ₹2,500-4,000 | Professional grade |
| **Google Drive** | Emergency hosting | ₹0 | 15GB free, slow streaming |

### Migration Trigger
- Move to Bunny.net when: Children > 200 OR need watch-time analytics

---

## 5. Meeting Transcription

### Primary: tl;dv Business (1 License)
| Attribute | Details |
|-----------|---------|
| **Use Case** | Auto-record & transcribe coaching sessions |
| **Monthly Cost** | ₹4,900 |
| **Risk** | Bot fails to join, transcription errors |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Recall.ai** | tl;dv unreliable, need better API | ₹2,400 | Pay per hour |
| **MeetingBaas** | Cost optimization at scale | ₹2,200 | Similar to Recall |
| **Google Meet Recording** | tl;dv completely down | ₹0 | Manual transcription via Gemini |
| **Coach Manual Notes** | All transcription fails | ₹0 | Template-based note taking |

### Implementation
```javascript
// Session recording fallback
async function ensureSessionRecording(meetingId) {
  try {
    // Try tl;dv first
    await tldvClient.joinMeeting(meetingId);
  } catch (error) {
    // Fallback: Enable Google Meet recording
    await enableMeetRecording(meetingId);
    // Notify coach to take manual notes as backup
    await notifyCoach(meetingId, 'RECORDING_FALLBACK');
  }
}
```

---

## 6. Scheduling

### Primary: Google Calendar API
| Attribute | Details |
|-----------|---------|
| **Use Case** | Session booking, coach availability |
| **Monthly Cost** | ₹0 (part of Workspace) |
| **Risk** | API limits, sync issues |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Cal.com** | Google Calendar API issues | ₹1,000 | Self-hosted option available |
| **Calendly** | Need simpler booking flow | ₹1,200 | Per user pricing |
| **Manual Booking** | All calendar systems down | ₹0 | Google Form + Sheet |

---

## 7. Payments

### Primary: Razorpay
| Attribute | Details |
|-----------|---------|
| **Use Case** | Collect payments, auto-split |
| **Monthly Cost** | 2% per transaction |
| **Risk** | Account hold, settlement delays |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Cashfree** | Razorpay account issues | 1.9% per txn | Quick activation |
| **PayU** | Need backup gateway | 2% per txn | Established player |
| **Direct Bank Transfer** | All gateways down | ₹0 | Manual reconciliation |
| **UPI QR Code** | Emergency collections | ₹0 | Via business bank account |

### Implementation
```javascript
// Payment gateway fallback
const PAYMENT_GATEWAYS = ['razorpay', 'cashfree', 'manual'];

async function createPaymentOrder(amount, metadata) {
  for (const gateway of PAYMENT_GATEWAYS) {
    try {
      return await createOrder(gateway, amount, metadata);
    } catch (error) {
      console.error(`${gateway} failed, trying next...`);
    }
  }
  // Return manual payment instructions
  return { type: 'manual', upiId: 'yestoryd@bank', amount };
}
```

---

## 8. WhatsApp Notifications

### Primary: Twilio WhatsApp
| Attribute | Details |
|-----------|---------|
| **Use Case** | Session reminders, summaries |
| **Monthly Cost** | ₹1,000-1,500 |
| **Risk** | Template rejection, rate limits |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Interakt** | Twilio too expensive at scale | ₹800-1,200 | India-focused |
| **Gupshup** | Need better India support | ₹1,000-1,500 | Local provider |
| **SMS (Twilio)** | WhatsApp Business approval pending | ₹1,500-2,000 | Higher cost per msg |
| **Email Only** | All messaging fails | ₹0 | Included in SendGrid |

---

## 9. Hosting

### Primary: Vercel Pro
| Attribute | Details |
|-----------|---------|
| **Use Case** | Next.js frontend + API routes |
| **Monthly Cost** | ₹1,700 |
| **Risk** | Build failures, bandwidth limits |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Vercel Hobby** | Cost cutting needed | ₹0 | Limited, personal use only |
| **Render** | Vercel issues, need background jobs | ₹600-1,500 | Good for Node.js |
| **Railway** | Quick deployment needed | ₹500-1,500 | Developer-friendly |
| **AWS Amplify** | Enterprise requirements | ₹1,500-3,000 | More control |

---

## 10. Domain & DNS

### Primary: Hostinger
| Attribute | Details |
|-----------|---------|
| **Use Case** | yestoryd.com DNS management |
| **Monthly Cost** | ₹200 |
| **Risk** | DNS propagation issues |

### Fallback Options

| Fallback | Trigger Condition | Monthly Cost | Notes |
|----------|-------------------|--------------|-------|
| **Cloudflare** | Need DDoS protection, faster DNS | ₹0 | Free tier excellent |
| **Google Domains** | Hostinger issues | ₹1,000/year | Reliable |
| **Namecheap** | Budget alternative | ₹800/year | Good support |

---

## Cost Summary

### Normal Operations (₹23,000-25,000/month)

| Service | Primary Cost |
|---------|--------------|
| Google Workspace (11 users) | ₹12,500 |
| tl;dv Business | ₹4,900 |
| Gemini API | ₹3,000 |
| Vercel Pro | ₹1,700 |
| WhatsApp (Twilio) | ₹1,200 |
| Hostinger | ₹200 |
| Supabase | ₹0 (Free) |
| SendGrid | ₹0 (Free) |
| YouTube | ₹0 (Free) |
| **TOTAL** | **₹23,500** |

### Worst Case Scenario (All Fallbacks Active)

| Service | Fallback Cost | Trigger |
|---------|---------------|---------|
| AI → OpenAI + Gemini Flash | +₹3,000 | Quality issues |
| Database → Supabase Pro + Neon | +₹4,000 | Free tier exceeded |
| Email → SendGrid Essentials | +₹1,700 | Volume exceeded |
| Video → Bunny.net | +₹2,000 | Need tracking |
| Transcription → Recall.ai | -₹2,500 | tl;dv issues |
| Hosting → Vercel + Render | +₹1,500 | Background jobs |
| **Worst Case TOTAL** | **₹33,000-35,000** |

### Contingency Budget Recommendation

| Scenario | Monthly Budget |
|----------|----------------|
| **Normal** | ₹25,000 |
| **Buffer (20%)** | ₹30,000 |
| **Worst Case** | ₹35,000 |

**Recommendation:** Keep ₹30,000/month budget with ₹5,000 contingency reserve.

---

## Monitoring & Alert Triggers

### Automated Health Checks

```javascript
// Health check cron - runs every 5 minutes
const HEALTH_CHECKS = [
  { name: 'Supabase', endpoint: '/api/health/db', threshold: 2000 },
  { name: 'Gemini', endpoint: '/api/health/ai', threshold: 5000 },
  { name: 'SendGrid', endpoint: '/api/health/email', threshold: 3000 },
  { name: 'Razorpay', endpoint: '/api/health/payment', threshold: 3000 },
];

async function runHealthChecks() {
  for (const check of HEALTH_CHECKS) {
    const start = Date.now();
    try {
      await fetch(check.endpoint);
      const duration = Date.now() - start;
      if (duration > check.threshold) {
        await alertSlack(`⚠️ ${check.name} slow: ${duration}ms`);
      }
    } catch (error) {
      await alertSlack(`🔴 ${check.name} DOWN: ${error.message}`);
      await activateFallback(check.name);
    }
  }
}
```

### Manual Trigger Conditions

| Service | Switch to Fallback When |
|---------|------------------------|
| Gemini | Error rate > 10% for 1 hour |
| Supabase | Response time > 3s consistently |
| SendGrid | Bounce rate > 5% |
| tl;dv | Fails to join 3 consecutive meetings |
| Razorpay | Payment failures > 5% |

---

## Quarterly Review Checklist

- [ ] Review service costs vs budget
- [ ] Check if any fallback was activated
- [ ] Evaluate primary service performance
- [ ] Update fallback credentials/configs
- [ ] Test failover procedures
- [ ] Review vendor SLAs and alternatives

---

## Emergency Contacts & Procedures

| Scenario | Immediate Action | Escalation |
|----------|------------------|------------|
| **All AI down** | Enable manual assessment mode | Notify all coaches via WhatsApp |
| **Database down** | Switch to Google Sheets read | Contact Supabase support |
| **Payments down** | Share UPI QR via WhatsApp | Contact Razorpay support |
| **Complete outage** | Post status on social media | Activate all fallbacks |

---

*Last Updated: December 2024*
*Review Frequency: Quarterly*
