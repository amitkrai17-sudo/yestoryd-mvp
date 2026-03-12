// =============================================================================
// FILE: app/api/books/[slug]/vote/route.ts
// PURPOSE: POST vote on a book, DELETE unvote — triggers auto-update vote_count
// NOTE: [slug] param receives book UUID (matches sibling [slug]/route.ts)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';

// ── POST: Cast a vote ──
export const POST = withParamsHandler<{ slug: string }>(async (req, params, ctx) => {
  const { supabase, auth } = ctx;
  const bookId = params.slug;

  const body = await req.json();
  const voteType = body.vote_type || 'kahani_request';
  const childId = body.child_id || null;

  // Validate vote_type
  if (!['kahani_request', 'want_to_read', 'favorite'].includes(voteType)) {
    return NextResponse.json({ error: 'Invalid vote_type' }, { status: 400 });
  }

  // Check book exists and is active
  const { data: book } = await supabase
    .from('books')
    .select('id, is_active, is_available_for_kahani_times, vote_count')
    .eq('id', bookId)
    .single();

  if (!book || !book.is_active) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // For kahani_request, book must be available for Kahani Times
  if (voteType === 'kahani_request' && !book.is_available_for_kahani_times) {
    return NextResponse.json({ error: 'This book is not available for Kahani Times voting' }, { status: 400 });
  }

  // Insert vote — unique index prevents daily duplicates
  const { error: insertError } = await supabase
    .from('book_votes')
    .insert({
      book_id: bookId,
      parent_id: auth.userId,
      child_id: childId,
      vote_type: voteType,
    });

  if (insertError) {
    // Unique constraint violation = already voted today
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Already voted today', already_voted: true }, { status: 409 });
    }
    console.error('[BOOK_VOTE] Insert error:', insertError);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }

  // Fetch updated count (trigger has already fired)
  const { data: updated } = await supabase
    .from('books')
    .select('vote_count')
    .eq('id', bookId)
    .single();

  return NextResponse.json({
    success: true,
    new_vote_count: updated?.vote_count || (book.vote_count || 0) + 1,
  });
}, { auth: 'authenticated' });

// ── DELETE: Remove a vote ──
export const DELETE = withParamsHandler<{ slug: string }>(async (req, params, ctx) => {
  const { supabase, auth } = ctx;
  const bookId = params.slug;
  const voteType = req.nextUrl.searchParams.get('vote_type') || 'kahani_request';

  const userId = auth.userId!;

  // Delete the most recent vote of this type by this user
  const { data: votes } = await supabase
    .from('book_votes')
    .select('id')
    .eq('book_id', bookId)
    .eq('parent_id', userId)
    .eq('vote_type', voteType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!votes || votes.length === 0) {
    return NextResponse.json({ error: 'No vote found to remove' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('book_votes')
    .delete()
    .eq('id', votes[0].id);

  if (deleteError) {
    console.error('[BOOK_VOTE] Delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 });
  }

  // Fetch updated count
  const { data: updated } = await supabase
    .from('books')
    .select('vote_count')
    .eq('id', bookId)
    .single();

  return NextResponse.json({
    success: true,
    new_vote_count: updated?.vote_count || 0,
  });
}, { auth: 'authenticated' });
