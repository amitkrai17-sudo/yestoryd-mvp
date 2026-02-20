// GET /api/public/stats — lightweight cached API for live platform metrics
// Used by SocialProofBar on landing page

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Parallel DB counts
    const [assessments, enrollments, sessions, coaches] = await Promise.all([
      supabaseAdmin
        .from('children')
        .select('*', { count: 'exact', head: true })
        .not('latest_assessment_score', 'is', null),
      supabaseAdmin
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'pending_start', 'completed']),
      supabaseAdmin
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabaseAdmin
        .from('coaches')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    const stats = {
      assessments_completed: assessments.count || 0,
      active_enrollments: enrollments.count || 0,
      sessions_delivered: sessions.count || 0,
      active_coaches: coaches.count || 0,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[public/stats] Error:', error);
    // Return safe fallback so UI never breaks
    return NextResponse.json(
      { assessments_completed: 0, active_enrollments: 0, sessions_delivered: 0, active_coaches: 0 },
      { status: 200 }
    );
  }
}
