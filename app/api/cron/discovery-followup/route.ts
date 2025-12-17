// app/api/cron/discovery-followup/route.ts
// Cron job to identify calls needing 24hr follow-up
// Configure in vercel.json: runs daily at 10 AM IST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find discovery calls needing follow-up:
    // - Status: completed
    // - Payment link sent > 24 hours ago
    // - Follow-up not yet sent
    // - Not yet converted
    const { data: callsNeedingFollowup, error } = await supabase
      .from('discovery_calls_need_followup')
      .select('*');

    if (error) {
      console.error('Error fetching calls needing followup:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const results: any[] = [];

    for (const call of callsNeedingFollowup || []) {
      // Get follow-up template
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('template')
        .eq('slug', 'discovery-followup-24hr')
        .single();

      // Extract child's goal from questionnaire
      const childGoal = call.questionnaire?.parent_goal || 'improve their reading skills';

      // Format follow-up message
      let followupMessage = '';
      if (template) {
        followupMessage = template.template
          .replace(/\{\{parentName\}\}/g, call.parent_name)
          .replace(/\{\{childName\}\}/g, call.child_name)
          .replace(/\{\{coachName\}\}/g, call.coach_name || 'Your Coach')
          .replace(/\{\{childGoal\}\}/g, childGoal)
          .replace(/\{\{paymentLink\}\}/g, call.payment_link || '');
      }

      // Generate wa.me link
      const waLink = call.parent_phone 
        ? `https://wa.me/91${call.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(followupMessage)}`
        : null;

      // Mark as follow-up sent (even though manual - to prevent duplicate cron triggers)
      await supabase
        .from('discovery_calls')
        .update({
          followup_sent_at: new Date().toISOString(),
          followup_count: (call.followup_count || 0) + 1,
        })
        .eq('id', call.id);

      results.push({
        id: call.id,
        parentName: call.parent_name,
        childName: call.child_name,
        parentPhone: call.parent_phone,
        waLink,
        hoursSincePaymentLink: Math.round(call.hours_since_payment_link),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} calls needing follow-up`,
      followups: results,
      note: 'WhatsApp messages need to be sent manually via wa.me links (or integrate with WhatsApp Business API)',
    });

  } catch (error) {
    console.error('Error in followup cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
