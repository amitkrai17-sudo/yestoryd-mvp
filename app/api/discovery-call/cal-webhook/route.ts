// app/api/discovery-call/cal-webhook/route.ts
// Webhook to update discovery call when booked via Cal.com

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Cal.com webhook payload structure
    const {
      triggerEvent, // 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED'
      payload,
    } = body;

    if (!payload) {
      return NextResponse.json({ error: 'No payload' }, { status: 400 });
    }

    const {
      uid: calBookingUid,
      eventTypeId,
      startTime,
      attendees,
      metadata,
      videoCallData,
    } = payload;

    // Get attendee email
    const attendeeEmail = attendees?.[0]?.email;

    if (!attendeeEmail) {
      return NextResponse.json({ error: 'No attendee email' }, { status: 400 });
    }

    if (triggerEvent === 'BOOKING_CREATED') {
      // Find matching discovery call by email (pending status)
      const { data: call, error: findError } = await supabase
        .from('discovery_calls')
        .select('id')
        .eq('parent_email', attendeeEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (call) {
        // Update discovery call with booking details
        await supabase
          .from('discovery_calls')
          .update({
            status: 'scheduled',
            cal_booking_uid: calBookingUid,
            cal_event_type_id: eventTypeId,
            scheduled_at: startTime,
            meeting_url: videoCallData?.url || null,
          })
          .eq('id', call.id);

        // Update child lead_status
        await supabase
          .from('children')
          .update({ lead_status: 'discovery_scheduled' })
          .eq('discovery_call_id', call.id);

        return NextResponse.json({
          success: true,
          message: 'Discovery call updated with booking',
          discoveryCallId: call.id,
        });
      }
    }

    if (triggerEvent === 'BOOKING_CANCELLED') {
      // Find and update the cancelled booking
      const { data: call } = await supabase
        .from('discovery_calls')
        .select('id')
        .eq('cal_booking_uid', calBookingUid)
        .single();

      if (call) {
        await supabase
          .from('discovery_calls')
          .update({ status: 'cancelled' })
          .eq('id', call.id);

        return NextResponse.json({
          success: true,
          message: 'Discovery call marked as cancelled',
        });
      }
    }

    if (triggerEvent === 'BOOKING_RESCHEDULED') {
      // Find and update the rescheduled booking
      const { data: call } = await supabase
        .from('discovery_calls')
        .select('id')
        .eq('cal_booking_uid', calBookingUid)
        .single();

      if (call) {
        await supabase
          .from('discovery_calls')
          .update({
            status: 'scheduled',
            scheduled_at: startTime,
            meeting_url: videoCallData?.url || null,
          })
          .eq('id', call.id);

        return NextResponse.json({
          success: true,
          message: 'Discovery call rescheduled',
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received but no matching discovery call found' 
    });

  } catch (error) {
    console.error('Cal.com webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
