// ============================================================
// FILE: app/api/admin/tuition/[id]/pay-link/route.ts
// PURPOSE: Admin void / reissue of a tuition enrollment's initial pay link.
//   [id] = enrollment id. Branches on body.action ('void' | 'reissue').
//   Logic lives in the shared helper lib/tuition/pay-link-lifecycle.ts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { voidPayLink, reissuePayLink } from '@/lib/tuition/pay-link-lifecycle';

export const dynamic = 'force-dynamic';

export const POST = withParamsHandler<{ id: string }>(async (req: NextRequest, { id }, { auth, supabase, requestId }) => {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = body?.action;

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select('id, status, parent_id, child_id, session_rate, sessions_purchased, enrollment_type')
    .eq('id', id)
    .eq('enrollment_type', 'tuition')
    .single();

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Tuition enrollment not found' }, { status: 404 });
  }

  if (action === 'void') {
    const r = await voidPayLink({ supabase, enrollment, actorEmail: auth.email ?? 'admin', actorType: 'admin', requestId });
    return NextResponse.json(r.body, { status: r.status });
  }

  if (action === 'reissue') {
    const r = await reissuePayLink({
      supabase,
      enrollment,
      sessionsPurchased: Number(body.sessionsPurchased),
      sessionRate: Number(body.sessionRate),
      altPhone: typeof body.alt_phone === 'string' ? body.alt_phone.trim() : null,
      actorEmail: auth.email ?? 'admin',
      actorType: 'admin',
      requestId,
    });
    return NextResponse.json(r.body, { status: r.status });
  }

  return NextResponse.json({ error: "Unknown action — expected 'void' or 'reissue'" }, { status: 400 });
}, { auth: 'admin' });
