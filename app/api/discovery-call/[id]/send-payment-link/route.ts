// app/api/discovery-call/[id]/send-payment-link/route.ts
// Send payment link to parent after discovery call

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate payment link with pre-filled info
function generatePaymentLink(call: any): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
  const params = new URLSearchParams({
    parentName: call.parent_name,
    parentEmail: call.parent_email,
    parentPhone: call.parent_phone || '',
    childName: call.child_name,
    childAge: call.child_age?.toString() || '',
    discoveryCallId: call.id,
  });
  return `${baseUrl}/checkout?${params.toString()}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const {
      sendVia = 'both', // 'whatsapp' | 'email' | 'both'
    } = body;

    // Fetch discovery call with coach
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

    // Generate payment link
    const paymentLink = generatePaymentLink(call);

    // Get WhatsApp template
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('template')
      .eq('slug', 'discovery-payment-link')
      .single();

    // Format WhatsApp message
    let whatsappMessage = '';
    if (template) {
      whatsappMessage = template.template
        .replace(/\{\{parentName\}\}/g, call.parent_name)
        .replace(/\{\{childName\}\}/g, call.child_name)
        .replace(/\{\{paymentLink\}\}/g, paymentLink)
        .replace(/\{\{coachName\}\}/g, call.coach?.name || 'Your Coach');
    }

    // Generate wa.me link
    const waLink = call.parent_phone 
      ? `https://wa.me/91${call.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
      : null;

    // Update discovery call with payment link sent timestamp
    const { error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        payment_link: paymentLink,
        payment_link_sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating payment link status:', updateError);
    }

    // TODO: If sendVia includes 'email', send via SendGrid
    // For now, we return the link for manual sending or wa.me

    return NextResponse.json({
      success: true,
      message: 'Payment link generated',
      paymentLink,
      waLink,
      whatsappMessage,
      parentPhone: call.parent_phone,
      parentEmail: call.parent_email,
    });

  } catch (error) {
    console.error('Error in send payment link API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
