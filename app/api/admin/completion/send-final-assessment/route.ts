// =============================================================================
// FILE: app/api/admin/completion/send-final-assessment/route.ts
// PURPOSE: Send final assessment link to parent via email/WhatsApp
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { enrollmentId, parentEmail, childName } = await request.json();

    if (!enrollmentId || !parentEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        child_id,
        parent_id,
        children!child_id (age)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Generate final assessment link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
    const assessmentLink = `${baseUrl}/assessment?type=final&enrollment=${enrollmentId}`;

    // Log the assessment request
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: 'final_assessment_sent',
      event_data: {
        parent_email: parentEmail,
        child_name: childName,
        link: assessmentLink,
        sent_at: new Date().toISOString(),
      },
      triggered_by: 'admin',
    });

    // Send via SendGrid
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.send({
        to: parentEmail,
        from: {
          email: 'engage@yestoryd.com',
          name: 'Yestoryd',
        },
        subject: `🎉 ${childName}'s Final Reading Assessment - See How Far They've Come!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF0099;">Congratulations! 🎉</h2>
            <p>Hi there,</p>
            <p><strong>${childName}</strong> has almost completed the 3-month reading program! It's time to see how much they've improved.</p>
            
            <p>Please complete the final reading assessment so we can create a personalized progress report comparing their journey from Day 1 to now.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${assessmentLink}" 
                 style="background: linear-gradient(to right, #FF0099, #7B008B); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 8px;
                        font-weight: bold;
                        display: inline-block;">
                Start Final Assessment
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This assessment takes just 5 minutes and will help us generate ${childName}'s completion certificate with their progress report.
            </p>
            
            <p>Best regards,<br>Team Yestoryd</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Continue even if email fails
    }

    // Send via AiSensy WhatsApp (if template exists)
    try {
      const parentPhone = await getParentPhone(enrollment.parent_id);
      if (parentPhone) {
        await sendWhatsAppMessage(parentPhone, childName, assessmentLink);
      }
    } catch (waError) {
      console.error('WhatsApp send error:', waError);
      // Continue even if WhatsApp fails
    }

    return NextResponse.json({
      success: true,
      message: 'Final assessment link sent',
      link: assessmentLink,
    });

  } catch (error: any) {
    console.error('Send final assessment error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function getParentPhone(parentId: string): Promise<string | null> {
  const { data } = await supabase
    .from('parents')
    .select('phone')
    .eq('id', parentId)
    .single();
  return data?.phone || null;
}

async function sendWhatsAppMessage(phone: string, childName: string, link: string) {
  // AiSensy API call
  const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: 'final_assessment_request',
      destination: phone.replace(/\D/g, ''),
      userName: 'Yestoryd',
      templateParams: [childName, link],
    }),
  });
  return response.json();
}
