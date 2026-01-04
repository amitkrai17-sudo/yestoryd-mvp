// app/api/discovery/book/route.ts
// Native discovery booking with AUTO-ASSIGNMENT (round-robin)

import { NextRequest, NextResponse } from 'next/server';
import { bookDiscoveryCall } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// AUTO-ASSIGNMENT: Get next coach (round-robin)
// ============================================
async function getNextAvailableCoach(scheduledDate: Date) {
  try {
    // Get all active coaches
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, last_assigned_at, is_active, is_available, exit_status')
      .eq('is_active', true)
      .eq('is_available', true)
      .order('last_assigned_at', { ascending: true }); // Round-robin: oldest first

    if (coachError || !coaches || coaches.length === 0) {
      console.log('[Auto-Assign] No active coaches found');
      return null;
    }

    // Filter out coaches who are:
    // 1. On leave during scheduled date
    // 2. Have pending exit status
    const eligibleCoaches = [];
    
    for (const coach of coaches) {
      // Skip if exiting
      if (coach.exit_status === 'pending') {
        console.log(`[Auto-Assign] Skipping ${coach.name} - exit pending`);
        continue;
      }

      // Check if on leave during scheduled date
      const { data: leaves } = await supabase
        .from('coach_availability')
        .select('id')
        .eq('coach_id', coach.id)
        .eq('is_available', false)
        .lte('start_date', scheduledDate.toISOString().split('T')[0])
        .gte('end_date', scheduledDate.toISOString().split('T')[0])
        .limit(1);

      if (leaves && leaves.length > 0) {
        console.log(`[Auto-Assign] Skipping ${coach.name} - on leave`);
        continue;
      }

      eligibleCoaches.push(coach);
    }

    if (eligibleCoaches.length === 0) {
      console.log('[Auto-Assign] No eligible coaches after filtering');
      return null;
    }

    // Return first eligible (least recently assigned due to ORDER BY)
    const selected = eligibleCoaches[0];
    console.log(`[Auto-Assign] Selected coach: ${selected.name} (last assigned: ${selected.last_assigned_at})`);
    return selected;

  } catch (error) {
    console.error('[Auto-Assign] Error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      parentName, 
      parentEmail, 
      parentPhone, 
      childName, 
      childAge, 
      childId,
      slotDate, 
      slotTime,
      source 
    } = body;
    
    // Validate required fields
    if (!parentName || !parentEmail || !parentPhone || !childName || !childAge || !slotDate || !slotTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Format phone number (ensure 91 prefix)
    const cleanPhone = parentPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    // Book via Google Calendar
    const calendarResult = await bookDiscoveryCall({
      parentName,
      parentEmail: parentEmail.toLowerCase().trim(),
      parentPhone: formattedPhone,
      childName,
      childAge: parseInt(childAge),
      slotDate,
      slotTime,
      notes: `Source: ${source || 'lets-talk'}`,
    });
    
    if (!calendarResult.success) {
      return NextResponse.json(
        { success: false, error: calendarResult.error || 'Failed to create calendar event' },
        { status: 500 }
      );
    }

    // Parse scheduled datetime
    const [hours, minutes] = slotTime.split(':').map(Number);
    const slotDatetime = new Date(slotDate);
    slotDatetime.setHours(hours, minutes, 0, 0);

    // ============================================
    // AUTO-ASSIGNMENT: Get coach via round-robin
    // ============================================
    const eligibleCoach = await getNextAvailableCoach(slotDatetime);

    // Create discovery_calls record WITH auto-assignment
    const { data: discoveryCall, error: dbError } = await supabase
      .from('discovery_calls')
      .insert({
        parent_name: parentName,
        parent_email: parentEmail.toLowerCase().trim(),
        parent_phone: formattedPhone,
        child_name: childName,
        child_age: parseInt(childAge),
        child_id: childId || null,
        scheduled_at: slotDatetime.toISOString(),
        status: 'scheduled',
        booking_source: 'native',
        google_calendar_event_id: calendarResult.eventId,
        google_meet_link: calendarResult.meetLink,
        slot_date: slotDate,
        slot_time: slotTime,
        source: source || 'lets-talk',
        // AUTO-ASSIGNMENT FIELDS
        assigned_coach_id: eligibleCoach?.id || null,
        assignment_type: eligibleCoach ? 'auto' : 'pending',
        assigned_at: eligibleCoach ? new Date().toISOString() : null,
        assigned_by: eligibleCoach ? 'system' : null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('[API] Discovery DB error:', dbError);
      // Calendar event was created but DB failed - log but don't fail completely
    }

    // ============================================
    // Update coach's last_assigned_at for round-robin
    // ============================================
    if (eligibleCoach && discoveryCall) {
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ 
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', eligibleCoach.id);

      if (updateError) {
        console.error('[API] Error updating coach last_assigned_at:', updateError);
      } else {
        console.log(`[API] Updated last_assigned_at for coach ${eligibleCoach.name}`);
      }
    }

    // Link to existing child record if email matches
    if (!childId && discoveryCall) {
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('parent_email', parentEmail.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingChild) {
        await supabase
          .from('discovery_calls')
          .update({ child_id: existingChild.id })
          .eq('id', discoveryCall.id);
      }
    }

    // Send WhatsApp notification using EXISTING communication API
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://yestoryd.com';
      
      await fetch(`${baseUrl}/api/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCode: 'P6_discovery_booked',  // Discovery booked template
          recipientType: 'parent',
          recipientPhone: formattedPhone,
          recipientEmail: parentEmail,
          recipientName: parentName,
          variables: {
            parent_name: parentName,
            child_name: childName,
            scheduled_date: slotDatetime.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
            scheduled_time: slotDatetime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
            meet_link: calendarResult.meetLink || 'Link will be shared before the call',
          },
          relatedEntityType: 'discovery_call',
          relatedEntityId: discoveryCall?.id,
        })
      });
    } catch (notifyError) {
      // Non-fatal - booking succeeded, notification can be retried
      console.error('[API] WhatsApp notification error (non-fatal):', notifyError);
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: discoveryCall?.id,
        calendarEventId: calendarResult.eventId,
        meetLink: calendarResult.meetLink,
        date: slotDate,
        time: slotTime,
      },
      autoAssigned: !!eligibleCoach,
      assignedCoach: eligibleCoach?.name || null,
      message: `Discovery call booked for ${slotDate} at ${slotTime}${eligibleCoach ? ` - Auto-assigned to ${eligibleCoach.name}` : ''}`,
    });
    
  } catch (error) {
    console.error('[API] Discovery booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Booking failed' },
      { status: 500 }
    );
  }
}
