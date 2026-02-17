// ============================================================
// FILE: app/api/discovery-call/[id]/send-payment-link/route.ts
// ============================================================
// HARDENED VERSION - Send payment link after discovery call
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Authentication required (coach or admin)
// - Coach can only send for their assigned calls
// - UUID validation
// - Rate limiting (prevent spam)
// - Audit logging
// - Actual email/WhatsApp sending
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 3,       // 3 payment links
  windowMs: 60 * 60 * 1000, // per hour per discovery call
};

function checkRateLimit(discoveryCallId: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const key = `payment_link_${discoveryCallId}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { success: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: RATE_LIMIT.maxRequests - record.count };
}

// --- VALIDATION ---
const SendPaymentLinkSchema = z.object({
  sendVia: z.enum(['whatsapp', 'email', 'both']).default('both'),
  customMessage: z.string().max(500).optional(),
});

const ParamsSchema = z.object({
  id: z.string().uuid('Invalid discovery call ID'),
});

// --- HELPER: Generate payment link ---
function generatePaymentLink(call: any): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
  
  // Use URLSearchParams for proper encoding
  const params = new URLSearchParams();
  if (call.parent_name) params.set('parentName', call.parent_name);
  if (call.parent_email) params.set('parentEmail', call.parent_email);
  if (call.parent_phone) params.set('parentPhone', call.parent_phone);
  if (call.child_name) params.set('childName', call.child_name);
  if (call.child_age) params.set('childAge', call.child_age.toString());
  params.set('discoveryCallId', call.id);
  params.set('source', 'discovery_call');
  
  return `${baseUrl}/checkout?${params.toString()}`;
}

// --- HELPER: Mask PII for response ---
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return '***' + phone.slice(-4);
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

// --- MAIN HANDLER ---
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Validate route params
    const paramsValidation = ParamsSchema.safeParse(params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid discovery call ID' },
        { status: 400 }
      );
    }
    const { id } = paramsValidation.data;

    // 2. Authenticate
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRole = auth.role || 'coach';
    const userCoachId = auth.coachId;
    const userEmail = auth.email || '';

    // 3. Parse and validate body
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK, use defaults
    }

    const validation = SendPaymentLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }
    const { sendVia, customMessage } = validation.data;

    const supabase = getServiceSupabase();

    // 4. Fetch discovery call with coach
    const { data: call, error: fetchError } = await supabase
      .from('discovery_calls')
      .select(`
        *,
        coach:coaches!assigned_coach_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !call) {
      console.log(JSON.stringify({
        requestId,
        event: 'discovery_call_not_found',
        discoveryCallId: id,
      }));

      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // 5. Authorization check
    const isAdmin = userRole === 'admin';
    const isAssignedCoach = userRole === 'coach' && call.assigned_coach_id === userCoachId;

    if (!isAdmin && !isAssignedCoach) {
      console.log(JSON.stringify({
        requestId,
        event: 'authorization_failed',
        userEmail,
        userRole,
        assignedCoachId: call.assigned_coach_id,
      }));

      return NextResponse.json(
        { error: 'You can only send payment links for your assigned calls' },
        { status: 403 }
      );
    }

    // 6. Check call status
    if (call.status === 'converted') {
      return NextResponse.json(
        { error: 'Payment already completed for this call' },
        { status: 400 }
      );
    }

    if (call.status === 'cancelled' || call.status === 'no_show') {
      return NextResponse.json(
        { error: `Cannot send payment link for ${call.status} call` },
        { status: 400 }
      );
    }

    // 7. Rate limiting
    const rateLimit = checkRateLimit(id);
    if (!rateLimit.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        discoveryCallId: id,
      }));

      return NextResponse.json(
        { 
          error: 'Too many payment links sent for this call. Please wait before sending again.',
          retryAfter: '1 hour',
        },
        { 
          status: 429,
          headers: { 'Retry-After': '3600' },
        }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'send_payment_link_request',
      discoveryCallId: id,
      sendVia,
      senderEmail: userEmail,
      senderRole: userRole,
    }));

    // 8. Generate payment link
    const paymentLink = generatePaymentLink(call);

    // 9. Send via requested channels
    const sendResults: { whatsapp?: boolean; email?: boolean } = {};

    if (sendVia === 'whatsapp' || sendVia === 'both') {
      if (call.parent_phone) {
        try {
          const { sendCommunication } = await import('@/lib/communication');
          
          const result = await sendCommunication({
            templateCode: 'discovery_payment_link',
            recipientType: 'parent',
            recipientPhone: call.parent_phone,
            recipientEmail: call.parent_email,
            recipientName: call.parent_name,
            variables: {
              parent_name: call.parent_name,
              child_name: call.child_name,
              payment_link: paymentLink,
              coach_name: call.coach?.name || 'Your Coach',
              custom_message: customMessage || '',
            },
            relatedEntityType: 'discovery_call',
            relatedEntityId: id,
            skipChannels: sendVia === 'whatsapp' ? ['email'] : [],
          });

          sendResults.whatsapp = result.success;

          console.log(JSON.stringify({
            requestId,
            event: 'whatsapp_sent',
            success: result.success,
          }));
        } catch (whatsappError) {
          console.error(JSON.stringify({
            requestId,
            event: 'whatsapp_failed',
            error: (whatsappError as Error).message,
          }));
          sendResults.whatsapp = false;
        }
      } else {
        sendResults.whatsapp = false;
      }
    }

    if (sendVia === 'email' || sendVia === 'both') {
      if (call.parent_email) {
        try {
          const { sendCommunication } = await import('@/lib/communication');
          
          const result = await sendCommunication({
            templateCode: 'discovery_payment_link_email',
            recipientType: 'parent',
            recipientEmail: call.parent_email,
            recipientName: call.parent_name,
            variables: {
              parent_name: call.parent_name,
              child_name: call.child_name,
              payment_link: paymentLink,
              coach_name: call.coach?.name || 'Your Coach',
              custom_message: customMessage || '',
            },
            relatedEntityType: 'discovery_call',
            relatedEntityId: id,
            skipChannels: ['whatsapp', 'sms'],
          });

          sendResults.email = result.success;

          console.log(JSON.stringify({
            requestId,
            event: 'email_sent',
            success: result.success,
          }));
        } catch (emailError) {
          console.error(JSON.stringify({
            requestId,
            event: 'email_failed',
            error: (emailError as Error).message,
          }));
          sendResults.email = false;
        }
      } else {
        sendResults.email = false;
      }
    }

    // 10. Update discovery call
    const { error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        payment_link: paymentLink,
        payment_link_sent_at: new Date().toISOString(),
        payment_link_sent_by: userEmail,
        payment_link_send_count: (call.payment_link_send_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(JSON.stringify({
        requestId,
        event: 'update_failed',
        error: updateError.message,
      }));
    }

    // 11. Audit log
    try {
      await supabase.from('activity_log').insert({
        user_email: userEmail,
      user_type: 'admin',
        action: 'payment_link_sent',
        metadata: {
          request_id: requestId,
          discovery_call_id: id,
          child_name: call.child_name,
          send_via: sendVia,
          whatsapp_sent: sendResults.whatsapp,
          email_sent: sendResults.email,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Audit log failed:', logError);
    }

    // 12. Generate wa.me link for manual fallback
    let waLink: string | null = null;
    if (call.parent_phone && !sendResults.whatsapp) {
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('template')
        .eq('slug', 'discovery-payment-link')
        .single();

      if (template) {
        const whatsappMessage = template.template
          .replace(/\{\{parentName\}\}/g, call.parent_name || 'Parent')
          .replace(/\{\{childName\}\}/g, call.child_name || 'your child')
          .replace(/\{\{paymentLink\}\}/g, paymentLink)
          .replace(/\{\{coachName\}\}/g, call.coach?.name || 'Your Coach');

        const cleanPhone = call.parent_phone.replace(/\D/g, '');
        const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        waLink = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(whatsappMessage)}`;
      }
    }

    // 13. Return response
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'payment_link_sent',
      discoveryCallId: id,
      sendVia,
      results: sendResults,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Payment link generated and sent',
      paymentLink,
      sendResults,
      waLink, // Fallback for manual sending
      parentPhone: maskPhone(call.parent_phone),
      parentEmail: maskEmail(call.parent_email),
      rateLimitRemaining: rateLimit.remaining,
    }, {
      headers: {
        'X-Request-Id': requestId,
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'send_payment_link_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

// --- GET: Check payment link status ---
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate params
    const paramsValidation = ParamsSchema.safeParse(params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid discovery call ID' },
        { status: 400 }
      );
    }
    const { id } = paramsValidation.data;

    // Authenticate
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: call, error } = await supabase
      .from('discovery_calls')
      .select('id, payment_link, payment_link_sent_at, payment_link_send_count, status')
      .eq('id', id)
      .single();

    if (error || !call) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      hasPaymentLink: !!call.payment_link,
      sentAt: call.payment_link_sent_at,
      sendCount: call.payment_link_send_count || 0,
      status: call.status,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}





