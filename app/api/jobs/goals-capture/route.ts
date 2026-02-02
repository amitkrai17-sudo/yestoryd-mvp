// ============================================================
// FILE: app/api/jobs/goals-capture/route.ts
// ============================================================
// QStash job to send P7 goals capture WhatsApp messages
// Runs every 5 minutes via QStash schedule
//
// Finds children who:
// - Completed assessment 30-35 minutes ago
// - Haven't captured goals on results page
// - Haven't received the P7 message yet
//
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - QStash signature verification (using SDK)
// - Internal API key fallback for testing
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/api-auth';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';

const P7_TEMPLATE_NAME = 'p7_goals_capture_1';

// --- CONFIGURATION (Lazy initialization) ---
const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// --- VERIFICATION ---
async function verifyAuth(request: NextRequest, body: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check CRON_SECRET (for Vercel cron fallback)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key (for admin testing)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature using SDK
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash SDK verification failed:', e);
    }
  }

  // 4. Development bypass (ONLY in dev)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Get raw body for signature verification
    const body = await request.text();

    // 2. Verify authorization
    const auth = await verifyAuth(request, body);
    if (!auth.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Unauthorized goals capture request',
      }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'goals_capture_job_started',
      source: auth.source,
    }));

    const supabase = getServiceSupabase();

    // 3. Calculate time window (30-35 minutes ago)
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyFiveMinAgo = new Date(now.getTime() - 35 * 60 * 1000);

    // 4. Find children needing goals capture message
    const { data: children, error: queryError } = await supabase
      .from('children')
      .select('id, name, parent_name, parent_phone, parent_goals, goals_message_sent, assessment_completed_at, created_at, latest_assessment_score')
      .or('parent_goals.is.null,parent_goals.eq.{}')
      .or('goals_message_sent.is.null,goals_message_sent.eq.false')
      .not('parent_phone', 'is', null)
      .not('latest_assessment_score', 'is', null)  // Must have completed assessment
      .order('created_at', { ascending: true });

    if (queryError) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_error',
        error: queryError.message,
      }));
      return NextResponse.json(
        { success: false, requestId, error: 'Database error' },
        { status: 500 }
      );
    }

    // Filter by time window (assessment_completed_at or created_at)
    const eligibleChildren = (children || []).filter(child => {
      const assessmentTime = child.assessment_completed_at || child.created_at;
      if (!assessmentTime) return false;

      const timestamp = new Date(assessmentTime);
      return timestamp >= thirtyFiveMinAgo && timestamp <= thirtyMinAgo;
    });

    if (eligibleChildren.length === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'no_children_found',
        message: 'No children need goals capture message',
        totalQueried: children?.length || 0,
      }));

      return NextResponse.json({
        success: true,
        requestId,
        message: 'No children needing goals capture message',
        summary: { total_found: 0, sent: 0, skipped: 0, failed: 0 },
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'children_found',
      count: eligibleChildren.length,
    }));

    // 5. Check AiSensy API key
    if (!process.env.AISENSY_API_KEY) {
      console.error(JSON.stringify({
        requestId,
        event: 'config_error',
        error: 'AISENSY_API_KEY not configured',
      }));
      return NextResponse.json(
        { success: false, requestId, error: 'WhatsApp API not configured' },
        { status: 500 }
      );
    }

    const results: any[] = [];
    const skipped: any[] = [];
    const failed: any[] = [];

    for (const child of eligibleChildren) {
      // 6. Double-check: Skip if goals already captured
      if (child.parent_goals && Array.isArray(child.parent_goals) && child.parent_goals.length > 0) {
        skipped.push({ id: child.id, childName: child.name, reason: 'Goals already captured' });
        continue;
      }

      // 7. Skip if message already sent
      if (child.goals_message_sent) {
        skipped.push({ id: child.id, childName: child.name, reason: 'Message already sent' });
        continue;
      }

      // 8. Skip if no valid phone
      if (!child.parent_phone || child.parent_phone.trim() === '') {
        skipped.push({ id: child.id, childName: child.name, reason: 'No parent phone number' });
        continue;
      }

      // Extract first name
      const parentFirstName = child.parent_name?.split(' ')[0] || 'Parent';
      const childName = child.name || 'your child';

      try {
        // 9. Send WhatsApp message via AiSensy
        const waResult = await sendWhatsAppMessage({
          to: child.parent_phone,
          templateName: P7_TEMPLATE_NAME,
          variables: [
            parentFirstName,  // {{1}} Parent name
            childName,        // {{2}} Child name (first mention)
            childName,        // {{3}} Child name (second mention)
            'Our Coach',      // {{4}} Coach name
          ],
        });

        if (waResult.success) {
          // 10. Mark message as sent
          await supabase
            .from('children')
            .update({
              goals_message_sent: true,
              goals_message_sent_at: new Date().toISOString(),
            })
            .eq('id', child.id);

          results.push({
            id: child.id,
            childName: child.name,
            parentPhone: `***${child.parent_phone.slice(-4)}`,
            status: 'sent',
            messageId: waResult.messageId,
          });

          console.log(JSON.stringify({
            requestId,
            event: 'goals_message_sent',
            childId: child.id,
            childName: child.name,
          }));
        } else {
          failed.push({ id: child.id, childName: child.name, error: waResult.error });
          console.error(JSON.stringify({
            requestId,
            event: 'goals_message_failed',
            childId: child.id,
            error: waResult.error,
          }));
        }
      } catch (sendError: any) {
        failed.push({ id: child.id, childName: child.name, error: sendError.message });
        console.error(JSON.stringify({
          requestId,
          event: 'goals_message_error',
          childId: child.id,
          error: sendError.message,
        }));
      }

      // Rate limiting delay (200ms between messages)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 11. Audit log
    try {
      await supabase.from('activity_log').insert({
        user_email: 'engage@yestoryd.com',
        action: 'goals_capture_job_executed',
        details: {
          request_id: requestId,
          source: auth.source,
          total_found: eligibleChildren.length,
          sent: results.length,
          skipped: skipped.length,
          failed: failed.length,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('[GoalsCaptureJob] Audit log failed:', logError);
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'goals_capture_job_complete',
      duration: `${duration}ms`,
      sent: results.length,
      skipped: skipped.length,
      failed: failed.length,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Sent ${results.length} goals capture messages`,
      summary: {
        total_found: eligibleChildren.length,
        sent: results.length,
        skipped: skipped.length,
        failed: failed.length,
      },
      results,
      skipped: skipped.length > 0 ? skipped : undefined,
      failed: failed.length > 0 ? failed : undefined,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'goals_capture_job_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK / GET handler ---
export async function GET(request: NextRequest) {
  // Also support GET for manual testing / health check
  return NextResponse.json({
    status: 'ok',
    service: 'Goals Capture Job (QStash)',
    endpoint: '/api/jobs/goals-capture',
    schedule: 'Every 5 minutes via QStash',
    timestamp: new Date().toISOString(),
  });
}
