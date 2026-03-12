import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, { supabase }) => {
  // Use the book_popularity view
  const { data, error } = await supabase
    .from('book_popularity')
    .select('*')
    .order('votes_this_month', { ascending: false })
    .limit(10);

  if (error) {
    // Fallback to direct query if view fails
    const { data: fallback } = await supabase
      .from('books')
      .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, vote_count, is_available_for_kahani_times, average_rating')
      .eq('is_active', true)
      .order('vote_count', { ascending: false, nullsFirst: false })
      .limit(10);

    const response = NextResponse.json({ success: true, books: fallback || [] });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  }

  const response = NextResponse.json({ success: true, books: data || [] });
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response;
}, { auth: 'none' });
