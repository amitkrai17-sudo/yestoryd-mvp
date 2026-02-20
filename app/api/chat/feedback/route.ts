// file: app/api/chat/feedback/route.ts
// rAI v2.1 - Chat feedback endpoint (thumbs up/down)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Untyped client for the new rai_chat_feedback table (not yet in generated types)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageContent, userQuery, rating, userRole, userId, childId } = body;

    if (!messageContent || !rating || !userRole || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (rating !== 'positive' && rating !== 'negative') {
      return NextResponse.json({ error: 'Rating must be positive or negative' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase.from('rai_chat_feedback').insert({
      user_id: userId,
      user_role: userRole,
      child_id: childId || null,
      user_query: userQuery || '',
      rai_response: messageContent,
      rating,
    });

    if (error) {
      console.error('Failed to save feedback:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback endpoint error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
