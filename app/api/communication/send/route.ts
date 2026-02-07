// ============================================================
// FILE: app/api/communication/send/route.ts
// ============================================================
// HARDENED VERSION - Secure communication sending
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Authentication required (admin, coach, or internal)
// - Rate limiting (prevent spam)
// - Comprehensive input validation
// - Request tracing
// - Idempotency support
// - Audit logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendCommunication, SendCommunicationParams } from '@/lib/communication';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
// Using getServiceSupabase from api-auth.ts

// Internal API key for server-to-server calls (webhooks, crons)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
  admin: { max: 100, windowMs: 60 * 1000 },      // 100/min for admins
  coach: { max: 20, windowMs: 60 * 1000 },       // 20/min for coaches
  internal: { max: 500, windowMs: 60 * 1000 },   // 500/min for internal
  default: { max: 5, windowMs: 60 * 1000 },      // 5/min fallback
};

function checkRateLimit(
  identifier: string, 
  role: 'admin' | 'coach' | 'internal' | 'default'
): { success: boolean; remaining: number } {
  const now = Date.now();
  const limits = RATE_LIMITS[role];
  const key = `${identifier}_${role}`;
  
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + limits.windowMs });
    return { success: true, remaining: limits.max - 1 };
  }

  if (record.count >= limits.max) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limits.max - record.count };
}

// --- VALIDATION SCHEMA ---
const CommunicationSchema = z.object({
  templateCode: z.string()
    .min(1, 'templateCode is required')
    .max(100, 'templateCode too long')
    .regex(/^[a-z0-9_]+$/, 'templateCode must be lowercase alphanumeric with underscores'),
  
  recipientType: z.enum(['parent', 'coach', 'admin'], {
    errorMap: () => ({ message: 'recipientType must be parent, coach, or admin' }),
  }),
  
  recipientId: z.string().uuid().optional(),
  
  recipientPhone: z.string()
    
    .optional(),
  
  recipientEmail: z.string()
    .email('Invalid email format')
    .max(255)
    .optional(),
  
  recipientName: z.string()
    .max(100)
    .optional(),
  
  variables: z.record(z.string())
    .refine(obj => Object.keys(obj).length <= 50, 'Too many variables (max 50)'),
  
  relatedEntityType: z.enum(['child', 'enrollment', 'session', 'discovery_call', 'payment'])
    .optional(),
  
  relatedEntityId: z.string().uuid().optional(),
  
  skipChannels: z.array(z.enum(['whatsapp', 'email', 'sms']))
    .optional(),
  
  // Idempotency key to prevent duplicate sends
  idempotencyKey: z.string().max(100).optional(),
});

type CommunicationInput = z.infer<typeof CommunicationSchema>;

// --- AUTHENTICATION ---
async function authenticateRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  role: 'admin' | 'coach' | 'internal' | 'default';
  identifier: string;
  error?: string;
}> {
  // 1. Check for internal API key (server-to-server)
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && INTERNAL_API_KEY && apiKey === INTERNAL_API_KEY) {
    return { authenticated: true, role: 'internal', identifier: 'internal' };
  }

  // 2. Check for session (user-facing) using api-auth
  const auth = await requireAdminOrCoach();
  
  if (!auth.authorized || !auth.email) {
    return { 
      authenticated: false, 
      role: 'default', 
      identifier: 'anonymous',
      error: 'Authentication required' 
    };
  }

  const userRole = auth.role;
  const email = auth.email!;

  if (userRole === 'admin') {
    return { authenticated: true, role: 'admin', identifier: email };
  }

  if (userRole === 'coach') {
    return { authenticated: true, role: 'coach', identifier: email };
  }

  // Parents shouldn't be able to send arbitrary communications
  return { 
    authenticated: false, 
    role: 'default', 
    identifier: auth.email || 'unknown',
    error: 'Insufficient permissions - admin or coach required' 
  };
}

// --- IDEMPOTENCY CHECK ---
async function checkIdempotency(
  key: string,
  requestId: string
): Promise<{ isDuplicate: boolean; previousResult?: any }> {
  const supabase = getServiceSupabase();

  // Check if this idempotency key was already used
  const { data: existing } = await supabase
    .from('communication_logs')
    .select('id, status, response_data')
    .eq('idempotency_key', key)
    .single();

  if (existing) {
    console.log(JSON.stringify({
      requestId,
      event: 'idempotent_request_detected',
      idempotencyKey: key,
      previousLogId: existing.id,
    }));
    return { isDuplicate: true, previousResult: existing };
  }

  return { isDuplicate: false };
}

// --- AUDIT LOGGING ---
async function logCommunicationAttempt(
  requestId: string,
  params: CommunicationInput,
  senderEmail: string,
  senderRole: string,
  success: boolean,
  error?: string
) {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('activity_log').insert({
      user_email: senderEmail,
      action: 'communication_send',
      details: {
        request_id: requestId,
        template_code: params.templateCode,
        recipient_type: params.recipientType,
        recipient_email: params.recipientEmail,
        recipient_phone: params.recipientPhone ? '***' + params.recipientPhone.slice(-4) : null,
        sender_role: senderRole,
        success,
        error,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log communication attempt:', err);
  }
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate request
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: auth.error,
        identifier: auth.identifier,
      }));
      
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // 2. Check rate limit
    const rateLimit = checkRateLimit(auth.identifier, auth.role);
    
    if (!rateLimit.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        identifier: auth.identifier,
        role: auth.role,
      }));

      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      );
    }

    // 3. Parse and validate input
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = CommunicationSchema.safeParse(body);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));

      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const params = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'communication_request',
      templateCode: params.templateCode,
      recipientType: params.recipientType,
      senderRole: auth.role,
      senderIdentifier: auth.identifier,
    }));

    // 4. Check idempotency (if key provided)
    if (params.idempotencyKey) {
      const idempotencyCheck = await checkIdempotency(params.idempotencyKey, requestId);
      
      if (idempotencyCheck.isDuplicate) {
        return NextResponse.json({
          success: true,
          message: 'Request already processed (idempotent)',
          previousResult: idempotencyCheck.previousResult,
          requestId,
        });
      }
    }

    // 5. Validate recipient has at least one contact method
    if (!params.recipientPhone && !params.recipientEmail && !params.recipientId) {
      return NextResponse.json(
        { success: false, error: 'At least one of recipientPhone, recipientEmail, or recipientId is required' },
        { status: 400 }
      );
    }

    // 6. Send communication
    const sendParams: SendCommunicationParams = {
      templateCode: params.templateCode,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      recipientPhone: params.recipientPhone,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      variables: params.variables,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      skipChannels: params.skipChannels,
    };

    const result = await sendCommunication(sendParams);

    // 7. Log the attempt
    await logCommunicationAttempt(
      requestId,
      params,
      auth.identifier,
      auth.role,
      result.success,
      'error' in result ? String(result.error) : undefined
    );

    // 8. Return response
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'communication_complete',
      success: result.success,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      ...result,
      requestId,
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
      event: 'communication_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET(request: NextRequest) {
  // Only admins can see detailed status
  const auth = await authenticateRequest(request);

  if (auth.authenticated && auth.role === 'admin') {
    return NextResponse.json({
      status: 'ok',
      service: 'Communication API v2.0 (Hardened)',
      features: [
        'authentication',
        'rate_limiting',
        'validation',
        'idempotency',
        'audit_logging',
      ],
      endpoints: {
        send: 'POST /api/communication/send',
      },
      rateLimits: RATE_LIMITS,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Communication API is running',
  });
}
