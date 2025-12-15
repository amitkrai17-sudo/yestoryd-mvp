import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days') || '7');

    // Try to use the function we created
    const { data, error } = await supabase.rpc('get_crm_daily_stats', { days_back: daysBack });

    if (error) {
      // Fallback: manual calculation
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get assessments by day
      const { data: children } = await supabase
        .from('children')
        .select('created_at, enrolled_at')
        .gte('created_at', startDate.toISOString());

      // Get interactions by day
      const { data: interactions } = await supabase
        .from('interactions')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      // Build daily stats
      const stats: any[] = [];
      for (let i = daysBack; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const newAssessments = children?.filter((c: any) => 
          c.created_at?.startsWith(dateStr)
        ).length || 0;

        const newEnrollments = children?.filter((c: any) => 
          c.enrolled_at?.startsWith(dateStr)
        ).length || 0;

        const interactionsLogged = interactions?.filter((i: any) => 
          i.created_at?.startsWith(dateStr)
        ).length || 0;

        stats.push({
          date: dateStr,
          new_assessments: newAssessments,
          new_enrollments: newEnrollments,
          interactions_logged: interactionsLogged,
        });
      }

      return NextResponse.json({ stats });
    }

    return NextResponse.json({ stats: data || [] });
  } catch (error: any) {
    console.error('Error fetching daily stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
