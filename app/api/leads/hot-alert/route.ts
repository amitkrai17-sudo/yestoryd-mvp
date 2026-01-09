// ============================================================
// FILE: app/api/leads/hot-alert/route.ts
// ============================================================
// HARDENED VERSION - Hot Lead Alert System
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - GET: QStash signature verification (cron only)
// - POST: QStash signature OR admin auth (internal trigger)
// - PUT: Admin-only, cursor-based batch processing
// - UUID validation
// - Request tracing
// - Rate limiting on manual triggers
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { calculateLeadScore } from '@/lib/logic/lead-scoring';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY;

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- HELPER: Verify QStash signature ---
async function verifyQStashSignature(request: Request): Promise<boolean> {
  const signature = request.headers.get('upstash-signature');
  
  if (!signature || !QSTASH_CURRENT_SIGNING_KEY) {
    return false;
  }

  try {
    const body = await request.text();

    // Try current key first, then next key (for key rotation)
    for (const key of [QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY]) {
      if (!key) continue;
      
      const [timestamp, expectedSig] = signature.split('.');
      const payload = `${timestamp}.${body}`;
      const computedSig = crypto
        .createHmac('sha256', key)
        .update(payload)
        .digest('base64url');
      
      if (computedSig === expectedSig) {
        // Check timestamp (allow 5 min clock skew)
        const signatureTime = parseInt(timestamp) * 1000;
        const now = Date.now();
        if (Math.abs(now - signatureTime) < 5 * 60 * 1000) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// --- HELPER: Check if request is from QStash ---
function isQStashRequest(request: NextRequest): boolean {
  return request.headers.has('upstash-signature');
}

// --- RATE LIMITING for manual triggers ---
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

// ============================================================
// GET - Check for hot leads and send alerts
// Called by QStash cron job every 15 minutes
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Verify this is from QStash cron OR admin
    const isQStash = isQStashRequest(request);
    
    if (isQStash) {
      // Clone request to read body for signature verification
      const clonedRequest = request.clone();
      const isValid = await verifyQStashSignature(clonedRequest);
      
      if (!isValid) {
        console.log(JSON.stringify({
          requestId,
          event: 'qstash_signature_invalid',
        }));
        
        return NextResponse.json(
          { error: 'Invalid QStash signature' },
          { status: 401 }
        );
      }
    } else {
      // If not QStash, must be admin
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email || (session.user as any).role !== 'admin') {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Admin or QStash required for cron trigger',
        }));
        
        return NextResponse.json(
          { error: 'Unauthorized. This endpoint is for cron jobs only.' },
          { status: 401 }
        );
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'hot_alert_cron_start',
      source: isQStash ? 'qstash' : 'admin',
    }));

    const supabase = getSupabase();

    // 2. Get hot leads that haven't been alerted yet
    const { data: hotLeads, error } = await supabase
      .from('children')
      .select('id, child_name, parent_name, parent_phone, parent_email, age, latest_assessment_score, lead_score, created_at')
      .eq('lead_status', 'hot')
      .is('hot_lead_alerted_at', null)
      .not('parent_phone', 'is', null)
      .order('lead_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching hot leads:', error);
      return NextResponse.json({ error: 'Failed to fetch hot leads' }, { status: 500 });
    }

    if (!hotLeads || hotLeads.length === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No new hot leads to alert',
        count: 0,
      });
    }

    console.log(`🔥 Found ${hotLeads.length} hot leads to alert`);

    const alertResults = [];

    for (const lead of hotLeads) {
      try {
        // Send WhatsApp alert to admin
        const alertSent = await sendHotLeadAlert(lead);

        // Mark as alerted
        if (alertSent) {
          await supabase
            .from('children')
            .update({ hot_lead_alerted_at: new Date().toISOString() })
            .eq('id', lead.id);

          // Log the alert (non-blocking)
          try {
            await supabase.from('communication_logs').insert({
              recipient_type: 'admin',
              channel: 'whatsapp',
              template_code: 'hot_lead_alert',
              variables: {
                child_name: lead.child_name,
                parent_name: lead.parent_name,
                score: lead.latest_assessment_score,
                lead_score: lead.lead_score,
              },
              related_entity_type: 'child',
              related_entity_id: lead.id,
              status: 'sent',
            });
          } catch (logErr) {
            console.warn('Failed to log alert:', logErr);
          }

          alertResults.push({ id: lead.id, name: lead.child_name, alerted: true });
        } else {
          alertResults.push({ id: lead.id, name: lead.child_name, alerted: false, reason: 'send_failed' });
        }
      } catch (alertError) {
        console.error(`Failed to alert for lead ${lead.id}:`, alertError);
        alertResults.push({ id: lead.id, name: lead.child_name, alerted: false, reason: 'error' });
      }
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'hot_alert_cron_complete',
      count: hotLeads.length,
      alerted: alertResults.filter(r => r.alerted).length,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Processed ${hotLeads.length} hot leads`,
      count: hotLeads.length,
      results: alertResults,
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'hot_alert_cron_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// ============================================================
// POST - Trigger alert for specific lead
// Called by QStash (from assessment route) or admin
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Verify source - QStash OR admin
    const isQStash = isQStashRequest(request);
    let adminEmail: string | null = null;

    if (isQStash) {
      const clonedRequest = request.clone();
      const isValid = await verifyQStashSignature(clonedRequest);

      if (!isValid) {
        console.log(JSON.stringify({
          requestId,
          event: 'qstash_signature_invalid',
        }));

        return NextResponse.json(
          { error: 'Invalid QStash signature' },
          { status: 401 }
        );
      }
    } else {
      // If not QStash, must be admin
      const session = await getServerSession(authOptions);

      if (!session?.user?.email || (session.user as any).role !== 'admin') {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Admin or QStash required',
        }));

        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      adminEmail = session.user.email;

      // Rate limit manual triggers
      if (!checkRateLimit(adminEmail)) {
        return NextResponse.json(
          { error: 'Too many manual alerts. Please wait.' },
          { status: 429 }
        );
      }
    }

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { childId } = body;

    if (!childId) {
      return NextResponse.json(
        { error: 'childId required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(childId)) {
      return NextResponse.json(
        { error: 'Invalid childId format' },
        { status: 400 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'hot_alert_manual_trigger',
      source: isQStash ? 'qstash' : 'admin',
      adminEmail,
      childId,
    }));

    const supabase = getSupabase();

    // 3. Fetch lead
    const { data: lead, error } = await supabase
      .from('children')
      .select('id, child_name, parent_name, parent_phone, parent_email, age, latest_assessment_score, lead_score, created_at')
      .eq('id', childId)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // 4. Send alert
    const alertSent = await sendHotLeadAlert(lead);

    if (alertSent) {
      await supabase
        .from('children')
        .update({ hot_lead_alerted_at: new Date().toISOString() })
        .eq('id', childId);
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'hot_alert_manual_complete',
      childId,
      alertSent,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: alertSent,
      requestId,
      message: alertSent ? 'Alert sent successfully' : 'Failed to send alert',
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'hot_alert_manual_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// ============================================================
// PUT - Recalculate lead scores (Admin utility)
// Cursor-based batch processing for scalability
// ============================================================

const BATCH_SIZE = 100; // Process 100 records per request

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Admin-only authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'admin') {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Admin required for score recalculation',
        userEmail: session.user.email,
      }));

      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Get cursor from query params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor'); // Last processed ID
    const isFirstBatch = !cursor;

    console.log(JSON.stringify({
      requestId,
      event: 'lead_score_recalc_batch_start',
      adminEmail: session.user.email,
      cursor: cursor || 'START',
    }));

    const supabase = getSupabase();

    // 3. Fetch batch of children (cursor-based pagination)
    let query = supabase
      .from('children')
      .select('id, latest_assessment_score, age, parent_phone, created_at')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    // If we have a cursor, start after that ID
    if (cursor) {
      query = query.gt('id', cursor);
    }

    const { data: children, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    // 4. Check if we're done
    if (!children || children.length === 0) {
      const duration = Date.now() - startTime;

      // Log completion only on first empty batch after processing
      if (cursor) {
        await supabase.from('activity_log').insert({
          user_email: session.user.email,
          action: 'lead_scores_recalculation_complete',
          details: {
            request_id: requestId,
            final_cursor: cursor,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        requestId,
        message: 'Recalculation complete',
        processed: 0,
        isComplete: true,
        nextCursor: null,
      });
    }

    // 5. Process batch
    let updated = 0;
    const updates: Array<{ id: string; score: number; status: string }> = [];

    for (const child of children) {
      // Check for discovery call
      const { data: discovery } = await supabase
        .from('discovery_calls')
        .select('id')
        .or(`child_id.eq.${child.id},parent_phone.eq.${child.parent_phone}`)
        .limit(1);

      // Check for enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', child.id)
        .eq('status', 'active')
        .limit(1);

      const hasDiscovery = !!(discovery && discovery.length > 0);
      const hasEnrollment = !!(enrollment && enrollment.length > 0);

      // Calculate days since assessment
      const daysSinceAssessment = child.created_at
        ? Math.floor((Date.now() - new Date(child.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Use shared scoring library
      const result = calculateLeadScore({
        latestAssessmentScore: child.latest_assessment_score,
        age: child.age,
        hasDiscoveryCall: hasDiscovery,
        hasActiveEnrollment: hasEnrollment,
        daysSinceAssessment,
      });

      // Update child record
      await supabase
        .from('children')
        .update({
          lead_score: result.score,
          lead_status: result.status,
          lead_score_updated_at: new Date().toISOString(),
        })
        .eq('id', child.id);

      updates.push({ id: child.id, score: result.score, status: result.status });
      updated++;
    }

    // 6. Get next cursor (last processed ID)
    const lastProcessedId = children[children.length - 1].id;
    const hasMore = children.length === BATCH_SIZE;

    // 7. Audit log for first batch
    if (isFirstBatch) {
      await supabase.from('activity_log').insert({
        user_email: session.user.email,
        action: 'lead_scores_recalculation_started',
        details: {
          request_id: requestId,
          batch_size: BATCH_SIZE,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'lead_score_recalc_batch_complete',
      processed: updated,
      nextCursor: hasMore ? lastProcessedId : null,
      hasMore,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Processed ${updated} records`,
      processed: updated,
      isComplete: !hasMore,
      nextCursor: hasMore ? lastProcessedId : null,
      // Include sample updates for debugging (first 5)
      sampleUpdates: updates.slice(0, 5),
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'lead_score_recalc_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// ============================================================
// SEND WHATSAPP ALERT VIA AISENSY
// ============================================================

async function sendHotLeadAlert(lead: {
  id: string;
  child_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  age: number | null;
  latest_assessment_score: number | null;
  lead_score: number;
  created_at: string;
}): Promise<boolean> {

  const childName = lead.child_name || 'Unknown';
  const parentName = lead.parent_name || 'Parent';
  const score = lead.latest_assessment_score ?? 'N/A';
  const age = lead.age ?? 'N/A';
  const phone = lead.parent_phone || 'No phone';
  const leadScore = lead.lead_score;
  const createdAt = new Date(lead.created_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  // Determine urgency
  let urgency = '🔥 HOT LEAD';
  if (lead.latest_assessment_score !== null && lead.latest_assessment_score <= 3) {
    urgency = '🚨 URGENT HOT LEAD';
  }

  const message = `${urgency}

👤 Child: ${childName} (Age: ${age})
👨‍👩‍👧 Parent: ${parentName}
📱 Phone: ${phone}
📊 Score: ${score}/10
🎯 Lead Score: ${leadScore}
🕐 Assessed: ${createdAt}

${lead.latest_assessment_score !== null && lead.latest_assessment_score <= 3
    ? '⚡ Child scored very low - HIGH NEED for coaching!'
    : '📈 Good candidate for coaching program'}

👉 Call within 1 hour for best conversion!`;

  // Try AiSensy
  if (AISENSY_API_KEY) {
    try {
      const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: AISENSY_API_KEY,
          campaignName: 'hot_lead_alert',
          destination: ADMIN_PHONE.replace('+', ''),
          userName: 'Yestoryd System',
          templateParams: [
            childName,
            String(age),
            parentName,
            phone,
            String(score),
            String(leadScore),
          ],
          message: message,
        }),
      });

      if (response.ok) {
        console.log(`✅ WhatsApp alert sent for ${childName}`);
        return true;
      } else {
        const errorData = await response.text();
        console.error('AiSensy error:', errorData);
      }
    } catch (aiSensyError) {
      console.error('AiSensy API error:', aiSensyError);
    }
  }

  // Fallback: Log to console
  console.log('📱 HOT LEAD ALERT (console fallback):');
  console.log(message);
  console.log('---');

  // Still return true to mark as processed
  return true;
}