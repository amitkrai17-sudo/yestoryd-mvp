// One-off script: Backfill embeddings for learning_events and el_content_items missing them
// Usage: npx tsx scripts/backfill-missing-embeddings.ts

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSION = 768;

async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSION,
  } as Parameters<typeof model.embedContent>[0]);
  return result.embedding.values;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey || !process.env.GEMINI_API_KEY) {
    console.error('Missing env vars');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- 1. learning_events missing embeddings ---
  console.log('\n=== learning_events ===');
  const { data: events, error: evErr } = await supabase
    .from('learning_events')
    .select('id, event_type, event_data, ai_summary, child_id')
    .is('embedding', null);

  if (evErr) { console.error('Fetch error:', evErr.message); process.exit(1); }

  for (const ev of events || []) {
    // Build searchable text from event_data (extract string values)
    const parts: string[] = [`${ev.event_type} event`];
    const data = ev.event_data as Record<string, unknown> || {};

    // For progress_pulse, use the rich text fields
    if (ev.event_type === 'progress_pulse') {
      if (data.headline) parts.push(String(data.headline));
      if (data.improving) parts.push(String(data.improving));
      if (data.worked_on) parts.push(String(data.worked_on));
      if (data.focus_areas) parts.push(String(data.focus_areas));
      if (data.home_practice) parts.push(String(data.home_practice));
      if (Array.isArray(data.strengths)) parts.push(`strengths: ${data.strengths.join(', ')}`);
    } else if (ev.event_type === 'daily_recommendations') {
      if (data.focus && typeof data.focus === 'object') {
        const focus = data.focus as Record<string, unknown>;
        if (focus.area) parts.push(`focus: ${focus.area}`);
        if (focus.reason) parts.push(String(focus.reason));
      }
      if (Array.isArray(data.carousel)) {
        const titles = data.carousel.map((c: Record<string, unknown>) => c.title).filter(Boolean);
        if (titles.length) parts.push(`content: ${titles.join(', ')}`);
      }
    } else {
      // Generic: extract string values
      Object.values(data).forEach(v => {
        if (typeof v === 'string' && v.length > 0 && v.length < 500) parts.push(v);
      });
    }
    if (ev.ai_summary) parts.push(ev.ai_summary);

    const text = parts.join(' ').trim();
    if (text.length < 10) {
      console.log(`  Skipping ${ev.id} (${ev.event_type}) — text too short: "${text}"`);
      continue;
    }

    try {
      const embedding = await generateEmbedding(text);
      const { error } = await supabase
        .from('learning_events')
        .update({ embedding, content_for_embedding: text })
        .eq('id', ev.id);
      if (error) throw new Error(error.message);
      console.log(`  Embedded ${ev.event_type} (${ev.id}) — ${text.length} chars`);
    } catch (err) {
      console.error(`  Failed ${ev.id}:`, (err as Error).message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // --- 2. el_content_items missing embeddings ---
  console.log('\n=== el_content_items ===');
  const { data: items, error: ciErr } = await supabase
    .from('el_content_items')
    .select('id, title, description, search_text, content_type')
    .is('embedding', null);

  if (ciErr) { console.error('Fetch error:', ciErr.message); process.exit(1); }

  for (const item of items || []) {
    const text = item.search_text || `${item.title || ''} ${item.description || ''}`.trim();
    if (text.length < 10) {
      console.log(`  Skipping ${item.id} (${item.title}) — text too short`);
      continue;
    }

    try {
      const embedding = await generateEmbedding(text);
      const updateData: Record<string, unknown> = { embedding };
      if (!item.search_text) updateData.search_text = text;
      const { error } = await supabase
        .from('el_content_items')
        .update(updateData)
        .eq('id', item.id);
      if (error) throw new Error(error.message);
      console.log(`  Embedded "${item.title}" (${item.id}) — ${text.length} chars`);
    } catch (err) {
      console.error(`  Failed ${item.id}:`, (err as Error).message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // --- 3. Final counts ---
  console.log('\n=== Final Verification ===');
  const checks = [
    { table: 'learning_events', col: 'embedding' },
    { table: 'el_content_items', col: 'embedding' },
    { table: 'el_learning_units', col: 'embedding' },
    { table: 'books', col: 'embedding' },
  ];
  for (const { table, col } of checks) {
    const { count: total } = await supabase.from(table).select('id', { count: 'exact', head: true });
    const { count: withEmb } = await supabase.from(table).select('id', { count: 'exact', head: true }).not(col, 'is', null);
    console.log(`  ${table}: ${withEmb}/${total} embedded`);
  }
}

main().catch(console.error);
