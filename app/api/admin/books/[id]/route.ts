import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET single book
export const GET = withParamsHandler<{ id: string }>(async (request, { id }, { supabase }) => {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // Get vote breakdown
  const { data: votes } = await supabase
    .from('book_votes')
    .select('vote_type')
    .eq('book_id', id);

  const voteBreakdown = {
    kahani_request: 0,
    want_to_read: 0,
    favorite: 0,
  };
  votes?.forEach((v: { vote_type: string }) => {
    if (v.vote_type in voteBreakdown) {
      voteBreakdown[v.vote_type as keyof typeof voteBreakdown]++;
    }
  });

  return NextResponse.json({ success: true, book: { ...data, vote_breakdown: voteBreakdown } });
}, { auth: 'admin' });

// PATCH: Update book
const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  illustrator: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  reading_level: z.string().optional().nullable(),
  difficulty_score: z.number().optional().nullable(),
  age_min: z.number().min(0).max(18).optional(),
  age_max: z.number().min(0).max(18).optional(),
  genres: z.array(z.string()).optional().nullable(),
  themes: z.array(z.string()).optional().nullable(),
  skills_targeted: z.array(z.string()).optional().nullable(),
  source_url: z.string().optional().nullable(),
  affiliate_url: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  rucha_review: z.string().optional().nullable(),
  buy_links: z.record(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  is_available_for_coaching: z.boolean().optional(),
  is_available_for_kahani_times: z.boolean().optional(),
  language: z.string().optional().nullable(),
  page_count: z.number().optional().nullable(),
  reading_time_minutes: z.number().optional().nullable(),
});

export const PATCH = withParamsHandler<{ id: string }>(async (request, { id }, { auth, supabase, requestId }) => {
  const body = await request.json();
  const validation = updateBookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('books')
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity_log').insert({
    user_email: auth.email || 'unknown',
    user_type: 'admin',
    action: 'book_updated',
    metadata: { request_id: requestId, book_id: id, fields: Object.keys(validation.data) },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, book: data });
}, { auth: 'admin' });

// DELETE: Soft delete (set is_active = false)
export const DELETE = withParamsHandler<{ id: string }>(async (request, { id }, { auth, supabase, requestId }) => {
  const { error } = await supabase
    .from('books')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity_log').insert({
    user_email: auth.email || 'unknown',
    user_type: 'admin',
    action: 'book_deactivated',
    metadata: { request_id: requestId, book_id: id },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}, { auth: 'admin' });
