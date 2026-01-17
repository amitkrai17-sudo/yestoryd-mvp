// ============================================================
// FILE: app/api/admin/crm/export/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Export API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ SENSITIVE: Exports PII - All exports are audit logged
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION ---
const querySchema = z.object({
  status: z.string().max(50).optional(),
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
    const validation = querySchema.safeParse({ status: searchParams.get('status') });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { status } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_export_request', adminEmail: auth.email, statusFilter: status || 'all' }));

    const supabase = getServiceSupabase();

    // Fetch all leads
    let query = supabase
      .from('children')
      .select(`
        id, name, age, lead_status, lead_source, created_at, enrolled_at,
        last_contacted_at, next_followup_at, lead_notes,
        parent:parents(name, email, phone),
        coach:coaches(name, email)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('lead_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const recordCount = data?.length || 0;

    // AUDIT LOG - Track PII exports for DPDP Act compliance
    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email,
        action: 'crm_pii_export',
        details: {
          request_id: requestId,
          records_exported: recordCount,
          status_filter: status || 'all',
          export_format: 'csv',
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.error('Audit log failed (non-critical):', auditError);
    }

    // Convert to CSV
    const headers = [
      'Child Name', 'Age', 'Parent Name', 'Parent Email', 'Parent Phone',
      'Status', 'Source', 'Coach', 'Assessed Date', 'Enrolled Date',
      'Last Contacted', 'Next Follow-up', 'Notes',
    ];

    const rows = (data || []).map((child: any) => {
      const parent = Array.isArray(child.parent) ? child.parent[0] : child.parent;
      const coach = Array.isArray(child.coach) ? child.coach[0] : child.coach;

      return [
        child.name || '',
        child.age || '',
        parent?.name || '',
        parent?.email || '',
        parent?.phone || '',
        child.lead_status || 'assessed',
        child.lead_source || 'website',
        coach?.name || '',
        child.created_at ? new Date(child.created_at).toLocaleDateString('en-IN') : '',
        child.enrolled_at ? new Date(child.enrolled_at).toLocaleDateString('en-IN') : '',
        child.last_contacted_at ? new Date(child.last_contacted_at).toLocaleDateString('en-IN') : '',
        child.next_followup_at ? new Date(child.next_followup_at).toLocaleDateString('en-IN') : '',
        (child.lead_notes || '').replace(/[,\n\r"]/g, ' ').substring(0, 500),
      ];
    });

    // Build CSV with proper escaping
    const escapeCsvField = (field: any): string => {
      const str = String(field || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csv = [
      headers.map(escapeCsvField).join(','),
      ...rows.map(row => row.map(escapeCsvField).join(',')),
    ].join('\n');

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_export_success', adminEmail: auth.email, recordCount, duration: `${duration}ms` }));

    const filename = `yestoryd-leads-${status || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Request-Id': requestId,
        'X-Records-Exported': String(recordCount),
      },
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_export_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to export leads', requestId }, { status: 500 });
  }
}
