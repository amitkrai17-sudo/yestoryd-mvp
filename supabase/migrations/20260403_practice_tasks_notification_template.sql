-- Migration: Add P22_practice_tasks_assigned communication template
-- Email notification sent to parents after session completion when practice tasks are generated

INSERT INTO communication_templates (
  template_code, name, description, journey, stage, recipient_type,
  use_whatsapp, use_email, use_sms,
  wa_approved,
  email_subject,
  email_body_html,
  required_variables,
  priority, is_active,
  notes
) VALUES (
  'P22_practice_tasks_assigned',
  'Practice Tasks Assigned',
  'Notifies parent that new practice tasks have been assigned after a session',
  'active_enrollment',
  'session_complete',
  'parent',
  false, true, false,
  false,
  'New practice tasks for {{child_name}}',
  '<p>Hi {{parent_first_name}},</p><p>{{task_count}} new practice tasks have been assigned for {{child_name}} after today''s session.</p><p>Open your dashboard to view and complete them:</p><p><a href="{{dashboard_link}}">View Practice Tasks</a></p><p>Regular practice between sessions makes a big difference!</p><p>Team Yestoryd</p>',
  ARRAY['parent_first_name', 'child_name', 'task_count', 'dashboard_link'],
  5, true,
  'Email-only for now. WA template pending AiSensy approval. Sent after session completion when daily tasks are generated.'
) ON CONFLICT (template_code) DO NOTHING;
