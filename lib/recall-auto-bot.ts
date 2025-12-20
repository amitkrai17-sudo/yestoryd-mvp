// file: lib/recall-auto-bot.ts
// Utility to automatically create Recall.ai bots when sessions are scheduled
// Called after Google Calendar event creation

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';

interface SessionInfo {
  sessionId: string;
  childId: string;
  coachId: string;
  childName: string;
  sessionType: 'coaching' | 'parent_checkin' | 'remedial';
  meetLink: string;
  scheduledTime: Date;
}

/**
 * Create a Recall.ai bot for a scheduled session
 * Call this after creating Google Calendar event
 */
export async function createRecallBot(session: SessionInfo): Promise<{ 
  success: boolean; 
  botId?: string; 
  error?: string;
}> {
  try {
    // Skip if no API key configured
    if (!RECALL_API_KEY) {
      console.log('Recall.ai not configured, skipping bot creation');
      return { success: false, error: 'RECALL_API_KEY not configured' };
    }

    // Create bot
    const response = await fetch(`${RECALL_API_URL}/bot`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: session.meetLink,
        bot_name: `Yestoryd - ${session.childName} Recording`,
        
        // Join 1 minute before scheduled time
        join_at: new Date(session.scheduledTime.getTime() - 60000).toISOString(),
        
        transcription_options: {
          provider: 'default',
        },
        
        recording_mode: 'speaker_view',
        
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 300,
          everyone_left_timeout: 60,
        },
        
        metadata: {
          session_id: session.sessionId,
          child_id: session.childId,
          coach_id: session.coachId,
          session_type: session.sessionType,
          platform: 'yestoryd',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Recall.ai bot creation failed:', errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    const botData = await response.json();
    console.log('🤖 Recall bot created:', botData.id);

    // Store in database
    await supabase.from('recall_bot_sessions').insert({
      bot_id: botData.id,
      session_id: session.sessionId,
      child_id: session.childId,
      coach_id: session.coachId,
      meeting_url: session.meetLink,
      status: 'created',
      scheduled_join_time: session.scheduledTime.toISOString(),
      metadata: {
        session_type: session.sessionType,
        child_name: session.childName,
      },
    });

    // Update session with bot ID
    await supabase
      .from('scheduled_sessions')
      .update({ recall_bot_id: botData.id })
      .eq('id', session.sessionId);

    return { success: true, botId: botData.id };

  } catch (error) {
    console.error('Recall bot creation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create bots for all sessions in a batch (e.g., after enrollment)
 */
export async function createBotsForEnrollment(enrollmentId: string): Promise<{
  created: number;
  failed: number;
  errors: string[];
}> {
  const results = { created: 0, failed: 0, errors: [] as string[] };

  // Get all sessions for this enrollment
  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      child_id,
      coach_id,
      session_type,
      scheduled_date,
      scheduled_time,
      meet_link,
      child:children(name)
    `)
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'scheduled')
    .is('recall_bot_id', null);

  if (error || !sessions) {
    return { created: 0, failed: 0, errors: [error?.message || 'No sessions found'] };
  }

  // Create bot for each session
  for (const session of sessions) {
    const child = session.child as any;
    
    // Parse scheduled datetime
    const scheduledTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    
    // Skip if session is in the past
    if (scheduledTime < new Date()) {
      continue;
    }

    const result = await createRecallBot({
      sessionId: session.id,
      childId: session.child_id,
      coachId: session.coach_id,
      childName: child?.name || 'Unknown',
      sessionType: session.session_type as any,
      meetLink: session.meet_link,
      scheduledTime,
    });

    if (result.success) {
      results.created++;
    } else {
      results.failed++;
      results.errors.push(`Session ${session.id}: ${result.error}`);
    }

    // Rate limit - wait 500ms between bot creations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Cancel a bot (e.g., when session is rescheduled)
 */
export async function cancelRecallBot(botId: string): Promise<boolean> {
  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    await supabase
      .from('recall_bot_sessions')
      .update({ status: 'cancelled' })
      .eq('bot_id', botId);

    return response.ok;
  } catch (error) {
    console.error('Cancel bot error:', error);
    return false;
  }
}

/**
 * Get bot status for a session
 */
export async function getBotStatus(sessionId: string): Promise<{
  status: string;
  recordingUrl?: string;
  error?: string;
} | null> {
  const { data } = await supabase
    .from('recall_bot_sessions')
    .select('status, recording_url, error_message')
    .eq('session_id', sessionId)
    .single();

  if (!data) return null;

  return {
    status: data.status,
    recordingUrl: data.recording_url,
    error: data.error_message,
  };
}
