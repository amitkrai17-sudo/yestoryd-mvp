// POST /api/admin/backfill-parent-auth
// One-time backfill: create Supabase auth accounts for all parents without user_id
// Admin-only endpoint

import { NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureParentAuthAccount } from '@/lib/auth/create-parent-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Get all parents without auth
  const { data: parents, error } = await supabase
    .from('parents')
    .select('id, name, phone, email')
    .is('user_id', null)
    .not('phone', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!parents || parents.length === 0) {
    return NextResponse.json({ message: 'No parents need backfill', count: 0 });
  }

  const results: { parentId: string; name: string | null; phone: string; success: boolean; error?: string }[] = [];

  for (const parent of parents) {
    if (!parent.phone) continue;

    const result = await ensureParentAuthAccount({
      parentId: parent.id,
      phone: parent.phone,
      email: parent.email,
      name: parent.name,
    });

    results.push({
      parentId: parent.id,
      name: parent.name,
      phone: parent.phone,
      success: result.userId !== null,
      error: result.error,
    });
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  // Log to activity_log
  await supabase.from('activity_log').insert({
    action: 'backfill_parent_auth',
    user_email: auth.email || 'admin',
    user_type: 'admin',
    metadata: {
      total: results.length,
      succeeded,
      failed,
      failures: results.filter(r => !r.success),
    },
  });

  return NextResponse.json({
    message: `Backfill complete: ${succeeded} succeeded, ${failed} failed`,
    total: results.length,
    succeeded,
    failed,
    results,
  });
}
