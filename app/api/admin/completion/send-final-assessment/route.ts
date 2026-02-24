// ============================================================
// FILE: app/api/admin/completion/send-final-assessment/route.ts
// ============================================================
// HARDENED VERSION - Send Final Assessment Link
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const sendAssessmentSchema = z.object({
  enrollmentId: z.string().uuid('Invalid enrollment ID'),
  parentEmail: z.string().email('Invalid email'),
  childName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'send_final_assessment_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = sendAssessmentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { enrollmentId, parentEmail, childName } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'send_final_assessment_request', adminEmail: auth.email, enrollmentId, parentEmail }));

    const supabase = getServiceSupabase();

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
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
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
        sent_by: auth.email,
      },
      triggered_by: 'admin',
    });

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'final_assessment_sent',
      metadata: {
        request_id: requestId,
        enrollment_id: enrollmentId,
        parent_email: parentEmail,
        child_name: childName,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // Send via Resend
    let emailSent = false;
    try {
      const { sendEmail } = require('@/lib/email/resend-client');

      await sendEmail({
        to: parentEmail,
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
        subject: `🎉 ${childName}'s Final Reading Assessment - See How Far They've Come!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF0099;">Congratulations! 🎉</h2>
            <p>Hi there,</p>
            <p><strong>${childName}</strong> has almost completed the 12-week reading program! It's time to see how much they've improved.</p>
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
      emailSent = true;
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }

    // Send via AiSensy WhatsApp
    let whatsappSent = false;
    try {
      const { data: parent } = enrollment.parent_id ? await supabase
        .from('parents')
        .select('phone')
        .eq('id', enrollment.parent_id)
        .single() : { data: null };

      if (parent?.phone) {
        const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: 'final_assessment_request',
            destination: parent.phone.replace(/\D/g, ''),
            userName: 'Yestoryd',
            templateParams: [childName, assessmentLink],
          }),
        });
        whatsappSent = response.ok;
      }
    } catch (waError) {
      console.error('WhatsApp send error:', waError);
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'send_final_assessment_success', enrollmentId, emailSent, whatsappSent, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Final assessment link sent',
      link: assessmentLink,
      emailSent,
      whatsappSent,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'send_final_assessment_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}
