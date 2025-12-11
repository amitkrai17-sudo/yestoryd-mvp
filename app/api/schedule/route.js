// app/api/schedule/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');
  const parentEmail = searchParams.get('email');
  const filter = searchParams.get('filter') || 'upcoming';

  try {
    let childQuery = supabase.from('children').select('*');
    
    if (childId) {
      childQuery = childQuery.eq('id', childId);
    } else if (parentEmail) {
      childQuery = childQuery.eq('parent_email', parentEmail);
    } else {
      return Response.json({ error: 'childId or email required' }, { status: 400 });
    }

    // FIX 1: Add .limit(1) to handle parents with multiple children safely
    const { data: child, error: childError } = await childQuery.limit(1).maybeSingle();

    if (childError) {
      console.error('Child query error:', childError);
      return Response.json({ error: childError.message }, { status: 500 });
    }

    if (!child) {
      return Response.json({ error: 'Child not found' }, { status: 404 });
    }

    // Get coach separately
    let coach = null;
    if (child.assigned_coach_id) {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', child.assigned_coach_id)
        .maybeSingle(); // FIX 2: Use maybeSingle() to prevent crashes if coach is missing
      coach = coachData;
    }

    // Get sessions
    let sessionsQuery = supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('child_id', child.id)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    const today = new Date().toISOString().split('T')[0];

    if (filter === 'upcoming') {
      sessionsQuery = sessionsQuery.gte('scheduled_date', today);
    } else if (filter === 'past') {
      sessionsQuery = sessionsQuery.lt('scheduled_date', today);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('Sessions query error:', sessionsError);
      return Response.json({ error: sessionsError.message }, { status: 500 });
    }

    return Response.json({
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        parentName: child.parent_name,
        parentEmail: child.parent_email,
        programStart: child.program_start_date,
        programEnd: child.program_end_date,
        status: child.subscription_status,
      },
      coach: coach ? {
        id: coach.id,
        name: coach.name,
        email: coach.email,
      } : null,
      sessions: (sessions || []).map(s => ({
        id: s.id,
        type: s.session_type,
        title: s.session_title,
        week: s.week_number,
        date: s.scheduled_date,
        time: s.scheduled_time,
        duration: s.duration_minutes,
        meetLink: s.google_meet_link,
        status: s.status,
      })),
      totalSessions: sessions?.length || 0,
    });
  } catch (error) {
    console.error('Schedule API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}