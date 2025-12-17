// app/api/webhooks/cal/route.ts
// Handles Cal.com booking webhooks - creates discovery_calls record

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// POST handler - receives Cal.com webhook
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
    
    // Cal.com field names - try multiple variations
    const parentName = responses.name || attendee.name || responses['Your name'] || '';
    const parentEmail = responses.email || attendee.email || responses['Email address'] || '';
    const parentPhone = responses.phone || responses['Phone Number'] || responses.phoneNumber || '';
    
    // Child info - try multiple field name variations
    const childName = responses.childName || 
                     responses['Child Name'] || 
                     responses['child-name'] || 
                     responses['childname'] ||
                     responses['child_name'] ||
                     '';
    
    const childAgeRaw = responses.childAge || 
                       responses['Child Age'] || 
                       responses['child-age'] || 
                       responses['childage'] ||
                       responses['child_age'] ||
                       '';
    const childAge = parseInt(childAgeRaw) || null;

    console.log('Extracted data:', {
      parentName,
      parentEmail,
      parentPhone,
      childName,
      childAge,
      responses: Object.keys(responses)
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

    // Create discovery call record
    const { data: discoveryCall, error } = await supabase
      .from('discovery_calls')
      .insert({
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        child_name: childName || 'Not provided',
        child_age: childAge,
        status: 'scheduled',
        scheduled_at: booking.startTime,
        meeting_url: booking.metadata?.videoCallUrl || booking.location || null,
        cal_booking_id: booking.bookingId || booking.id,
        cal_booking_uid: booking.uid,
        source: 'cal.com',
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

    return NextResponse.json({
      success: true,
      discoveryCallId: discoveryCall.id,
      message: 'Discovery call created successfully'
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
