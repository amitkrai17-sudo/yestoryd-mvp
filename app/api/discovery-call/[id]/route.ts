// ============================================================
// FILE: app/api/discovery-call/[id]/route.ts
// ============================================================
// HARDENED VERSION - Discovery Call Details with AI Questions
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin/Coach authentication required
// - Coaches can only access their assigned calls
// - UUID validation
// - PII masking for coaches
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

// --- HELPER: Mask PII ---
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 6) return '***';
  return '***' + phone.slice(-4);
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 
    ? local.slice(0, 2) + '***' 
    : '***';
  return `${maskedLocal}@${domain}`;
}

// ============================================================
// AI-suggested questions based on assessment data
// ============================================================
function generateSuggestedQuestions(call: any): string[] {
  const questions: string[] = [];
  const childName = call.child_name || 'your child';
  
  // Base questions for all calls
  questions.push(`How often does ${childName} read at home currently?`);
  questions.push(`Does ${childName} enjoy reading or resist it?`);
  questions.push(`What are your goals for ${childName}'s reading in 3 months?`);
  questions.push(`Has ${childName} had any reading support before?`);
  questions.push(`What time works best for weekly sessions?`);
  
  // Score-based questions
  if (call.assessment_score !== null && call.assessment_score !== undefined) {
    if (call.assessment_score < 5) {
      questions.push(`I noticed ${childName} scored ${call.assessment_score}/10. Have you observed any specific struggles at home?`);
      questions.push(`Does ${childName} get frustrated when reading difficult words?`);
    } else if (call.assessment_score >= 7) {
      questions.push(`${childName} scored well at ${call.assessment_score}/10! What would you like to focus on - speed, comprehension, or confidence?`);
    }
  }
  
  // Age-based questions
  if (call.child_age) {
    if (call.child_age <= 5) {
      questions.push(`At ${call.child_age} years old, we focus a lot on phonics and letter sounds. Is ${childName} familiar with the alphabet?`);
    } else if (call.child_age >= 8) {
      questions.push(`For ${call.child_age}-year-olds, we often work on comprehension and reading fluency. Does ${childName} understand what they read?`);
    }
  }
  
  // WPM-based questions
  if (call.assessment_wpm) {
    if (call.assessment_wpm < 60) {
      questions.push(`${childName}'s reading speed is ${call.assessment_wpm} words per minute. Would you like us to focus on building fluency?`);
    }
  }
  
  // Closing questions
  questions.push(`Any specific concerns about ${childName}'s reading that we haven't discussed?`);
  
  return questions;
}

// ============================================================
// Closing prompts for the coach (with dynamic pricing)
// ============================================================
async function generateClosingPrompts(call: any, supabase: any): Promise<string[]> {
  const childName = call.child_name || 'your child';
  
  // Fetch current price from pricing_plans (single source of truth)
  // Managed via Admin → Site Settings → Pricing tab
  let price = '₹5,999'; // Fallback default
  let sessions = '9';
  
  try {
    const { data: pricingPlan } = await supabase
      .from('pricing_plans')
      .select('discounted_price, sessions, label')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (pricingPlan?.discounted_price) {
      price = `₹${Number(pricingPlan.discounted_price).toLocaleString('en-IN')}`;
      sessions = pricingPlan.sessions?.toString() || '9';
    }
  } catch (err) {
    console.warn('Could not fetch program price from pricing_plans, using default');
  }
  
  return [
    `Based on ${childName}'s assessment, I'd recommend focusing on [specific area]...`,
    `In 3 months, you can expect ${childName} to show improvement in [areas]...`,
    `Our program includes 6 coaching sessions plus 3 parent check-ins over 12 weeks.`,
    `The investment is ${price} for the full 3-month program, which also includes free access to our eLearning library and storytelling sessions.`,
    `Ready to get started? I'll send you the payment link right after our call.`,
  ];
}

// ============================================================
// GET: Discovery call details
// ============================================================
export async function GET(
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
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'No session',
        callId: id,
      }));

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
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Insufficient permissions',
        userEmail,
        userRole,
        callId: id,
      }));

      return NextResponse.json(
        { error: 'Access denied. Admin or Coach role required.' },
        { status: 403 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_call_detail_request',
      userEmail,
      userRole,
      callId: id,
    }));

    const supabase = getSupabase();

    // 4. Fetch discovery call
    const { data: call, error } = await supabase
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

    if (error || !call) {
      console.log(JSON.stringify({
        requestId,
        event: 'call_not_found',
        callId: id,
      }));

      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // 5. AUTHORIZATION: Coaches can only see their assigned calls
    if (userRole === 'coach') {
      if (call.assigned_coach_id !== sessionCoachId) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Coach tried to access unassigned call',
          userEmail,
          callId: id,
          assignedCoachId: call.assigned_coach_id,
          sessionCoachId,
        }));

        return NextResponse.json(
          { error: 'You can only view calls assigned to you' },
          { status: 403 }
        );
      }
    }

    // 6. Mask PII for coaches (admins see full data)
    const maskedCall = {
      ...call,
      parent_phone: userRole === 'admin' ? call.parent_phone : maskPhone(call.parent_phone),
      parent_email: userRole === 'admin' ? call.parent_email : maskEmail(call.parent_email),
    };

    // 7. Generate AI-suggested questions and closing prompts
    const suggestedQuestions = generateSuggestedQuestions(call);
    const closingPrompts = await generateClosingPrompts(call, supabase);

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_call_retrieved',
      callId: id,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      call: maskedCall,
      suggestedQuestions,
      closingPrompts,
    }, {
      headers: { 'X-Request-Id': requestId },
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'discovery_call_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}