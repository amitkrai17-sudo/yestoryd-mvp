// ============================================================
// FILE: app/api/admin/agreements/route.ts
// ============================================================
// HARDENED VERSION - List Agreement Versions
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSupabase } from '@/lib/admin-auth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'agreements_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'agreements_get_request', adminEmail: auth.email }));

    const supabase = getSupabase();

    const { data: agreements, error } = await supabase
      .from('agreement_versions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'agreements_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch agreements' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'agreements_get_success', count: agreements?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      agreements,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'agreements_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
