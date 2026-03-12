// Verify which views actually exist by checking for real data or errors
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const names = [
  // Known real tables
  'children', 'parents', 'coaches',
  // Views to check
  'book_requests_view', 'v_book_requests',
  'reading_goals_view', 'v_reading_goals',
  'parent_communications_view', 'v_parent_communications',
  'parent_dashboard_stats', 'child_reading_stats',
  // Definitely fake name
  'xyzzy_nonexistent_table_42',
];

async function main() {
  for (const name of names) {
    const { data, error, count } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true });

    console.log(`${name.padEnd(35)} | error: ${error ? `${error.code} ${error.message.substring(0, 60)}` : 'none'} | count: ${count}`);
  }
}

main().catch(console.error);
