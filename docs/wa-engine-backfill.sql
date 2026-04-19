-- ============================================================
-- WhatsApp Engine Backfill — SHOW-ONLY (do not run yet)
-- Date: 2026-04-16
-- Precondition: migration 20260416120000_wa_engine_unified.sql
--               has been applied (channel + cost_per_send columns exist)
-- ============================================================
--
-- Decisions encoded here (per user resolutions):
--   - Use existing wa_template_category for cost classification
--     (no new cost_category column). We still compute cost_per_send
--     based on the template_code mapping rule.
--   - Use existing wa_variables text[] as the ordered param list
--     (no new param_schema jsonb column).
--   - is_active is NOT touched. All 37 existing rows keep is_active
--     as-is. Disabling email-only rows (use_whatsapp=false,
--     use_email=true) would break those flows.
--   - channel defaults to 'aisensy' via column default; the UPDATE
--     below is idempotent/no-op but explicit for auditability.
--
-- ============================================================
-- PART A — UPDATE existing 37 rows
-- ============================================================

BEGIN;

-- A.1  channel = 'aisensy' for every existing row (explicit, no-op under default).
UPDATE communication_templates
   SET channel = 'aisensy'
 WHERE channel IS DISTINCT FROM 'aisensy';

-- A.2  cost_per_send by template_code pattern:
--      OTP                                          → 0.1000 (authentication)
--      contains 'nudge'|'goal'|'insight'|
--               'reminder_weekly'|'practice'         → 1.0900 (marketing)
--      everything else                              → 0.1450 (utility)

-- Authentication
UPDATE communication_templates
   SET cost_per_send = 0.1000
 WHERE template_code IN ('OTP', 'parent_otp')
    OR template_code ILIKE '%otp%';

-- Marketing
UPDATE communication_templates
   SET cost_per_send = 1.0900
 WHERE template_code ~* '(nudge|goal|insight|reminder_weekly|practice)'
   AND cost_per_send IS DISTINCT FROM 0.1000;  -- don't overwrite OTP

-- Utility — everything still null
UPDATE communication_templates
   SET cost_per_send = 0.1450
 WHERE cost_per_send IS NULL;

-- A.3  FLAG FIX — C9_session_reminder has use_whatsapp=false in DB
--      but code actively sends coach_session_reminder_1h_v3 via direct
--      sendWhatsAppMessage(). Flip the flag to match runtime truth.
--      (Documented in docs/wa-audit-2026-04-16.md Phase 4 MISMATCH.)
UPDATE communication_templates
   SET use_whatsapp = true
 WHERE template_code = 'C9_session_reminder';

COMMIT;

-- ============================================================
-- PART B — INSERT 27 new templates currently sent as hardcoded
--          campaign strings with no communication_templates row.
--
-- One template — parent_discovery_followup_v3 — is intentionally
-- SKIPPED. It is a freeform message template stored in a
-- separate `whatsapp_templates` table (not communication_templates)
-- and is never passed to sendWhatsAppMessage as a campaign name.
-- It will remain out of scope until that slug system is unified.
--
-- wa_variables arrays below were derived by reading each call site
-- and copying the positional order actually passed today.
-- ============================================================

BEGIN;

-- ─── Admin alerts (9 templates) ─────────────────────────────
INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_new_lead_v4', 'Admin: new lead', 'admin', true, false,
   'admin_new_lead_v4',
   ARRAY['child_name','age','parent_name','parent_phone','location','score','wpm','lead_status','timestamp'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_discovery_booked_v4', 'Admin: discovery booked', 'admin', true, false,
   'admin_discovery_booked_v4',
   ARRAY['child_name','age','parent_name','parent_phone','scheduled_date_time','coach_name','score','wpm','timestamp'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_daily_digest_v3', 'Admin: daily digest', 'admin', true, false,
   'admin_daily_digest_v3',
   ARRAY['date','new_leads_count','hot_count','warm_count','cool_count','booked_yesterday','scheduled_today','pending_followup','mtd_total'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_daily_health_v3', 'Admin: daily health check', 'admin', true, false,
   'admin_daily_health_v3',
   ARRAY['message'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_hot_lead_alert_v3', 'Admin: hot lead alert', 'admin', true, false,
   'admin_hot_lead_alert_v3',
   ARRAY['child_name','age','parent_name','phone','score','lead_score'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_report_overdue_v3', 'Admin: session report overdue', 'admin', true, false,
   'admin_report_overdue_v3',
   ARRAY['coach_name','child_name','session_date','hours_overdue'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_scheduling_alert_v3', 'Admin: enrollment stuck', 'admin', true, false,
   'admin_scheduling_alert_v3',
   ARRAY['child_name','enrollment_short_id','minutes_ago','reason'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('admin_group_class_overdue', 'Admin: group class completion overdue', 'admin', true, false,
   'admin_group_class_overdue',
   ARRAY['instructor_name','class_name','session_time','hours_overdue'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

-- ─── Coach reminders (1 new template) ───────────────────────
INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('coach_report_deadline_v3', 'Coach: session report deadline reminder', 'coach', true, false,
   'coach_report_deadline_v3',
   ARRAY['coach_first_name','child_name','deadline_time'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

-- ─── Parent auth / lifecycle (8 templates) ──────────────────

-- parent_otp_v3 — authentication category, variables: [otp]
-- Button URL also contains {{otp}} but that is handled inline
-- by send-otp/route.ts; the template's text param schema is [otp].
INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_otp_v3', 'Parent/Coach: login OTP', 'parent', true, false,
   'parent_otp_v3',
   ARRAY['otp'],
   'aisensy', 0.1000)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_final_assessment_v3', 'Parent: final assessment link', 'parent', true, false,
   'parent_final_assessment_v3',
   ARRAY['child_name','assessment_link'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_feedback_request_v3', 'Parent: session feedback request', 'parent', true, false,
   'parent_feedback_request_v3',
   ARRAY['coach_first_name','child_first_name','session_number'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_proactive_notification_v3', 'Parent: proactive safety/progress alert', 'parent', true, false,
   'parent_proactive_notification_v3',
   ARRAY['message'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_goals_capture_v3', 'Parent: 30-min post-assessment goals nudge', 'parent', true, false,
   'parent_goals_capture_v3',
   ARRAY['parent_name','child_name','child_name_2','coach_name'],
   'aisensy', 1.0900)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_auto_reply_redirect_v3', 'Parent: auto-reply redirect to Lead Bot', 'parent', true, false,
   'parent_auto_reply_redirect_v3',
   ARRAY[]::text[],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_offline_notification_v3', 'Parent: offline session confirmation', 'parent', true, false,
   'parent_offline_notification_v3',
   ARRAY['parent_first','child_first','session_date'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_group_micro_insight_v3', 'Parent: micro insight from group class', 'parent', true, false,
   'parent_group_micro_insight_v3',
   ARRAY['parent_name','child_name','shortened_insight','cta_link'],
   'aisensy', 1.0900)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_group_promotion_v3', 'Parent: waitlist promotion notification', 'parent', true, false,
   'parent_group_promotion_v3',
   ARRAY['parent_name','child_name','class_name','session_date','hours'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

-- ─── Tuition onboarding & balance lifecycle (5 templates) ────
INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_tuition_onboarding_v3', 'Tuition: parent onboarding magic link', 'parent', true, false,
   'parent_tuition_onboarding_v3',
   ARRAY['coach_first_name','child_name','magic_link','sessions_purchased','rate_rupees','coach_first_name_2'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_tuition_payment_v3', 'Tuition: parent payment link', 'parent', true, false,
   'parent_tuition_payment_v3',
   ARRAY['parent_first_name','child_full_name','sessions_purchased','rate_rupees','total_rupees','checkout_url'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_tuition_renewal_v3', 'Tuition: balance zero, renewal link', 'parent', true, false,
   'parent_tuition_renewal_v3',
   ARRAY['parent_first_name','child_name','sessions_purchased','coach_name','child_name_2','renewal_url'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_tuition_low_balance_v3', 'Tuition: low balance (<=2 sessions)', 'parent', true, false,
   'parent_tuition_low_balance_v3',
   ARRAY['parent_first_name','child_name','new_balance','renewal_url'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('parent_tuition_paused_v3', 'Tuition: enrollment paused (balance 0 for 3+ days)', 'parent', true, false,
   'parent_tuition_paused_v3',
   ARRAY['parent_first_name','child_name','renewal_url','child_name_2'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

-- ─── Group class reminders & feedback (4 templates) ─────────
INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('group_class_reminder_24h', 'Group class: parent 24h reminder', 'parent', true, false,
   'group_class_reminder_24h',
   ARRAY['parent_name','child_name','class_name','date_time','meet_link'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('group_class_reminder_1h', 'Group class: parent 1h reminder', 'parent', true, false,
   'group_class_reminder_1h',
   ARRAY['parent_name','child_name','class_name','meet_link'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('group_class_instructor_reminder_1h', 'Group class: instructor 1h reminder', 'coach', true, false,
   'group_class_instructor_reminder_1h',
   ARRAY['instructor_name','class_name','session_time','participant_count','meet_link'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

INSERT INTO communication_templates
  (template_code, name, recipient_type, use_whatsapp, use_email,
   wa_template_name, wa_variables, channel, cost_per_send)
VALUES
  ('group_class_parent_feedback_request', 'Group class: parent post-session feedback', 'parent', true, false,
   'group_class_parent_feedback_request',
   ARRAY['parent_name','child_name','class_name'],
   'aisensy', 0.1450)
ON CONFLICT (template_code) DO UPDATE SET
  wa_template_name = EXCLUDED.wa_template_name,
  wa_variables     = EXCLUDED.wa_variables,
  channel          = EXCLUDED.channel,
  cost_per_send    = EXCLUDED.cost_per_send,
  use_whatsapp     = EXCLUDED.use_whatsapp;

COMMIT;

-- ============================================================
-- Verification queries (run after backfill to confirm state)
-- ============================================================
-- SELECT COUNT(*) FROM communication_templates;
-- -- expected: 64 (37 existing + 27 inserted)
--
-- SELECT cost_per_send, COUNT(*)
-- FROM communication_templates
-- GROUP BY cost_per_send
-- ORDER BY 1;
--
-- SELECT template_code, wa_template_name, channel, use_whatsapp, cost_per_send
-- FROM communication_templates
-- WHERE channel <> 'aisensy' OR cost_per_send IS NULL
-- ORDER BY template_code;
-- -- expected: 0 rows
