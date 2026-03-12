import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withParamsHandler<{ slug: string }>(async (request, { slug }, { supabase }) => {
  // Fetch book by slug
  const { data: book, error } = await supabase
    .from('books')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // Fetch collection memberships
  const { data: collectionItems } = await supabase
    .from('book_collection_items')
    .select('collection_id, book_collections(id, name, slug)')
    .eq('book_id', book.id);

  const collections = (collectionItems || [])
    .map((ci: any) => ci.book_collections)
    .filter(Boolean);

  // Fetch related books (same age range + overlapping skills, max 6)
  const relatedQuery = supabase
    .from('books')
    .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, skills_targeted, vote_count, rucha_review, is_available_for_kahani_times, affiliate_url')
    .eq('is_active', true)
    .neq('id', book.id)
    .gte('age_min', Math.max((book.age_min || 4) - 2, 0))
    .lte('age_max', (book.age_max || 12) + 2)
    .order('vote_count', { ascending: false, nullsFirst: false })
    .limit(6);

  const { data: related } = await relatedQuery;

  // Log view to activity_log (fire and forget)
  supabase.from('activity_log').insert({
    user_type: 'visitor',
    action: 'book_viewed',
    metadata: { book_id: book.id, slug, title: book.title },
    created_at: new Date().toISOString(),
  }).then(() => {});

  const response = NextResponse.json({
    success: true,
    book: { ...book, collections },
    related: related || [],
  });

  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response;
}, { auth: 'none' });
