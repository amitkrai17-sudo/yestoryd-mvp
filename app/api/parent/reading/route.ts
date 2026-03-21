// =============================================================================
// FILE: app/api/parent/reading/route.ts
// PURPOSE: GET reading data for a child — reading log, stats, current book
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteSetting } from '@/lib/config/site-settings-loader';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Auth — parent Bearer token pattern
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get childId from query
    const childId = request.nextUrl.searchParams.get('childId');
    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, parent_email')
      .eq('id', childId)
      .eq('parent_email', user.email ?? '')
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Get reading log entries (learning_events with event_type = 'reading_log')
    const { data: readingLogs } = await supabase
      .from('learning_events')
      .select('id, event_date, event_data, ai_summary, created_at')
      .eq('child_id', childId)
      .eq('event_type', 'reading_log')
      .order('event_date', { ascending: false })
      .limit(30);

    // Get monthly reading goal from site_settings
    const monthlyGoal = await getSiteSetting('default_monthly_reading_goal');
    const goal = monthlyGoal ? Number(JSON.parse(String(monthlyGoal))) : 4;

    // Count books read this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: booksThisMonth } = await supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('event_type', 'reading_log')
      .gte('event_date', monthStart);

    // Get total books read
    const { count: totalBooks } = await supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('event_type', 'reading_log');

    // Get book votes by this child's parent (for "currently interested" books)
    const { data: votes } = await supabase
      .from('book_votes')
      .select('book_id, books(id, title, author, slug, cover_image_url)')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const votedBooks = (votes || [])
      .map((v: Record<string, unknown>) => v.books)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      childName: child.child_name,
      readingLogs: readingLogs || [],
      stats: {
        booksThisMonth: booksThisMonth || 0,
        monthlyGoal: goal,
        totalBooks: totalBooks || 0,
      },
      votedBooks,
    });
  } catch (error) {
    console.error('[PARENT_READING] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
