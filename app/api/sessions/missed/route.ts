// app/api/sessions/missed/route.ts
// Mark a session as missed (no-show)
// Hardened with proper validation and logging

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';

// ============================================================
// CONSTANTS
// ============================================================

const API_NAME = 'sessions-missed';
const VALID_PREVIOUS_STATUSES = ['scheduled', 'pending'];

// ============================================================
// TYPES
// ============================================================

interface MarkMissedRequest {
  sessionId: string;
  reason?: string;
  notifyParent?: boolean;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
}

function logError(context: string, error: unknown): void {
  console.error(`[${API_NAME}] ${context}:`, error instanceof Error ? error.message : error);
}

function logInfo(context: string, message: string): void {
  console.log(`[${API_NAME}] ${context}: ${message}`);
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

async function validateSessionForMissed(
  supabase: SupabaseClient,
  sessionId: string,
  coachId: string
): Promise<{ valid: boolean; error?: string; session?: any }> {
  // Get the session
  const { data: session, error } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, session_number, status, coach_id, scheduled_date')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return { valid: false, error: 'Session not found' };
  }

  // Verify coach owns this session
  if (session.coach_id !== coachId) {
    return { valid: false, error: 'Not authorized to modify this session' };
  }

  // Check if session can be marked as missed
  if (!VALID_PREVIOUS_STATUSES.includes(session.status)) {
    return { 
      valid: false, 
      error: `Cannot mark session as missed. Current status: ${session.status}` 
    };
  }

  // Check if session date has passed (can only mark past sessions as missed)
  const sessionDate = new Date(session.scheduled_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (sessionDate > today) {
    return { 
      valid: false, 
      error: 'Cannot mark future sessions as missed. Use reschedule or cancel instead.' 
    };
  }

  return { valid: true, session };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const coachId = auth.coachId;
    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID not found' },
        { status: 400 }
      );
    }

    // 2. Parse request body
    let body: MarkMissedRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { sessionId, reason, notifyParent = false } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // 3. Initialize Supabase
    const supabase = getSupabaseClient();

    // 4. Validate session can be marked as missed
    const validation = await validateSessionForMissed(supabase, sessionId, coachId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const session = validation.session;

    // 5. Update session status to missed
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'missed',
        coach_notes: reason ? `Missed - Reason: ${reason}` : 'Marked as missed by coach',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      logError('updateSession', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    logInfo('markMissed', `Session ${sessionId} marked as missed`);

    // 6. Create learning event for tracking
    await supabase.from('learning_events').insert({
      child_id: session.child_id,
      event_type: 'session_missed',
      event_date: session.scheduled_date,
      event_data: {
        session_id: sessionId,
        session_number: session.session_number,
        reason: reason || 'No reason provided',
        marked_by: coachId,
      },
      searchable_content: `Session ${session.session_number} missed. ${reason || ''}`,
    });

    // 7. Optionally notify parent (using existing communication system)
    if (notifyParent) {
      try {
        // Get child and parent info
        const { data: child } = await supabase
          .from('children')
          .select('child_name, parent_phone, name')
          .eq('id', session.child_id)
          .single();

        if (child?.parent_phone) {
          // Use existing communication API
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/communication/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateCode: 'P23_session_noshow',
              recipientType: 'parent',
              recipientPhone: child.parent_phone,
              variables: {
                child_name: child.child_name || child.name || 'your child',
                reschedule_link: `${process.env.NEXT_PUBLIC_APP_URL}/parent/reschedule`,
              },
            }),
          });
        }
      } catch (notifyError) {
        // Don't fail the request if notification fails
        logError('notifyParent', notifyError);
      }
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      message: 'Session marked as missed',
      sessionId,
      sessionNumber: session.session_number,
    });

  } catch (error) {
    logError('POST handler', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
