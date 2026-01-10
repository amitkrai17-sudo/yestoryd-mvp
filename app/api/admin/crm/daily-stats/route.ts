// ============================================================
// FILE: app/api/admin/crm/daily-stats/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Daily Stats API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSupabase } from '@/lib/admin-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION ---
const querySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(7),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({ days: searchParams.get('days') });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { days: daysBack } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_daily_stats_request', adminEmail: auth.email, daysBack }));

    const supabase = getSupabase();

    // Try RPC function first
    const { data, error } = await supabase.rpc('get_crm_daily_stats', { days_back: daysBack });

    if (error) {
      console.log(JSON.stringify({ requestId, event: 'rpc_fallback', reason: error.message }));

      // Fallback: manual calculation
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: children } = await supabase
        .from('children')
        .select('created_at, enrolled_at')
        .gte('created_at', startDate.toISOString());

      const { data: interactions } = await supabase
        .from('interactions')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      const stats: any[] = [];
      for (let i = daysBack; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        stats.push({
          date: dateStr,
          new_assessments: children?.filter((c: any) => c.created_at?.startsWith(dateStr)).length || 0,
          new_enrollments: children?.filter((c: any) => c.enrolled_at?.startsWith(dateStr)).length || 0,
          interactions_logged: interactions?.filter((i: any) => i.created_at?.startsWith(dateStr)).length || 0,
        });
      }

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'crm_daily_stats_success_fallback', daysBack, duration: `${duration}ms` }));

      return NextResponse.json({ success: true, requestId, stats });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_daily_stats_success', daysBack, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, stats: data || [] });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_daily_stats_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to fetch daily stats', requestId }, { status: 500 });
  }
}
