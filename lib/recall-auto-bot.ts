// ============================================================
// lib/recall-auto-bot.ts
// Auto-schedule Recall.ai bots for coaching sessions
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';
const RECALL_API_KEY = process.env.RECALL_API_KEY;

interface ScheduleBotParams {
  sessionId: string;
  childId: string;
  coachId: string;
  childName: string;
  meetingUrl: string;        // Google Meet link
  scheduledTime: Date;       // When the session starts
  sessionType: 'coaching' | 'parent_checkin';
}

interface BotResponse {
  success: boolean;
  botId?: string;
  error?: string;
}

/**
 * Create a Recall.ai bot for a single session
 */
export async function createRecallBot(params: ScheduleBotParams): Promise<BotResponse> {
  const {
    sessionId,
    childId,
    coachId,
    childName,
    meetingUrl,
    scheduledTime,
    sessionType,
  } = params;

  if (!RECALL_API_KEY) {
    console.error('RECALL_API_KEY not configured');
    return { success: false, error: 'RECALL_API_KEY not configured' };
  }

  if (!meetingUrl) {
    console.error('No meeting URL provided for session:', sessionId);
    return { success: false, error: 'No meeting URL provided' };
  }

  try {
    // Create bot via Recall.ai API
    const response = await fetch(`${RECALL_API_URL}/bot`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: `rAI by Yestoryd - ${childName} - ${sessionType === 'coaching' ? 'Coaching' : 'Check-in'}`,
        
        // Join 1 minute before scheduled time
        join_at: new Date(scheduledTime.getTime() - 60000).toISOString(),
        
        // Automatic leave settings
        automatic_leave: {
          waiting_room_timeout: 600,     // 10 min in waiting room
          noone_joined_timeout: 300,     // 5 min if no one joins
          everyone_left_timeout: 60,     // 1 min after everyone leaves
        },
        
        // Custom metadata for webhook processing
        metadata: {
          session_id: sessionId,
          child_id: childId,
          coach_id: coachId,
          child_name: childName,
          session_type: sessionType,
          platform: 'yestoryd',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Recall.ai bot creation failed:', errorData);
      return { success: false, error: errorData.detail || 'Bot creation failed' };
    }

    const botData = await response.json();
    console.log(`🤖 Recall bot created: ${botData.id} for session ${sessionId}`);

    // Store bot info in recall_bot_sessions table
    await supabase.from('recall_bot_sessions').insert({
      bot_id: botData.id,
      session_id: sessionId,
      child_id: childId,
      coach_id: coachId,
      meeting_url: meetingUrl,
      status: 'scheduled',
      scheduled_join_time: scheduledTime.toISOString(),
      metadata: {
        session_type: sessionType,
        child_name: childName,
      },
    });

    // Update scheduled_session with bot info
    await supabase
      .from('scheduled_sessions')
      .update({
        recall_bot_id: botData.id,
        recall_status: 'scheduled',
      })
      .eq('id', sessionId);

    return { success: true, botId: botData.id };

  } catch (error: any) {
    console.error('Error creating Recall bot:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule Recall.ai bots for all sessions after payment
 * Called from /api/sessions/confirm or /api/payment/verify
 */
export async function scheduleBotsForEnrollment(enrollmentId: string): Promise<{
  success: boolean;
  botsCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let botsCreated = 0;

  try {
    // Get all sessions for this enrollment that have Google Meet links
    const { data: sessions, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        child_id,
        coach_id,
        session_type,
        scheduled_date,
        scheduled_time,
        google_meet_link,
        children (name)
      `)
      .eq('enrollment_id', enrollmentId)
      .not('google_meet_link', 'is', null);

    if (error) {
      console.error('Error fetching sessions:', error);
      return { success: false, botsCreated: 0, errors: [error.message] };
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions with Meet links found for enrollment:', enrollmentId);
      return { success: true, botsCreated: 0, errors: [] };
    }

    console.log(`📅 Scheduling ${sessions.length} Recall bots for enrollment ${enrollmentId}`);

    // Create bot for each session
    for (const session of sessions) {
      // Combine date and time to get scheduled datetime
      const scheduledDateTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
      
      // Skip sessions in the past
      if (scheduledDateTime < new Date()) {
        console.log(`Skipping past session: ${session.id}`);
        continue;
      }

      const childName = (session.children as any)?.name || 'Child';

      const result = await createRecallBot({
        sessionId: session.id,
        childId: session.child_id,
        coachId: session.coach_id,
        childName: childName,
        meetingUrl: session.google_meet_link,
        scheduledTime: scheduledDateTime,
        sessionType: session.session_type as 'coaching' | 'parent_checkin',
      });

      if (result.success) {
        botsCreated++;
      } else {
        errors.push(`Session ${session.id}: ${result.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ Created ${botsCreated}/${sessions.length} Recall bots`);

    return { success: true, botsCreated, errors };

  } catch (error: any) {
    console.error('Error scheduling bots:', error);
    return { success: false, botsCreated, errors: [error.message] };
  }
}

/**
 * Cancel a Recall.ai bot (e.g., if session is rescheduled)
 */
export async function cancelRecallBot(botId: string): Promise<boolean> {
  if (!RECALL_API_KEY) {
    console.error('RECALL_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    if (response.ok) {
      console.log(`🗑️ Recall bot cancelled: ${botId}`);
      
      // Update database
      await supabase
        .from('recall_bot_sessions')
        .update({ status: 'cancelled' })
        .eq('bot_id', botId);

      await supabase
        .from('scheduled_sessions')
        .update({ recall_status: 'cancelled' })
        .eq('recall_bot_id', botId);

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error cancelling bot:', error);
    return false;
  }
}