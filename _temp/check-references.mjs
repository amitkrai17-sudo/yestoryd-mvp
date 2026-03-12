// Check views, triggers, functions, RLS policies referencing specific tables
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = url.match(/https:\/\/(\w+)\./)?.[1];

const queries = {
  views: `SELECT schemaname, viewname, LEFT(definition, 300) as def_preview
    FROM pg_views
    WHERE definition ILIKE '%book_requests%'
       OR definition ILIKE '%reading_goals%'
       OR definition ILIKE '%parent_communications%';`,

  triggers: `SELECT tgname, tgrelid::regclass::text as table_name, tgenabled
    FROM pg_trigger
    WHERE tgrelid IN (
      SELECT oid FROM pg_class WHERE relname IN ('book_requests','reading_goals','parent_communications')
    );`,

  functions: `SELECT proname, LEFT(prosrc, 300) as src_preview
    FROM pg_proc
    WHERE prosrc ILIKE '%book_requests%'
       OR prosrc ILIKE '%reading_goals%'
       OR prosrc ILIKE '%parent_communications%';`,

  rls_policies: `SELECT tablename, policyname, qual::text, with_check::text
    FROM pg_policies
    WHERE tablename IN ('book_requests','reading_goals','parent_communications');`,

  // Also check if these tables are referenced by any FK constraints
  fk_refs: `SELECT
      tc.table_name as referencing_table,
      kcu.column_name as referencing_column,
      ccu.table_name as referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (ccu.table_name IN ('book_requests','reading_goals','parent_communications')
        OR tc.table_name IN ('book_requests','reading_goals','parent_communications'));`,

  // Check last scan times
  scan_stats: `SELECT relname, n_live_tup, seq_scan, last_seq_scan, last_analyze, last_autoanalyze
    FROM pg_stat_user_tables
    WHERE relname IN ('book_requests','reading_goals','parent_communications');`,
};

async function runQuery(label, sql) {
  // Use the Supabase Management API (requires access token)
  // Try the pg endpoint first
  const endpoints = [
    `https://${projectRef}.supabase.co/pg/query`,
    `https://${projectRef}.supabase.co/pg-meta/default/query`,
  ];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'apikey': key,
          'x-connection-encrypted': 'true',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch {}
  }
  return null;
}

// Alternative: use supabase-js to call an RPC if one exists
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Try to create a temporary function, run queries, then drop it
async function main() {
  // First, try creating a temp exec function via PostgREST
  // This won't work because PostgREST can't run DDL.
  // Instead, let's try querying system views directly via PostgREST.

  // pg_views is accessible if exposed in the schema
  // Let's try querying information_schema which IS accessible via PostgREST

  console.log('=== Checking RLS Policies ===');
  // pg_policies is in pg_catalog, not accessible via PostgREST
  // But we can try via the schema API

  // Let's use the Supabase Management API with the access token
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (accessToken) {
    console.log('Using Management API with access token...');
    for (const [label, sql] of Object.entries(queries)) {
      console.log(`\n--- ${label} ---`);
      try {
        const resp = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ query: sql }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`Failed: ${resp.status} ${await resp.text().then(t => t.substring(0, 200))}`);
        }
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
    }
  } else {
    console.log('No SUPABASE_ACCESS_TOKEN found. Trying service role key endpoints...');
    for (const [label, sql] of Object.entries(queries)) {
      console.log(`\n--- ${label} ---`);
      const result = await runQuery(label, sql);
      if (result) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Failed on all endpoints');
      }
    }
  }
}

main().catch(console.error);
