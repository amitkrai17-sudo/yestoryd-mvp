import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, { supabase }) => {
  // Fetch active collections
  const { data: collections, error } = await supabase
    .from('book_collections')
    .select('id, name, slug, description, cover_image_url')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each collection, get item count and first 4 book covers
  const enriched = await Promise.all(
    (collections || []).map(async (col: any) => {
      const { data: items, count } = await supabase
        .from('book_collection_items')
        .select('book_id, books(cover_image_url, title)', { count: 'exact' })
        .eq('collection_id', col.id)
        .limit(4);

      return {
        ...col,
        book_count: count || 0,
        preview_covers: (items || [])
          .map((i: any) => ({ cover_image_url: i.books?.cover_image_url, title: i.books?.title }))
          .filter((c: any) => c.cover_image_url),
      };
    })
  );

  const response = NextResponse.json({ success: true, collections: enriched });
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response;
}, { auth: 'none' });
