// GET /api/admin/tuition/batches
// Returns existing tuition batches grouped by batch_id for the admin dropdown

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { formatSchedulePreference } from '@/lib/scheduling/schedule-time';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_req, { supabase }) => {
  // Fetch all active tuition_onboarding records
  // batch_id column added via migration — not in generated types, use select('*')
  const { data: allRecords, error } = await supabase
    .from('tuition_onboarding')
    .select('*')
    .in('status', ['parent_completed', 'parent_pending', 'active'])
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch coach names
  const coachIds = Array.from(new Set((allRecords || []).map(r => r.coach_id)));
  const { data: coaches } = await supabase
    .from('coaches')
    .select('id, name')
    .in('id', coachIds);
  const coachMap = new Map((coaches || []).map(c => [c.id, c.name]));

  // Fetch category labels
  const catIds = Array.from(new Set((allRecords || []).map(r => r.category_id).filter(Boolean)));
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from('skill_categories')
      .select('id, label')
      .in('id', catIds as string[]);
    for (const c of cats || []) catMap.set(c.id, c.label);
  }

  // Group by batch_id
  const batchMap = new Map<string, {
    batch_id: string;
    coach_name: string;
    children: string[];
    schedule: string;
    subject: string;
  }>();

  for (const r of allRecords || []) {
    const batchId = (r as any).batch_id as string | null;
    if (!batchId) continue;

    const coachName = coachMap.get(r.coach_id) || 'Unknown';
    const subject = r.category_id ? (catMap.get(r.category_id) || '') : '';

    const schedule = formatSchedulePreference(r.schedule_preference);

    const existing = batchMap.get(batchId);
    if (existing) {
      existing.children.push(r.child_name);
    } else {
      batchMap.set(batchId, {
        batch_id: batchId,
        coach_name: coachName,
        children: [r.child_name],
        schedule,
        subject,
      });
    }
  }

  // 2G-5: expose schedule_confirmed per batch so the list can badge unconfirmed ones. tuition_batches
  // not in generated types yet → 'as any' on the client (2B precedent). Thin read, no writes.
  // 2G-2.5-fix3: also read status → drop deleted (retired) batches from the list entirely.
  const batchIds = Array.from(batchMap.keys());
  const confirmedById = new Map<string, boolean>();
  if (batchIds.length > 0) {
    const { data: batchRows } = await (supabase as any)
      .from('tuition_batches')
      .select('id, schedule_confirmed, status')
      .in('id', batchIds);
    for (const b of (batchRows ?? []) as Array<{ id: string; schedule_confirmed: boolean | null; status: string | null }>) {
      if (b.status === 'deleted') { batchMap.delete(b.id); continue; }
      confirmedById.set(b.id, !!b.schedule_confirmed);
    }
  }

  // Build labels: "Rucha — Mon/Fri 7-8pm — Grammar (Yekshit, Vihaan)"
  const batches = Array.from(batchMap.values()).map(b => ({
    batch_id: b.batch_id,
    label: [
      b.coach_name,
      b.schedule,
      b.subject,
      `(${b.children.join(', ')})`,
    ].filter(Boolean).join(' — '),
    schedule_confirmed: confirmedById.get(b.batch_id) ?? true,
  }));

  return NextResponse.json({ batches });
}, { auth: 'admin' });
