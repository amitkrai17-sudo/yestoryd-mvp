// file: lib/books/generate-book-embedding.ts
// Book embedding generation utilities
// Uses shared generateEmbedding() from lib/rai/embeddings.ts (gemini-embedding-001, 768-dim)

import { generateEmbedding } from '@/lib/rai/embeddings';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  skills_targeted: string[] | null;
  themes: string[] | null;
  reading_level: string | null;
  age_min: number | null;
  age_max: number | null;
}

interface BatchError {
  id: string;
  title: string;
  error: string;
}

interface BatchResult {
  success: number;
  failed: number;
  errors: BatchError[];
}

/**
 * Build searchable text for a book, optimized for semantic embedding.
 * Handles null/undefined fields gracefully.
 */
export function buildBookSearchableText(book: Book): string {
  const parts: string[] = [];

  parts.push(`${book.title || 'Untitled'} by ${book.author || 'Unknown'}`);

  if (book.description) {
    parts.push(book.description);
  }

  if (book.skills_targeted?.length) {
    parts.push(`Skills: ${book.skills_targeted.join(', ')}`);
  }

  if (book.themes?.length) {
    parts.push(`Themes: ${book.themes.join(', ')}`);
  }

  if (book.reading_level) {
    parts.push(`Level: ${book.reading_level}`);
  }

  if (book.age_min != null && book.age_max != null) {
    parts.push(`Ages ${book.age_min}-${book.age_max}`);
  } else if (book.age_min != null) {
    parts.push(`Ages ${book.age_min}+`);
  } else if (book.age_max != null) {
    parts.push(`Ages up to ${book.age_max}`);
  }

  return parts.join('. ').trim();
}

/**
 * Generate a 768-dim embedding vector for a single book.
 * Builds searchable text from book metadata, then calls the shared embedding function.
 */
export async function generateBookEmbedding(book: Book): Promise<number[]> {
  const text = buildBookSearchableText(book);
  return generateEmbedding(text);
}

/**
 * Batch-generate embeddings for multiple books and persist to the `books` table.
 *
 * - Processes 10 books at a time
 * - 500ms delay between batches for rate limiting
 * - Isolated try/catch per book so one failure does not stop the batch
 */
export async function batchGenerateBookEmbeddings(
  books: Book[],
  supabase: SupabaseClient
): Promise<BatchResult> {
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 500;

  let success = 0;
  let failed = 0;
  const errors: BatchError[] = [];

  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (book) => {
        const embedding = await generateBookEmbedding(book);

        const { error } = await supabase
          .from('books')
          .update({ embedding })
          .eq('id', book.id);

        if (error) {
          throw new Error(`Supabase update failed: ${error.message}`);
        }

        return book.id;
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        success++;
      } else {
        failed++;
        errors.push({
          id: batch[j].id,
          title: batch[j].title,
          error: result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        });
      }
    }

    // Rate-limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < books.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return { success, failed, errors };
}
