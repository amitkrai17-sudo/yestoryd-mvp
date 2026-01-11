// app/api/coach/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Use established auth pattern
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const coachId = auth.coachId;
    console.log('Auth result:', JSON.stringify(auth));
    
    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID not found' }, { status: 400 });
    }

    // Get coach data
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', coachId)
      .single();

    if (coachError || !coachData) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Get all sessions with child details
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        child_id,
        scheduled_date,
        scheduled_time,
        session_type,
        session_number,
        session_title,
        status,
        google_meet_link,
        coach_notes,
        children (
          id,
          child_name,
          parent_name,
          age
        )
      `)
      .eq('coach_id', coachId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (sessionsError) {
      console.error('Sessions fetch error:', sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    // Check which sessions have notes (using coach_notes column instead of separate table)
    const sessionsWithNotes = new Set(
      (sessionsData || [])
        .filter((s: any) => s.coach_notes && s.coach_notes.trim() !== '')
        .map((s: any) => s.id)
    );

    // Format sessions for frontend
    const formattedSessions = (sessionsData || []).map((s: any) => ({
      id: s.id,
      child_id: s.child_id,
      child_name: s.children?.child_name || 'Unknown',
      child_age: s.children?.age || 0,
      parent_name: s.children?.parent_name || '',
      scheduled_date: s.scheduled_date,
      scheduled_time: s.scheduled_time,
      session_type: s.session_type,
      session_number: s.session_number,
      session_title: s.session_title,
      status: s.status || 'pending',
      google_meet_link: s.google_meet_link,
      has_notes: sessionsWithNotes.has(s.id),
    }));

    return NextResponse.json({
      coach: coachData,
      sessions: formattedSessions,
    });

  } catch (error) {
    console.error('Coach sessions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
