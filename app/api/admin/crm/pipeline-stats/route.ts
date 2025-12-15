import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Try to use the function we created
    const { data, error } = await supabase.rpc('get_lead_pipeline_stats');

    if (error) {
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

      return NextResponse.json({ stats });
    }

    return NextResponse.json({ stats: data || [] });
  } catch (error: any) {
    console.error('Error fetching pipeline stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
