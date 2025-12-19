// app/api/coach-assessment/interview-feedback/route.ts
// Save post-interview assessment feedback

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { 
      applicationId,
      outcome, // 'proceed' | 'reject' | 'hold'
      interviewScore, // 1-5
      feedback, // Object with various fields
      notes,
      reviewedBy
    } = await request.json();

    if (!applicationId || !outcome) {
      return NextResponse.json(
        { error: 'Application ID and outcome required' },
        { status: 400 }
      );
    }

    // Fetch application
    const { data: application, error: fetchError } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Determine new status based on outcome
    let newStatus = 'interview_completed';
    if (outcome === 'proceed') {
      newStatus = 'approved';
    } else if (outcome === 'reject') {
      newStatus = 'rejected';
    } else if (outcome === 'hold') {
      newStatus = 'on_hold';
    }

    // Update application
    const { error: updateError } = await supabase
      .from('coach_applications')
      .update({
        status: newStatus,
        interview_completed_at: new Date().toISOString(),
        interview_outcome: outcome,
        interview_notes: notes,
        interview_feedback: feedback,
        interview_score: interviewScore,
        reviewed_by: reviewedBy || 'admin@yestoryd.com',
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send appropriate email based on outcome
    if (outcome === 'proceed') {
      // Send approval email
      await sgMail.send({
        to: application.email,
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd Academy' },
        subject: '🎉 Welcome to Yestoryd Academy!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://yestoryd.com/images/logo.png" alt="Yestoryd" style="height: 40px;" />
            </div>
            
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
              Congratulations, ${application.name}! 🎊
            </h1>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              We're thrilled to welcome you to the Yestoryd Academy family! After reviewing your application and our conversation, we believe you'll be a wonderful addition to our team of reading coaches.
            </p>
            
            <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
              <p style="color: #065f46; font-size: 18px; font-weight: bold; margin: 0;">
                ✅ You're Approved!
              </p>
            </div>
            
            <h3 style="color: #1e293b; margin-top: 30px;">📋 Next Steps:</h3>
            <ol style="color: #475569; line-height: 1.8;">
              <li>You'll receive a Partnership Agreement via email shortly</li>
              <li>Complete the onboarding training (2 hours)</li>
              <li>Set up your coach profile</li>
              <li>Start receiving student assignments!</li>
            </ol>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-top: 20px;">
              Rucha will be in touch within 24-48 hours with onboarding details.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              Welcome aboard!<br/>
              <strong>Team Yestoryd</strong>
            </p>
          </div>
        `
      });
    } else if (outcome === 'reject') {
      // Send rejection email
      await sgMail.send({
        to: application.email,
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd Academy' },
        subject: 'Yestoryd Academy - Application Update',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://yestoryd.com/images/logo.png" alt="Yestoryd" style="height: 40px;" />
            </div>
            
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
              Thank You, ${application.name}
            </h1>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Thank you for taking the time to apply to Yestoryd Academy and speak with us. We truly appreciate your interest in helping children become confident readers.
            </p>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              After careful consideration, we've decided not to move forward with your application at this time. This decision reflects our current needs and doesn't diminish your qualifications or potential.
            </p>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              We encourage you to reapply in the future if circumstances change. We wish you the very best in your endeavors.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              Warm regards,<br/>
              <strong>Team Yestoryd</strong>
            </p>
          </div>
        `
      });
    }
    // For 'hold', we don't send an email - will follow up later

    return NextResponse.json({
      success: true,
      applicationId,
      newStatus,
      outcome
    });

  } catch (error: any) {
    console.error('Interview feedback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Fetch interview feedback form fields
export async function GET(request: NextRequest) {
  return NextResponse.json({
    fields: {
      outcome: {
        type: 'select',
        label: 'Interview Outcome',
        required: true,
        options: [
          { value: 'proceed', label: '✅ Proceed - Approve for Onboarding' },
          { value: 'hold', label: '⏸️ Hold - Need more time/info' },
          { value: 'reject', label: '❌ Reject - Not a fit' }
        ]
      },
      interviewScore: {
        type: 'rating',
        label: 'Overall Interview Score',
        required: true,
        min: 1,
        max: 5
      },
      feedback: {
        communication: {
          type: 'rating',
          label: 'Communication Skills',
          min: 1,
          max: 5
        },
        enthusiasm: {
          type: 'rating',
          label: 'Enthusiasm for Teaching',
          min: 1,
          max: 5
        },
        childFocus: {
          type: 'rating',
          label: 'Child-Centric Approach',
          min: 1,
          max: 5
        },
        professionalism: {
          type: 'rating',
          label: 'Professionalism',
          min: 1,
          max: 5
        },
        availability: {
          type: 'rating',
          label: 'Availability Match',
          min: 1,
          max: 5
        }
      },
      notes: {
        type: 'textarea',
        label: 'Interview Notes',
        placeholder: 'Key observations, concerns, highlights...'
      },
      redFlags: {
        type: 'checkboxes',
        label: 'Red Flags (if any)',
        options: [
          'Communication issues',
          'Unrealistic expectations',
          'Lack of patience',
          'Schedule conflicts',
          'Technical setup issues',
          'Other concerns'
        ]
      },
      strengths: {
        type: 'checkboxes',
        label: 'Strengths',
        options: [
          'Great with children',
          'Patient and empathetic',
          'Strong communicator',
          'Flexible schedule',
          'Teaching experience',
          'Quick learner'
        ]
      }
    }
  });
}
