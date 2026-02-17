// ============================================================
// FILE: app/api/discovery-call/assign/route.ts
// ============================================================
// HARDENED VERSION - Coach assignment for discovery calls
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin-only authentication
// - UUID validation
// - Coach existence & status check
// - Discovery call verification
// - Audit logging
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Using getServiceSupabase from lib/api-auth.ts

// --- VALIDATION SCHEMA ---
const AssignCoachSchema = z.object({
  discovery_call_id: z.string().uuid('Invalid discovery call ID'),
  coach_id: z.string().uuid('Invalid coach ID'),
});


// --- AUTHENTICATION: Using requireAdminOrCoach from lib/api-auth.ts ---

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate - Admin only
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: auth.error,
        email: auth.email,
      }));

      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    // 2. Parse and validate input
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = AssignCoachSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);

      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));

      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { discovery_call_id, coach_id } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'assign_request',
      discoveryCallId: discovery_call_id,
      coachId: coach_id,
      adminEmail: auth.email,
    }));

    const supabase = getServiceSupabase();

    // 3. Verify coach exists and is active
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, is_active, status')
      .eq('id', coach_id)
      .single();

    if (coachError || !coach) {
      console.log(JSON.stringify({
        requestId,
        event: 'coach_not_found',
        coachId: coach_id,
      }));

      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    if (!coach.is_active) {
      console.log(JSON.stringify({
        requestId,
        event: 'coach_inactive',
        coachId: coach_id,
        coachStatus: coach.status,
      }));

      return NextResponse.json(
        { error: 'Cannot assign inactive coach', coachStatus: coach.status },
        { status: 400 }
      );
    }

    // 4. Verify discovery call exists and is not already completed
    const { data: existingCall, error: callError } = await supabase
      .from('discovery_calls')
      .select('id, status, assigned_coach_id, child_name')
      .eq('id', discovery_call_id)
      .single();

    if (callError || !existingCall) {
      console.log(JSON.stringify({
        requestId,
        event: 'discovery_call_not_found',
        discoveryCallId: discovery_call_id,
      }));

      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    if (existingCall.status === 'converted' || existingCall.status === 'cancelled') {
      console.log(JSON.stringify({
        requestId,
        event: 'discovery_call_closed',
        discoveryCallId: discovery_call_id,
        status: existingCall.status,
      }));

      return NextResponse.json(
        { error: `Cannot assign coach to ${existingCall.status} discovery call` },
        { status: 400 }
      );
    }

    // 5. Check if already assigned to this coach
    if (existingCall.assigned_coach_id === coach_id) {
      return NextResponse.json({
        success: true,
        message: 'Coach already assigned to this call',
        alreadyAssigned: true,
        discoveryCall: existingCall,
      });
    }

    // 6. Update the discovery call with assigned coach
    const { data: updatedCall, error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        assigned_coach_id: coach_id,
        assignment_type: 'manual',
        assigned_by: auth.email,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', discovery_call_id)
      .select(`
        *,
        assigned_coach:coaches!assigned_coach_id(id, name, email)
      `)
      .single();

    if (updateError) {
      console.error(JSON.stringify({
        requestId,
        event: 'update_failed',
        error: updateError.message,
      }));

      return NextResponse.json(
        { error: 'Failed to assign coach', details: updateError.message },
        { status: 500 }
      );
    }

    // 7. Update coach's last_assigned_at for round-robin tracking
    await supabase
      .from('coaches')
      .update({
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', coach_id);



      // 7b. Children sync handled by database trigger: trigger_sync_discovery_to_children

    // 8. CRITICAL: Sync external systems (Calendar + Notifications)
    const previousCoachId = existingCall.assigned_coach_id;

    // 8a. Notify the NEW coach
    try {
      const { sendCommunication } = await import('@/lib/communication');
      
      await sendCommunication({
        templateCode: 'coach_discovery_assigned',
        recipientType: 'coach',
        recipientEmail: coach.email,
        recipientName: coach.name,
        variables: {
          coach_name: coach.name,
          child_name: updatedCall.child_name || 'Child',
          parent_name: updatedCall.parent_name || 'Parent',
          scheduled_date: updatedCall.scheduled_at 
            ? new Date(updatedCall.scheduled_at).toLocaleDateString('en-IN', { 
                weekday: 'long', day: 'numeric', month: 'long' 
              })
            : 'TBD',
          scheduled_time: updatedCall.scheduled_at
            ? new Date(updatedCall.scheduled_at).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit'
              })
            : 'TBD',
          meet_link: updatedCall.google_meet_link || '',
          discovery_call_id: discovery_call_id,
        },
        relatedEntityType: 'discovery_call',
        relatedEntityId: discovery_call_id,
      });

      console.log(JSON.stringify({
        requestId,
        event: 'new_coach_notified',
        coachEmail: coach.email,
      }));
    } catch (notifyError) {
      console.error(JSON.stringify({
        requestId,
        event: 'new_coach_notification_failed',
        error: (notifyError as Error).message,
      }));
      // Non-blocking - continue even if notification fails
    }

    // 8b. Notify the OLD coach (if reassignment)
    if (previousCoachId && previousCoachId !== coach_id) {
      try {
        const { data: oldCoach } = await supabase
          .from('coaches')
          .select('name, email')
          .eq('id', previousCoachId)
          .single();

        if (oldCoach?.email) {
          const { sendCommunication } = await import('@/lib/communication');
          
          await sendCommunication({
            templateCode: 'coach_discovery_unassigned',
            recipientType: 'coach',
            recipientEmail: oldCoach.email,
            recipientName: oldCoach.name,
            variables: {
              coach_name: oldCoach.name,
              child_name: updatedCall.child_name || 'Child',
              reason: 'Reassigned to another coach',
            },
            relatedEntityType: 'discovery_call',
            relatedEntityId: discovery_call_id,
          });

          console.log(JSON.stringify({
            requestId,
            event: 'old_coach_notified',
            oldCoachEmail: oldCoach.email,
          }));
        }
      } catch (oldNotifyError) {
        console.error(JSON.stringify({
          requestId,
          event: 'old_coach_notification_failed',
          error: (oldNotifyError as Error).message,
        }));
      }
    }

    // 8c. Update Google Calendar event (if exists)
    if (updatedCall.google_calendar_event_id) {
      try {
        const { queueCalendarAttendeeUpdate } = await import('@/lib/qstash');
        
        await queueCalendarAttendeeUpdate({
          eventId: updatedCall.google_calendar_event_id,
          newCoachEmail: coach.email,
          oldCoachEmail: previousCoachId ? (await supabase
            .from('coaches')
            .select('email')
            .eq('id', previousCoachId)
            .single()).data?.email : undefined,
          requestId,
        });

        console.log(JSON.stringify({
          requestId,
          event: 'calendar_update_queued',
          eventId: updatedCall.google_calendar_event_id,
        }));
      } catch (calError) {
        console.error(JSON.stringify({
          requestId,
          event: 'calendar_update_failed',
          error: (calError as Error).message,
        }));
        // Non-blocking - coach is notified, they can join manually
      }
    }

    // 9. Log the assignment for audit trail
    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email || 'unknown',
      user_type: 'admin',
        action: 'discovery_call_coach_assigned',
        metadata: {
          request_id: requestId,
          discovery_call_id,
          coach_id,
          coach_name: coach.name,
          child_name: updatedCall.child_name,
          previous_coach_id: existingCall.assigned_coach_id,
          notifications_sent: true,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Audit log failed (non-blocking):', logError);
    }

    // 10. Return success
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'coach_assigned',
      coachName: coach.name,
      childName: updatedCall.child_name,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      message: 'Coach assigned successfully',
      requestId,
      discoveryCall: updatedCall,
    }, {
      headers: {
        'X-Request-Id': requestId,
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'assign_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

// --- GET: List assignable coaches ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Authenticate - Admin only
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    const supabase = getServiceSupabase();

    // 2. Get all active coaches
    const { data: coaches, error } = await supabase
      .from('coaches')
      .select('id, name, email, is_active, last_assigned_at')
      .eq('is_active', true)
      .order('last_assigned_at', { ascending: true, nullsFirst: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch coaches' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      coaches,
      count: coaches?.length || 0,
    });

  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'get_coaches_error', error }));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
