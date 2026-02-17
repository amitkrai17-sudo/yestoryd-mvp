// file: app/api/coach/notify-assignment/route.ts
// Sends WhatsApp + Email notification to coach when a child is assigned
// Called from: Admin CRM when assigning coach, or auto-assignment flow

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

interface NotifyAssignmentRequest {
  coachId: string;
  childId: string;
  enrollmentId?: string;
  firstSessionDate?: string;
  firstSessionTime?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: NotifyAssignmentRequest = await request.json();
    const { coachId, childId, enrollmentId, firstSessionDate, firstSessionTime } = body;

    if (!coachId || !childId) {
      return NextResponse.json(
        { success: false, error: 'coachId and childId are required' },
        { status: 400 }
      );
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, phone')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Get child details with assessment data
    const { data: child, error: childError } = await supabase
      .from('children')
      .select(`
        id,
        child_name,
        age,
        latest_assessment_score,
        parent_name,
        parent_email
      `)
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found' },
        { status: 404 }
      );
    }

    const childName = child.child_name || 'Student';
    const childAge = child.age || 0;
    const readingLevel = child.latest_assessment_score || 5;
    const coachFirstName = coach.name.split(' ')[0];

    // Get first session if enrollmentId provided
    let firstSession = { date: firstSessionDate, time: firstSessionTime };
    if (enrollmentId && (!firstSessionDate || !firstSessionTime)) {
      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date, scheduled_time')
        .eq('enrollment_id', enrollmentId)
        .eq('session_type', 'coaching')
        .order('scheduled_date', { ascending: true })
        .limit(1)
        .single();

      if (session) {
        firstSession = {
          date: new Date(session.scheduled_date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          time: session.scheduled_time?.slice(0, 5),
        };
      }
    }

    const results = { whatsapp: false, email: false, errors: [] as string[] };

    // 1. Send WhatsApp via AiSensy
    if (coach.phone) {
      try {
        const waResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: 'coach_child_assigned',
            destination: coach.phone.replace(/\D/g, ''),
            userName: 'Yestoryd',
            templateParams: [
              coachFirstName,                    // {{1}} - Coach name
              childName,                          // {{2}} - Child name
              String(childAge),                   // {{3}} - Child age
              String(readingLevel),               // {{4}} - Reading level
              firstSession.date && firstSession.time 
                ? `${firstSession.date}, ${firstSession.time}` 
                : 'To be scheduled',              // {{5}} - First session
            ],
            media: {},
            buttons: [
              {
                type: 'url',
                url: `https://www.yestoryd.com/coach/dashboard`,
              },
            ],
          }),
        });

        if (waResponse.ok) {
          results.whatsapp = true;
          console.log(`✅ WhatsApp sent to coach ${coach.name} for child ${childName}`);
        } else {
          const waError = await waResponse.text();
          results.errors.push(`WhatsApp failed: ${waError}`);
        }
      } catch (waErr: any) {
        results.errors.push(`WhatsApp error: ${waErr.message}`);
      }
    } else {
      results.errors.push('Coach has no phone number');
    }

    // 2. Send Email via SendGrid
    if (coach.email) {
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const assessmentSummary = 'Assessment data available in dashboard.';

        await sgMail.send({
          to: coach.email,
          from: {
            email: 'engage@yestoryd.com',
            name: 'Yestoryd',
          },
          subject: `👋 New Student Assigned: ${childName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #00abff, #0066cc); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">👋 New Student Assigned!</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none;">
                <p style="font-size: 16px; color: #333;">Hi ${coachFirstName},</p>
                
                <p style="color: #555; line-height: 1.6;">
                  A new student has been assigned to you. Here are the details:
                </p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666;">👧 Name:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #333;">${childName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;">🎂 Age:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #333;">${childAge} years</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;">📊 Reading Level:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #333;">${readingLevel}/10</td>
                    </tr>
                    ${firstSession.date && firstSession.time ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666;">📅 First Session:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #333;">${firstSession.date}, ${firstSession.time}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
                
                <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px; color: #0066cc; font-size: 14px;">📋 Assessment Summary</h3>
                  <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">${assessmentSummary}</p>
                </div>
                
                <p style="color: #555; line-height: 1.6;">
                  Please review the full assessment and parent notes in your dashboard before the first session.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://www.yestoryd.com/coach/dashboard" 
                     style="display: inline-block; background: linear-gradient(135deg, #ff0099, #7B008B); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    View Student Profile
                  </a>
                </div>
                
                <p style="color: #888; font-size: 14px;">
                  Good luck with your new student! If you have any questions, reply to this email.
                </p>
                
                <p style="color: #555;">
                  Best regards,<br>
                  <strong>Team Yestoryd</strong>
                </p>
              </div>
              
              <div style="background: #f9f9f9; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0; color: #888; font-size: 12px;">
                  Yestoryd • AI-Powered Reading Coaching for Kids
                </p>
              </div>
            </div>
          `,
        });

        results.email = true;
        console.log(`✅ Email sent to coach ${coach.name} for child ${childName}`);
      } catch (emailErr: any) {
        results.errors.push(`Email error: ${emailErr.message}`);
      }
    } else {
      results.errors.push('Coach has no email');
    }

    // 3. Log the notification in communication_logs
    await supabase.from('communication_logs').insert({
      template_code: 'C8_coach_child_assigned',
      recipient_type: 'coach',
      recipient_id: coachId,
      recipient_email: coach.email,
      recipient_phone: coach.phone,
      wa_sent: results.whatsapp,
      email_sent: results.email,
      context_data: {
        child_id: childId,
        child_name: childName,
        enrollment_id: enrollmentId,
        first_session: firstSession,
      },
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: results.whatsapp || results.email,
      results,
      message: results.whatsapp || results.email 
        ? `Notification sent to ${coach.name}` 
        : 'Failed to send notification',
    });

  } catch (error: any) {
    console.error('Notify assignment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
