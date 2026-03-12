import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query(label, sql) {
  console.log(`\n=== ${label} ===`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).maybeSingle();
  if (error) {
    // Try direct table query approach instead
    console.log(`RPC failed: ${error.message}`);
    return null;
  }
  console.log(JSON.stringify(data, null, 2));
  return data;
}

// Try using from() for each table instead
async function tableQuery(label, table, select, filters, options) {
  console.log(`\n=== ${label} ===`);
  try {
    let q = supabase.from(table).select(select, options || {});
    if (filters) {
      for (const [method, ...args] of filters) {
        q = q[method](...args);
      }
    }
    const { data, error } = await q;
    if (error) {
      console.log(`ERROR: ${error.message} (code: ${error.code})`);
      return null;
    }
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (e) {
    console.log(`EXCEPTION: ${e.message}`);
    return null;
  }
}

// Q1: Tables with category/skill columns — use information_schema
// This won't work via REST API, so we'll infer from migrations/types

// Q2: el_content_tags
await tableQuery('Q2: el_content_tags distinct tags', 'el_content_tags', 'tag_name, tag_type', [], { count: 'exact', head: false });

// Q3: Tables matching skill/category pattern — infer from code

// Q4: Distinct category values from key tables
await tableQuery('Q4a: scheduled_sessions categories', 'scheduled_sessions', 'category', [], { count: 'exact' });
await tableQuery('Q4b: scheduled_sessions focus_area', 'scheduled_sessions', 'focus_area', []);
await tableQuery('Q4c: session_templates category', 'session_templates', 'category', []);
await tableQuery('Q4d: assessments skill_area', 'assessments', 'skill_area', []);
await tableQuery('Q4e: el_modules category', 'el_modules', 'category', []);
await tableQuery('Q4f: el_learning_units category', 'el_learning_units', 'category', []);
await tableQuery('Q4g: el_content_tags skill tags', 'el_content_tags', 'tag_name', [['eq', 'tag_type', 'skill']]);

// Q5: discovery_calls
await tableQuery('Q5: discovery_calls columns check', 'discovery_calls', '*', [['limit', 1]]);

// Q6: skill_booster_requests or similar
await tableQuery('Q6a: skill_booster_requests', 'skill_booster_requests', 'skill_area', []);
await tableQuery('Q6b: remedial_requests', 'remedial_requests', '*', [['limit', 1]]);

// Q7: assessment results
await tableQuery('Q7a: assessment_results dimension', 'assessment_results', 'dimension', []);
await tableQuery('Q7b: assessment_scores skill_name', 'assessment_scores', 'skill_name', []);

// Q8: communication_templates category
await tableQuery('Q8: communication_templates category', 'communication_templates', 'category', []);

// Q9: site_settings skill/category keys
await tableQuery('Q9: site_settings skill/category', 'site_settings', 'key, value', [['or', 'key.ilike.%category%,key.ilike.%skill%']]);

// Q10: el_badges skill_category
await tableQuery('Q10: el_badges skill_category', 'el_badges', 'skill_category', []);

// Extra: check coach_groups for any skill references
await tableQuery('Extra: coach_session_plans category', 'coach_session_plans', 'category', [['limit', 5]]);
await tableQuery('Extra: learning_events category', 'learning_events', 'category', [['limit', 5]]);
await tableQuery('Extra: session_reports', 'session_reports', 'skills_covered', [['limit', 3]]);

console.log('\n=== DONE ===');
