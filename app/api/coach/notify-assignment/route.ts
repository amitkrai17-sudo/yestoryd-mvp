// file: app/api/coach/notify-assignment/route.ts
// Sends WhatsApp + Email notification to coach when a child is assigned
// Called from: Admin CRM when assigning coach, or auto-assignment flow

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { sendNotification } from '@/lib/communication/notify';

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

    // 1. Send WhatsApp via unified notify engine
    if (coach.phone) {
      const waResult = await sendNotification(
        'coach_child_assigned_v4',
        coach.phone,
        {
          coach_first_name: coachFirstName,
          child_name: childName,
          child_age: String(childAge),
          reading_level: String(readingLevel),
          first_session: firstSession.date && firstSession.time
            ? `${firstSession.date}, ${firstSession.time}`
            : 'To be scheduled',
        },
        {
          triggeredBy: 'admin',
          contextType: enrollmentId ? 'enrollment' : 'child',
          contextId: enrollmentId ?? childId,
        },
      );
      if (waResult.success) {
        results.whatsapp = true;
      } else {
        results.errors.push(`WhatsApp failed: ${waResult.reason}`);
      }
    } else {
      results.errors.push('Coach has no phone number');
    }

    // 2. Send Email via Resend
    if (coach.email) {
      try {
        const { sendEmail } = require('@/lib/email/resend-client');

        const assessmentSummary = 'Assessment data available in dashboard.';

        await sendEmail({
          to: coach.email,
          from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd' },
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
