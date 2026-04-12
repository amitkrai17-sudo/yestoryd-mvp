// ============================================================
// FILE: app/api/cron/wa-lead-cleanup/route.ts
// PURPOSE: Delete stale wa_lead_conversations so the Lead Bot state table
//          doesn't accumulate dormant rows. Messages cascade with the
//          conversation row.
// SCHEDULE: daily 03:00 IST via dispatcher
// STALE:    last_message_at older than STALE_DAYS (30)
// SAFETY:   only deletes rows that have NOT converted
//           (discovery_call_id IS NULL AND child_id IS NULL)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const dynamic = 'force-dynamic';

const STALE_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('wa_lead_conversations')
    .delete()
    .lt('last_message_at', cutoff)
    .is('discovery_call_id', null)
    .is('child_id', null)
    .select('id');

  if (error) {
    console.error(JSON.stringify({
      event: 'wa_lead_cleanup_error',
      error: error.message,
      cutoff,
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = data?.length || 0;
  console.log(JSON.stringify({
    event: 'wa_lead_cleanup_complete',
    deleted,
    cutoff,
    stale_days: STALE_DAYS,
  }));

  return NextResponse.json({ success: true, deleted, cutoff, staleDays: STALE_DAYS });
}
