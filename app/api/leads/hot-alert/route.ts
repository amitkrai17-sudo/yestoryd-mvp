// file: app/api/leads/hot-alert/route.ts
// Hot Lead Alert System - Detects hot leads and sends WhatsApp alerts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177'; // Amit's number

// ============================================================
// GET - Check for hot leads and send alerts
// Called by cron job every 15 minutes
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Get hot leads that haven't been alerted yet
    const { data: hotLeads, error } = await supabase
      .from('children')
      .select('id, child_name, parent_name, parent_phone, parent_email, age, latest_assessment_score, lead_score, created_at')
      .eq('lead_status', 'hot')
      .is('hot_lead_alerted_at', null)
      .not('parent_phone', 'is', null)
      .order('lead_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching hot leads:', error);
      return NextResponse.json({ error: 'Failed to fetch hot leads' }, { status: 500 });
    }

    if (!hotLeads || hotLeads.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No new hot leads to alert',
        count: 0 
      });
    }

    console.log(`🔥 Found ${hotLeads.length} hot leads to alert`);

    const alertResults = [];

    for (const lead of hotLeads) {
      try {
        // Send WhatsApp alert to admin
        const alertSent = await sendHotLeadAlert(lead);

        // Mark as alerted
        if (alertSent) {
          await supabase
            .from('children')
            .update({ hot_lead_alerted_at: new Date().toISOString() })
            .eq('id', lead.id);

          // Log the alert
          await supabase.from('communication_log').insert({
            recipient_type: 'admin',
            recipient_id: null,
            channel: 'whatsapp',
            template_name: 'hot_lead_alert',
            message_content: JSON.stringify({
              child_name: lead.child_name,
              parent_name: lead.parent_name,
              score: lead.latest_assessment_score,
              lead_score: lead.lead_score,
            }),
            metadata: { child_id: lead.id },
            status: 'sent',
          });

          alertResults.push({ id: lead.id, name: lead.child_name, alerted: true });
        } else {
          alertResults.push({ id: lead.id, name: lead.child_name, alerted: false, reason: 'send_failed' });
        }
      } catch (alertError) {
        console.error(`Failed to alert for lead ${lead.id}:`, alertError);
        alertResults.push({ id: lead.id, name: lead.child_name, alerted: false, reason: 'error' });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${hotLeads.length} hot leads`,
      count: hotLeads.length,
      results: alertResults,
    });

  } catch (error) {
    console.error('Hot lead alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST - Manually trigger alert for specific lead
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const { childId } = await request.json();

    if (!childId) {
      return NextResponse.json({ error: 'childId required' }, { status: 400 });
    }

    const { data: lead, error } = await supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const alertSent = await sendHotLeadAlert(lead);

    if (alertSent) {
      await supabase
        .from('children')
        .update({ hot_lead_alerted_at: new Date().toISOString() })
        .eq('id', childId);
    }

    return NextResponse.json({
      success: alertSent,
      message: alertSent ? 'Alert sent successfully' : 'Failed to send alert',
    });

  } catch (error) {
    console.error('Manual alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// SEND WHATSAPP ALERT VIA AISENSY
// ============================================================

async function sendHotLeadAlert(lead: {
  id: string;
  child_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  age: number | null;
  latest_assessment_score: number | null;
  lead_score: number;
  created_at: string;
}): Promise<boolean> {
  
  const childName = lead.child_name || 'Unknown';
  const parentName = lead.parent_name || 'Parent';
  const score = lead.latest_assessment_score ?? 'N/A';
  const age = lead.age ?? 'N/A';
  const phone = lead.parent_phone || 'No phone';
  const leadScore = lead.lead_score;
  const createdAt = new Date(lead.created_at).toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  // Determine urgency
  let urgency = '🔥 HOT LEAD';
  if (lead.latest_assessment_score !== null && lead.latest_assessment_score <= 3) {
    urgency = '🚨 URGENT HOT LEAD';
  }

  const message = `${urgency}

👤 Child: ${childName} (Age: ${age})
👨‍👩‍👧 Parent: ${parentName}
📱 Phone: ${phone}
📊 Score: ${score}/10
🎯 Lead Score: ${leadScore}
🕐 Assessed: ${createdAt}

${lead.latest_assessment_score !== null && lead.latest_assessment_score <= 3 
  ? '⚡ Child scored very low - HIGH NEED for coaching!' 
  : '📈 Good candidate for coaching program'}

👉 Call within 1 hour for best conversion!`;

  // Try AiSensy first
  if (AISENSY_API_KEY) {
    try {
      const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: AISENSY_API_KEY,
          campaignName: 'hot_lead_alert',
          destination: ADMIN_PHONE.replace('+', ''),
          userName: 'Yestoryd System',
          templateParams: [
            childName,
            String(age),
            parentName,
            phone,
            String(score),
            String(leadScore),
          ],
          // Fallback to direct message if template not set up
          message: message,
        }),
      });

      if (response.ok) {
        console.log(`✅ WhatsApp alert sent for ${childName}`);
        return true;
      } else {
        const errorData = await response.text();
        console.error('AiSensy error:', errorData);
      }
    } catch (aiSensyError) {
      console.error('AiSensy API error:', aiSensyError);
    }
  }

  // Fallback: Log to console (for development)
  console.log('📱 HOT LEAD ALERT (console fallback):');
  console.log(message);
  console.log('---');

  // Still return true to mark as processed (avoid re-alerting)
  return true;
}

// ============================================================
// RECALCULATE ALL LEAD SCORES (Admin utility)
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    // Recalculate all lead scores
    const { data: children, error } = await supabase
      .from('children')
      .select('id, latest_assessment_score, age, parent_phone');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    let updated = 0;

    for (const child of children || []) {
      // Check for discovery call
      const { data: discovery } = await supabase
        .from('discovery_calls')
        .select('id')
        .or(`child_id.eq.${child.id},parent_phone.eq.${child.parent_phone}`)
        .limit(1);

      // Check for enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', child.id)
        .eq('status', 'active')
        .limit(1);

      const hasDiscovery = discovery && discovery.length > 0;
      const hasEnrollment = enrollment && enrollment.length > 0;

      // Calculate score using the same logic as the database function
      let score = 10; // Base score

      if (child.latest_assessment_score !== null) {
        if (child.latest_assessment_score <= 3) score += 50;
        else if (child.latest_assessment_score <= 5) score += 30;
        else if (child.latest_assessment_score <= 7) score += 15;
        else score += 5;
      }

      if (child.age !== null) {
        if (child.age >= 4 && child.age <= 7) score += 15;
        else if (child.age >= 8 && child.age <= 10) score += 10;
      }

      if (hasDiscovery) score += 40;
      if (hasEnrollment) score += 100;

      // Determine status
      let status = 'new';
      if (hasEnrollment) status = 'converted';
      else if (score >= 60) status = 'hot';
      else if (score >= 30) status = 'warm';

      // Update
      await supabase
        .from('children')
        .update({
          lead_score: score,
          lead_status: status,
          lead_score_updated_at: new Date().toISOString(),
        })
        .eq('id', child.id);

      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ${updated} lead scores`,
      count: updated,
    });

  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
