// =============================================================================
// FILE: app/api/books/kahani-picks/route.ts
// PURPOSE: GET top Kahani Times votable books — public, with optional user vote status
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Optional auth — if present, check which books the user has voted for
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Get books available for Kahani Times, sorted by recent votes
    const { data: books } = await supabase
      .from('books')
      .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, vote_count, rucha_review')
      .eq('is_active', true)
      .eq('is_available_for_kahani_times', true)
      .order('vote_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (!books || books.length === 0) {
      return NextResponse.json({ success: true, books: [], userVotes: [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }

    // Get votes from the last 30 days per book for the progress bar
    const bookIds = books.map(b => b.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: recentVotes } = await supabase
      .from('book_votes')
      .select('book_id')
      .in('book_id', bookIds)
      .eq('vote_type', 'kahani_request')
      .gte('vote_date', thirtyDaysAgo);

    // Count recent votes per book
    const recentVoteCounts: Record<string, number> = {};
    (recentVotes || []).forEach((v: { book_id: string }) => {
      recentVoteCounts[v.book_id] = (recentVoteCounts[v.book_id] || 0) + 1;
    });

    // If authenticated, check which books the user has voted for today
    let userVotedBookIds: string[] = [];
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: userVotes } = await supabase
        .from('book_votes')
        .select('book_id')
        .eq('parent_id', userId)
        .eq('vote_type', 'kahani_request')
        .eq('vote_date', today)
        .in('book_id', bookIds);

      userVotedBookIds = (userVotes || []).map((v: { book_id: string }) => v.book_id);
    }

    // Find the max recent votes for progress bar scaling
    const maxVotes = Math.max(1, ...Object.values(recentVoteCounts));

    const enriched = books.map(book => ({
      ...book,
      recent_votes: recentVoteCounts[book.id] || 0,
      vote_progress: Math.round(((recentVoteCounts[book.id] || 0) / maxVotes) * 100),
      user_voted: userVotedBookIds.includes(book.id),
    }));

    return NextResponse.json({
      success: true,
      books: enriched,
      userVotes: userVotedBookIds,
    }, {
      headers: {
        'Cache-Control': userId
          ? 'private, max-age=30'
          : 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[KAHANI_PICKS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
