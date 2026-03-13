import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { Database } from '@/lib/database.types';
import { getSkillCategories } from '@/lib/config/skill-categories';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rowSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  age_min: z.union([z.number(), z.string().transform(Number)]),
  age_max: z.union([z.number(), z.string().transform(Number)]),
  illustrator: z.string().optional().default(''),
  publisher: z.string().optional().default(''),
  isbn: z.string().optional().default(''),
  description: z.string().optional().default(''),
  reading_level: z.string().optional().default(''),
  difficulty_score: z.string().optional().default(''),
  genres: z.string().optional().default(''),
  themes: z.string().optional().default(''),
  skills_targeted: z.string().optional().default(''),
  cover_image_url: z.string().optional().default(''),
  source_url: z.string().optional().default(''),
  affiliate_url: z.string().optional().default(''),
  rucha_review: z.string().optional().default(''),
  is_available_for_coaching: z.string().optional().default('false'),
  is_available_for_kahani_times: z.string().optional().default('false'),
});

interface RowError {
  row: number;
  reason: string;
}

export const POST = withApiHandler(async (request, { auth, supabase, requestId }) => {
  const body = await request.json();
  const { items } = body as { items: Record<string, string>[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  if (items.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 books per upload' }, { status: 400 });
  }

  const errors: RowError[] = [];
  const toInsert: Database['public']['Tables']['books']['Insert'][] = [];

  // Validate each row (first pass — record errors)
  for (let i = 0; i < items.length; i++) {
    const rowNum = i + 2; // +2 for header row + 0-index
    const validation = rowSchema.safeParse(items[i]);

    if (!validation.success) {
      const issues = validation.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join('; ');
      errors.push({ row: rowNum, reason: issues });
    }
  }

  // Batch check for duplicates (title + author)
  const { data: existingBooks } = await supabase
    .from('books')
    .select('title, author');

  const existingSet = new Set(
    (existingBooks || []).map((b: { title: string; author: string | null }) =>
      `${b.title?.toLowerCase().trim()}|||${(b.author || '').toLowerCase().trim()}`
    )
  );

  // Fetch existing slugs for dedup
  const { data: existingSlugs } = await supabase
    .from('books')
    .select('slug');
  const slugSet = new Set((existingSlugs || []).map((b: { slug: string | null }) => b.slug));

  // Build skill label→slug map for validation (accepts both slugs and labels)
  const skillCategories = await getSkillCategories();
  const validSkillSlugs = new Set(skillCategories.map(c => c.slug));
  const labelToSlug = new Map<string, string>();
  for (const cat of skillCategories) {
    labelToSlug.set(cat.label.toLowerCase(), cat.slug);
    if (cat.parentLabel) labelToSlug.set(cat.parentLabel.toLowerCase(), cat.slug);
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const validation = rowSchema.safeParse(items[i]);
    if (!validation.success) continue; // Already recorded error above

    const row = validation.data;
    const key = `${row.title.toLowerCase().trim()}|||${row.author.toLowerCase().trim()}`;

    if (existingSet.has(key)) {
      skipped++;
      continue;
    }

    // Generate unique slug
    let slug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slugSet.has(slug)) {
      let counter = 2;
      while (slugSet.has(`${slug}-${counter}`)) counter++;
      slug = `${slug}-${counter}`;
    }
    slugSet.add(slug);
    existingSet.add(key);

    // Parse comma-separated arrays
    const parseArray = (val: string): string[] =>
      val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

    toInsert.push({
      title: row.title.trim(),
      author: row.author.trim(),
      slug,
      age_min: Number(row.age_min),
      age_max: Number(row.age_max),
      illustrator: row.illustrator || null,
      publisher: row.publisher || null,
      isbn: row.isbn || null,
      description: row.description || null,
      reading_level: row.reading_level || null,
      difficulty_score: row.difficulty_score ? Number(row.difficulty_score) : null,
      genres: parseArray(row.genres),
      themes: parseArray(row.themes),
      skills_targeted: parseArray(row.skills_targeted).map(s => {
        // Accept slugs directly
        if (validSkillSlugs.has(s)) return s;
        // Try mapping label to slug (case-insensitive)
        const mapped = labelToSlug.get(s.toLowerCase());
        if (mapped) return mapped;
        // Unknown skill — warn but skip
        errors.push({ row: i + 2, reason: `Unknown skill "${s}" — skipped. Use slugs or labels from skill_categories.` });
        return null;
      }).filter((s): s is string => s !== null),
      cover_image_url: row.cover_image_url || (row.isbn ? `https://covers.openlibrary.org/b/isbn/${row.isbn}-M.jpg` : null),
      source_url: row.source_url || null,
      affiliate_url: row.affiliate_url || null,
      rucha_review: row.rucha_review || null,
      is_available_for_coaching: row.is_available_for_coaching === 'true',
      is_available_for_kahani_times: row.is_available_for_kahani_times === 'true',
      is_active: true,
    });
  }

  // Batch insert (max 100 at a time)
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { error } = await supabase.from('books').insert(batch);
    if (error) {
      errors.push({ row: 0, reason: `Batch insert error: ${error.message}` });
    } else {
      inserted += batch.length;
    }
  }

  // Audit log
  await supabase.from('activity_log').insert({
    user_email: auth.email || 'unknown',
    user_type: 'admin',
    action: 'books_bulk_uploaded',
    metadata: { request_id: requestId, inserted, skipped, errors: errors.length, total: items.length },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, inserted, skipped, errors });
}, { auth: 'admin' });
