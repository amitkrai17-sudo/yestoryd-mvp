// ============================================================
// FILE: app/api/cron/daily-lead-digest/route.ts
// ============================================================
// HARDENED VERSION - Daily Lead Digest Cron
// Runs daily at 9:15 AM IST via QStash to send admin summary
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Required auth (QStash signature or CRON_SECRET)
// - Request tracing
// - Lazy Supabase initialization
//
// Features:
// - Last 24 hours lead summary (children table)
// - Groups by lead temperature (Hot/Warm/Cool)
// - Discovery call bookings summary
// - WhatsApp lead summary (wa_leads table)
// - WhatsApp message to admin
//
// QStash Schedule:
//   cron: "15 3 * * *"  (9:15 AM IST = 3:45 AM UTC)
//   url: /api/cron/daily-lead-digest
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import { sendDailyDigest, type DailyDigestData } from '@/lib/notifications/admin-alerts';
import { sendText } from '@/lib/whatsapp/cloud-api';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VERIFICATION ---
async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });

      const isValid = await receiver.verify({
        signature,
        body: body || '',
      });

      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  return { isValid: false, source: 'none' };
}

// --- TYPES ---
interface LeadDigestData {
  total: number;
  hot: number;
  warm: number;
  cool: number;
  newLeads: Array<{
    child_name: string;
    parent_name: string;
    age: number;
    score: number;
    lead_status: string;
    created_at: string;
  }>;
  discoveryBooked: number;
  discoveryCompleted: number;
}

interface WaLeadDigestData {
  newCount: number;
  totalActive: number;
  byStatus: { new: number; qualifying: number; qualified: number; discovery_booked: number };
  hotLeads: Array<{ parent_name: string; child_age: number | null; lead_score: number; current_state: string }>;
  stuckCount: number;
  escalatedCount: number;
}

const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';

// --- MAIN HANDLER ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. AUTHORIZATION (Required)
    const auth = await verifyCronAuth(request);

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
      event: 'daily_lead_digest_start',
      source: auth.source,
    }));

    const supabase = getServiceSupabase();

    // 2. Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 3. Fetch new leads from last 24 hours
    const { data: newLeads, error: leadsError } = await supabase
      .from('children')
      .select('id, child_name, parent_name, age, latest_assessment_score, lead_status, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('lead_status', { ascending: true }) // hot first
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_error',
        table: 'children',
        error: leadsError.message,
      }));
      return NextResponse.json(
        { success: false, requestId, error: 'Database error' },
        { status: 500 }
      );
    }

    // 4. Fetch discovery calls from last 24 hours
    const { data: discoveryData, error: discoveryError } = await supabase
      .from('discovery_calls')
      .select('id, status')
      .gte('created_at', twentyFourHoursAgo);

    if (discoveryError) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_error',
        table: 'discovery_calls',
        error: discoveryError.message,
      }));
      // Non-fatal, continue with leads data
    }

    // 5. Aggregate data
    const leads = newLeads || [];
    const digest: LeadDigestData = {
      total: leads.length,
      hot: leads.filter(l => l.lead_status === 'hot').length,
      warm: leads.filter(l => l.lead_status === 'warm').length,
      cool: leads.filter(l => l.lead_status === 'cool' || l.lead_status === 'new').length,
      newLeads: leads.slice(0, 10).map(l => ({
        child_name: l.child_name || 'Unknown',
        parent_name: l.parent_name || 'Parent',
        age: l.age || 0,
        score: l.latest_assessment_score || 0,
        lead_status: l.lead_status || 'new',
        created_at: l.created_at || new Date().toISOString(),
      })),
      discoveryBooked: discoveryData?.filter(d => d.status === 'scheduled').length || 0,
      discoveryCompleted: discoveryData?.filter(d => d.status === 'completed').length || 0,
    };

    console.log(JSON.stringify({
      requestId,
      event: 'digest_computed',
      ...digest,
    }));

    // 5b. Quick count of new WhatsApp leads (for skip check)
    const { count: newWaLeadCount } = await supabase
      .from('wa_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    // 6. Skip if no activity at all (website leads, discovery calls, OR WhatsApp leads)
    if (digest.total === 0 && digest.discoveryBooked === 0 && (newWaLeadCount || 0) === 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'no_activity_skip',
      }));

      return NextResponse.json({
        success: true,
        requestId,
        message: 'No new leads or bookings in last 24 hours',
        digest,
        messageSent: false,
      });
    }

    // 7. Format date for template (Jan 21 format)
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });

    // 8. Fetch additional stats for the new template
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Get first day of month for MTD
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString();

    // Discovery calls scheduled for today
    const { count: scheduledToday } = await supabase
      .from('discovery_calls')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_at', todayStr)
      .lt('scheduled_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['scheduled', 'confirmed']);

    // Pending followup (discovery calls completed but not enrolled)
    const { count: pendingFollowup } = await supabase
      .from('discovery_calls')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .is('payment_link_clicked', null);

    // MTD total leads
    const { count: mtdTotal } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstOfMonthStr);

    // 9. Send WhatsApp message via template
    const digestData: DailyDigestData = {
      date,
      newLeadsCount: digest.total,
      hotCount: digest.hot,
      warmCount: digest.warm,
      coolCount: digest.cool,
      bookedYesterday: digest.discoveryBooked,
      scheduledToday: scheduledToday || 0,
      pendingFollowup: pendingFollowup || 0,
      mtdTotal: mtdTotal || 0,
    };

    const sendSuccess = await sendDailyDigest(digestData);
    const sendResult = { success: sendSuccess, error: sendSuccess ? undefined : 'Send failed' };

    // 9b. Fetch WhatsApp lead stats and send follow-up message
    const waDigest = await fetchWaLeadDigest(supabase, twentyFourHoursAgo, requestId);
    let waSendSuccess = false;

    if (waDigest) {
      const waMessage = formatWaLeadDigestMessage(date, waDigest);

      try {
        const waResult = await sendText(ADMIN_PHONE, waMessage);
        waSendSuccess = waResult.success;

        console.log(JSON.stringify({
          requestId,
          event: 'wa_lead_digest_sent',
          success: waResult.success,
          error: waResult.error,
          newCount: waDigest.newCount,
          totalActive: waDigest.totalActive,
        }));
      } catch (err: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'wa_lead_digest_send_error',
          error: err.message,
        }));
      }
    }

    // 10. Log the digest (non-blocking)
    try {
      await supabase.from('communication_logs').insert({
        recipient_type: 'admin',
        channel: 'whatsapp',
        template_code: 'daily_lead_digest',
        variables: {
          ...digest,
          wa_leads: waDigest || null,
          request_id: requestId,
        },
        status: sendResult.success ? 'sent' : 'failed',
        sent_at: sendResult.success ? new Date().toISOString() : null,
        error_message: sendResult.error || null,
      });
    } catch (err) {
      console.error('Failed to log digest:', err);
    }

    // 11. Audit log (non-blocking)
    try {
      await supabase.from('activity_log').insert({
        user_email: 'engage@yestoryd.com',
        user_type: 'system',
        action: 'daily_lead_digest_sent',
        metadata: {
          request_id: requestId,
          source: auth.source,
          digest,
          wa_leads: waDigest || null,
          message_sent: sendResult.success,
          wa_message_sent: waSendSuccess,
          timestamp: new Date().toISOString(),
        } as any,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'daily_lead_digest_complete',
      duration: `${duration}ms`,
      messageSent: sendResult.success,
      waMessageSent: waSendSuccess,
      total: digest.total,
      hot: digest.hot,
      warm: digest.warm,
      cool: digest.cool,
      waNewCount: waDigest?.newCount || 0,
      waTotalActive: waDigest?.totalActive || 0,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: sendResult.success ? 'Daily digest sent successfully' : 'Digest computed but send failed',
      digest,
      wa_leads: waDigest || null,
      messageSent: sendResult.success,
      waMessageSent: waSendSuccess,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'daily_lead_digest_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// WhatsApp Lead Digest — Query + Format
// ============================================================

async function fetchWaLeadDigest(
  supabase: ReturnType<typeof getServiceSupabase>,
  twentyFourHoursAgo: string,
  requestId: string
): Promise<WaLeadDigestData | null> {
  try {
    // 1. All active wa_leads (not enrolled)
    const { data: allWaLeads, error: allError } = await supabase
      .from('wa_leads')
      .select('id, parent_name, child_age, lead_score, status, conversation_id, created_at')
      .not('status', 'eq', 'enrolled');

    if (allError) {
      console.error(JSON.stringify({ requestId, event: 'wa_digest_fetch_error', error: allError.message }));
      return null;
    }

    const leads = allWaLeads || [];

    // 2. Count new in last 24h
    const newCount = leads.filter(l => l.created_at && l.created_at >= twentyFourHoursAgo).length;

    // 3. Group by status
    const byStatus = { new: 0, qualifying: 0, qualified: 0, discovery_booked: 0 };
    for (const lead of leads) {
      const s = lead.status as keyof typeof byStatus;
      if (s in byStatus) byStatus[s]++;
    }

    // 4. Top 3 hottest leads by lead_score — need conversation state
    const sortedByScore = [...leads].sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
    const top3Ids = sortedByScore.slice(0, 3);

    // Fetch conversation states for top leads
    const topConvIds = top3Ids
      .map(l => l.conversation_id)
      .filter((id): id is string => id !== null);

    let convStateMap = new Map<string, string>();
    if (topConvIds.length > 0) {
      const { data: convos } = await supabase
        .from('wa_lead_conversations')
        .select('id, current_state')
        .in('id', topConvIds);

      for (const c of convos || []) {
        convStateMap.set(c.id, c.current_state);
      }
    }

    const hotLeads = top3Ids.map(l => ({
      parent_name: l.parent_name || 'Unknown',
      child_age: l.child_age,
      lead_score: l.lead_score || 0,
      current_state: l.conversation_id ? (convStateMap.get(l.conversation_id) || '?') : '?',
    }));

    // 5. Stuck in QUALIFYING >48h
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count: stuckCount } = await supabase
      .from('wa_lead_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('current_state', 'QUALIFYING')
      .eq('is_bot_active', true)
      .lt('last_message_at', fortyEightHoursAgo);

    // 6. Escalated (bot inactive)
    const { count: escalatedCount } = await supabase
      .from('wa_lead_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot_active', false);

    const result: WaLeadDigestData = {
      newCount,
      totalActive: leads.length,
      byStatus,
      hotLeads,
      stuckCount: stuckCount || 0,
      escalatedCount: escalatedCount || 0,
    };

    console.log(JSON.stringify({
      requestId,
      event: 'wa_digest_computed',
      ...result,
    }));

    return result;
  } catch (err: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'wa_digest_error',
      error: err.message,
    }));
    return null;
  }
}

function formatWaLeadDigestMessage(date: string, wa: WaLeadDigestData): string {
  const lines: string[] = [];

  lines.push(`💬 WhatsApp Leads — ${date}`);
  lines.push(`New: ${wa.newCount} | Total active: ${wa.totalActive}`);
  lines.push('');

  // Status breakdown
  const statParts: string[] = [];
  if (wa.byStatus.qualifying > 0) statParts.push(`Qualifying: ${wa.byStatus.qualifying}`);
  if (wa.byStatus.qualified > 0) statParts.push(`Qualified: ${wa.byStatus.qualified}`);
  if (wa.byStatus.discovery_booked > 0) statParts.push(`Booked: ${wa.byStatus.discovery_booked}`);
  if (wa.byStatus.new > 0) statParts.push(`New: ${wa.byStatus.new}`);
  if (statParts.length > 0) {
    lines.push(statParts.join(' | '));
  }

  // Hot leads
  if (wa.hotLeads.length > 0 && wa.hotLeads[0].lead_score > 0) {
    lines.push('');
    lines.push('🔥 Top leads:');
    for (const lead of wa.hotLeads) {
      if (lead.lead_score === 0) continue;
      const age = lead.child_age ? `, age ${lead.child_age}` : '';
      lines.push(`• ${lead.parent_name}${age} — score ${lead.lead_score} (${lead.current_state})`);
    }
  }

  // Alerts
  const alerts: string[] = [];
  if (wa.stuckCount > 0) alerts.push(`⚠️ Stuck >48h: ${wa.stuckCount} leads`);
  if (wa.escalatedCount > 0) alerts.push(`🚨 Escalated (needs human): ${wa.escalatedCount}`);
  if (alerts.length > 0) {
    lines.push('');
    lines.push(alerts.join('\n'));
  }

  return lines.join('\n');
}

// Support POST for QStash
export async function POST(request: NextRequest) {
  return GET(request);
}
