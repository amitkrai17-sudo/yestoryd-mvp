// ============================================================
// Canonical wa_leads.lead_score scorer
// Sole source of truth for both real-time (qualification) and
// cron (daily recalculation) writes to wa_leads.lead_score.
// Extracted verbatim from app/api/cron/lead-scoring/route.ts (D1b-1).
// Missing inputs contribute 0; score is monotonic and capped at 100.
// ============================================================

export interface WaLeadRow {
  child_name: string | null;
  child_age: number | null;
  reading_concerns: string | null;
  city: string | null;
  school: string | null;
  child_id: string | null;
}

export interface MessageStats {
  messageCount: number;
  firstInboundAt: string | null;
  firstOutboundAt: string | null;
}

export function calculateWaLeadScore(lead: WaLeadRow, stats: MessageStats | undefined): number {
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
