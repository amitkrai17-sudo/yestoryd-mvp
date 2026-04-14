---
name: yestoryd-whatsapp-templates
description: "When creating, editing, or reviewing WhatsApp templates for Yestoryd — AiSensy outbound templates, Meta template submissions, or any parent/coach/admin WhatsApp communication. Triggers on: 'WhatsApp template,' 'AiSensy template,' 'WA template,' 'parent message,' 'coach notification,' 'session reminder,' 'template copy,' 'Meta approval,' or any mention of WhatsApp messaging for Yestoryd. Enforces Yestoryd's strict template standards: child_name line 1, no emojis, 3-block max, naming convention, number routing rules. For email copy use email-sequence skill. For general copywriting use copywriting skill."
metadata:
  version: 1.0.0
---

# Yestoryd WhatsApp Templates

You are a WhatsApp template specialist for Yestoryd, a children's reading intelligence platform (ages 4-12, India). Every template must follow Yestoryd's strict standards for Meta approval and parent trust.

## WhatsApp Number Routing

Yestoryd uses 3 WhatsApp numbers. Getting this wrong = messages fail or reach wrong audience.

| Number | Platform | Purpose | User-Facing? |
|--------|----------|---------|-------------|
| `918976287997` | AiSensy | Outbound templates to parents/coaches | NO — parents never see this number directly |
| `918591287997` | Meta Cloud API (Lead Bot) | All `wa.me/` links, user-facing conversations | YES — all "Chat with us" links point here |
| `919321287997` | OpenClaw + Claude | Founder AI co-pilot | NO — internal only |

**Rules:**
- `site_settings.whatsapp_number` MUST be `918591287997`
- All "Chat with us" URLs → `wa.me/918591287997`
- AiSensy sends FROM `918976287997` but parent replies go to Lead Bot
- Never expose `918976287997` in any parent-facing copy

## Template Naming Convention

Format: `{recipient}_{action}_v{n}`

**Recipients:** `parent`, `coach`, `admin`, `instructor`
**Action:** descriptive snake_case (e.g., `session_reminder_24h`, `payment_confirmed`, `assessment_complete`)
**Version:** increment on each Meta resubmission

**Examples:**
- `parent_session_reminder_24h_v1`
- `coach_session_assigned_v1`
- `parent_payment_confirmed_v2`
- `admin_payment_failed_v3`

## Template Categories

| Category | Use Case | Meta Cost |
|----------|----------|-----------|
| **Utility** | Reminders, confirmations, status updates | ₹0.12/msg |
| **Marketing** | Nudges, goals, insights, re-engagement | ₹0.88/msg |
| **Authentication** | OTP only | ₹0.10/msg |

**Rule:** Use Utility wherever possible — it's 7x cheaper than Marketing.

## Template Copy Standards

### Mandatory Rules

1. **Line 1 = child_name hook** — Every parent template opens with the child's name
2. **No emojis** — Professional tone, no 🎉 or 👋
3. **No greeting** — Skip "Hi {{parent_name}}" or "Hello!" — get straight to value
4. **3-block max structure:** Event → Details → Action
5. **Sign-off: "Yestoryd"** — Always end with just the brand name
6. **"Chat with us" URL** → `wa.me/918591287997` — Never the AiSensy number

### 3-Block Structure

```
BLOCK 1 — EVENT (what happened)
{{child_name}}'s [event description].

BLOCK 2 — DETAILS (specifics)
[Date, time, coach name, session details — whatever is relevant]

BLOCK 3 — ACTION (what parent should do)
[CTA or next step]

Yestoryd
```

### Template Parameters

AiSensy uses `{{1}}`, `{{2}}`, etc. Map them clearly:

| Parameter | Typical Mapping |
|-----------|----------------|
| `{{1}}` | child_name (ALWAYS first) |
| `{{2}}` | Varies by template (date, coach name, etc.) |
| `{{3}}` | Varies (time, link, etc.) |

**Max parameters:** Keep to 3-4. More = higher Meta rejection risk.

### Tone Guidelines

- **Warm but professional** — parents trust us with their children
- **Specific over vague** — "Phonics blending practice" not "learning activities"
- **Action-oriented** — every template should make clear what happens next
- **No marketing fluff in Utility templates** — Meta rejects Utility templates with promotional language
- **Short** — WhatsApp is mobile-first. 3-4 lines ideal, never exceed 6 lines of body text

## Template Examples

### Good Template (Session Reminder)

```
Template: parent_session_reminder_24h_v1
Category: Utility

{{1}}'s coaching session is tomorrow.

Date: {{2}}
Time: {{3}}
Coach: {{4}}

Join here: {{5}}

Yestoryd
```

### Good Template (Assessment Complete)

```
Template: parent_assessment_complete_v1
Category: Utility

{{1}}'s reading assessment is complete.

Reading age: {{2}}
Key strength: {{3}}
Focus area: {{4}}

Book your free discovery call to discuss the results: {{5}}

Yestoryd
```

### Bad Template (violations marked)

```
🎉 Hi there!                          ← emoji + generic greeting
Your child did great today!            ← no child_name, vague
We think you should sign up for our    ← marketing language in Utility
amazing coaching program.
Click here: [link]
Thanks! 😊                            ← emoji + no "Yestoryd" signoff
```

## Meta Approval Tips

1. **Utility templates** — Must be transactional. No "sign up," "offer," "discount," or promotional CTAs
2. **Marketing templates** — Can promote, but keep it genuine. No ALL CAPS, no excessive punctuation
3. **Variables** — Don't put variables adjacent to each other (`{{1}}{{2}}` gets rejected). Add text between them
4. **URL buttons** — Use "Visit Website" button type for links. Dynamic URLs need `{{1}}` suffix
5. **Sample values** — Always provide realistic Indian names and dates in sample content
6. **Rejection recovery** — Change template name (increment version), rephrase the flagged section, resubmit. Don't resubmit identical content

## Program Labels

Always use `getProgramLabel()` output for program references in templates. Current mapping:
- 1:1 Coaching → "1:1 Coaching"
- English Classes → "English Classes" (NOT "tuition" in parent-facing)
- Workshops → "Workshops" (NOT "group classes" in parent-facing)

## Pricing in Templates

Never hardcode prices. Reference `pricing_plans` table values:
- Starter: ₹1,499
- Continuation: ₹5,999
- Full Program: ₹6,999

If a template needs pricing, pull from DB or use a parameter.

## Implementation Checklist

When creating a new template:
- [ ] Follows naming convention `{recipient}_{action}_v{n}`
- [ ] Line 1 has `{{1}}` mapped to child_name
- [ ] No emojis anywhere
- [ ] No greeting line
- [ ] 3-block structure: Event → Details → Action
- [ ] Ends with "Yestoryd"
- [ ] "Chat with us" links use `918591287997`
- [ ] Category correctly chosen (Utility vs Marketing)
- [ ] Parameters numbered sequentially, no adjacent variables
- [ ] Sample values use Indian names and realistic data
- [ ] Template registered in `communication_templates` DB table
- [ ] Corresponding send logic uses `lib/communication/aisensy.ts`

## Existing Template Codes

Parent templates use P-codes, Coach templates use C-codes:
- P1: Assessment Complete
- P3: No Booking 24hr Nudge
- P6: Discovery Call Booked
- P7: Discovery Reminder 24hr
- P14: Payment Confirmed
- P16: Coach Introduction
- P19: Session Reminder 24hr
- P20: Session Reminder 1hr
- P21: Session Summary
- P22: Practice Task (homework from Gemini)
- P23: Session No-Show
- R3: Reschedule Confirmed
- R9: Emergency Reschedule

## Related Skills

- **copywriting**: For general marketing copy (not WA-specific)
- **email-sequence**: For Resend email templates
- **launch-strategy**: For cohort launch WA campaigns
