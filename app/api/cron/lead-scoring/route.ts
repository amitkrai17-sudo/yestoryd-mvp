// ============================================================
// POST /api/cron/lead-scoring — Recalculate lead scores
// Called by QStash cron (daily)
//
// Pass 1: Children table — uses canonical scoring from lib/logic/lead-scoring.ts
// Pass 2: wa_leads table — enhanced scoring for WhatsApp leads
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { calculateLeadScore } from '@/lib/logic/lead-scoring';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify cron secret or QStash signature
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isQStash = request.headers.get('upstash-signature');

  if (!isQStash && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // ============================================================
  // PASS 1: Children table scoring (existing)
  // ============================================================
  let childrenProcessed = 0;
  let childrenErrors = 0;

  // Fetch all non-enrolled children (active leads)
  const { data: children, error } = await supabase
    .from('children')
    .select(`
      id, age, latest_assessment_score, created_at
    `)
    .not('lead_status', 'eq', 'enrolled')
    .not('lead_status', 'eq', 'churned');

  if (error || !children) {
    console.error('Lead scoring: failed to fetch children', error?.message);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }

  // Fetch discovery calls for these children
  const childIds = children.map((c) => c.id);
  const { data: discoveryCalls } = await supabase
    .from('discovery_calls')
    .select('child_id')
    .in('child_id', childIds.length > 0 ? childIds : ['00000000-0000-0000-0000-000000000000']);

  const dcSet = new Set<string>();
  for (const dc of discoveryCalls || []) {
    if (dc.child_id) dcSet.add(dc.child_id);
  }

  // Fetch active enrollments for these children
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('child_id')
    .in('child_id', childIds.length > 0 ? childIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'active');

  const enrolledSet = new Set<string>();
  for (const e of enrollments || []) {
    if (e.child_id) enrolledSet.add(e.child_id);
  }

  // Score each lead using canonical scoring logic
  const updates: { id: string; lead_score: number }[] = [];

  for (const child of children) {
    try {
      const daysSinceAssessment = child.latest_assessment_score !== null && child.created_at
        ? Math.floor((now.getTime() - new Date(child.created_at).getTime()) / 86400000)
        : 0;

      const result = calculateLeadScore({
        latestAssessmentScore: child.latest_assessment_score,
        age: child.age,
        hasDiscoveryCall: dcSet.has(child.id),
        hasActiveEnrollment: enrolledSet.has(child.id),
        daysSinceAssessment,
      });

      updates.push({ id: child.id, lead_score: result.score });
      childrenProcessed++;
    } catch {
      childrenErrors++;
    }
  }

  // Batch update scores (in chunks of 100)
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    for (const u of chunk) {
      await supabase
        .from('children')
        .update({
          lead_score: u.lead_score,
          lead_score_updated_at: now.toISOString(),
        })
        .eq('id', u.id);
    }
  }

  console.log(JSON.stringify({
    event: 'lead_scoring_children_complete',
    processed: childrenProcessed,
    errors: childrenErrors,
    timestamp: now.toISOString(),
  }));

  // ============================================================
  // PASS 2: WhatsApp leads scoring
  // ============================================================
  const waResult = await scoreWhatsAppLeads(now);

  console.log(JSON.stringify({
    event: 'lead_scoring_complete',
    children: { processed: childrenProcessed, errors: childrenErrors },
    wa_leads: { processed: waResult.processed, errors: waResult.errors },
    timestamp: now.toISOString(),
  }));

  return NextResponse.json({
    success: true,
    children: { processed: childrenProcessed, errors: childrenErrors },
    wa_leads: { processed: waResult.processed, errors: waResult.errors },
  });
}

// ============================================================
// WhatsApp Lead Scoring
// ============================================================

async function scoreWhatsAppLeads(now: Date): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Fetch wa_leads that need rescoring:
  // - lead_score is 0 (never scored or newly created)
  // - OR updated_at is older than 24 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: waLeads, error: waError } = await supabase
    .from('wa_leads')
    .select('id, phone_number, child_name, child_age, reading_concerns, city, school, child_id, lead_score, conversation_id')
    .or(`lead_score.eq.0,updated_at.lt.${twentyFourHoursAgo}`);

  if (waError) {
    console.error(JSON.stringify({
      event: 'wa_lead_scoring_fetch_error',
      error: waError.message,
    }));
    return { processed: 0, errors: 1 };
  }

  if (!waLeads || waLeads.length === 0) {
    console.log(JSON.stringify({ event: 'wa_lead_scoring_skip', reason: 'no_leads_to_score' }));
    return { processed: 0, errors: 0 };
  }

  // Batch-fetch message stats for all conversations at once
  const conversationIds = waLeads
    .map(l => l.conversation_id)
    .filter((id): id is string => id !== null);

  const messageStatsMap = await fetchMessageStats(conversationIds);

  // Score each lead
  for (const lead of waLeads) {
    try {
      const oldScore = lead.lead_score ?? 0;
      const stats = lead.conversation_id ? messageStatsMap.get(lead.conversation_id) : undefined;
      const newScore = calculateWaLeadScore(lead, stats);

      await supabase
        .from('wa_leads')
        .update({
          lead_score: newScore,
          updated_at: now.toISOString(),
        })
        .eq('id', lead.id);

      console.log(JSON.stringify({
        event: 'wa_lead_scored',
        phone: lead.phone_number,
        old_score: oldScore,
        new_score: newScore,
      }));

      processed++;
    } catch (e) {
      console.error(JSON.stringify({
        event: 'wa_lead_scoring_error',
        phone: lead.phone_number,
        error: e instanceof Error ? e.message : 'Unknown error',
      }));
      errors++;
    }
  }

  console.log(JSON.stringify({
    event: 'wa_lead_scoring_complete',
    processed,
    errors,
    timestamp: now.toISOString(),
  }));

  return { processed, errors };
}

// ============================================================
// Message stats fetcher — batch query for all conversations
// ============================================================

interface MessageStats {
  messageCount: number;
  firstInboundAt: string | null;
  firstOutboundAt: string | null;
}

async function fetchMessageStats(
  conversationIds: string[]
): Promise<Map<string, MessageStats>> {
  const result = new Map<string, MessageStats>();
  if (conversationIds.length === 0) return result;

  // Fetch message counts per conversation
  const { data: messages, error } = await supabase
    .from('wa_lead_messages')
    .select('conversation_id, direction, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (error || !messages) {
    console.error(JSON.stringify({
      event: 'wa_lead_scoring_messages_fetch_error',
      error: error?.message,
    }));
    return result;
  }

  // Aggregate: count, first inbound, first outbound per conversation
  for (const msg of messages) {
    const convId = msg.conversation_id;
    let stats = result.get(convId);
    if (!stats) {
      stats = { messageCount: 0, firstInboundAt: null, firstOutboundAt: null };
      result.set(convId, stats);
    }

    stats.messageCount++;

    if (msg.direction === 'inbound' && !stats.firstInboundAt) {
      stats.firstInboundAt = msg.created_at;
    }
    if (msg.direction === 'outbound' && !stats.firstOutboundAt) {
      stats.firstOutboundAt = msg.created_at;
    }
  }

  return result;
}

// ============================================================
// WhatsApp lead score calculator
// ============================================================

interface WaLeadRow {
  child_name: string | null;
  child_age: number | null;
  reading_concerns: string | null;
  city: string | null;
  school: string | null;
  child_id: string | null;
}

function calculateWaLeadScore(lead: WaLeadRow, stats: MessageStats | undefined): number {
  let score = 0;

  // Profile completeness
  if (lead.child_name) score += 15;
  if (lead.child_age !== null && lead.child_age >= 4 && lead.child_age <= 12) score += 20;
  if (lead.reading_concerns) score += 20;
  if (lead.city) score += 5;
  if (lead.school) score += 5;

  // Assessment completed (child linked)
  if (lead.child_id) score += 25;

  // Engagement signals from conversation
  if (stats) {
    // Active conversation (>5 messages exchanged)
    if (stats.messageCount > 5) score += 10;

    // Response speed: parent replied within 5 minutes of first bot message
    if (stats.firstOutboundAt && stats.firstInboundAt) {
      const firstOut = new Date(stats.firstOutboundAt).getTime();
      const firstIn = new Date(stats.firstInboundAt).getTime();
      // First inbound after first outbound = a reply (not the initial message)
      // If first inbound is BEFORE first outbound, that's the initial message —
      // look for the second inbound (not available here, so check if gap is small
      // meaning fast initial engagement)
      const gapMs = Math.abs(firstIn - firstOut);
      if (gapMs <= 5 * 60 * 1000) {
        score += 10;
      }
    }
  }

  return Math.min(score, 100);
}
