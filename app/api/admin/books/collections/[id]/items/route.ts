import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const manageItemsSchema = z.object({
  book_ids: z.array(z.string().uuid()),
  action: z.enum(['add', 'remove']),
});

export const POST = withParamsHandler<{ id: string }>(async (request, { id }, { auth, supabase, requestId }) => {
  const body = await request.json();
  const validation = manageItemsSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const { book_ids, action } = validation.data;

  // Verify collection exists
  const { data: collection } = await supabase
    .from('book_collections')
    .select('id')
    .eq('id', id)
    .single();

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  if (action === 'add') {
    // Get existing items to avoid duplicates
    const { data: existing } = await supabase
      .from('book_collection_items')
      .select('book_id')
      .eq('collection_id', id)
      .in('book_id', book_ids);

    const existingIds = new Set((existing || []).map((e: { book_id: string }) => e.book_id));
    const newItems = book_ids
      .filter(bid => !existingIds.has(bid))
      .map(book_id => ({ collection_id: id, book_id }));

    if (newItems.length > 0) {
      const { error } = await supabase.from('book_collection_items').insert(newItems);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'books_added_to_collection',
      metadata: { request_id: requestId, collection_id: id, book_ids, added: newItems.length, skipped: existingIds.size },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, added: newItems.length, skipped: book_ids.length - newItems.length });
  } else {
    const { error } = await supabase
      .from('book_collection_items')
      .delete()
      .eq('collection_id', id)
      .in('book_id', book_ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'books_removed_from_collection',
      metadata: { request_id: requestId, collection_id: id, book_ids },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, removed: book_ids.length });
  }
}, { auth: 'admin' });
