import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: child, error: childError } = await supabase
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

    const { data: upcomingSessions } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('child_id', child.id)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .in('status', ['scheduled', 'rescheduled'])
      .order('scheduled_date', { ascending: true })
      .limit(5);

    const { count: completedCount } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', child.id)
      .eq('status', 'completed');

    const { data: recentNotes } = await supabase
      .from('session_notes')
      .select('*, scheduled_sessions(session_number, session_type)')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const totalSessions = child.total_sessions || 9;
    const sessionsCompleted = completedCount || 0;
    const progressPercentage = Math.round((sessionsCompleted / totalSessions) * 100);

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
