// file: lib/rai/proactive-notifications.ts
// Sends proactive alerts to coaches and parents based on session analysis

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// ============================================================
// TYPES
// ============================================================

interface SessionAnalysis {
  progress_rating?: string;
  flagged_for_attention?: boolean;
  flag_reason?: string | null;
  concerns_noted?: string | null;
  engagement_level?: string;
  breakthrough_moment?: string | null;
  focus_area?: string;
  child_name?: string | null;
  summary?: string;
}

interface TriggerContext {
  childId: string;
  childName: string;
  sessionId?: string | null;
  coachId?: string | null;
  analysis: SessionAnalysis;
}

interface NotificationResult {
  sent: boolean;
  notifications: string[];
  errors: string[];
}

// ============================================================
// MAIN FUNCTION: Check and Send Proactive Notifications
// ============================================================

export async function checkAndSendProactiveNotifications(
  context: TriggerContext
): Promise<NotificationResult> {
  const result: NotificationResult = {
    sent: false,
    notifications: [],
    errors: [],
  };

  const { childId, childName, sessionId, coachId, analysis } = context;

  try {
    // Get coach and parent details
    const { data: child } = await supabase
      .from('children')
      .select(`
        id,
        child_name,
        parent_email,
        parent_phone,
        assigned_coach_id,
        coach:coaches!assigned_coach_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', childId)
      .single();

    if (!child) {
      result.errors.push('Child not found');
      return result;
    }

    const coach = child.coach as any;
    const triggers = detectTriggers(analysis);

    if (triggers.length === 0) {
      console.log('✅ No proactive triggers detected');
      return result;
    }

    console.log(`🚨 Proactive triggers detected: ${triggers.map(t => t.type).join(', ')}`);

    // Process each trigger
    for (const trigger of triggers) {
      // Check if already notified for this session + type
      if (sessionId) {
        const { data: existing } = await supabase
          .from('proactive_notifications')
          .select('id')
          .eq('session_id', sessionId)
          .eq('notification_type', trigger.type)
          .eq('recipient_role', 'coach')
          .single();

        if (existing) {
          console.log(`⏭️ Already notified for ${trigger.type}, skipping`);
          continue;
        }
      }

      // Send to Coach
      if (coach?.phone && trigger.notifyCoach) {
        const coachMessage = formatCoachMessage(trigger, childName, analysis);
        const sent = await sendWhatsApp(coach.phone, coachMessage);
        
        if (sent) {
          await logNotification({
            childId,
            sessionId,
            coachId: coach.id,
            type: trigger.type,
            channel: 'whatsapp',
            recipientRole: 'coach',
            recipientPhone: coach.phone,
            message: coachMessage,
            triggerReason: trigger.reason,
            triggerData: { analysis },
          });
          result.notifications.push(`Coach (${coach.name}): ${trigger.type}`);
          result.sent = true;
        } else {
          result.errors.push(`Failed to send to coach: ${trigger.type}`);
        }
      }

      // Send to Parent (softer message, only for certain triggers)
      if (child.parent_phone && trigger.notifyParent) {
        const parentMessage = formatParentMessage(trigger, childName, analysis);
        const sent = await sendWhatsApp(child.parent_phone, parentMessage);
        
        if (sent) {
          await logNotification({
            childId,
            sessionId,
            coachId: coach?.id,
            type: trigger.type,
            channel: 'whatsapp',
            recipientRole: 'parent',
            recipientPhone: child.parent_phone,
            message: parentMessage,
            triggerReason: trigger.reason,
            triggerData: { analysis },
          });
          result.notifications.push(`Parent: ${trigger.type}`);
          result.sent = true;
        } else {
          result.errors.push(`Failed to send to parent: ${trigger.type}`);
        }
      }
    }

    return result;

  } catch (error: any) {
    console.error('Proactive notification error:', error);
    result.errors.push(error.message);
    return result;
  }
}

// ============================================================
// TRIGGER DETECTION
// ============================================================

interface Trigger {
  type: 'concern' | 'progress_drop' | 'low_engagement' | 'milestone' | 'flagged';
  reason: string;
  severity: 'low' | 'medium' | 'high';
  notifyCoach: boolean;
  notifyParent: boolean;
}

function detectTriggers(analysis: SessionAnalysis): Trigger[] {
  const triggers: Trigger[] = [];

  // Trigger 1: Flagged for attention
  if (analysis.flagged_for_attention) {
    triggers.push({
      type: 'flagged',
      reason: analysis.flag_reason || 'Session flagged for review',
      severity: 'high',
      notifyCoach: true,
      notifyParent: false, // Don't alarm parents unnecessarily
    });
  }

  // Trigger 2: Progress declined
  if (analysis.progress_rating === 'declined') {
    triggers.push({
      type: 'progress_drop',
      reason: 'Progress rating declined from previous session',
      severity: 'medium',
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // Trigger 3: Concerns noted
  if (analysis.concerns_noted && analysis.concerns_noted.length > 5) {
    triggers.push({
      type: 'concern',
      reason: analysis.concerns_noted,
      severity: 'medium',
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // Trigger 4: Low engagement
  if (analysis.engagement_level === 'low') {
    triggers.push({
      type: 'low_engagement',
      reason: 'Child showed low engagement during session',
      severity: 'low',
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // Trigger 5: Breakthrough moment (positive!)
  if (analysis.breakthrough_moment && analysis.breakthrough_moment.length > 5) {
    triggers.push({
      type: 'milestone',
      reason: analysis.breakthrough_moment,
      severity: 'low',
      notifyCoach: false, // Coach already knows
      notifyParent: true, // Parents love hearing good news!
    });
  }

  return triggers;
}

// ============================================================
// MESSAGE FORMATTING
// ============================================================

function formatCoachMessage(trigger: Trigger, childName: string, analysis: SessionAnalysis): string {
  const baseUrl = 'https://www.yestoryd.com';
  
  switch (trigger.type) {
    case 'flagged':
      return `🚨 *Yestoryd Alert*

${childName}'s session was flagged for attention.

*Reason:* ${trigger.reason}

Please review the session transcript and prepare accordingly for the next class.

${baseUrl}/coach/dashboard`;

    case 'progress_drop':
      return `📉 *Yestoryd Update*

Heads up: ${childName}'s progress rating dropped in today's session.

${analysis.concerns_noted ? `*Notes:* ${analysis.concerns_noted}` : ''}

Consider adjusting the approach or revisiting fundamentals in the next session.

${baseUrl}/coach/dashboard`;

    case 'concern':
      return `⚠️ *Yestoryd Alert*

A concern was noted during ${childName}'s session:

"${analysis.concerns_noted}"

${analysis.focus_area ? `*Focus Area:* ${analysis.focus_area}` : ''}

Please review before the next session.

${baseUrl}/coach/dashboard`;

    case 'low_engagement':
      return `💡 *Yestoryd Insight*

${childName} showed low engagement in today's session.

Consider trying different activities or checking in about how they're feeling next time.

${baseUrl}/coach/dashboard`;

    default:
      return `📋 *Yestoryd Update*

Update regarding ${childName}'s session: ${trigger.reason}

${baseUrl}/coach/dashboard`;
  }
}

function formatParentMessage(trigger: Trigger, childName: string, analysis: SessionAnalysis): string {
  switch (trigger.type) {
    case 'milestone':
      return `🌟 *Great News from Yestoryd!*

${childName} had a breakthrough moment in today's reading session!

*What happened:* ${analysis.breakthrough_moment}

Keep encouraging ${childName} - they're making wonderful progress! 📚

- Team Yestoryd`;

    default:
      // Generic positive message for parents (we don't send negative alerts to parents)
      return `📚 *Yestoryd Update*

${childName} completed today's reading session.

${analysis.summary || 'Keep up the great work with daily reading practice!'}

- Team Yestoryd`;
  }
}

// ============================================================
// WHATSAPP SENDING (Twilio)
// ============================================================

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio credentials not configured, skipping WhatsApp');
    return false;
  }

  try {
    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }
    
    const toNumber = `whatsapp:+${formattedPhone}`;
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: toNumber,
          Body: message,
        }),
      }
    );

    if (response.ok) {
      console.log(`✅ WhatsApp sent to ${toNumber}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ WhatsApp failed: ${error}`);
      return false;
    }

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return false;
  }
}

// ============================================================
// NOTIFICATION LOGGING
// ============================================================

async function logNotification(data: {
  childId: string;
  sessionId?: string | null;
  coachId?: string | null;
  type: string;
  channel: string;
  recipientRole: string;
  recipientPhone?: string;
  recipientEmail?: string;
  message: string;
  triggerReason: string;
  triggerData: any;
}): Promise<void> {
  try {
    await supabase.from('proactive_notifications').insert({
      child_id: data.childId,
      session_id: data.sessionId,
      coach_id: data.coachId,
      notification_type: data.type,
      channel: data.channel,
      recipient_role: data.recipientRole,
      recipient_phone: data.recipientPhone,
      recipient_email: data.recipientEmail,
      message_sent: data.message,
      trigger_reason: data.triggerReason,
      trigger_data: data.triggerData,
      status: 'sent',
    });
    console.log(`📝 Notification logged: ${data.type} to ${data.recipientRole}`);
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}
