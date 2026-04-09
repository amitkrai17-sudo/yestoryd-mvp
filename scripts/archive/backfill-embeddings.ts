// scripts/backfill-embeddings.ts
// One-time script to backfill missing embeddings on learning_events.
// Run with: npx tsx scripts/backfill-embeddings.ts

import 'dotenv/config';
import { createAdminClient } from '../lib/supabase/admin';
import { generateEmbedding } from '../lib/rai/embeddings';

async function main() {
  const supabase = createAdminClient();

  // Fetch rows missing embeddings but having content
  const { data: rows, error } = await supabase
    .from('learning_events')
    .select('id, content_for_embedding')
    .is('embedding', null)
    .not('content_for_embedding', 'is', null)
    .neq('content_for_embedding', '')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch rows:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} rows to backfill.`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const embedding = await generateEmbedding(row.content_for_embedding!);
      const { error: updateErr } = await supabase
        .from('learning_events')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`[FAIL] ${row.id}: ${updateErr.message}`);
        failed++;
      } else {
        console.log(`[OK]   ${row.id}`);
        success++;
      }
    } catch (err) {
      console.error(`[FAIL] ${row.id}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
