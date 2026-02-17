// ============================================================
// FILE: app/api/admin/feature-flags/route.ts
// ============================================================
// HARDENED VERSION - Feature Flags Management
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const updateFlagSchema = z.object({
  flag_key: z.string().min(1).max(100).regex(/^[a-z_]+$/, 'Flag key must be lowercase with underscores'),
  flag_value: z.union([z.boolean(), z.string(), z.number()]),
});

// --- GET: Fetch all feature flags ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'feature_flags_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'feature_flags_get_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_key');

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'feature_flags_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'feature_flags_get_success', count: flags?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, flags: flags || [] });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'feature_flags_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PUT: Update a feature flag ---
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'feature_flags_put_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateFlagSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { flag_key, flag_value } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'feature_flags_put_request', adminEmail: auth.email, flagKey: flag_key, flagValue: flag_value }));

    const supabase = getServiceSupabase();

    // Get current value for audit
    const { data: currentFlag } = await supabase
      .from('feature_flags')
      .select('flag_value')
      .eq('flag_key', flag_key)
      .single();

    const { data, error } = await supabase
      .from('feature_flags')
      .update({
        flag_value: Boolean(flag_value),
        updated_at: new Date().toISOString(),
      })
      .eq('flag_key', flag_key)
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'feature_flags_put_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'feature_flag_updated',
      metadata: {
        request_id: requestId,
        flag_key,
        previous_value: currentFlag?.flag_value,
        new_value: flag_value,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'feature_flags_put_success', flagKey: flag_key, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, flag: data });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'feature_flags_put_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
