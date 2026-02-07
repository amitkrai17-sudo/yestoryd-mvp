// ============================================================
// FILE: app/api/admin/crm/pipeline-stats/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Pipeline Stats API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'crm_pipeline_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    // Try RPC function first
    const { data, error } = await supabase.rpc('get_lead_pipeline_stats');

    if (error) {
      console.log(JSON.stringify({ requestId, event: 'rpc_fallback', reason: error.message }));

      // Fallback: manual aggregation
      const { data: children, error: childError } = await supabase
        .from('children')
        .select('lead_status');

      if (childError) throw childError;

      const total = children?.length || 0;
      const statusCounts: Record<string, number> = {};

      children?.forEach((c: any) => {
        const status = c.lead_status || 'assessed';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const stats = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
      }));

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'crm_pipeline_success_fallback', total, duration: `${duration}ms` }));

      return NextResponse.json({ success: true, requestId, stats });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_pipeline_success', duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, stats: data || [] });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_pipeline_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to fetch pipeline stats', requestId }, { status: 500 });
  }
}
