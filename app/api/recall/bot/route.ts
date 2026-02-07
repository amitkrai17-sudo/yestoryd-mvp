// ============================================================
// app/api/recall/bot/route.ts
// Create, get, and delete Recall.ai bots
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';
const RECALL_API_KEY = process.env.RECALL_API_KEY;

// GET - Check bot status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const botId = searchParams.get('bot_id');

  if (botId) {
    // Get bot status from Recall.ai
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const botData = await response.json();
    return NextResponse.json(botData);
  }

  if (sessionId) {
    // Get bot info from our database
    const { data, error } = await supabase
      .from('recall_bot_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'No bot found for session' }, { status: 404 });
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'session_id or bot_id required' }, { status: 400 });
}

// POST - Create a new bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      meetingUrl,
      sessionId,
      childId,
      coachId,
      childName,
      sessionType,
      scheduledTime,
    } = body;

    if (!meetingUrl) {
      return NextResponse.json(
        { error: 'Meeting URL is required' },
        { status: 400 }
      );
    }

    // Create bot with Recall.ai
    const botResponse = await fetch(`${RECALL_API_URL}/bot`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: `rAI by Yestoryd - ${childName || 'Session'} - ${sessionType === 'coaching' ? 'Coaching' : 'Check-in'}`,
        
        // Join configuration
        join_at: scheduledTime || new Date().toISOString(),
        
        // Automatic leave settings
        automatic_leave: {
          waiting_room_timeout: 600,     // 10 min in waiting room
          noone_joined_timeout: 300,     // 5 min if no one joins
          everyone_left_timeout: 60,     // 1 min after everyone leaves
        },
        
        // Custom metadata
        metadata: {
          session_id: sessionId,
          child_id: childId,
          coach_id: coachId,
          session_type: sessionType,
          platform: 'yestoryd',
        },
      }),
    });

    if (!botResponse.ok) {
      const errorData = await botResponse.json();
      console.error('Recall.ai error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create bot', details: errorData },
        { status: botResponse.status }
      );
    }

    const botData = await botResponse.json();
    console.log('🤖 Bot created:', botData.id);

    // Store bot info in database
    await supabase.from('recall_bot_sessions').insert({
      bot_id: botData.id,
      session_id: sessionId,
      child_id: childId,
      coach_id: coachId,
      meeting_url: meetingUrl,
      status: 'created',
      scheduled_join_time: scheduledTime,
      metadata: {
        session_type: sessionType,
        child_name: childName,
      },
    });

    // Update scheduled_session with bot info
    if (sessionId) {
      await supabase
        .from('scheduled_sessions')
        .update({ 
          recall_bot_id: botData.id,
          recall_status: 'scheduled',
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      bot_id: botData.id,
      status: botData.status_changes?.[0]?.code || 'created',
      join_at: scheduledTime,
    });

  } catch (error: any) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a bot
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('bot_id');

  if (!botId) {
    return NextResponse.json({ error: 'bot_id required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    if (response.ok) {
      // Update our database
      await supabase
        .from('recall_bot_sessions')
        .update({ status: 'cancelled' })
        .eq('bot_id', botId);

      await supabase
        .from('scheduled_sessions')
        .update({ recall_status: 'cancelled' })
        .eq('recall_bot_id', botId);

      return NextResponse.json({ success: true, message: 'Bot cancelled' });
    }

    return NextResponse.json({ error: 'Failed to cancel bot' }, { status: response.status });

  } catch (error: any) {
    console.error('Error cancelling bot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}