// =============================================================================
// FILE: app/api/group-classes/sessions/[sessionId]/route.ts
// PURPOSE: Get single session details for registration page
// FIXED: Next.js 15 async params + separate queries for related data
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: Extract sessionId from URL
function getSessionIdFromUrl(request: NextRequest): string | null {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1];
  if (sessionId && UUID_REGEX.test(sessionId)) {
    return sessionId;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  try {
    // Get sessionId from URL (most reliable)
    const sessionId = getSessionIdFromUrl(request);
    
    console.log('Fetching session:', sessionId);

    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session without joins
    const { data: session, error } = await supabase
      .from('group_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      console.error('Session not found:', error);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get related data separately
    let classType = null;
    let instructor = null;
    let book = null;

    if (session.class_type_id) {
      const { data } = await supabase
        .from('group_class_types')
        .select('id, slug, name, tagline, icon_emoji, color_hex, duration_minutes, features, learning_outcomes')
        .eq('id', session.class_type_id)
        .single();
      classType = data;
    }

    if (session.instructor_id) {
      const { data } = await supabase
        .from('coaches')
        .select('id, name, photo_url, bio')
        .eq('id', session.instructor_id)
        .single();
      instructor = data;
    }

    if (session.book_id) {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url')
        .eq('id', session.book_id)
        .single();
      book = data;
    }

    // Check if registration is still open
    const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    const now = new Date();
    
    if (sessionDate <= now) {
      return NextResponse.json(
        { error: 'Registration closed - session has started or passed' },
        { status: 400 }
      );
    }

    // Check spots available
    const spotsAvailable = session.max_participants - session.current_participants;

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        scheduledDate: session.scheduled_date,
        scheduledTime: session.scheduled_time,
        durationMinutes: session.duration_minutes,
        maxParticipants: session.max_participants,
        currentParticipants: session.current_participants,
        spotsAvailable,
        priceInr: session.price_inr,
        ageMin: session.age_min,
        ageMax: session.age_max,
        status: session.status,
        googleMeetLink: session.google_meet_link,
        classType,
        instructor,
        book,
      },
      isOpen: spotsAvailable > 0 && session.status === 'scheduled',
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}