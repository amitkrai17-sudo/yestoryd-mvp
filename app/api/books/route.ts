import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, { supabase }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const search = url.searchParams.get('search') || '';
  const ageMin = url.searchParams.get('age_min');
  const ageMax = url.searchParams.get('age_max');
  const skill = url.searchParams.get('skill');
  const genre = url.searchParams.get('genre');
  const collection = url.searchParams.get('collection');
  const sort = url.searchParams.get('sort') || 'popular';
  const offset = (page - 1) * limit;

  let query = supabase
    .from('books')
    .select('id, title, author, slug, description, rucha_review, cover_image_url, reading_level, difficulty_score, age_min, age_max, genres, themes, skills_targeted, vote_count, times_read_in_sessions, average_rating, is_available_for_kahani_times, affiliate_url, buy_links, is_featured', { count: 'exact' })
    .eq('is_active', true);

  // Search using ILIKE on title/author (search_text column is for DB-level search)
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }
  if (ageMin) query = query.gte('age_min', parseInt(ageMin));
  if (ageMax) query = query.lte('age_max', parseInt(ageMax));
  if (skill) query = query.contains('skills_targeted', [skill]);
  if (genre) query = query.contains('genres', [genre]);

  // Sort
  switch (sort) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'alphabetical':
      query = query.order('title', { ascending: true });
      break;
    case 'popular':
    default:
      query = query.order('vote_count', { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If collection filter, get book IDs from collection then filter
  // (handled separately since it's a join)
  let books = data || [];
  if (collection) {
    const { data: collectionItems } = await supabase
      .from('book_collection_items')
      .select('book_id')
      .eq('collection_id', collection);

    const collectionBookIds = new Set((collectionItems || []).map((i: { book_id: string }) => i.book_id));
    books = books.filter(b => collectionBookIds.has(b.id));
  }

  const response = NextResponse.json({
    success: true,
    books,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });

  // CDN cache for 5 minutes
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response;
}, { auth: 'none' });
