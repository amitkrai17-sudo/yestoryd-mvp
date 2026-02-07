// app/api/webhooks/cal/route.ts
// Handles Cal.com booking webhooks - creates discovery_calls record
// Features:
//   - Auto-assigns coach using round-robin (excludes unavailable/exiting coaches)
//   - Properly extracts values from Cal.com JSON response objects
//   - Auto-links to children table by matching email + child name

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET handler - for testing if endpoint exists
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Cal.com webhook endpoint ready',
    timestamp: new Date().toISOString()
  });
}

// ============================================
// Helper: Extract value from Cal.com response objects
// Cal.com returns: { "label": "field_name", "value": "actual_value", "isHidden": false }
// ============================================
const extractValue = (field: any): string => {
  if (!field) return '';
  if (typeof field === 'object' && field.value !== undefined) {
    return String(field.value);
  }
  return String(field);
};

// ============================================
// Helper: Get eligible coach for auto-assignment
// ============================================
async function getEligibleCoach(scheduledDate: string): Promise<{ id: string; name: string } | null> {
  try {
    // 1. Get coaches who are on leave during the scheduled date
    const { data: unavailableCoachIds } = await supabase
      .from('coach_availability')
      .select('coach_id')
      .in('status', ['upcoming', 'active'])
      .lte('start_date', scheduledDate)
      .gte('end_date', scheduledDate);

    const excludeIds = (unavailableCoachIds || []).map(u => u.coach_id);

    // 2. Get eligible coaches:
    //    - is_active = true
    //    - is_available = true (not manually marked unavailable)
    //    - Not exiting (exit_status is null or not 'pending')
    //    - Not in unavailable list
    //    - Order by last_assigned_at ASC (round-robin: least recently assigned first)
    let query = supabase
      .from('coaches')
      .select('id, name, last_assigned_at')
      .eq('is_active', true)
      .eq('is_available', true)
      .or('exit_status.is.null,exit_status.neq.pending')
      .order('last_assigned_at', { ascending: true, nullsFirst: true })
      .limit(1);

    // Exclude coaches on leave (if any)
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: coaches, error } = await query;

    if (error) {
      console.error('Error finding eligible coach:', error);
      return null;
    }

    if (!coaches || coaches.length === 0) {
      console.log('No eligible coaches found for auto-assignment');
      return null;
    }

    return { id: coaches[0].id, name: coaches[0].name };
  } catch (error) {
    console.error('Error in getEligibleCoach:', error);
    return null;
  }
}

// ============================================
// Helper: Find matching child from children table
// ============================================
async function findMatchingChild(parentEmail: string, childName: string): Promise<string | null> {
  if (!parentEmail || !childName) return null;

  try {
    const { data: matchedChild, error } = await supabase
      .from('children')
      .select('id')
      .ilike('parent_email', parentEmail)
      .ilike('child_name', childName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !matchedChild) {
      console.log('No matching child found for:', { parentEmail, childName });
      return null;
    }

    console.log('Auto-linked to child_id:', matchedChild.id);
    return matchedChild.id;
  } catch (error) {
    console.error('Error finding matching child:', error);
    return null;
  }
}

// ============================================
// POST handler - receives Cal.com webhook
// ============================================
export async function POST(request: NextRequest) {
  console.log('=== CAL.COM WEBHOOK RECEIVED ===');

  try {
    const payload = await request.json();

    console.log('Event:', payload.triggerEvent);
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    // Only process BOOKING_CREATED events
    if (payload.triggerEvent !== 'BOOKING_CREATED') {
      console.log('Ignoring event:', payload.triggerEvent);
      return NextResponse.json({ received: true, ignored: true });
    }

    const booking = payload.payload;

    // Check if this is a discovery call
    const eventType = booking?.eventType?.slug || booking?.type || '';
    const isDiscoveryCall = eventType.toLowerCase().includes('discovery') ||
                           booking?.length === 30 ||
                           booking?.length === 20;

    if (!isDiscoveryCall) {
      console.log('Not a discovery call, event type:', eventType);
      return NextResponse.json({ received: true, ignored: true, reason: 'not_discovery' });
    }

    // Extract attendee info
    const attendee = booking.attendees?.[0] || {};
    const responses = booking.responses || {};

    // ============================================
    // Extract parent info - with value extraction for JSON objects
    // ============================================
    const parentName = extractValue(responses.your_name) || 
                       extractValue(responses.name) || 
                       extractValue(responses['Your name']) || 
                       extractValue(responses['Your Name']) ||
                       attendee.name || '';
    
    const parentEmail = extractValue(responses.email_address) || 
                        extractValue(responses.email) || 
                        extractValue(responses['Email address']) || 
                        extractValue(responses['Email Address']) ||
                        attendee.email || '';
    
    const parentPhone = extractValue(responses.phone) || 
                        extractValue(responses['Phone Number']) || 
                        extractValue(responses['Phone number']) ||
                        extractValue(responses.phoneNumber) ||
                        extractValue(responses.phone_number) || '';

    // ============================================
    // Extract child info - with value extraction for JSON objects
    // ============================================
    const childName = extractValue(responses['Child Name']) ||
                      extractValue(responses['child name']) ||
                      extractValue(responses.childName) ||
                      extractValue(responses['child-name']) ||
                      extractValue(responses.child_name) ||
                      extractValue(responses.childname) || '';

    const childAgeRaw = extractValue(responses['Child Age']) ||
                        extractValue(responses['child age']) ||
                        extractValue(responses.childAge) ||
                        extractValue(responses['child-age']) ||
                        extractValue(responses.child_age) ||
                        extractValue(responses.childage) || '';
    
    const childAge = parseInt(childAgeRaw) || null;

    console.log('Extracted data:', {
      parentName,
      parentEmail,
      parentPhone,
      childName,
      childAge,
      responseKeys: Object.keys(responses)
    });

    // Validate required fields
    if (!parentName) {
      console.error('Missing parent name');
      return NextResponse.json({
        success: false,
        error: 'Missing parent name',
        responses: responses
      }, { status: 400 });
    }

    // ============================================
    // AUTO-LINK: Find matching child from children table
    // ============================================
    const childId = await findMatchingChild(parentEmail, childName);

    // Get scheduled date for availability check
    const scheduledDate = booking.startTime ? 
      new Date(booking.startTime).toISOString().split('T')[0] : 
      new Date().toISOString().split('T')[0];

    // ============================================
    // AUTO-ASSIGNMENT: Find eligible coach
    // ============================================
    const eligibleCoach = await getEligibleCoach(scheduledDate);
    
    console.log('Auto-assignment result:', eligibleCoach 
      ? `Assigned to ${eligibleCoach.name} (${eligibleCoach.id})`
      : 'No eligible coach - will need manual assignment'
    );

    // ============================================
    // Create discovery call record
    // ============================================
    const { data: discoveryCall, error } = await supabase
      .from('discovery_calls')
      .insert({
        // Link to children table
        child_id: childId,
        // Parent info
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        // Child info
        child_name: childName || 'Not provided',
        child_age: childAge,
        // Booking info
        status: 'scheduled',
        scheduled_at: booking.startTime,
        meeting_url: booking.metadata?.videoCallUrl || booking.location || null,
        cal_booking_id: booking.bookingId || booking.id,
        cal_booking_uid: booking.uid,
        source: 'cal.com',
        // Auto-assignment fields
        coach_id: eligibleCoach?.id || null,
        assignment_type: eligibleCoach ? 'auto' : 'pending',
        assigned_at: eligibleCoach ? new Date().toISOString() : null,
        assigned_by: eligibleCoach ? 'system' : null,
        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 });
    }

    console.log('Discovery call created:', discoveryCall.id);

    // ============================================
    // Update coach's last_assigned_at for round-robin
    // ============================================
    if (eligibleCoach) {
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ 
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', eligibleCoach.id);

      if (updateError) {
        console.error('Error updating coach last_assigned_at:', updateError);
        // Non-fatal - discovery call was created successfully
      } else {
        console.log(`Updated last_assigned_at for coach ${eligibleCoach.name}`);
      }
    }

    return NextResponse.json({
      success: true,
      discoveryCallId: discoveryCall.id,
      message: 'Discovery call created successfully',
      autoAssigned: !!eligibleCoach,
      assignedCoach: eligibleCoach?.name || null,
      childLinked: !!childId
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}