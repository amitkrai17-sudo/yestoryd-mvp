// ============================================================================
// SCHEDULING NOTIFICATION MANAGER
// lib/scheduling/notification-manager.ts
// ============================================================================
//
// Unified notifications for all scheduling events.
// Uses existing lib/communication for WhatsApp/email delivery.
//
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { sendCommunication, sendAdminAlert } from '@/lib/communication';

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Pre-fetch a template by template_code to check wa_approved status.
 * Matches the query pattern in lib/communication/index.ts:
 *   SELECT * FROM communication_templates WHERE template_code = $1 AND is_active = true
 */
async function fetchTemplate(templateCode: string): Promise<{
  exists: boolean;
  waApproved: boolean;
} | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('communication_templates')
      .select('id, template_code, wa_approved, is_active')
      .eq('template_code', templateCode)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      exists: true,
      waApproved: data.wa_approved === true,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type SchedulingEvent =
  | 'session.scheduled'
  | 'session.rescheduled'
  | 'session.cancelled'
  | 'coach.reassigned'
  | 'session.manual_needed'
  | 'enrollment.at_risk';

export interface NotificationData {
  // Common
  childId?: string;
  childName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentName?: string;
  coachName?: string;
  enrollmentId?: string;
  sessionId?: string;

  // Session-specific
  sessionDate?: string;
  sessionTime?: string;
  sessionType?: string;
  meetLink?: string;

  // Reschedule
  oldDate?: string;
  oldTime?: string;
  newDate?: string;
  newTime?: string;
  reason?: string;

  // Reassignment
  oldCoachName?: string;
  newCoachName?: string;
  isTemporary?: boolean;
  expectedReturnDate?: string;

  // At-risk
  consecutiveNoShows?: number;
  totalNoShows?: number;

  // Manual queue
  failureReason?: string;
  attemptsMade?: number;
}

// ============================================================================
// TEMPLATE MAPPING
// ============================================================================

// Maps scheduling events to communication_templates.template_code
const EVENT_TEMPLATES: Record<SchedulingEvent, {
  parent?: string;
  coach?: string;
  admin?: string;
}> = {
  'session.scheduled': {
    parent: 'P_session_scheduled',
    coach: 'C_session_scheduled',
  },
  'session.rescheduled': {
    parent: 'P_session_rescheduled',
    coach: 'C_session_rescheduled',
  },
  'session.cancelled': {
    parent: 'P_session_cancelled',
    coach: 'C_session_cancelled',
  },
  'coach.reassigned': {
    parent: 'P_coach_reassigned',
    admin: 'A_coach_reassigned',
  },
  'session.manual_needed': {
    admin: 'A_manual_scheduling_needed',
  },
  'enrollment.at_risk': {
    admin: 'A_enrollment_at_risk',
  },
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Send notifications for a scheduling event.
 * Sends to all applicable recipients (parent, coach, admin) based on event type.
 */
export async function notify(
  event: SchedulingEvent,
  data: NotificationData
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const templates = EVENT_TEMPLATES[event];
  if (!templates) {
    console.warn(`[NotificationManager] No templates for event: ${event}`);
    return { sent: 0, failed: 0, errors: [`Unknown event: ${event}`] };
  }

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  const variables = buildVariables(data);

  // Send to parent
  if (templates.parent && (data.parentPhone || data.parentEmail)) {
    try {
      const skipChannels: ('whatsapp' | 'email' | 'sms')[] = [];

      // Pre-check template: skip WhatsApp if wa_approved is false
      const templateInfo = await fetchTemplate(templates.parent);
      if (!templateInfo) {
        console.warn(`[NotificationManager] Template not found: ${templates.parent}`);
        results.failed++;
        results.errors.push(`Parent template not found: ${templates.parent}`);
      } else {
        if (!templateInfo.waApproved) {
          console.warn(`[NotificationManager] WhatsApp not approved for template: ${templates.parent}, skipping WhatsApp`);
          skipChannels.push('whatsapp');
        }

        const result = await sendCommunication({
          templateCode: templates.parent,
          recipientType: 'parent',
          recipientPhone: data.parentPhone,
          recipientEmail: data.parentEmail,
          recipientName: data.parentName,
          variables,
          relatedEntityType: 'session',
          relatedEntityId: data.sessionId,
          skipChannels: skipChannels.length > 0 ? skipChannels : undefined,
        });

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Parent notification failed for ${event}`);
        }
      }
    } catch (error: any) {
      results.failed++;
      results.errors.push(`Parent: ${error.message}`);
    }
  }

  // Send to coach
  if (templates.coach && data.coachName) {
    try {
      const skipChannels: ('whatsapp' | 'email' | 'sms')[] = [];

      const templateInfo = await fetchTemplate(templates.coach);
      if (!templateInfo) {
        console.warn(`[NotificationManager] Template not found: ${templates.coach}`);
        results.failed++;
        results.errors.push(`Coach template not found: ${templates.coach}`);
      } else {
        if (!templateInfo.waApproved) {
          console.warn(`[NotificationManager] WhatsApp not approved for template: ${templates.coach}, skipping WhatsApp`);
          skipChannels.push('whatsapp');
        }

        const result = await sendCommunication({
          templateCode: templates.coach,
          recipientType: 'coach',
          variables,
          relatedEntityType: 'session',
          relatedEntityId: data.sessionId,
          skipChannels: skipChannels.length > 0 ? skipChannels : undefined,
        });

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Coach notification failed for ${event}`);
        }
      }
    } catch (error: any) {
      results.failed++;
      results.errors.push(`Coach: ${error.message}`);
    }
  }

  // Send to admin
  if (templates.admin) {
    try {
      const templateInfo = await fetchTemplate(templates.admin);
      if (!templateInfo) {
        console.warn(`[NotificationManager] Template not found: ${templates.admin}`);
        results.failed++;
        results.errors.push(`Admin template not found: ${templates.admin}`);
      } else {
        const result = await sendAdminAlert(
          templates.admin,
          variables,
          data.enrollmentId ? 'enrollment' : 'session',
          data.enrollmentId || data.sessionId
        );

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Admin notification failed for ${event}`);
        }
      }
    } catch (error: any) {
      results.failed++;
      results.errors.push(`Admin: ${error.message}`);
    }
  }

  if (results.errors.length > 0) {
    console.warn(`[NotificationManager] ${event}: ${results.sent} sent, ${results.failed} failed`, results.errors);
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildVariables(data: NotificationData): Record<string, string> {
  const vars: Record<string, string> = {};

  if (data.childName) vars.child_name = data.childName;
  if (data.parentName) vars.parent_name = data.parentName;
  if (data.coachName) vars.coach_name = data.coachName;
  if (data.sessionDate) vars.session_date = data.sessionDate;
  if (data.sessionTime) vars.session_time = data.sessionTime;
  if (data.sessionType) vars.session_type = data.sessionType;
  if (data.meetLink) vars.meet_link = data.meetLink;
  if (data.oldDate) vars.old_date = data.oldDate;
  if (data.oldTime) vars.old_time = data.oldTime;
  if (data.newDate) vars.new_date = data.newDate;
  if (data.newTime) vars.new_time = data.newTime;
  if (data.reason) vars.reason = data.reason;
  if (data.oldCoachName) vars.old_coach_name = data.oldCoachName;
  if (data.newCoachName) vars.new_coach_name = data.newCoachName;
  if (data.failureReason) vars.failure_reason = data.failureReason;
  if (data.consecutiveNoShows !== undefined) vars.consecutive_no_shows = String(data.consecutiveNoShows);
  if (data.totalNoShows !== undefined) vars.total_no_shows = String(data.totalNoShows);
  if (data.attemptsMade !== undefined) vars.attempts_made = String(data.attemptsMade);
  if (data.isTemporary !== undefined) vars.is_temporary = data.isTemporary ? 'Yes' : 'No';
  if (data.expectedReturnDate) vars.expected_return_date = data.expectedReturnDate;
  if (data.enrollmentId) vars.enrollment_id = data.enrollmentId;
  if (data.sessionId) vars.session_id = data.sessionId;

  return vars;
}
