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
import { z } from 'zod';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { getProgramLabel } from '@/lib/utils/program-label';
import { sendNotification } from '@/lib/communication/notify';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const sendAssessmentSchema = z.object({
  enrollmentId: z.string().uuid('Invalid enrollment ID'),
  parentEmail: z.string().email('Invalid email'),
  childName: z.string().min(1).max(100),
});

export const POST = withApiHandler(async (request, { auth, supabase, requestId }) => {
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

    // Validated — proceed

    // Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        child_id,
        parent_id,
        billing_model,
        program_description,
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

      const programLabel = getProgramLabel(enrollment);

      await sendEmail({
        to: parentEmail,
        from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd' },
        subject: `${childName}'s Final Assessment — See How Far They've Come!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF0099;">Congratulations!</h2>
            <p>Hi there,</p>
            <p><strong>${childName}</strong> has almost completed ${programLabel}! It's time to see how much they've improved.</p>
            <p>Please complete the final assessment so we can create a personalized progress report comparing their journey from Day 1 to now.</p>
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

    // Send via WhatsApp (unified notify engine)
    let whatsappSent = false;
    try {
      if (enrollment.parent_id) {
        const waResult = await sendNotification(
          'parent_final_assessment_v3',
          enrollment.parent_id,
          { child_name: childName, assessment_link: assessmentLink },
          {
            triggeredBy: 'admin',
            triggeredByUserId: auth.userId ?? null,
            contextType: 'enrollment',
            contextId: enrollment.id,
          },
        );
        whatsappSent = waResult.success;
      }
    } catch (waError) {
      console.error('WhatsApp send error:', waError);
    }

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Final assessment link sent',
      link: assessmentLink,
      emailSent,
      whatsappSent,
    });
}, { auth: 'admin' });
