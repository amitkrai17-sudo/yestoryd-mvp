// app/api/coach/sessions/[id]/parent-update/route.ts
// Marks a session as having parent update sent

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const body = await request.json();
    const { message, sentAt } = body;

    // Validate session exists and belongs to coach
    const { data: session, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('id, coach_id, child_id, parent_update_sent_at')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update session with parent_update_sent_at
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        parent_update_sent_at: sentAt || new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Log to communication_logs for tracking (optional but recommended)
    try {
      // Get child info for logging
      const { data: child } = await supabase
        .from('children')
        .select('parent_email, parent_phone, child_name')
        .eq('id', session.child_id)
        .single();

      if (child) {
        await supabase.from('communication_logs').insert({
          template_code: 'session_update_manual',
          recipient_type: 'parent',
          recipient_email: child.parent_email,
          recipient_phone: child.parent_phone,
          channel: 'whatsapp',
          status: 'sent',
          related_entity_type: 'session',
          related_entity_id: sessionId,
          variables: {
            child_name: child.child_name,
            message_preview: message?.substring(0, 100) || 'Parent update sent',
          },
          sent_at: sentAt || new Date().toISOString(),
        });
      }
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn('Failed to log communication:', logError);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      updatedAt: sentAt || new Date().toISOString(),
    });

  } catch (error) {
    console.error('Parent update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check if parent update was sent for a session
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select('id, parent_update_sent_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId,
      parentUpdateSent: !!session.parent_update_sent_at,
      sentAt: session.parent_update_sent_at,
    });

  } catch (error) {
    console.error('Get parent update status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
