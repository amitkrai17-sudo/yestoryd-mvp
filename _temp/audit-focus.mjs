import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check distinct focus_area values written to learning_events.event_data
const { data, error } = await supabase.rpc('exec_sql', { sql_query: "SELECT DISTINCT event_data->>'focus_area' as fa FROM learning_events WHERE event_data->>'focus_area' IS NOT NULL" });
if (error) {
  // fallback: just get a sample
  const { data: rows } = await supabase.from('learning_events').select('event_data').not('event_data', 'is', null).limit(20);
  const fas = new Set();
  for (const r of rows || []) {
    const fa = r.event_data?.focus_area || r.event_data?.focusArea;
    if (fa) fas.add(fa);
  }
  console.log('Distinct focus_area in learning_events:', [...fas]);
} else {
  console.log(JSON.stringify(data));
}

// Check discovery_calls parent_goals format
const { data: dc } = await supabase.from('discovery_calls').select('parent_goals').not('parent_goals', 'is', null).limit(10);
console.log('\ndiscovery_calls parent_goals samples:');
for (const r of dc || []) {
  if (r.parent_goals && JSON.stringify(r.parent_goals) !== '[]') console.log(JSON.stringify(r.parent_goals));
}

console.log('\nDONE');
