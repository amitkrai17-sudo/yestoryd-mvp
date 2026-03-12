import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function q(label, table, select, filters) {
  console.log(`\n=== ${label} ===`);
  try {
    let query = supabase.from(table).select(select);
    if (filters) for (const [m, ...a] of filters) query = query[m](...a);
    const { data, error } = await query;
    if (error) { console.log(`ERROR: ${error.message}`); return null; }
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (e) { console.log(`EXCEPTION: ${e.message}`); return null; }
}

// el_skills table
await q('el_skills (all)', 'el_skills', 'id, name, slug, module_id, scope, is_active, sort_order', [['eq','is_active',true],['order','sort_order']]);

// el_modules table  
await q('el_modules (all)', 'el_modules', 'id, name, slug, is_active, sort_order', [['eq','is_active',true],['order','sort_order']]);

// el_content_tags - check actual columns
await q('el_content_tags sample', 'el_content_tags', '*', [['limit', 10]]);

// el_badges 
await q('el_badges sample', 'el_badges', '*', [['limit', 5]]);

// el_learning_units
await q('el_learning_units sample', 'el_learning_units', '*', [['limit', 3]]);

// scheduled_sessions — check actual columns for category-like fields
await q('scheduled_sessions columns', 'scheduled_sessions', 'id, session_type, focus_area, status', [['limit', 5], ['not', 'focus_area', 'is', null]]);

// learning_events — check columns
await q('learning_events sample', 'learning_events', '*', [['limit', 2]]);

// session_activity_log for skill references
await q('session_activity_log sample', 'session_activity_log', '*', [['limit', 2]]);

// Check parent_goals on discovery_calls
await q('discovery_calls parent_goals', 'discovery_calls', 'id, parent_goals', [['not', 'parent_goals', 'eq', '[]'], ['limit', 5]]);

// mini_challenge_content or similar
await q('mini_challenge_content', 'mini_challenge_content', '*', [['limit', 3]]);

// Check what's in children table for any skill/goal references
await q('children skill refs', 'children', 'id, learning_goals, age', [['limit', 3]]);

console.log('\n=== DONE ===');
