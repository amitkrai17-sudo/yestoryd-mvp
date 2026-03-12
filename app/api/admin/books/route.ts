// GET: List books with pagination + filters
// POST: Create single book

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, { supabase, requestId }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const search = url.searchParams.get('search') || '';
  const ageMin = url.searchParams.get('age_min');
  const ageMax = url.searchParams.get('age_max');
  const readingLevel = url.searchParams.get('reading_level');
  const genre = url.searchParams.get('genre');
  const isActive = url.searchParams.get('is_active');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('books')
    .select('id, title, author, slug, cover_image_url, age_min, age_max, reading_level, genres, skills_targeted, is_active, is_featured, vote_count, times_read_in_sessions, is_available_for_coaching, is_available_for_kahani_times, rucha_review, created_at', { count: 'exact' });

  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }
  if (ageMin) query = query.gte('age_min', parseInt(ageMin));
  if (ageMax) query = query.lte('age_max', parseInt(ageMax));
  if (readingLevel) query = query.eq('reading_level', readingLevel);
  if (genre) query = query.contains('genres', [genre]);
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    query = query.eq('is_active', isActive === 'true');
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    books: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}, { auth: 'admin' });

// POST: Create single book
const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  age_min: z.number().min(0).max(18),
  age_max: z.number().min(0).max(18),
  // All optional fields
  illustrator: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  reading_level: z.string().optional().nullable(),
  difficulty_score: z.number().optional().nullable(),
  genres: z.array(z.string()).optional().nullable(),
  themes: z.array(z.string()).optional().nullable(),
  skills_targeted: z.array(z.string()).optional().nullable(),
  source_url: z.string().optional().nullable(),
  affiliate_url: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  rucha_review: z.string().optional().nullable(),
  buy_links: z.record(z.string()).optional().nullable(),
  is_available_for_coaching: z.boolean().optional(),
  is_available_for_kahani_times: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  language: z.string().optional().nullable(),
  page_count: z.number().optional().nullable(),
  reading_time_minutes: z.number().optional().nullable(),
});

export const POST = withApiHandler(async (request, { auth, supabase, requestId }) => {
  const body = await request.json();
  const validation = createBookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const bookData = validation.data;

  // Generate slug from title
  let slug = bookData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Check for duplicate slug
  const { data: existing } = await supabase
    .from('books')
    .select('slug')
    .like('slug', `${slug}%`);

  if (existing && existing.length > 0) {
    const existingSlugs = new Set(existing.map((b: { slug: string | null }) => b.slug));
    if (existingSlugs.has(slug)) {
      let counter = 2;
      while (existingSlugs.has(`${slug}-${counter}`)) counter++;
      slug = `${slug}-${counter}`;
    }
  }

  const { data, error } = await supabase
    .from('books')
    .insert({ ...bookData, slug, is_active: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await supabase.from('activity_log').insert({
    user_email: auth.email || 'unknown',
    user_type: 'admin',
    action: 'book_created',
    metadata: { request_id: requestId, book_id: data.id, title: bookData.title },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, book: data }, { status: 201 });
}, { auth: 'admin' });
