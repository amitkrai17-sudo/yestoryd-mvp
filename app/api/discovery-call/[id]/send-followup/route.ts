// ============================================================
// FILE: app/api/discovery-call/[id]/send-followup/route.ts
// ============================================================
// HARDENED VERSION - Send 24hr Follow-up Message
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin/Coach authentication
// - Coach ownership verification
// - UUID validation
// - Rate limiting (prevent spam)
// - PII masking in response
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- HELPER: Mask phone number ---
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 6) return '***';
  return '***' + phone.slice(-4);
}

// --- HELPER: Mask email ---
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? local.slice(0, 2) + '***' : '***';
  return `${maskedLocal}@${domain}`;
}

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 per minute

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { id } = params;

    // 1. Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid discovery call ID format' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    const userRole = (session.user as any).role as string;
    const sessionCoachId = (session.user as any).coachId as string | undefined;

    // 3. Authorize - Admin or Coach only
    if (!['admin', 'coach'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Access denied. Admin or Coach role required.' },
        { status: 403 }
      );
    }

    // 4. Rate limiting
    if (!checkRateLimit(userEmail)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending more follow-ups.' },
        { status: 429 }
      );
    }

    const supabase = getSupabase();

    // 5. Fetch discovery call with coach details
    const { data: call, error: fetchError } = await supabase
      .from('discovery_calls')
      .select(`
        *,
        coach:coaches!coach_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !call) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // 6. AUTHORIZATION: Coaches can only send follow-up for their assigned calls
    if (userRole === 'coach') {
      if (call.coach_id !== sessionCoachId) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Coach tried to send followup for unassigned call',
          userEmail,
          callId: id,
          assignedCoachId: call.coach_id,
          sessionCoachId,
        }));

        return NextResponse.json(
          { error: 'You can only send follow-ups for calls assigned to you' },
          { status: 403 }
        );
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'send_followup_request',
      userEmail,
      userRole,
      callId: id,
    }));

    // 7. Check if already followed up
    if (call.followup_sent_at) {
      return NextResponse.json(
        { 
          error: 'Follow-up already sent', 
          sentAt: call.followup_sent_at,
          note: 'Only ONE follow-up is allowed per discovery call.',
        },
        { status: 400 }
      );
    }

    // 8. Check if already converted
    if (call.converted_to_enrollment) {
      return NextResponse.json(
        { error: 'Lead already converted, no follow-up needed' },
        { status: 400 }
      );
    }

    // 9. Check if payment link exists (required for follow-up)
    if (!call.payment_link) {
      return NextResponse.json(
        { 
          error: 'Payment link not generated yet',
          hint: 'Please generate a payment link using "Send Payment Link" before sending follow-up.',
          action_required: 'generate_payment_link',
        },
        { status: 400 }
      );
    }

    // 10. Get follow-up template
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
        .replace(/\{\{parentName\}\}/g, call.parent_name || 'Parent')
        .replace(/\{\{childName\}\}/g, call.child_name || 'your child')
        .replace(/\{\{coachName\}\}/g, call.coach?.name || 'Your Coach')
        .replace(/\{\{childGoal\}\}/g, childGoal)
        .replace(/\{\{paymentLink\}\}/g, call.payment_link);
    } else {
      // Default template
      followupMessage = `Hi ${call.parent_name || 'there'},\n\nThank you for speaking with us about ${call.child_name || 'your child'}'s reading journey. We're excited to help them ${childGoal}!\n\nReady to get started? Here's your enrollment link: ${call.payment_link}\n\nWarm regards,\n${call.coach?.name || 'Yestoryd Team'}`;
    }

    // Generate wa.me link (only if phone exists)
    const waLink = call.parent_phone
      ? `https://wa.me/91${call.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(followupMessage)}`
      : null;

    // 11. Update discovery call with follow-up timestamp
    const { error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        followup_sent_at: new Date().toISOString(),
        followup_count: (call.followup_count || 0) + 1,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating followup status:', updateError);
    }

    // 12. Log the follow-up
    await supabase.from('activity_log').insert({
      user_email: userEmail,
      action: 'discovery_followup_sent',
      details: {
        request_id: requestId,
        discovery_call_id: id,
        child_name: call.child_name,
        followup_count: (call.followup_count || 0) + 1,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'followup_generated',
      callId: id,
      hasWaLink: !!waLink,
      duration: `${duration}ms`,
    }));

    // 13. Return response with MASKED PII for coaches
    return NextResponse.json({
      success: true,
      requestId,
      message: 'Follow-up message generated',
      waLink, // Full link for actual sending
      followupMessage,
      // Mask PII for coaches (admins see full data)
      parentPhone: userRole === 'admin' ? call.parent_phone : maskPhone(call.parent_phone),
      parentEmail: userRole === 'admin' ? call.parent_email : maskEmail(call.parent_email),
      note: 'This is the ONLY follow-up. No further sales messages will be sent.',
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'send_followup_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
