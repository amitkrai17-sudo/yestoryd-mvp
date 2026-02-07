// ============================================================
// POST /api/cron/lead-scoring — Recalculate lead scores
// Called by QStash cron (daily)
// Uses the canonical scoring logic from lib/logic/lead-scoring.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateLeadScore } from '@/lib/logic/lead-scoring';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Verify cron secret or QStash signature
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isQStash = request.headers.get('upstash-signature');

  if (!isQStash && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let processed = 0;
  let errors = 0;

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
      const daysSinceAssessment = child.latest_assessment_score !== null
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
      processed++;
    } catch {
      errors++;
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
    event: 'lead_scoring_complete',
    processed,
    errors,
    timestamp: now.toISOString(),
  }));

  return NextResponse.json({
    success: true,
    processed,
    errors,
  });
}
