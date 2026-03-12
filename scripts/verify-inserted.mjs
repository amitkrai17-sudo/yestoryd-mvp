#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

const { data, error } = await supabase
  .from('elearning_units')
  .select('id, name, goal_area, min_age, max_age')
  .eq('is_mini_challenge', true)
  .order('goal_area, min_age');

if (error) {
  console.error('Error:', error);
} else {
  console.log('\n📋 Mini Challenge Videos:\n');
  data.forEach(mc => {
    console.log(`${mc.name}`);
    console.log(`  ID: ${mc.id}`);
    console.log(`  Goal: ${mc.goal_area} | Ages: ${mc.min_age}-${mc.max_age}\n`);
  });
  console.log(`Total: ${data.length} videos\n`);
}
