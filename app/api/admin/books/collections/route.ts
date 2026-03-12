import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, { supabase }) => {
  const { data, error } = await supabase
    .from('book_collections')
    .select(`
      *,
      book_collection_items(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten count
  const collections = (data || []).map((c: any) => ({
    ...c,
    item_count: c.book_collection_items?.[0]?.count || 0,
    book_collection_items: undefined,
  }));

  return NextResponse.json({ success: true, collections });
}, { auth: 'admin' });

const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
});

export const POST = withApiHandler(async (request, { auth, supabase, requestId }) => {
  const body = await request.json();
  const validation = createCollectionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  // Generate slug from name
  const slug = validation.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabase
    .from('book_collections')
    .insert({ ...validation.data, slug, is_active: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity_log').insert({
    user_email: auth.email || 'unknown',
    user_type: 'admin',
    action: 'book_collection_created',
    metadata: { request_id: requestId, collection_id: data.id, name: validation.data.name },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, collection: data }, { status: 201 });
}, { auth: 'admin' });
