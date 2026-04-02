// ============================================================
// FILE: app/api/admin/completion/extend/route.ts
// ============================================================
// HARDENED VERSION - Extend Program End Date
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

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const extendSchema = z.object({
  enrollmentId: z.string().uuid('Invalid enrollment ID'),
  days: z.number().min(1).max(90).default(14),
  reason: z.string().max(500).optional(),
});

export const POST = withApiHandler(async (request, { auth, supabase, requestId }) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = extendSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { enrollmentId, days, reason } = validation.data;

    // Get current enrollment
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(`
        id,
        program_end,
        original_program_end,
        extension_count,
        child_id,
        billing_model,
        program_description,
        children!child_id (name, child_name, parent_email)
      `)
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !enrollment) {
      return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }

    // Calculate new end date
    if (!enrollment.program_end) {
      return NextResponse.json({ success: false, error: 'Enrollment has no program end date' }, { status: 400 });
    }
    const currentEnd = new Date(enrollment.program_end);
    const newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + days);

    // Store original end date if first extension
    const originalEnd = enrollment.original_program_end || enrollment.program_end;
    const newExtensionCount = (enrollment.extension_count || 0) + 1;

    // Update enrollment
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        program_end: newEndDate.toISOString().split('T')[0],
        original_program_end: originalEnd,
        extension_count: newExtensionCount,
        risk_level: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'completion_extend_db_error', error: updateError.message }));
      return NextResponse.json({ success: false, error: 'Failed to extend program' }, { status: 500 });
    }

    // Log the event
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: 'program_extended',
      event_data: {
        previous_end: enrollment.program_end,
        new_end: newEndDate.toISOString().split('T')[0],
        days_added: days,
        reason: reason || 'Admin extended',
        extension_number: newExtensionCount,
        extended_by: auth.email,
      },
      triggered_by: 'admin',
    });

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'enrollment_extended',
      metadata: {
        request_id: requestId,
        enrollment_id: enrollmentId,
        previous_end: enrollment.program_end,
        new_end: newEndDate.toISOString().split('T')[0],
        days_added: days,
        extension_count: newExtensionCount,
        reason: reason || null,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    // Notify parent (optional)
    const childName = (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'your child';
    const parentEmail = (enrollment.children as any)?.parent_email;

    if (parentEmail) {
      try {
        const { sendEmail } = require('@/lib/email/resend-client');

        await sendEmail({
          to: parentEmail,
          from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd' },
          subject: `Good News! ${childName}'s Program Extended`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1F2937;">Program Extended!</h2>
              <p>We've extended ${childName}'s ${getProgramLabel(enrollment)} to ensure they complete all sessions.</p>
              <p><strong>New End Date:</strong> ${newEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Please ensure remaining sessions are scheduled. Contact us if you need any assistance.</p>
              <p>Best,<br>Team Yestoryd</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Extension email error:', emailError);
        // Non-critical - don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      requestId,
      previousEnd: enrollment.program_end,
      newEnd: newEndDate.toISOString().split('T')[0],
      extensionCount: newExtensionCount,
      daysAdded: days,
    });
}, { auth: 'admin' });
