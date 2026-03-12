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
    const { data, error, count } = await query;
    if (error) { console.log(`ERROR: ${error.message}`); return null; }
    if (count !== undefined && count !== null) console.log(`COUNT: ${count}`);
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (e) { console.log(`EXCEPTION: ${e.message}`); return null; }
}

// el_skills - get actual columns
await q('el_skills', 'el_skills', 'id, name, scope, is_active, module_id', [['eq','is_active',true]]);

// el_modules - get actual columns
await q('el_modules', 'el_modules', 'id, name, is_active', [['eq','is_active',true]]);

// el_learning_units goal_area values
await q('el_learning_units goal_areas', 'el_learning_units', 'goal_area', [['not', 'goal_area', 'is', null], ['limit', 20]]);

// mini_challenge_content
await q('mini_challenge_content', 'mini_challenge_content', 'id, title, goal_area, skill_tag', [['limit', 10]]);

// children learning_goals
await q('children learning_goals', 'children', 'id, learning_goals', [['not', 'learning_goals', 'eq', '[]'], ['limit', 5]]);

// discovery_calls parent_goals
await q('discovery_calls parent_goals', 'discovery_calls', 'id, parent_goals', [['not', 'parent_goals', 'eq', '[]'], ['limit', 5]]);

// Count records in key tables
await q('scheduled_sessions focus_area distinct', 'scheduled_sessions', 'focus_area', [['not', 'focus_area', 'is', null]]);

// session_templates check
await q('session_templates columns', 'session_templates', '*', [['limit', 1]]);

// communication_templates check
await q('communication_templates columns', 'communication_templates', '*', [['limit', 1]]);

console.log('\n=== DONE ===');
