// ============================================================
// FILE: lib/triggers/goals-capture.ts
// ============================================================
// Trigger functions for parent goals capture flow
// Sends P7 WhatsApp template 30 minutes after assessment
// if goals were not captured on results page
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';

const P7_TEMPLATE_NAME = 'p7_goals_capture_1';

interface GoalsCaptureResult {
  success: boolean;
  action: 'sent' | 'skipped' | 'error';
  reason?: string;
  messageId?: string;
}

/**
 * Check if a child needs the goals capture message
 * Returns true if:
 * - parent_goals is empty or null
 * - goals_message_sent is false or null
 */
export async function shouldSendGoalsMessage(childId: string): Promise<boolean> {
  const { data: child, error } = await supabaseAdmin
    .from('children')
    .select('parent_goals, goals_message_sent')
    .eq('id', childId)
    .single();

  if (error || !child) {
    console.error('[GoalsCapture] Failed to fetch child:', error);
    return false;
  }

  // Skip if goals already captured
  if (child.parent_goals && child.parent_goals.length > 0) {
    return false;
  }

  // Skip if message already sent
  if (child.goals_message_sent) {
    return false;
  }

  return true;
}

/**
 * Send P7 goals capture WhatsApp message to a parent
 */
export async function sendGoalsCaptureMessage(childId: string): Promise<GoalsCaptureResult> {
  try {
    // Fetch child with parent info
    const { data: child, error: fetchError } = await supabaseAdmin
      .from('children')
      .select('id, name, parent_name, parent_phone, parent_goals, goals_message_sent')
      .eq('id', childId)
      .single();

    if (fetchError || !child) {
      return {
        success: false,
        action: 'error',
        reason: `Child not found: ${fetchError?.message || 'Unknown error'}`,
      };
    }

    // Check if goals already captured
    if (child.parent_goals && child.parent_goals.length > 0) {
      return {
        success: true,
        action: 'skipped',
        reason: 'Goals already captured on results page',
      };
    }

    // Check if message already sent
    if (child.goals_message_sent) {
      return {
        success: true,
        action: 'skipped',
        reason: 'Goals message already sent',
      };
    }

    // Validate phone number
    if (!child.parent_phone) {
      return {
        success: false,
        action: 'error',
        reason: 'No parent phone number',
      };
    }

    // Extract first name
    const parentFirstName = child.parent_name?.split(' ')[0] || 'Parent';
    const childName = child.name || 'your child';

    // Send WhatsApp message via AiSensy
    // Template: p7_goals_capture_1
    // Variables: {{1}}=parent_name, {{2}}=child_name, {{3}}=child_name, {{4}}=coach_name
    const result = await sendWhatsAppMessage({
      to: child.parent_phone,
      templateName: P7_TEMPLATE_NAME,
      variables: [
        parentFirstName,  // {{1}} Parent name
        childName,        // {{2}} Child name (first mention)
        childName,        // {{3}} Child name (second mention)
        'Our Coach',      // {{4}} Coach name
      ],
    });

    if (result.success) {
      // Mark message as sent
      await supabaseAdmin
        .from('children')
        .update({
          goals_message_sent: true,
          goals_message_sent_at: new Date().toISOString(),
        })
        .eq('id', childId);

      return {
        success: true,
        action: 'sent',
        messageId: result.messageId,
      };
    } else {
      return {
        success: false,
        action: 'error',
        reason: result.error || 'WhatsApp send failed',
      };
    }
  } catch (error) {
    console.error('[GoalsCapture] Exception:', error);
    return {
      success: false,
      action: 'error',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find children who need goals capture message
 * Criteria:
 * - Assessment completed 30-35 minutes ago
 * - parent_goals is empty or null
 * - goals_message_sent is false or null
 * - Has valid parent_phone
 */
export async function findChildrenNeedingGoalsMessage(): Promise<any[]> {
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const thirtyFiveMinAgo = new Date(now.getTime() - 35 * 60 * 1000);

  // Query children who:
  // - Have assessment_completed_at between 30-35 min ago
  // - Have empty or null parent_goals
  // - Have goals_message_sent = false or null
  // - Have a valid parent_phone
  const { data: children, error } = await supabaseAdmin
    .from('children')
    .select('id, name, parent_name, parent_phone, parent_goals, goals_message_sent, assessment_completed_at, created_at')
    .or('parent_goals.is.null,parent_goals.eq.{}')
    .or('goals_message_sent.is.null,goals_message_sent.eq.false')
    .not('parent_phone', 'is', null)
    .not('parent_phone', 'eq', '')
    .gte('assessment_completed_at', thirtyFiveMinAgo.toISOString())
    .lte('assessment_completed_at', thirtyMinAgo.toISOString())
    .order('assessment_completed_at', { ascending: true });

  if (error) {
    console.error('[GoalsCapture] Query error:', error);
    return [];
  }

  return children || [];
}
