// ============================================================
// FILE: app/api/my-child/verify-phone/route.ts
// ============================================================
// Phone verification for My Child portal.
// Given child_id + phone, verifies the phone matches the child's
// parent_phone, then returns a redirect URL with HMAC token.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/utils/phone';
import { buildMyChildUrl } from '@/lib/group-classes/my-child-token';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { child_id, phone } = body;

    if (!child_id || !phone) {
      return NextResponse.json({ error: 'Missing child_id or phone' }, { status: 400 });
    }

    const inputPhone = normalizePhone(phone);
    if (!inputPhone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: child } = await supabase
      .from('children')
      .select('id, parent_phone')
      .eq('id', child_id)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const childParentPhone = normalizePhone(child.parent_phone || '');

    if (!childParentPhone || inputPhone !== childParentPhone) {
      return NextResponse.json(
        { error: 'Phone number does not match our records. Please use the link from WhatsApp.' },
        { status: 403 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';
    const redirectUrl = buildMyChildUrl(baseUrl, child_id, inputPhone);

    return NextResponse.json({ redirect_url: redirectUrl });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
