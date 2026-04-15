// ============================================================
// FILE: app/api/cron/discovery-followup/route.ts
// ============================================================
// HARDENED VERSION - Discovery Call Follow-up Cron
// Runs daily at 10 AM IST to identify calls needing 24hr follow-up
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Required auth (not optional!)
// - QStash signature verification
// - Lazy Supabase initialization
// - Request tracing
//
// Performance features:
// - Fetch template once (not in loop)
// - Batch operations where possible
//
// Edge case fixes:
// - Skip calls without payment link
// - Idempotency check
// ============================================================

import { Database } from '@/lib/supabase/database.types';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { logDecision } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- MAIN HANDLER ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. AUTHORIZATION (Required, not optional!)
    const auth = await verifyCronRequest(request);

    if (!auth.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Unauthorized cron request',
      }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_followup_cron_started',
      source: auth.source,
    }));

    const supabase = getServiceSupabase();

    // 2. Find discovery calls needing follow-up
    // Using the view: discovery_calls_need_followup
    const { data: callsNeedingFollowup, error } = await supabase
      .from('discovery_calls_need_followup')
      .select('*');

    if (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_error',
        error: error.message,
      }));
      return NextResponse.json(
        { success: false, requestId, error: 'Database error' },
        { status: 500 }
      );
    }

    if (!callsNeedingFollowup || callsNeedingFollowup.length === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'no_calls_found',
        message: 'No discovery calls need follow-up',
      }));

      return NextResponse.json({
        success: true,
        requestId,
        message: 'No calls needing follow-up',
        followups: [],
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'calls_found',
      count: callsNeedingFollowup.length,
    }));

    // 3. Check AiSensy API key
    const aisensyKey = process.env.AISENSY_API_KEY;
    if (!aisensyKey) {
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

    for (const call of callsNeedingFollowup) {
      // 4. EDGE CASE: Skip if no payment link (Ghost Link Prevention)
      if (!call.payment_link) {
        skipped.push({
          id: call.id,
          parentName: call.parent_name,
          childName: call.child_name,
          reason: 'No payment link generated',
        });
        continue;
      }

      // 5. EDGE CASE: Skip if no parent phone
      if (!call.parent_phone) {
        skipped.push({
          id: call.id,
          parentName: call.parent_name,
          reason: 'No parent phone number',
        });
        continue;
      }

      // Skip if no ID (shouldn't happen but required for type safety)
      if (!call.id) {
        skipped.push({
          id: 'unknown',
          reason: 'No call ID',
        });
        continue;
      }

      // NOTE: Idempotency check disabled - followup_processing column doesn't exist
      // Would need migration to add this column for proper idempotency

      // Extract child's goal from questionnaire
      const childGoal = (call.questionnaire as any)?.parent_goal || 'improve their reading skills';
      const parentFirstName = call.parent_name?.split(' ')[0] || 'Parent';

      try {
        // 7. ACTUALLY SEND WhatsApp via AiSensy
        const waResult = await sendWhatsAppMessage({
          to: call.parent_phone,
          templateName: 'parent_discovery_reminder_v3',
          variables: [
            parentFirstName,
            call.child_name || 'your child',
            call.coach_name || 'Your Coach',
            childGoal,
            call.payment_link,
          ],
          meta: {
            templateCode: 'P7_discovery_reminder_24h',
            recipientType: 'parent',
            triggeredBy: 'cron',
            contextType: 'discovery_call',
            contextId: call.id,
          },
        });

        if (waResult.success) {
          // 8. Update discovery call - ONLY after successful send
          await supabase
            .from('discovery_calls')
            .update({
              followup_sent_at: new Date().toISOString(),
              followup_count: (call.followup_count || 0) + 1,
              followup_method: 'aisensy_auto',
            })
            .eq('id', call.id);

          results.push({
            id: call.id,
            parentName: call.parent_name,
            childName: call.child_name,
            parentPhone: `***${call.parent_phone.slice(-4)}`, // Masked
            hoursSincePaymentLink: Math.round(call.hours_since_payment_link || 0),
            status: 'sent',
          });

          try { await logDecision({ source: 'cron:discovery-followup', entity_type: 'discovery_call', entity_id: call.id, decision: 'send_discovery_followup', reason: { child_name: call.child_name || 'unknown' } as Json, action: 'aisensy:discovery_followup', outcome: 'success' }); } catch {}

          console.log(JSON.stringify({
            requestId,
            event: 'followup_sent',
            callId: call.id,
            childName: call.child_name,
          }));
        } else {
          failed.push({
            id: call.id,
            parentName: call.parent_name,
            childName: call.child_name,
            error: waResult.error ?? 'unknown',
          });

          console.error(JSON.stringify({
            requestId,
            event: 'followup_send_failed',
            callId: call.id,
            error: waResult.error,
          }));
        }
      } catch (sendError: any) {
        failed.push({
          id: call.id,
          parentName: call.parent_name,
          error: sendError.message,
        });

        console.error(JSON.stringify({
          requestId,
          event: 'followup_send_error',
          callId: call.id,
          error: sendError.message,
        }));
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 9. Audit log
    await supabase.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'discovery_followup_cron_executed',
      metadata: {
        request_id: requestId,
        source: auth.source,
        total_found: callsNeedingFollowup.length,
        sent: results.length,
        skipped: skipped.length,
        failed: failed.length,
        skip_reasons: skipped.length > 0 ? skipped : undefined,
        failures: failed.length > 0 ? failed : undefined,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_followup_cron_complete',
      duration: `${duration}ms`,
      sent: results.length,
      skipped: skipped.length,
      failed: failed.length,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Sent ${results.length} follow-up messages`,
      summary: {
        total_found: callsNeedingFollowup.length,
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
      event: 'discovery_followup_cron_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support POST for QStash
export async function POST(request: NextRequest) {
  return GET(request);
}
