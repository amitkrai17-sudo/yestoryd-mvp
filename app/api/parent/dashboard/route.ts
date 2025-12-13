import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get child for this parent
    const { data: child, error: childError } = await supabaseAdmin
      .from('children')
      .select(`
        *,
        coaches (
          id,
          name,
          email,
          bio
        )
      `)
      .eq('parent_email', user.email)
      .eq('enrollment_status', 'active')
      .single();

    if (childError || !child) {
      return NextResponse.json({
        success: true,
        hasEnrollment: false,
        message: 'No active enrollment found'
      });
    }

    // Get upcoming sessions
    const { data: upcomingSessions } = await supabaseAdmin
      .from('scheduled_sessions')
      .select('*')
      .eq('child_id', child.id)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .in('status', ['scheduled', 'rescheduled'])
      .order('scheduled_date', { ascending: true })
      .limit(5);

    // Get completed sessions count
    const { count: completedCount } = await supabaseAdmin
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', child.id)
      .eq('status', 'completed');

    // Get recent session notes
    const { data: recentNotes } = await supabaseAdmin
      .from('session_notes')
      .select('*, scheduled_sessions(session_number, session_type)')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // Calculate progress
    const totalSessions = child.total_sessions || 9;
    const sessionsCompleted = completedCount || 0;
    const progressPercentage = Math.round((sessionsCompleted / totalSessions) * 100);

    // Calculate days remaining
    const programEnd = new Date(child.program_end_date);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((programEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      success: true,
      hasEnrollment: true,
      child: {
        id: child.id,
        name: child.child_name || child.name,
        age: child.age,
        latestScore: child.latest_assessment_score,
        sessionsCompleted,
        totalSessions,
        progressPercentage,
        programStartDate: child.program_start_date,
        programEndDate: child.program_end_date,
        daysRemaining,
      },
      coach: child.coaches,
      upcomingSessions: upcomingSessions || [],
      recentNotes: recentNotes || [],
    });

  } catch (error: any) {
    console.error('Parent dashboard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
