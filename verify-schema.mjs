#!/usr/bin/env node
/**
 * Verify Mini Challenge schema columns exist
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('Verifying elearning_units schema...\n');

// Try to select with the new columns explicitly
const { data, error } = await supabase
  .from('elearning_units')
  .select('id, name, video_url, is_mini_challenge, goal_area, min_age, max_age')
  .limit(1);

if (error) {
  console.error('❌ Error querying with new columns:');
  console.error('   Message:', error.message);
  console.error('   Code:', error.code);
  console.error('   Details:', error.details);
  console.log('\n⚠️  Columns may not exist yet. Please verify migration ran successfully.');
  process.exit(1);
} else {
  console.log('✅ Successfully queried with all new columns!');
  console.log('   Columns are present in schema.');

  if (data && data.length > 0) {
    console.log('\n📋 Sample record:');
    console.log('   ID:', data[0].id);
    console.log('   Name:', data[0].name);
    console.log('   video_url:', data[0].video_url || '(null)');
    console.log('   is_mini_challenge:', data[0].is_mini_challenge);
    console.log('   goal_area:', data[0].goal_area || '(null)');
  }
}
