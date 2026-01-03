// =============================================================================
// FILE: app/api/admin/completion/extend/route.ts
// PURPOSE: Extend program end date for overdue/at-risk enrollments
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { enrollmentId, days = 14, reason } = await request.json();

    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'Enrollment ID required' },
        { status: 400 }
      );
    }

    // Get current enrollment
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(`
        id,
        program_end,
        original_program_end,
        extension_count,
        child_id,
        children!child_id (name, child_name, parent_email)
      `)
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Calculate new end date
    const currentEnd = new Date(enrollment.program_end);
    const newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + days);

    // Store original end date if first extension
    const originalEnd = enrollment.original_program_end || enrollment.program_end;

    // Update enrollment
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        program_end: newEndDate.toISOString().split('T')[0],
        original_program_end: originalEnd,
        extension_count: (enrollment.extension_count || 0) + 1,
        risk_level: 'active', // Reset risk level
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to extend program' },
        { status: 500 }
      );
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
        extension_number: (enrollment.extension_count || 0) + 1,
      },
      triggered_by: 'admin',
    });

    // Notify parent (optional)
    const childName = (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'your child';
    const parentEmail = (enrollment.children as any)?.parent_email;

    if (parentEmail) {
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.send({
          to: parentEmail,
          from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
          subject: `Good News! ${childName}'s Program Extended`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1F2937;">Program Extended! 📚</h2>
              <p>We've extended ${childName}'s reading program to ensure they complete all sessions.</p>
              <p><strong>New End Date:</strong> ${newEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Please ensure remaining sessions are scheduled. Contact us if you need any assistance.</p>
              <p>Best,<br>Team Yestoryd</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Extension email error:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      previousEnd: enrollment.program_end,
      newEnd: newEndDate.toISOString().split('T')[0],
      extensionCount: (enrollment.extension_count || 0) + 1,
      daysAdded: days,
    });

  } catch (error: any) {
    console.error('Extend program error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
