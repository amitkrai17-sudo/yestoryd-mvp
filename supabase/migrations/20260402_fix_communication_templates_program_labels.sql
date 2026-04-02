-- Migration: 20260402_fix_communication_templates_program_labels
-- Purpose: Update P14 payment confirmed template and WA templates to use
--          dynamic program labels instead of hardcoded "reading coaching program"
-- Author: Amit / Claude Code
-- Related: Communication audit — 64 hardcoded references

-- ═══════════════════════════════════════════════════
-- 1. P14_payment_confirmed — email template
-- ═══════════════════════════════════════════════════

UPDATE communication_templates
SET
  email_subject = 'Welcome to Yestoryd! Payment Confirmed',
  email_body_html = '<p>Hi {{parent_name}},</p>
    <p>Thank you! Your payment of <strong>₹{{amount}}</strong> for {{child_name}}''s {{program_label}} has been received.</p>
    <p><strong>What happens next:</strong></p>
    <ol>
    <li>Coach {{coach_name}} will be assigned within 24 hours</li>
    <li>{{schedule_description}}</li>
    <li>Access your parent dashboard to track progress</li>
    </ol>
    <p><a href="{{dashboard_link}}" style="background:#FF0099;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;">Go to Dashboard</a></p>
    <p>Welcome to the Yestoryd family!<br>Team Yestoryd</p>',
  required_variables = ARRAY['parent_name', 'child_name', 'amount', 'coach_name', 'dashboard_link', 'program_label', 'schedule_description'],
  updated_at = NOW()
WHERE template_code = 'P14_payment_confirmed';

-- ═══════════════════════════════════════════════════
-- 2. WhatsApp templates — genericize program names
-- ═══════════════════════════════════════════════════

-- discovery-payment-link: "3-month coaching program" → "personalized learning program"
UPDATE whatsapp_templates
SET
  template = E'Hi {{parentName}}! \U0001F44B\r\n\r\nThank you for the wonderful conversation about {{childName}}''s learning journey.\r\n\r\nAs discussed, here''s the enrollment link for our personalized learning program:\r\n\r\n\U0001F517 {{paymentLink}}\r\n\r\nProgram includes:\r\n\u2705 Personalized coaching sessions\r\n\u2705 Parent check-ins\r\n\u2705 Free access to eLearning library\r\n\u2705 Free storytelling sessions\r\n\r\nLooking forward to working with {{childName}}! \U0001F4DA\r\n\r\n- {{coachName}}, Yestoryd',
  updated_at = NOW()
WHERE slug = 'discovery-payment-link';

-- coach-introduction: "3-month Reading Program" → "learning program"
UPDATE whatsapp_templates
SET
  template = E'Hi {{parentName}}! \U0001F389\r\n\r\nGreat news - {{childName}} is officially enrolled in our learning program!\r\n\r\nMeet your coach:\r\n\U0001F469\u200D\U0001F3EB {{coachName}}\r\n\U0001F4E7 {{coachEmail}}\r\n\U0001F4F1 {{coachPhone}}\r\n\r\nYour first session: {{firstSessionDate}} at {{firstSessionTime}}\r\n\r\nAccess your dashboard anytime:\r\n\U0001F517 {{dashboardLink}}\r\n\r\nWelcome to the Yestoryd family! \U0001F4DA\r\n\r\nQuestions? Just reply here!',
  updated_at = NOW()
WHERE slug = 'coach-introduction';
