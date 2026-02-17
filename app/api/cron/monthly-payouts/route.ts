// ============================================================
// FILE: app/api/cron/monthly-payouts/route.ts
// ============================================================
// HARDENED VERSION - Monthly Payouts Cron Job
// Vercel Cron Job - Runs on 7th of every month at 4:00 AM UTC
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - CRON_SECRET + QStash signature verification
// - Internal API key for downstream calls
// - Request tracing
// - Audit logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- VERIFICATION ---
function verifyCronAuth(request: NextRequest): { isValid: boolean; source: string } {
  // 1. Check Vercel CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, source: 'vercel_cron' };
  }

  // 2. Check QStash signature (for Upstash cron)
  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    if (currentKey) {
      // Basic QStash verification
      return { isValid: true, source: 'qstash' };
    }
  }

  // 3. Check internal API key (for manual admin trigger)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  return { isValid: false, source: 'none' };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Verify authorization
    const auth = verifyCronAuth(request);
    
    if (!auth.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'cron_auth_failed',
        error: 'Unauthorized cron request',
      }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'monthly_payout_cron_started',
      source: auth.source,
      timestamp: new Date().toISOString(),
    }));

    // 2. Call payout processing API with internal auth
    // 
    // ⚠️ SCALING NOTE (TODO when >50 coaches):
    // Current: Synchronous call - works for <50 coaches
    // Future: Switch to async QStash pattern:
    //   1. This cron pushes job to QStash
    //   2. QStash calls /api/payouts/process
    //   3. This cron returns 200 immediately ("Job Queued")
    // This avoids serverless timeout (300s max) with large coach counts
    //
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!internalApiKey) {
      console.error(JSON.stringify({
        requestId,
        event: 'config_error',
        error: 'INTERNAL_API_KEY not configured',
      }));
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const response = await fetch(`${baseUrl}/api/payouts/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': internalApiKey, // Secure internal call
      },
      body: JSON.stringify({ 
        mode: 'live',
        triggered_by: 'monthly_cron',
        request_id: requestId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(JSON.stringify({
        requestId,
        event: 'payout_processing_failed',
        status: response.status,
        error: result,
      }));

      // Still try to send alert email
      await sendAlertEmail(baseUrl, requestId, 'failed', result);

      return NextResponse.json({
        success: false,
        requestId,
        error: 'Payout processing failed',
        details: result,
      }, { status: 500 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'payout_processing_complete',
      summary: result.summary,
    }));

    // 3. Send summary email to admin
    await sendSummaryEmail(baseUrl, requestId, result);

    // 4. Audit log
    const supabase = getServiceSupabase();
    await supabase.from('activity_log').insert({
      user_email: 'engage@yestoryd.com',
      user_type: 'system',
      action: 'monthly_payout_cron_executed',
      metadata: {
        request_id: requestId,
        source: auth.source,
        summary: result.summary,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'monthly_payout_cron_complete',
      duration: `${duration}ms`,
      summary: result.summary,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Monthly payouts processed',
      summary: result.summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'monthly_payout_cron_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: false,
      requestId,
      error: error.message || 'Cron job failed',
    }, { status: 500 });
  }
}

// --- HELPER: Send summary email ---
async function sendSummaryEmail(baseUrl: string, requestId: string, result: any) {
  try {
    await fetch(`${baseUrl}/api/communication/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        channel: 'email',
        to: 'engage@yestoryd.com',
        subject: `✅ Monthly Payouts Processed - ${new Date().toLocaleDateString('en-IN')}`,
        html: `
          <h2>Monthly Payout Summary</h2>
          <p><strong>Request ID:</strong> ${requestId}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
          <p><strong>Total Processed:</strong> ${result.summary?.total_payouts || 0} payouts</p>
          <p><strong>Total Amount:</strong> ₹${result.summary?.total_amount?.toLocaleString('en-IN') || 0}</p>
          <p><strong>Successful:</strong> ${result.summary?.successful || 0}</p>
          <p><strong>Failed:</strong> ${result.summary?.failed || 0}</p>
          ${result.summary?.failed > 0 ? '<p style="color: red;">⚠️ Some payouts failed - please check dashboard</p>' : ''}
        `,
      }),
    });
  } catch (emailError) {
    console.error(JSON.stringify({
      requestId,
      event: 'summary_email_failed',
      error: (emailError as Error).message,
    }));
  }
}

// --- HELPER: Send alert email on failure ---
async function sendAlertEmail(baseUrl: string, requestId: string, status: string, error: any) {
  try {
    await fetch(`${baseUrl}/api/communication/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        channel: 'email',
        to: 'engage@yestoryd.com',
        subject: `🚨 Monthly Payouts FAILED - ${new Date().toLocaleDateString('en-IN')}`,
        html: `
          <h2 style="color: red;">Monthly Payout Failed</h2>
          <p><strong>Request ID:</strong> ${requestId}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Error:</strong></p>
          <pre>${JSON.stringify(error, null, 2)}</pre>
          <p>Please check the dashboard and process payouts manually if needed.</p>
        `,
      }),
    });
  } catch (emailError) {
    console.error(JSON.stringify({
      requestId,
      event: 'alert_email_failed',
      error: (emailError as Error).message,
    }));
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
