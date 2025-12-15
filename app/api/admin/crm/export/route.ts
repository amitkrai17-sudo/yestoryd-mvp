import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch all leads
    let query = supabase
      .from('children')
      .select(`
        id,
        name,
        age,
        lead_status,
        lead_source,
        created_at,
        enrolled_at,
        last_contacted_at,
        next_followup_at,
        lead_notes,
        parent:parents(name, email, phone),
        coach:coaches(name, email)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('lead_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Convert to CSV
    const headers = [
      'Child Name',
      'Age',
      'Parent Name',
      'Parent Email',
      'Parent Phone',
      'Status',
      'Source',
      'Coach',
      'Assessed Date',
      'Enrolled Date',
      'Last Contacted',
      'Next Follow-up',
      'Notes',
    ];

    const rows = (data || []).map((child: any) => [
      child.name || '',
      child.age || '',
      child.parent?.name || '',
      child.parent?.email || '',
      child.parent?.phone || '',
      child.lead_status || 'assessed',
      child.lead_source || 'website',
      child.coach?.name || '',
      child.created_at ? new Date(child.created_at).toLocaleDateString() : '',
      child.enrolled_at ? new Date(child.enrolled_at).toLocaleDateString() : '',
      child.last_contacted_at ? new Date(child.last_contacted_at).toLocaleDateString() : '',
      child.next_followup_at ? new Date(child.next_followup_at).toLocaleDateString() : '',
      (child.lead_notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
    ]);

    // Build CSV string
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Return as downloadable file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="yestoryd-leads-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
