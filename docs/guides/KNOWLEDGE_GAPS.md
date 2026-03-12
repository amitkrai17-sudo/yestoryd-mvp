# Yestoryd AI Knowledge Base — Information Gaps

Items that could not be confirmed from the codebase and need manual input from Rucha/Amit.

## Pricing (HIGH PRIORITY)

- [ ] **Exact current prices for each program tier** — Full, Starter, Continuation. These are in the `pricing_plans` DB table but not in code. The knowledge base currently directs users to the enrollment page. Should the WhatsApp AI quote exact prices?
- [ ] **Session counts per program** — How many coaching sessions, skill building sessions, and parent check-ins are included in each tier?
- [ ] **Group class pricing** — Is this a separate paid product or included in coaching programs?
- [ ] **E-learning access** — Is this bundled with all programs or only specific tiers?

## Program Details

- [ ] **Exact session frequency** — Weekly? Twice a week? How many total sessions over 90 days per tier?
- [ ] **Continuation program** — What's the difference from the Full program? Is it shorter? Fewer sessions?
- [ ] **Starter vs Full** — What exactly is included/excluded in the Starter tier?

## Discovery Call

- [ ] **Who conducts discovery calls?** — Always Rucha, or any available coach?
- [ ] **Discovery call availability** — What time slots are typically available?

## Refund Policy

- [ ] **Exact refund terms** — Within how many days? Full refund or prorated? Any conditions?
- [ ] **Refund process** — How long does it take? Who initiates?

## Content

- [ ] **FAQ answers** — The `site_settings.faq_items` contain the actual FAQ. The knowledge base has reasonable answers but should be verified against the DB content.
- [ ] **Testimonial quotes** — Real parent testimonials with names (if permission given) for the AI to reference.
- [ ] **ASER 2023 stat context** — "46.8%" is referenced in ProblemSection. What exactly does this stat represent? "X% of Class Y children cannot read a Class Z text"?

## Operational

- [ ] **Operating hours** — When is the WhatsApp AI expected to respond? 24/7 or business hours?
- [ ] **Response time SLA** — For escalations, how quickly does Rucha/team respond?
- [ ] **Languages supported** — English only? Hindi? Regional languages?
- [ ] **Technical requirements** — Minimum internet speed, browser versions, etc.

## Marketing

- [ ] **Current active offers/promotions** — Any seasonal discounts, launch offers, or referral campaigns running?
- [ ] **Referral program details** — What does the referring parent get? What does the new parent get?
- [ ] **Success stories with specifics** — Named testimonials with before/after scores that the AI can reference (with permission).

## Competition Awareness

- [ ] **How should the AI respond if asked about competitors?** — Currently told "never discuss competitors." Should it acknowledge and differentiate, or redirect entirely?

---

*Last updated: January 2026*
*To resolve: Update `lib/rai/knowledge/yestoryd.ts` with confirmed values, then rebuild.*
