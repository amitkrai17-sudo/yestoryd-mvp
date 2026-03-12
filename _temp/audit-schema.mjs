// Schema audit — creates temp exec_sql function, runs queries, drops it
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create a temporary function to execute SQL
async function setupExecSQL() {
  const { error } = await supabase.rpc('exec_sql_audit', { sql_query: 'SELECT 1' }).catch(() => ({ error: { message: 'not found' } }));

  // Function doesn't exist, create it
  // We need to use the supabase-js to call a function that already exists
  // Let's try using the .from() approach with a view or use fetch directly

  // Use the Supabase Management API to run SQL
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(\w+)\./)?.[1];
  if (!projectRef) throw new Error('Cannot extract project ref from URL');

  console.log('Project ref:', projectRef);

  // Try using the Supabase SQL API (undocumented but works)
  const sqlApiUrl = `https://${projectRef}.supabase.co/rest/v1/`;

  return projectRef;
}

// Use fetch to hit the PostgREST endpoint and run SQL via a temporary function
async function createAndRunSQL(queries) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Step 1: Create the exec function via PostgREST
  // We can't create functions via PostgREST. Let's use a different approach.
  // Use supabase-js to query pg_stat tables which ARE accessible via PostgREST
  // if we query information_schema views.

  // Actually — Supabase exposes pg_stat_user_tables as a view through PostgREST
  // if we use the right schema. Let's try querying via SQL using the
  // supabase dashboard API.

  // Best approach: use the Supabase SQL Editor API
  const projectRef = url.match(/https:\/\/(\w+)\./)?.[1];

  // Use the Management API with service role key for SQL execution
  // The correct endpoint is the pg-meta API
  const results = {};

  for (const [label, sql] of Object.entries(queries)) {
    console.log(`\nRunning: ${label}...`);
    try {
      const resp = await fetch(
        `https://${projectRef}.supabase.co/pg/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-connection-encrypted': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({ query: sql }),
        }
      );

      if (!resp.ok) {
        // Try alternate pg-meta endpoint
        const resp2 = await fetch(
          `https://${projectRef}.supabase.co/pg-meta/default/query`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
              'x-connection-encrypted': 'true',
            },
            body: JSON.stringify({ query: sql }),
          }
        );

        if (!resp2.ok) {
          const errText = await resp2.text();
          console.error(`  Failed: ${resp2.status} - ${errText.substring(0, 200)}`);
          results[label] = { error: errText.substring(0, 200) };
          continue;
        }

        results[label] = await resp2.json();
        console.log(`  OK: ${JSON.stringify(results[label]).substring(0, 150)}...`);
        continue;
      }

      results[label] = await resp.json();
      console.log(`  OK: ${JSON.stringify(results[label]).substring(0, 150)}...`);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      results[label] = { error: err.message };
    }
  }

  return results;
}

async function main() {
  const queries = {
    // 1. All tables with row counts
    table_stats: `
      SELECT
        schemaname,
        relname as table_name,
        n_live_tup as row_count,
        last_autoanalyze,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname;
    `,

    // 2. Similar table names
    similar_names: `
      SELECT a.relname as table_a, b.relname as table_b,
             similarity(a.relname, b.relname) as sim_score
      FROM pg_stat_user_tables a
      CROSS JOIN pg_stat_user_tables b
      WHERE a.schemaname = 'public' AND b.schemaname = 'public'
        AND a.relname < b.relname
        AND similarity(a.relname, b.relname) > 0.5
      ORDER BY sim_score DESC
      LIMIT 30;
    `,

    // 3. Column overlap between tables
    column_overlap: `
      WITH table_columns AS (
        SELECT table_name, array_agg(column_name::text ORDER BY column_name) as cols,
               count(*) as col_count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
      )
      SELECT
        a.table_name as table_a,
        b.table_name as table_b,
        a.col_count as cols_a,
        b.col_count as cols_b,
        (SELECT count(*) FROM unnest(a.cols) x JOIN unnest(b.cols) y ON x = y) as shared_cols,
        ROUND(
          (SELECT count(*) FROM unnest(a.cols) x JOIN unnest(b.cols) y ON x = y)::numeric /
          LEAST(a.col_count, b.col_count) * 100
        ) as overlap_pct
      FROM table_columns a
      CROSS JOIN table_columns b
      WHERE a.table_name < b.table_name
        AND a.col_count >= 3 AND b.col_count >= 3
      HAVING (SELECT count(*) FROM unnest(a.cols) x JOIN unnest(b.cols) y ON x = y)::numeric /
             LEAST(a.col_count, b.col_count) * 100 >= 70
      ORDER BY overlap_pct DESC
      LIMIT 30;
    `,

    // 4. Empty tables
    empty_tables: `
      SELECT relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public' AND n_live_tup = 0
      ORDER BY relname;
    `,

    // 5. Orphan tables (not referenced by any FK)
    orphan_tables: `
      WITH fk_targets AS (
        SELECT DISTINCT ccu.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
      ),
      all_tables AS (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      )
      SELECT at.tablename as table_name
      FROM all_tables at
      LEFT JOIN fk_targets ft ON at.tablename = ft.table_name
      WHERE ft.table_name IS NULL
      ORDER BY at.tablename;
    `,

    // 6. Tables without RLS
    no_rls: `
      SELECT tablename as table_name, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND rowsecurity = false
      ORDER BY tablename;
    `,

    // 7. All public tables (for cross-ref with TS types)
    all_tables: `
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `,
  };

  const results = await createAndRunSQL(queries);

  // Save raw results
  fs.writeFileSync('_temp/audit-raw.json', JSON.stringify(results, null, 2));
  console.log('\n\nRaw results saved to _temp/audit-raw.json');
}

main().catch(console.error);
