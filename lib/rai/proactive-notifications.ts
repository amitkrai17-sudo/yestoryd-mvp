// file: lib/rai/proactive-notifications.ts
// ENHANCED v2.1 - Smart Proactive Triggers with Recurring Struggle Detection

import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '918976287997';

interface SessionAnalysis {
  progress_rating?: string;
  flagged_for_attention?: boolean;
  flag_reason?: string | null;
  concerns_noted?: string | null;
  concerns_array?: string[] | null;
  engagement_level?: string;
  breakthrough_moment?: string | null;
  focus_area?: string;
  child_name?: string | null;
  summary?: string;
  parent_summary?: string;
  safety_flag?: boolean;
  safety_reason?: string | null;
  sentiment_score?: number;
  skills_worked_on?: string[];
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

interface PreviousSession {
  id: string;
  focus_area: string | null;
  progress_rating: string | null;
  concerns_noted: string | null;
  skills_worked_on: string[] | null;
  scheduled_date: string;
}

interface Trigger {
  type: 'safety' | 'recurring_struggle' | 'progress_drop' | 'low_engagement' | 'milestone' | 'flagged' | 'concern';
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  notifyAdmin: boolean;
  notifyCoach: boolean;
  notifyParent: boolean;
  recurringSkill?: string;
}

export async function checkAndSendProactiveNotifications(
  context: TriggerContext
): Promise<NotificationResult> {
  const result: NotificationResult = { sent: false, notifications: [], errors: [] };
  const { childId, childName, sessionId, coachId, analysis } = context;

  try {
    const { data: child } = await supabase
      .from('children')
      .select(`id, child_name, parent_email, parent_phone, coach_id,
        coach:coaches!coach_id (id, name, email, phone)`)
      .eq('id', childId)
      .single();

    if (!child) {
      result.errors.push('Child not found');
      return result;
    }

    const coach = child.coach as any;
    const previousSessions = await getRecentSessions(childId, 3);
    const triggers = detectSmartTriggers(analysis, previousSessions, childName);

    if (triggers.length === 0) {
      console.log('No proactive triggers detected');
      return result;
    }

    console.log('Proactive triggers detected:', triggers.map(t => t.type).join(', '));

    for (const trigger of triggers) {
      if (sessionId) {
        const { data: existing } = await supabase
          .from('proactive_notifications')
          .select('id')
          .eq('session_id', sessionId)
          .eq('notification_type', trigger.type)
          .eq('recipient_role', trigger.notifyAdmin ? 'admin' : trigger.notifyCoach ? 'coach' : 'parent')
          .single();
        if (existing) {
          console.log('Already notified for', trigger.type);
          continue;
        }
      }

      if (trigger.notifyAdmin) {
        const msg = formatAdminMessage(trigger, childName, analysis, coach?.name);
        const sent = await sendWhatsApp(ADMIN_PHONE, msg);
        if (sent) {
          await logNotification({
            childId,
            sessionId,
            coachId: coach?.id,
            type: trigger.type,
            channel: 'whatsapp',
            recipientRole: 'admin',
            recipientPhone: ADMIN_PHONE,
            message: msg,
            triggerReason: trigger.reason,
            triggerData: { analysis, severity: trigger.severity },
          });
          result.notifications.push('Admin: ' + trigger.type + ' (' + trigger.severity + ')');
          result.sent = true;
        } else {
          result.errors.push('Failed admin: ' + trigger.type);
        }
      }

      if (coach?.phone && trigger.notifyCoach) {
        const msg = formatCoachMessage(trigger, childName, analysis);
        const sent = await sendWhatsApp(coach.phone, msg);
        if (sent) {
          await logNotification({
            childId,
            sessionId,
            coachId: coach.id,
            type: trigger.type,
            channel: 'whatsapp',
            recipientRole: 'coach',
            recipientPhone: coach.phone,
            message: msg,
            triggerReason: trigger.reason,
            triggerData: { analysis },
          });
          result.notifications.push('Coach (' + coach.name + '): ' + trigger.type);
          result.sent = true;
        } else {
          result.errors.push('Failed coach: ' + trigger.type);
        }
      }

      if (child.parent_phone && trigger.notifyParent) {
        const msg = formatParentMessage(trigger, childName, analysis);
        const sent = await sendWhatsApp(child.parent_phone, msg);
        if (sent) {
          await logNotification({
            childId,
            sessionId,
            coachId: coach?.id,
            type: trigger.type,
            channel: 'whatsapp',
            recipientRole: 'parent',
            recipientPhone: child.parent_phone,
            message: msg,
            triggerReason: trigger.reason,
            triggerData: { analysis },
          });
          result.notifications.push('Parent: ' + trigger.type);
          result.sent = true;
        } else {
          result.errors.push('Failed parent: ' + trigger.type);
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

async function getRecentSessions(childId: string, limit: number = 3): Promise<PreviousSession[]> {
  const { data } = await supabase
    .from('scheduled_sessions')
    .select('id, focus_area, progress_rating, concerns_noted, skills_worked_on, scheduled_date')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(limit);
  return data || [];
}

function detectSmartTriggers(
  analysis: SessionAnalysis,
  previousSessions: PreviousSession[],
  childName: string
): Trigger[] {
  const triggers: Trigger[] = [];

  // SAFETY (Critical)
  if (analysis.safety_flag || (analysis.sentiment_score !== undefined && analysis.sentiment_score < 0.3)) {
    triggers.push({
      type: 'safety',
      reason: analysis.safety_reason || 'Child showed signs of distress',
      severity: 'critical',
      notifyAdmin: true,
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // RECURRING STRUGGLE
  if (analysis.concerns_noted || analysis.concerns_array?.length) {
    const currentConcerns = analysis.concerns_array || (analysis.concerns_noted ? [analysis.concerns_noted] : []);
    const recurring = findRecurringStruggle(currentConcerns, analysis.skills_worked_on, previousSessions);
    if (recurring) {
      triggers.push({
        type: 'recurring_struggle',
        reason: childName + ' is still struggling with "' + recurring + '" across multiple sessions.',
        severity: 'high',
        notifyAdmin: false,
        notifyCoach: true,
        notifyParent: false,
        recurringSkill: recurring,
      });
    }
  }

  // PROGRESS DECLINED
  if (analysis.progress_rating === 'declined') {
    const prevDeclines = previousSessions.filter(s => s.progress_rating === 'declined').length;
    triggers.push({
      type: 'progress_drop',
      reason: prevDeclines > 0
        ? 'Progress declined for ' + (prevDeclines + 1) + ' consecutive sessions'
        : 'Progress rating declined',
      severity: prevDeclines > 0 ? 'high' : 'medium',
      notifyAdmin: prevDeclines > 0,
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // FLAGGED
  if (analysis.flagged_for_attention && !analysis.safety_flag) {
    triggers.push({
      type: 'flagged',
      reason: analysis.flag_reason || 'Session flagged for review',
      severity: 'high',
      notifyAdmin: false,
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // LOW ENGAGEMENT
  if (analysis.engagement_level === 'low') {
    const prevLow = previousSessions.some(s =>
      s.concerns_noted?.toLowerCase().includes('engagement')
    );
    triggers.push({
      type: 'low_engagement',
      reason: prevLow ? 'Consistently low engagement' : 'Low engagement this session',
      severity: prevLow ? 'medium' : 'low',
      notifyAdmin: prevLow,
      notifyCoach: true,
      notifyParent: false,
    });
  }

  // BREAKTHROUGH (Positive - Parent!)
  if (
    analysis.breakthrough_moment &&
    analysis.breakthrough_moment.length > 10 &&
    (analysis.progress_rating === 'significant_improvement' || analysis.progress_rating === 'improved')
  ) {
    triggers.push({
      type: 'milestone',
      reason: analysis.breakthrough_moment,
      severity: 'low',
      notifyAdmin: false,
      notifyCoach: false,
      notifyParent: true,
    });
  }

  // SIMPLE CONCERN
  const hasConcern = triggers.some(t =>
    ['recurring_struggle', 'safety', 'flagged'].includes(t.type)
  );
  if (!hasConcern && analysis.concerns_noted && analysis.concerns_noted.length > 10) {
    triggers.push({
      type: 'concern',
      reason: analysis.concerns_noted,
      severity: 'low',
      notifyAdmin: false,
      notifyCoach: true,
      notifyParent: false,
    });
  }

  return triggers;
}

function findRecurringStruggle(
  currentConcerns: string[],
  currentSkills: string[] | undefined,
  previousSessions: PreviousSession[]
): string | null {
  if (previousSessions.length < 2) return null;

  const keywords = [
    'consonant', 'blend', 'vowel', 'phonics', 'fluency', 'speed',
    'pronunciation', 'comprehension', 'sight', 'cvc', 'digraph',
    'reading', 'spelling', 'writing', 'focus', 'attention', 'confidence'
  ];

  const concernText = currentConcerns.join(' ').toLowerCase();
  const foundKeywords = keywords.filter(k => concernText.includes(k));

  let matchCount = 0;
  let matchedTopic = '';

  for (const session of previousSessions) {
    const prev = session.concerns_noted?.toLowerCase() || '';
    for (const kw of foundKeywords) {
      if (prev.includes(kw)) {
        matchCount++;
        matchedTopic = kw;
        break;
      }
    }
  }

  return matchCount >= 2 ? matchedTopic : null;
}

function formatAdminMessage(
  trigger: Trigger,
  childName: string,
  analysis: SessionAnalysis,
  coachName?: string
): string {
  if (trigger.type === 'safety') {
    let msg = '*URGENT: Safety Alert*\n\n';
    msg += '*Child:* ' + childName + '\n';
    msg += '*Coach:* ' + (coachName || 'Unknown') + '\n';
    msg += '*Severity:* CRITICAL\n\n';
    msg += '*Reason:* ' + trigger.reason + '\n';
    if (analysis.sentiment_score !== undefined) {
      msg += '*Sentiment:* ' + analysis.sentiment_score + '/1.0\n';
    }
    msg += '\nPlease review immediately.\n\nhttps://www.yestoryd.com/admin#';
    return msg;
  }

  let msg = '*Admin Alert*\n\n';
  msg += '*Child:* ' + childName + '\n';
  msg += '*Type:* ' + trigger.type + '\n';
  msg += '*Severity:* ' + trigger.severity + '\n\n';
  msg += trigger.reason + '\n\nhttps://www.yestoryd.com/admin#';
  return msg;
}

function formatCoachMessage(
  trigger: Trigger,
  childName: string,
  analysis: SessionAnalysis
): string {
  const url = 'https://www.yestoryd.com/coach/dashboard';

  switch (trigger.type) {
    case 'safety':
      return '*Urgent: ' + childName + '*\n\nSafety concern detected. Admin notified.\n\n*Details:* ' + trigger.reason + '\n\n' + url;

    case 'recurring_struggle':
      return '*Recurring Struggle*\n\n' + childName + ' is still stuck on *"' + trigger.recurringSkill + '"*.\n\nTry a different approach:\n- Visual aids or games\n- Smaller steps\n- Check for gaps\n\n' + url;

    case 'progress_drop':
      let msg = '*Progress Alert: ' + childName + '*\n\n' + trigger.reason;
      if (analysis.concerns_noted) {
        msg += '\n\n*Notes:* ' + analysis.concerns_noted;
      }
      return msg + '\n\n' + url;

    case 'flagged':
      return '*Flagged: ' + childName + '*\n\n*Reason:* ' + trigger.reason + '\n\nPlease review before next session.\n\n' + url;

    case 'low_engagement':
      return '*Engagement: ' + childName + '*\n\n' + trigger.reason + '\n\nTry: gamify, short break, change topic.\n\n' + url;

    case 'concern':
      return '*Note: ' + childName + '*\n\n"' + analysis.concerns_noted + '"\n\n' + url;

    default:
      return '*Update: ' + childName + '*\n\n' + trigger.reason + '\n\n' + url;
  }
}

function formatParentMessage(
  trigger: Trigger,
  childName: string,
  analysis: SessionAnalysis
): string {
  if (trigger.type === 'milestone') {
    return '*Wonderful News!*\n\n' + childName + ' had an amazing breakthrough!\n\n' + analysis.breakthrough_moment + '\n\nKeep encouraging them!\n\n- Team Yestoryd';
  }
  return '*Session Update*\n\n' + childName + ' completed today\'s session!\n\n' + (analysis.parent_summary || 'Keep up the daily reading!') + '\n\n- Team Yestoryd';
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('Twilio not configured');
    return false;
  }

  try {
    let formatted = phone.replace(/\D/g, '');
    if (!formatted.startsWith('91') && formatted.length === 10) {
      formatted = '91' + formatted;
    }
    const to = 'whatsapp:+' + formatted;

    const res = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_ACCOUNT_SID + '/Messages.json',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: to,
          Body: message,
        }),
      }
    );

    if (res.ok) {
      console.log('WhatsApp sent to ' + to);
      return true;
    }

    console.error('WhatsApp failed:', await res.text());
    return false;
  } catch (e) {
    console.error('WhatsApp error:', e);
    return false;
  }
}

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
  } catch (e) {
    console.error('Log notification failed:', e);
  }
}