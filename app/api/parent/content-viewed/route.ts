// ============================================================
// FILE: app/api/parent/content-viewed/route.ts
// PURPOSE: Track when parent opens a practice content item.
//          Updates the parent_practice_assigned learning_event's
//          event_data to record viewed_at per item.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { getSupabaseClient } from '@/lib/supabase/client';
const supabaseAnon = getSupabaseClient();
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Auth: get parent from Supabase session token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, content_ref_id } = body;

    if (!event_id || !content_ref_id) {
      return NextResponse.json({ error: 'event_id and content_ref_id required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch the learning event
    const { data: event, error: fetchError } = await supabase
      .from('learning_events')
      .select('id, event_data')
      .eq('id', event_id)
      .eq('event_type', 'parent_practice_assigned')
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Update the event_data: mark the item as viewed
    const eventData = (event.event_data || {}) as Record<string, any>;
    const items = eventData.items || [];
    let found = false;

    for (const item of items) {
      if (item.id === content_ref_id && !item.viewed_at) {
        item.viewed_at = new Date().toISOString();
        found = true;
        break;
      }
    }

    if (!found) {
      return NextResponse.json({ success: true, already_viewed: true });
    }

    // Save updated event_data
    await supabase
      .from('learning_events')
      .update({ event_data: { ...eventData, items } })
      .eq('id', event_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('content-viewed error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
