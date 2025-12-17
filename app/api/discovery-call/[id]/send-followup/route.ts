// app/api/discovery-call/[id]/send-followup/route.ts
// Send 24hr follow-up message (ONE time only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch discovery call with coach and questionnaire
    const { data: call, error: fetchError } = await supabase
      .from('discovery_calls')
      .select(`
        *,
        coach:coaches!assigned_coach_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !call) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // Check if already followed up
    if (call.followup_sent_at) {
      return NextResponse.json(
        { error: 'Follow-up already sent', sentAt: call.followup_sent_at },
        { status: 400 }
      );
    }

    // Check if already converted
    if (call.converted_to_enrollment) {
      return NextResponse.json(
        { error: 'Lead already converted, no follow-up needed' },
        { status: 400 }
      );
    }

    // Get follow-up template
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('template')
      .eq('slug', 'discovery-followup-24hr')
      .single();

    // Extract child's goal from questionnaire
    const childGoal = call.questionnaire?.parent_goal 
      || 'improve their reading skills';

    // Format follow-up message
    let followupMessage = '';
    if (template) {
      followupMessage = template.template
        .replace(/\{\{parentName\}\}/g, call.parent_name)
        .replace(/\{\{childName\}\}/g, call.child_name)
        .replace(/\{\{coachName\}\}/g, call.coach?.name || 'Your Coach')
        .replace(/\{\{childGoal\}\}/g, childGoal)
        .replace(/\{\{paymentLink\}\}/g, call.payment_link || '');
    }

    // Generate wa.me link
    const waLink = call.parent_phone 
      ? `https://wa.me/91${call.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(followupMessage)}`
      : null;

    // Update discovery call with follow-up timestamp
    const { error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        followup_sent_at: new Date().toISOString(),
        followup_count: (call.followup_count || 0) + 1,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating followup status:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up message generated',
      waLink,
      followupMessage,
      parentPhone: call.parent_phone,
      parentEmail: call.parent_email,
      note: 'This is the ONLY follow-up. No further sales messages will be sent.',
    });

  } catch (error) {
    console.error('Error in send followup API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
