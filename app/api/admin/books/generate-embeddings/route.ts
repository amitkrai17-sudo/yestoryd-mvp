// =============================================================================
// FILE: app/api/admin/books/generate-embeddings/route.ts
// PURPOSE: POST — generate embeddings for all books missing them (admin only)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { batchGenerateBookEmbeddings, type Book } from '@/lib/books/generate-book-embedding';

export const POST = withApiHandler(async (_req: NextRequest, ctx) => {
  const { supabase } = ctx;

  // Fetch all books missing embeddings
  const { data: books, error: fetchError } = await supabase
    .from('books')
    .select('id, title, author, description, skills_targeted, themes, reading_level, age_min, age_max')
    .eq('is_active', true)
    .is('embedding', null);

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }

  if (!books || books.length === 0) {
    return NextResponse.json({ success: true, message: 'All books already have embeddings', processed: 0 });
  }

  // Process embeddings in batches
  const result = await batchGenerateBookEmbeddings(books as Book[], supabase);

  // Log to activity_log
  await supabase.from('activity_log').insert({
    action: 'book_embedding_generation',
    actor_type: 'admin',
    details: {
      total_books: books.length,
      success: result.success,
      failed: result.failed,
      errors: result.errors.slice(0, 10), // Cap error details
    },
  });

  return NextResponse.json({
    success: true,
    total: books.length,
    processed: result.success,
    failed: result.failed,
    errors: result.errors.slice(0, 10),
  });
}, { auth: 'admin' });
