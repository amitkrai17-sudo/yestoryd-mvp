#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

const { data: subSkills, error } = await supabase
  .from('sub_skills')
  .select('id, name, skill_id')
  .limit(5);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${subSkills?.length || 0} sub_skills:`);
  subSkills?.forEach(ss => {
    console.log(`  - ${ss.name} (ID: ${ss.id})`);
  });
}
