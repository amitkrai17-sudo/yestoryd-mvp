// Check what references book_requests, reading_goals, parent_communications
// Uses Supabase JS to query accessible system views + direct table checks
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = ['book_requests', 'reading_goals', 'parent_communications'];

async function main() {
  // 1. Check if tables actually exist by trying to query them
  console.log('=== 1. Table existence check ===\n');
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${table}: ${error.code === '42P01' ? 'TABLE DOES NOT EXIST' : error.message}`);
    } else {
      console.log(`  ${table}: EXISTS (count query succeeded)`);
    }
  }

  // 2. Check FK constraints via information_schema (accessible via PostgREST)
  console.log('\n=== 2. Foreign key references ===\n');
  for (const table of TABLES) {
    // FKs pointing TO this table
    let fksTo = null;
    try {
      const { data } = await supabase.rpc('get_fks_to_table', { target_table: table });
      fksTo = data;
    } catch {}

    // Try information_schema approach - columns that reference these tables
    // information_schema.referential_constraints might not be exposed
    // Let's try querying the table's columns for FK info
    const { data: cols } = await supabase
      .from(table)
      .select('*')
      .limit(0);

    if (cols !== null) {
      console.log(`  ${table}: table is accessible`);
    }
  }

  // 3. Check RLS policies by trying to query as anon vs service role
  console.log('\n=== 3. RLS policy check (anon access test) ===\n');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  for (const table of TABLES) {
    const { data, error } = await anonClient.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42501') {
        console.log(`  ${table}: RLS ENABLED (permission denied for anon)`);
      } else if (error.code === '42P01') {
        console.log(`  ${table}: TABLE DOES NOT EXIST`);
      } else {
        console.log(`  ${table}: ${error.code} - ${error.message}`);
      }
    } else {
      console.log(`  ${table}: RLS OFF or allows anon select`);
    }
  }

  // 4. Check if there's a view with same name pattern
  console.log('\n=== 4. Check related views ===\n');
  const viewNames = [
    'book_requests_view', 'v_book_requests',
    'reading_goals_view', 'v_reading_goals',
    'parent_communications_view', 'v_parent_communications',
    'parent_dashboard_stats', 'child_reading_stats',
  ];
  for (const vn of viewNames) {
    const { error } = await supabase.from(vn).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`  ${vn}: EXISTS`);
    }
  }
  console.log('  (checked 8 view name patterns - any found are listed above)');

  // 5. Try to get column info for each table
  console.log('\n=== 5. Table columns ===\n');
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ${table}: ${error.message}`);
    } else if (data && data.length === 0) {
      // Get columns by selecting empty
      const { data: d2 } = await supabase.from(table).select('*').limit(0);
      // PostgREST returns empty array, but we can check the columns via OPTIONS or just try
      console.log(`  ${table}: empty (0 rows)`);
    }
  }

  // 6. Check if any Supabase Edge Functions or triggers exist
  // by looking at the local codebase
  console.log('\n=== 6. Checking migrations for triggers/functions ===');

  // Read all migration files to find references
  const fs = await import('fs');
  const path = await import('path');
  const migrationsDir = 'supabase/migrations';

  let migrationFiles;
  try {
    migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  } catch {
    migrationFiles = [];
  }

  for (const table of TABLES) {
    const refs = [];
    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (content.toLowerCase().includes(table)) {
        // Find the specific lines
        const lines = content.split('\n');
        const matchingLines = lines
          .map((l, i) => ({ line: i + 1, text: l.trim() }))
          .filter(l => l.text.toLowerCase().includes(table) && !l.text.startsWith('--'));

        if (matchingLines.length > 0) {
          refs.push({ file, lines: matchingLines.map(l => `L${l.line}: ${l.text.substring(0, 120)}`) });
        }
      }
    }

    console.log(`\n  ${table}:`);
    if (refs.length === 0) {
      console.log('    No migration references found');
    } else {
      for (const r of refs) {
        console.log(`    ${r.file}:`);
        for (const l of r.lines) {
          console.log(`      ${l}`);
        }
      }
    }
  }

  // 7. Final: get the actual schema for these tables from the types file
  console.log('\n=== 7. TypeScript type definitions ===\n');
  const typesContent = fs.readFileSync('lib/database.types.ts', 'utf8').replace(/\r\n/g, '\n');

  for (const table of TABLES) {
    const regex = new RegExp(`^\\s+${table}:\\s*\\{[\\s\\S]*?^\\s+\\}`, 'gm');
    // Simpler: find the table section
    const startIdx = typesContent.indexOf(`      ${table}: {`);
    if (startIdx === -1) {
      console.log(`  ${table}: NOT in database.types.ts`);
      continue;
    }

    // Extract the Row type
    const rowStart = typesContent.indexOf('Row: {', startIdx);
    const insertStart = typesContent.indexOf('Insert: {', startIdx);
    if (rowStart !== -1 && insertStart !== -1) {
      const rowSection = typesContent.substring(rowStart, insertStart).trim();
      const columns = rowSection.match(/^\s+(\w+):/gm);
      if (columns) {
        console.log(`  ${table}: ${columns.length} columns`);
        console.log(`    Columns: ${columns.map(c => c.trim().replace(':', '')).join(', ')}`);
      }
    }
  }
}

main().catch(console.error);
