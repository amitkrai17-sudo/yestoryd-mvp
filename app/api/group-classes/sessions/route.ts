// =============================================================================
// FILE: app/api/group-classes/sessions/route.ts
// PURPOSE: Fetch upcoming group class sessions for public /classes page
// FIXED: Uses separate queries for related data to avoid FK issues
// =============================================================================

export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/group-classes/sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const classTypeSlug = searchParams.get('type');
    const ageMin = searchParams.get('age_min');
    const ageMax = searchParams.get('age_max');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const today = new Date().toISOString().split('T')[0];
    console.log('Fetching sessions for date >=', today);

    // First, get sessions without joins
    let query = supabase
      .from('group_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(limit);

    // Filter by class type slug
    if (classTypeSlug) {
      const { data: classType } = await supabase
        .from('group_class_types')
        .select('id')
        .eq('slug', classTypeSlug)
        .single();
      
      if (classType) {
        query = query.eq('class_type_id', classType.id);
      }
    }

    // Filter by age range
    if (ageMin) query = query.gte('age_max', parseInt(ageMin));
    if (ageMax) query = query.lte('age_min', parseInt(ageMax));

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions', details: error.message }, { status: 500 });
    }

    console.log('Found sessions:', sessions?.length || 0);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    // Get unique IDs for related data
    const classTypeIds = Array.from(new Set(sessions.map(s => s.class_type_id).filter(Boolean)));
    const instructorIds = Array.from(new Set(sessions.map(s => s.instructor_id).filter(Boolean)));
    const bookIds = Array.from(new Set(sessions.map(s => s.book_id).filter(Boolean)));

    // Fetch related data in parallel
    const [classTypesRes, instructorsRes, booksRes] = await Promise.all([
      classTypeIds.length > 0 
        ? supabase.from('group_class_types').select('*').in('id', classTypeIds)
        : { data: [] },
      instructorIds.length > 0
        ? supabase.from('coaches').select('id, name, photo_url, bio').in('id', instructorIds)
        : { data: [] },
      bookIds.length > 0
        ? supabase.from('books').select('id, title, author, cover_image_url').in('id', bookIds)
        : { data: [] },
    ]);

    // Create lookup maps
    const classTypesMap = new Map((classTypesRes.data || []).map(ct => [ct.id, ct]));
    const instructorsMap = new Map((instructorsRes.data || []).map(i => [i.id, i]));
    const booksMap = new Map((booksRes.data || []).map(b => [b.id, b]));

    // Transform sessions with related data
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description,
      scheduledDate: session.scheduled_date,
      scheduledTime: session.scheduled_time,
      durationMinutes: session.duration_minutes,
      maxParticipants: session.max_participants,
      currentParticipants: session.current_participants,
      spotsAvailable: session.max_participants - session.current_participants,
      priceInr: session.price_inr,
      ageMin: session.age_min,
      ageMax: session.age_max,
      classType: session.class_type_id ? classTypesMap.get(session.class_type_id) || null : null,
      instructor: session.instructor_id ? instructorsMap.get(session.instructor_id) || null : null,
      book: session.book_id ? booksMap.get(session.book_id) || null : null,
    }));

    return NextResponse.json({ 
      sessions: transformedSessions,
      total: transformedSessions.length
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}