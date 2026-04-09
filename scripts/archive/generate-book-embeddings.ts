// One-off script: Generate embeddings for books missing them
// Usage: npx tsx scripts/generate-book-embeddings.ts
// Safe: only processes books where embedding IS NULL

import { createClient } from '@supabase/supabase-js';
import { batchGenerateBookEmbeddings, type Book } from '../lib/books/generate-book-embedding';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch books missing embeddings
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, author, description, skills_targeted, themes, reading_level, age_min, age_max')
    .eq('is_active', true)
    .is('embedding', null);

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  if (!books || books.length === 0) {
    console.log('All books already have embeddings.');
    return;
  }

  console.log(`Found ${books.length} books missing embeddings. Generating...`);

  const result = await batchGenerateBookEmbeddings(books as Book[], supabase);

  console.log(`Done. Success: ${result.success}, Failed: ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('Errors:', JSON.stringify(result.errors, null, 2));
  }
}

main().catch(console.error);
